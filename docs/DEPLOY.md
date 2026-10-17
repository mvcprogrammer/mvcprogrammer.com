# Deploying mvcprogrammer.com

The site follows the KISS principle. Plain HTML, CSS, and vanilla JavaScript. No framework, no build step, no backend. Hosted as static files on Amazon S3 behind CloudFront. This is the infrastructure walkthrough that used to live in the README.

## Files

```
index.html                  the single page
404.html                    small not-found page, served by CloudFront for any missing path
privacy.html, terms.html    privacy policy and SMS terms (required for the toll-free SMS registration)
styles.css                  mobile-first styles shared by all four editions, light/dark via prefers-color-scheme
vanilla.css                 eggshell palette override for this edition (design tokens only, loaded after styles.css)
main.js                     nav toggle, active-section highlighting, footer year, image fallback
favicon.svg                 tab icon (follows dark mode)
favicon.ico, apple-touch-icon.png  raster fallbacks rendered from favicon.svg (16/32/48 px ICO, 180 px PNG)
site.webmanifest
robots.txt
sitemap.xml
assets/fonts/               self-hosted Inter and JetBrains Mono (latin subset) plus their OFL licenses
assets/images/              og-image.jpg social preview and portfolio/ card images
infra/lambda/resume-download/  Lambda that texts you and redirects to the resume PDF (see Resume download)
infra/lambda/contact/       Lambda behind the contact form, emails you through SES (see Contact form)
.github/workflows/deploy.yml  optional: sync to S3 and invalidate CloudFront on push to main
```

## Preview locally

In Rider, pick **Serve site locally** from the run configurations (shared in `.run/`) and press Run. It serves the repo root at http://127.0.0.1:8080 and opens it in the browser. Note the resume button still points at the live Lambda URL, so clicking it locally sends a real download notification.

From a terminal, any static file server works. With Python:

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

## Before you deploy

The resume PDF is not in the repo; see [Resume download](#resume-download). Update `<lastmod>` in `sitemap.xml` when content changes.

## Deploy to S3 + CloudFront

The bucket stays private. CloudFront reads from it through Origin Access Control (OAC), serves it over HTTPS with an ACM certificate, and Route 53 points the domain at the distribution. Replace the placeholders in angle brackets. All commands assume the AWS CLI v2 is installed and configured.

### 1. Private S3 bucket

```sh
aws s3api create-bucket --bucket mvcprogrammer.com --region us-east-1
aws s3api put-public-access-block --bucket mvcprogrammer.com \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Do not enable static website hosting on the bucket. CloudFront will use the S3 REST endpoint, which is what OAC requires.

### 2. ACM certificate (must be in us-east-1)

CloudFront only accepts certificates from `us-east-1`, regardless of where the bucket lives.

```sh
aws acm request-certificate --region us-east-1 \
  --domain-name mvcprogrammer.com \
  --subject-alternative-names www.mvcprogrammer.com \
  --validation-method DNS
```

Take the CNAME name/value pairs from `aws acm describe-certificate` and add them to the hosted zone (the ACM console has a "Create records in Route 53" button that does this in one click). Wait until the certificate status is `ISSUED`.

### 3. Origin Access Control

```sh
aws cloudfront create-origin-access-control --origin-access-control-config \
  Name=mvcprogrammer-s3-oac,OriginAccessControlOriginType=s3,SigningBehavior=always,SigningProtocol=sigv4
```

Note the returned `Id`.

### 4. CloudFront distribution

The console is the least error-prone way to create the distribution. Use these settings:

| Setting | Value |
| --- | --- |
| Origin domain | `mvcprogrammer.com.s3.us-east-1.amazonaws.com` (the REST endpoint, not the website endpoint) |
| Origin access | Origin access control settings, pick the OAC from step 3 |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Allowed HTTP methods | GET, HEAD |
| Cache policy | CachingOptimized |
| Compress objects automatically | Yes |
| Alternate domain names (CNAMEs) | `mvcprogrammer.com`, `www.mvcprogrammer.com` |
| Custom SSL certificate | the ACM certificate from step 2 |
| Default root object | `index.html` |
| HTTP versions | HTTP/2 and HTTP/3 |
| Security policy (TLS) | TLSv1.2_2021 |
| Response headers policy | the custom policy from step 4a below |

Under Error pages, map both HTTP 403 and HTTP 404 to response code 404 with response page path `/404.html` and an error caching minimum TTL of 300 seconds. With OAC, S3 answers 403 for missing keys, so this turns "not found" into the small 404 page (about 3 KB) instead of an S3 XML error or the full home page, and the five-minute error TTL keeps scanner probes for the same path from reaching the origin again. From the CLI, fetch the config with `aws cloudfront get-distribution-config --id <DISTRIBUTION_ID>`, set `DistributionConfig.CustomErrorResponses` to the block below, and send it back with `aws cloudfront update-distribution --id <DISTRIBUTION_ID> --if-match <ETag> --distribution-config file://config.json`.

```json
{
  "Quantity": 2,
  "Items": [
    { "ErrorCode": 403, "ResponseCode": "404", "ResponsePagePath": "/404.html", "ErrorCachingMinTTL": 300 },
    { "ErrorCode": 404, "ResponseCode": "404", "ResponsePagePath": "/404.html", "ErrorCachingMinTTL": 300 }
  ]
}
```

Every URL in `404.html` is root-relative (`/styles.css`, not `styles.css`) because CloudFront serves it at whatever path was requested, including nested ones.

**Use an AWS CLI released after August 2022 (v2.7.x and earlier predate OAC).** An older CLI does not know the `OriginAccessControlId` field, so `get-distribution-config` silently drops it and the following `update-distribution` detaches the OAC from the origin. Every request then gets S3's `AccessDenied` XML until the OAC is put back (console: Origins > Edit > Origin access, or `update-distribution` from a current CLI or boto3) and the cache is invalidated. Check with `aws --version` before any distribution update.

After creating the distribution, the console shows a "copy policy" banner for the bucket. Apply it, or use this policy (fill in the account ID and distribution ID):

```sh
cat > bucket-policy.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontServicePrincipalReadOnly",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::mvcprogrammer.com/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
      }
    }
  }]
}
JSON
aws s3api put-bucket-policy --bucket mvcprogrammer.com --policy file://bucket-policy.json
```

### 4a. Security headers

S3 and CloudFront send no security headers on their own. Create a response headers policy once and attach it to the distribution's default behavior. The CSP below matches what the page actually loads: same-origin scripts, styles, fonts, and images, nothing inline, nothing third-party.

```sh
cat > headers-policy.json <<'JSON'
{
  "Name": "mvcprogrammer-security-headers",
  "Comment": "HSTS, CSP, and friends for the static site",
  "SecurityHeadersConfig": {
    "StrictTransportSecurity": { "Override": true, "AccessControlMaxAgeSec": 63072000, "IncludeSubdomains": true, "Preload": false },
    "ContentTypeOptions": { "Override": true },
    "FrameOptions": { "Override": true, "FrameOption": "DENY" },
    "ReferrerPolicy": { "Override": true, "ReferrerPolicy": "strict-origin-when-cross-origin" },
    "ContentSecurityPolicy": {
      "Override": true,
      "ContentSecurityPolicy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; frame-src https://display.lightsplitters.com; upgrade-insecure-requests"
    }
  },
  "CustomHeadersConfig": {
    "Quantity": 1,
    "Items": [
      { "Header": "Permissions-Policy", "Value": "camera=(), microphone=(), geolocation=(), payment=(), usb=()", "Override": true }
    ]
  }
}
JSON
aws cloudfront create-response-headers-policy --response-headers-policy-config file://headers-policy.json
```

Attach the returned policy ID to the default cache behavior (console: Behaviors > Edit > Response headers policy). The inline JSON-LD block in `index.html` is a data block, not executable script, so `script-src 'self'` does not affect it. If you ever add an inline `<script>` or `style=""` attribute, the CSP will block it; move the code into `main.js` or `styles.css` instead.

`Preload` is left off on purpose. Turning it on and submitting the domain to hstspreload.org is a one-way door: browsers will then refuse plain HTTP for the domain and every subdomain, including the mail-related hostnames in the zone. Enable it only once you are sure nothing under mvcprogrammer.com will ever need HTTP.

### 4b. Redirect www to the apex (optional)

Both hostnames point at the same distribution, so without a redirect the site is reachable at two URLs. A CloudFront Function on viewer-request fixes that. The same function answers the engagement beacon (`GET /ping`, see [Visitor stats](#visitor-stats)) with an empty 204 at the edge, so those requests are logged but never reach S3. The code is checked in at [infra/cloudfront/www-redirect.js](../infra/cloudfront/www-redirect.js).

Create it under CloudFront > Functions as `mvcprogrammer-www-redirect` (runtime `cloudfront-js-2.0`), publish it, and associate it with the viewer request event of the default behavior and of the `/api/*` behavior. To change it later, update the DEVELOPMENT stage, test it, then publish; each call needs the stage's current ETag:

```sh
ETAG=$(aws cloudfront describe-function --name mvcprogrammer-www-redirect --stage DEVELOPMENT --query ETag --output text)
ETAG=$(aws cloudfront update-function --name mvcprogrammer-www-redirect --if-match "$ETAG" \
  --function-config '{"Comment":"301 www to apex; 204 for the /ping engagement beacon","Runtime":"cloudfront-js-2.0"}' \
  --function-code fileb://infra/cloudfront/www-redirect.js --query ETag --output text)
aws cloudfront test-function --name mvcprogrammer-www-redirect --if-match "$ETAG" --stage DEVELOPMENT --event-object fileb://event.json
aws cloudfront publish-function --name mvcprogrammer-www-redirect --if-match "$ETAG"
```

A published function takes effect within a few seconds; no invalidation is needed. The same function is associated with the default behavior of the Blazor, Angular, and React distributions too (since 2026-10-15 and 2026-10-16), so `/ping` is answered on every edition; the `www` branch never matches there.

### 5. Route 53 records

In the hosted zone for `mvcprogrammer.com`, create alias records pointing at the distribution. CloudFront's hosted zone ID is always `Z2FDTNDATAQYW2`.

```sh
cat > records.json <<'JSON'
{
  "Comment": "Point apex and www at CloudFront",
  "Changes": [
    { "Action": "UPSERT", "ResourceRecordSet": {
        "Name": "mvcprogrammer.com", "Type": "A",
        "AliasTarget": { "HostedZoneId": "Z2FDTNDATAQYW2", "DNSName": "<DISTRIBUTION_DOMAIN>.cloudfront.net", "EvaluateTargetHealth": false } } },
    { "Action": "UPSERT", "ResourceRecordSet": {
        "Name": "mvcprogrammer.com", "Type": "AAAA",
        "AliasTarget": { "HostedZoneId": "Z2FDTNDATAQYW2", "DNSName": "<DISTRIBUTION_DOMAIN>.cloudfront.net", "EvaluateTargetHealth": false } } },
    { "Action": "UPSERT", "ResourceRecordSet": {
        "Name": "www.mvcprogrammer.com", "Type": "A",
        "AliasTarget": { "HostedZoneId": "Z2FDTNDATAQYW2", "DNSName": "<DISTRIBUTION_DOMAIN>.cloudfront.net", "EvaluateTargetHealth": false } } },
    { "Action": "UPSERT", "ResourceRecordSet": {
        "Name": "www.mvcprogrammer.com", "Type": "AAAA",
        "AliasTarget": { "HostedZoneId": "Z2FDTNDATAQYW2", "DNSName": "<DISTRIBUTION_DOMAIN>.cloudfront.net", "EvaluateTargetHealth": false } } }
  ]
}
JSON
aws route53 change-resource-record-sets --hosted-zone-id <HOSTED_ZONE_ID> --change-batch file://records.json
```

Once the old EC2 / load balancer records are replaced, the ALB, auto scaling group, and instances can be deleted.

### 6. Upload and redeploy

Cache headers use `s-maxage` so CloudFront caches aggressively while browsers re-check within minutes. The invalidation at the end clears CloudFront on every deploy.

```sh
# Long-lived images
aws s3 sync assets/ s3://mvcprogrammer.com/assets/ --delete \
  --cache-control "public, max-age=604800, s-maxage=31536000" \
  --exclude "README.md" --exclude "*/README.md" --exclude "*.gitkeep"

# Everything else (HTML, CSS, JS, icons, sitemap, robots)
aws s3 sync . s3://mvcprogrammer.com/ --delete \
  --cache-control "public, max-age=300, s-maxage=31536000" \
  --exclude "*" \
  --include "index.html" --include "privacy.html" --include "terms.html" --include "404.html" \
  --include "styles.css" --include "vanilla.css" --include "main.js" \
  --include "favicon.svg" --include "favicon.ico" --include "apple-touch-icon.png" --include "site.webmanifest" \
  --include "robots.txt" --include "sitemap.xml" --include "assets/*" \
  --exclude "assets/README.md" --exclude "assets/*/README.md" --exclude "*.gitkeep"

# The CLI does not know the .webmanifest MIME type
aws s3 cp site.webmanifest s3://mvcprogrammer.com/site.webmanifest \
  --content-type "application/manifest+json" \
  --cache-control "public, max-age=300, s-maxage=31536000"

aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

The `--include "assets/*"` in the second sync keeps `--delete` from removing the assets uploaded in the first step. The second sync will re-upload changed assets with the shorter browser TTL only if they changed between the two commands, which does not happen in practice.

### 4c. Live kiosk demo (frame-src)

The portfolio's "Try the live kiosk" button opens display.lightsplitters.com in an iframe inside a `<dialog>`.
`default-src 'self'` would block that, so the CSP on the response headers policy carries one extra directive,
`frame-src https://display.lightsplitters.com` (added 2026-10-08). The kiosk sends no `X-Frame-Options` or
`frame-ancestors`, so it allows being framed. The iframe is created only when the dialog opens and removed when
it closes (`main.js`), so the kiosk's Lambda is not hit by visitors who never press the button.

To change the directive, edit the policy in the console (CloudFront, Policies, Response headers, the
`mvcprogrammer-security-headers` policy, Content-Security-Policy) and save; it applies on the next request, no
invalidation needed. Or by CLI, fetch the policy with `get-response-headers-policy`, edit the
`ContentSecurityPolicy` value in the config, and `update-response-headers-policy` with the returned ETag as `--if-match`.

## Resume download

The resume is deliberately kept out of this public repo. The PDF lives in the site bucket under a prefix the deploy workflow never syncs, and the download button goes through a small Lambda that sends a text message before redirecting to the file.

**Pieces (all us-east-1):**

| Piece | Name |
| --- | --- |
| PDF objects | `s3://mvcprogrammer.com/resume/Neal_Thomas_Resume.pdf` (default) plus one variant per edition, `Neal_Thomas_Resume-{vanilla,blazor,angular,react}.pdf`, served under `https://mvcprogrammer.com/resume/` |
| Lambda | `mvcprogrammer-resume-download` (Node 22, arm64), public function URL referenced from each edition's Resume button with its edition tag (`?edition=vanilla`, `blazor`, `angular`, `react`) |
| Role | `mvcprogrammer-resume-download-lambda` (basic execution + `sns:Publish` on the topic) |
| SNS topic | `mvcprogrammer-resume-downloads` (subscribe a phone number for SMS, an email address for a copy) |

The Lambda publishes one message per visitor IP per 15 minutes, skips link-preview bots and `HEAD` requests, and always answers `302` to the PDF even if SNS fails. It publishes with `MessageStructure: json`, so each protocol gets its own body. SMS receives the short line filed with the toll-free registration (device, IP, source, "Reply STOP to end."). Email receives a report with the device, IP, reverse DNS host, network owner and approximate city from a keyless ipinfo.io lookup (capped at 1.5 s, skipped silently on failure), links to look the IP up at ipinfo, ARIN RDAP and AbuseIPDB, and the full user agent. The `edition` query tag selects the variant PDF (the Lambda rewrites `Neal_Thomas_Resume.pdf` to `Neal_Thomas_Resume-<edition>.pdf` in `PDF_URL`; unknown tags get the default) and is named in the alert. Append `?src=linkedin` (or any tag) to the function URL to see where a download came from. `privacy.html` discloses the lookup; keep it in step if the data collected changes.

**Update the PDF.** The master (no Portfolio section) is the base; `docs/pdf/build_resume_variants.py` stamps a Portfolio section onto it once per edition, each linking to and describing that edition. Edit the base, rebuild the variants, then upload all five. Every variant downloads under the same `Neal_Thomas_Resume.pdf` filename.

```bash
python3 -m venv /tmp/pdfenv && /tmp/pdfenv/bin/pip install pymupdf fonttools brotli
/tmp/pdfenv/bin/python docs/pdf/build_fonts.py /tmp/pdffonts
/tmp/pdfenv/bin/python docs/pdf/build_resume_variants.py "/Volumes/Storage Hot/Job Shopping/Neal_Thomas_Resume.pdf" /tmp/pdffonts "/Volumes/Storage Hot/Job Shopping"
for f in Neal_Thomas_Resume Neal_Thomas_Resume-vanilla Neal_Thomas_Resume-blazor Neal_Thomas_Resume-angular Neal_Thomas_Resume-react; do
  aws s3 cp "/Volumes/Storage Hot/Job Shopping/$f.pdf" "s3://mvcprogrammer.com/resume/$f.pdf" \
    --content-type application/pdf \
    --content-disposition 'attachment; filename="Neal_Thomas_Resume.pdf"' \
    --cache-control "public, max-age=300, s-maxage=3600"
done
aws cloudfront create-invalidation --distribution-id E23085GR2SZJHC --paths "/resume/*"
```

**Update the Lambda code** (source: `infra/lambda/resume-download/index.mjs`; the deploy workflow does not upload `infra/`):

```bash
zip -j /tmp/function.zip infra/lambda/resume-download/index.mjs
aws lambda update-function-code --function-name mvcprogrammer-resume-download --zip-file fileb:///tmp/function.zip
```

**Alert delivery.** The topic has an email subscription for mvc.programmer@gmail.com (confirmed 2026-10-05) and a pending one for the T-Mobile email-to-SMS gateway (the gateway rarely forwards the confirmation email, so it may never confirm and can be deleted). Real SMS needs a registered US toll-free number, because the SNS SMS sandbox refused to send even a verification code ("No origination entities available to send").

**Toll-free SMS (in progress, submitted 2026-10-05).** Managed through AWS End User Messaging (`pinpoint-sms-voice-v2`). The local AWS CLI is too old for the registration commands, so use a venv with current boto3.

| Piece | Value |
| --- | --- |
| Toll-free number | `+18664853309`, id `phone-ff7a93ccfefe4abb82f0ba477f0c5fbb`, transactional, deletion protection on, about $2/month |
| Registration | `registration-454592ffe3be471d903ff8310c6d385f`, type `US_TOLL_FREE_REGISTRATION`, version 1 status `REVIEWING` |
| Required public pages | `privacy.html` and `terms.html` (linked from the footer); the form points at both |
| Opt-in evidence | attachment `attachment-c98ca038c4d54c15bf9ce7e5e38257f3` (screenshot of the terms page plus the owner-subscribes-own-number flow) |

Check progress (carrier review usually takes one to two weeks; `COMPLETE` means approved, `REQUIRES_UPDATES` means the carrier wants changes, read `describe-registration-versions` for the reason):

```python
import boto3
c = boto3.client("pinpoint-sms-voice-v2", region_name="us-east-1")
print(c.describe_registrations()["Registrations"][0]["RegistrationStatus"])
print(c.describe_phone_numbers()["PhoneNumbers"][0]["Status"])  # ACTIVE once approved
```

When the registration is `COMPLETE` and the number is `ACTIVE`, finish the SMS path. Either verify the phone in the sandbox and subscribe it, or request production access first (SNS console > Text messaging > Exit sandbox) so any number works:

```bash
aws sns create-sms-sandbox-phone-number --phone-number +1XXXXXXXXXX
aws sns verify-sms-sandbox-phone-number --phone-number +1XXXXXXXXXX --one-time-password 123456
aws sns subscribe --topic-arn arn:aws:sns:us-east-1:<ACCOUNT_ID>:mvcprogrammer-resume-downloads --protocol sms --notification-endpoint +1XXXXXXXXXX
```

The alert text ends with "Reply STOP to end." so it matches the samples in the registration; keep that if you change the Lambda's message. If you ever drop SMS, release the number (`release-phone-number` after turning off deletion protection) to stop the monthly charge.

## Contact form

The Contact section is a form that posts JSON to a Lambda Function URL; the Lambda emails the message through SES. No email address or phone number appears on the site.

| Piece | Value |
|---|---|
| Lambda | `mvcprogrammer-contact` (Node 22, arm64, 256 MB, 10 s), source in `infra/lambda/contact/index.mjs` |
| Role | `mvcprogrammer-contact-lambda`: `AWSLambdaBasicExecutionRole` plus inline `ses-send` (`ses:SendEmail` on `identity/*`) |
| Function URL | `https://y4z5rf27yv7aoy4zpuu5twkwl40ijxab.lambda-url.us-east-1.on.aws/`, auth NONE, CORS `AllowOrigins=https://mvcprogrammer.com`, `POST`, `content-type` |
| Env vars | `TO_EMAIL`, `FROM_EMAIL` (a verified SES identity), `ALLOWED_ORIGIN=https://mvcprogrammer.com` |
| CSP | the CloudFront response headers policy lists the function URL origin in `connect-src` |

The URL is in `index.html` as the form's `data-endpoint`; `main.js` posts `name`, `email`, `topic`, `reply` (`Email` or `Phone call`), `phone` (only for a call), `message`, the honeypot `website`, and `elapsed` (ms the form was open). The Lambda answers 200 without sending when the honeypot is filled or `elapsed` is under 3 s, allows 3 messages per IP per hour per warm container, and rejects bad input with 400. It only sends when the browser `Origin` matches, so the form does not work from a local preview.

SES is in the sandbox, so both the sender and the recipient must be verified identities. The recipient is `neal.thomas@mvcprogrammer.com` (a Microsoft 365 mailbox from GoDaddy, verified in SES 2026-10-07; it replaced `mvc.programmer@gmail.com`). The sender is `website@mvcprogrammer.com`: the domain is DKIM-verified in SES (the three `_domainkey` CNAMEs in `infra/ses-dkim-change-batch.json`, added 2026-10-07), and any address at a verified domain may send, so no mailbox exists for it. `Reply-To` is the visitor, so nobody replies to the sender. Earlier the sender was `mvcprogrammer@lightsplitters.com`, and before that the Gmail address itself, which landed in Gmail's spam because Gmail treats mail "from" one of its own accounts that did not come through Google as a spoof.

**How the domain sender was set up** (done 2026-10-07; repeat only if the SES identity is ever recreated, which issues new DKIM tokens):

```sh
# 1. DNS: the change batch is checked in at infra/ses-dkim-change-batch.json
aws route53 change-resource-record-sets --hosted-zone-id Z02467662SJ3B6YDOZKEF \
  --change-batch file://infra/ses-dkim-change-batch.json

# 2. Wait until this says SUCCESS (took about 35 minutes; Amazon allows up to 72 h)
aws sesv2 get-email-identity --email-identity mvcprogrammer.com --query DkimAttributes.Status

# 3. Switch the sender
aws lambda update-function-configuration --function-name mvcprogrammer-contact \
  --environment "Variables={TO_EMAIL=neal.thomas@mvcprogrammer.com,FROM_EMAIL=website@mvcprogrammer.com,ALLOWED_ORIGIN=https://mvcprogrammer.com}"
```

Redeploy the code after editing it:

```sh
cd infra/lambda/contact && zip -j /tmp/contact.zip index.mjs && \
  aws lambda update-function-code --function-name mvcprogrammer-contact --zip-file fileb:///tmp/contact.zip
```

Dropped and sent submissions are logged as one JSON line each in the function's CloudWatch log group, with the IP and user agent, so a spam wave can be traced.

## Logs

Both Lambdas write one JSON line per request to CloudWatch Logs: `/aws/lambda/mvcprogrammer-resume-download` and `/aws/lambda/mvcprogrammer-contact`. Each group keeps 90 days of events (set 2026-10-07). A new function's group has no retention until you set it:

```sh
aws logs put-retention-policy --log-group-name /aws/lambda/<function> --retention-in-days 90

# Read recent lines without the START/END/REPORT noise, or follow live
aws logs tail /aws/lambda/mvcprogrammer-resume-download --since 24h --format short | grep INFO
aws logs tail /aws/lambda/mvcprogrammer-contact --follow
```

CloudFront access logs are separate and go to S3, not CloudWatch: standard logging on each distribution writes gzipped W3C files to `s3://mvcprogrammer-cf-logs-334383610383/` under `cf/` for mvcprogrammer.com (enabled 2026-10-07), `blazor/` and `angular/` for the two framework editions (enabled 2026-10-15) and `react/` for the third (enabled 2026-10-16); the bucket lifecycle expires them after 30 days. `tools/cf-stats.mjs` (see [Visitor stats](#visitor-stats)) reads all four. Logging itself is free; the only cost is S3 storage, well under a megabyte a day across the four.

Reviewed 2026-10-08 over the first two days of logs (about 4,800 requests): every 4xx was scanner traffic (PHP and `.env`
probes, WordPress paths, `POST /`), none of the old site's URLs (`/images/`, `/js/`, `/css/`, `single-blog.html`) arrived
with a referrer or from a real visitor, and every visit referred from LinkedIn, Facebook, Google, or GitHub loaded `/` cleanly.
So no legacy redirects were added. Scanners mostly hit `www.`, where they get a 301 and go away. Storage runs about 0.4 MB
a day. To stop logging:

```bash
# Logging lives in DistributionConfig.Logging; set Enabled to false and update with the current ETag
aws cloudfront get-distribution-config --id E23085GR2SZJHC --query 'DistributionConfig.Logging'
```

### Visitor stats

`tools/cf-stats.mjs` turns those access logs into the few numbers worth knowing: visits and unique visitors per day, where they came from, which edge locations served them, how many loaded the Experience API or clicked a skill chip, how many downloaded the resume, and, from the engagement beacon, which sections visitors reached and how long the page stayed visible. Scanners and known crawlers are dropped, and a visit only counts when a browser loaded the page plus at least one asset, API call, or ping. It needs Node 22+ and the AWS CLI, nothing else.

```sh
node tools/cf-stats.mjs                                   # the last 7 days
node tools/cf-stats.mjs --days 30 --scanners              # a month, plus the 4xx and bot breakdown
CF_STATS_EXCLUDE_IPS=203.0.113.7 node tools/cf-stats.mjs  # leave your own visits out
```

The bucket defaults to `mvcprogrammer-cf-logs-<account id>` for the current AWS account (`--bucket` or `CF_LOG_BUCKET` override it), all four prefixes are read unless `--prefix cf/` or `--prefix blazor/,angular/,react/` narrows it, and files are cached under `~/.cache/mvcprogrammer-cf-stats/`, so a second run only downloads what is new. A "By edition" line splits the visits by host. Unique visitors are IP address plus browser string, the best a server log can do; carrier NAT and office networks blur it.

The beacon itself is the last block of `main.js` (mirrored by `watchEngagement()` in the Blazor edition's `site.js` and `BeaconEngagementTracker` in the Angular and React editions). It sends `GET /ping?e=view&s=<section>` once per section that reaches the middle of the viewport and `GET /ping?e=leave&t=<seconds visible>` each time the tab is hidden, with `keepalive` so the last one survives the tab closing. The CloudFront Function answers 204 (section 4b), the request lands in the access log, and nothing is stored anywhere else. The beacon stays silent on `localhost` and when the browser sends Do Not Track or Global Privacy Control, and `privacy.html` describes it. Logging must stay on for the stats to exist; at well under a megabyte a day of S3 storage across the four distributions, that is the whole cost.

## GitHub Actions (optional)

`.github/workflows/deploy.yml` runs the same steps on every push to `main`. It authenticates with OpenID Connect (OIDC), so no long-lived access keys are stored in GitHub. Third-party actions are pinned to commit SHAs with the version in a trailing comment; bump the SHA and the comment together when upgrading.

1. Create an IAM identity provider for GitHub in the AWS account (IAM > Identity providers > OpenID Connect, provider URL `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`).
2. Create an IAM role with this trust policy (replace the owner/repo):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
         "StringLike": { "token.actions.githubusercontent.com:sub": [
           "repo:mvcprogrammer@<OWNER_ID>/mvcprogrammer.com@<REPO_ID>:ref:refs/heads/main",
           "repo:mvcprogrammer/mvcprogrammer.com:ref:refs/heads/main"
         ] }
       }
     }]
   }
   ```

   GitHub's OIDC token identifies the repository as `repo:<owner>@<owner id>/<repo>@<repo id>:ref:...`, so the trust policy lists that form first. The plain `owner/repo` form is kept as a fallback. Find the IDs with `curl -s https://api.github.com/repos/mvcprogrammer/mvcprogrammer.com | grep -E '"id"'` (the first `id` is the repo, the one under `owner` is the owner), or read the exact `sub` value from a failed `AssumeRoleWithWebIdentity` event in CloudTrail. The repo ID survives a rename but the name part of both forms does not, so update the trust policy whenever the repository is renamed.

3. Attach a permissions policy to the role:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::mvcprogrammer.com" },
       { "Effect": "Allow", "Action": ["s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::mvcprogrammer.com/*" },
       { "Effect": "Allow", "Action": ["cloudfront:CreateInvalidation"], "Resource": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>" }
     ]
   }
   ```

4. In the GitHub repository, add these under Settings > Secrets and variables > Actions:

   | Type | Name | Value |
   | --- | --- | --- |
   | Secret | `AWS_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/<ROLE_NAME>` |
   | Variable | `S3_BUCKET` | `mvcprogrammer.com` |
   | Variable | `CLOUDFRONT_DISTRIBUTION_ID` | the distribution ID |
   | Variable | `AWS_REGION` | `us-east-1` |

Push to `main`, or run the workflow manually from the Actions tab.

## Experience API

The read-only API behind the Experience section. Code and design notes: [api/README.md](../api/README.md).
Stack: `mvcprogrammer-experience-api` (CloudFormation, SAM transform) from `api/template.yaml`.

Prerequisites, once per machine:

```bash
dotnet --version                                  # 10.x SDK
dotnet tool update -g Amazon.Lambda.Tools         # 7.0.0 or later knows the dotnet10 runtime
aws --version                                     # 2.37 or later (the 2022 CLI cannot edit OAC origins; see 2026-10-07)
```

### 1. Deploy the stack

Packages the function (ReadyToRun, linux-arm64, framework-dependent), uploads it, and creates or updates the stack.
The S3 bucket is any bucket in the account for deployment artifacts; the distribution ARN scopes the invoke permission.

```bash
cd api/src/Experience.Api
dotnet lambda deploy-serverless \
  --s3-bucket aws-sam-cli-managed-default-samclisourcebucket-113mxhhn8smh9 \
  --template-parameters "DistributionArn=arn:aws:cloudfront::334383610383:distribution/E23085GR2SZJHC"
```

Then read the outputs; the CloudFront step needs three of them:

```bash
aws cloudformation describe-stacks --stack-name mvcprogrammer-experience-api \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' --output table
```

### 2. Seed the table

Idempotent; re-run after editing `api/seed/positions.json`. It does not delete positions removed from the file.

```bash
dotnet run --project api/src/Experience.Seed -- --table mvcprogrammer-experience
```

### 3. Wire CloudFront (one time)

The distribution predates the stack, so this is done against the live config. Add a second origin pointing at the
function URL and a `/api/*` behavior in front of the S3 origin.

```bash
aws cloudfront get-distribution-config --id E23085GR2SZJHC > /tmp/dist.json
ETAG=$(python3 -c 'import json;print(json.load(open("/tmp/dist.json"))["ETag"])')
```

Edit `/tmp/dist.json` `DistributionConfig`:

- `Origins.Items`: append
  ```json
  {
    "Id": "experience-api",
    "DomainName": "<FunctionUrl host, e.g. abc123.lambda-url.us-east-1.on.aws>",
    "OriginPath": "",
    "CustomHeaders": { "Quantity": 0 },
    "CustomOriginConfig": {
      "HTTPPort": 80, "HTTPSPort": 443, "OriginProtocolPolicy": "https-only",
      "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] },
      "OriginReadTimeout": 30, "OriginKeepaliveTimeout": 5
    },
    "ConnectionAttempts": 3, "ConnectionTimeout": 10,
    "OriginShield": { "Enabled": false },
    "OriginAccessControlId": "<OriginAccessControlId output>"
  }
  ```
  and bump `Origins.Quantity`.
- `CacheBehaviors.Items`: append
  ```json
  {
    "PathPattern": "/api/*",
    "TargetOriginId": "experience-api",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": { "Quantity": 3, "Items": ["GET", "HEAD", "OPTIONS"],
                        "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] } },
    "Compress": true,
    "CachePolicyId": "<CachePolicyId output>",
    "OriginRequestPolicyId": "<managed policy AllViewerExceptHostHeader; look up its id with aws cloudfront list-origin-request-policies --type managed>",
    "ResponseHeadersPolicyId": "28b549c3-c562-418c-a803-abe16efe78eb",
    "SmoothStreaming": false,
    "FieldLevelEncryptionId": "",
    "LambdaFunctionAssociations": { "Quantity": 0 },
    "FunctionAssociations": { "Quantity": 0 },
    "TrustedSigners": { "Enabled": false, "Quantity": 0 },
    "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 }
  }
  ```
  and bump `CacheBehaviors.Quantity`. The Host header must not reach a function URL, which is why the origin request
  policy is the "except Host" one. When the write endpoints ship, `AllowedMethods` widens to all seven.

Apply, strip the wrapper first:

```bash
python3 -c 'import json;d=json.load(open("/tmp/dist.json"));json.dump(d["DistributionConfig"],open("/tmp/dist-config.json","w"))'
aws cloudfront update-distribution --id E23085GR2SZJHC --if-match "$ETAG" --distribution-config file:///tmp/dist-config.json
```

Verify once deployed (a few minutes):

```bash
curl -si https://mvcprogrammer.com/api/health
curl -si https://mvcprogrammer.com/api/experience | grep -i "etag\|cache-control\|x-cache"
curl -si "https://<FunctionUrl host>/api/health"     # 403: the raw URL is CloudFront-only
```

The site's CSP needs no change: `/api` is same-origin, covered by `connect-src 'self'`.

Done 2026-10-08: origin `experience-api` and the `/api/*` behavior are live on `E23085GR2SZJHC`, with the
`mvcprogrammer-www-redirect` function attached to the new behavior too so `www` redirects on API paths as well.

### 4. Let the API's own 404 through

Custom error responses are distribution-wide, so the original `404 -> /404.html` mapping also replaced the
API's `application/problem+json` 404 with the site's HTML page. The S3 bucket policy grants only `s3:GetObject`
(no `ListBucket`), so S3 answers **403** for a missing file, never 404; the `403 -> /404.html` mapping is the one
that actually serves the site's not-found page. Removing the 404 mapping therefore changes nothing for the site
and lets the API's 404 reach the client. Keep the 403 mapping.

```bash
aws cloudfront get-distribution-config --id E23085GR2SZJHC > /tmp/dist.json
python3 - <<'EOF2'
import json
d = json.load(open('/tmp/dist.json')); c = d['DistributionConfig']
items = [e for e in c['CustomErrorResponses']['Items'] if e['ErrorCode'] != 404]
c['CustomErrorResponses'] = {"Quantity": len(items), "Items": items}
json.dump(c, open('/tmp/dist-config.json', 'w'))
open('/tmp/dist-etag', 'w').write(d['ETag'])
EOF2
aws cloudfront update-distribution --id E23085GR2SZJHC --if-match "$(cat /tmp/dist-etag)" --distribution-config file:///tmp/dist-config.json --query Distribution.Status
aws cloudfront wait distribution-deployed --id E23085GR2SZJHC
# The HTML 404 was cached for the API path (ErrorCachingMinTTL 300), so flush it
aws cloudfront create-invalidation --distribution-id E23085GR2SZJHC --paths "/api/*"
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://mvcprogrammer.com/no-such-page        # 404 text/html
curl -s -w " [%{http_code} %{content_type}]\n" https://mvcprogrammer.com/api/experience/acme          # 404 application/problem+json
```

### Logs

```bash
aws logs tail /aws/lambda/mvcprogrammer-experience-api --since 1h --format short
```

## Blazor edition (blazor.mvcprogrammer.com)

Added 2026-10-14. The Blazor WebAssembly build in `blazor/` is published to the `blazor/` prefix of
the same bucket and served by a second distribution. The `deploy-blazor` job in the workflow
builds and syncs it on every push to `main`; nothing in the static site's job changed.

| Piece | Value |
| --- | --- |
| CloudFront distribution | `E2NFN5MW02S8Y9` (d2tjmqaw33vtjp.cloudfront.net), origin path `/blazor`, same S3 OAC `E2KEES7ZY0UA4S`, `/api/*` to the Experience API with its OAC `EADX2EY7VKO1Y`, 403 → `/index.html` 200 |
| Response headers policy | `mvcprogrammer-blazor-security-headers` (`a95f1577-4d06-445c-acd5-bd6763b5651b`): the static site's headers with `'wasm-unsafe-eval'` added to `script-src` |
| ACM certificate | `arn:aws:acm:us-east-1:334383610383:certificate/f448d49f-3ad1-4ccd-a2ce-a9a367c48222` (blazor.mvcprogrammer.com, DNS-validated) |
| Route 53 | A and AAAA aliases for `blazor.mvcprogrammer.com` to the distribution |
| Bucket policy | the `AWS:SourceArn` condition lists both distributions |
| Experience API | Lambda permission `blazor-cloudfront-invoke` lets the new distribution invoke the function URL. This is outside the SAM template; a `sam deploy` leaves it alone |
| Contact Lambda | function URL CORS allows both origins; `ALLOWED_ORIGIN` is now a comma-separated list (code in `infra/lambda/contact/index.mjs`) |
| GitHub variable | `BLAZOR_DISTRIBUTION_ID` = `E2NFN5MW02S8Y9` |
| IAM | the deploy role's inline policy is kept at `infra/iam/github-actions-deploy-role-policy.json`; its `cloudfront:CreateInvalidation` lists both distributions. Apply with `aws iam put-role-policy --role-name github-actions-mvcprogrammer-deploy --policy-name deploy-static-site --policy-document file://infra/iam/github-actions-deploy-role-policy.json` |

Manual deploy, the same two syncs the workflow runs (pre-compressed `.br`/`.gz` twins stay out;
CloudFront compresses on the fly):

```bash
dotnet publish blazor/src/Portfolio.Blazor -c Release -o /tmp/blazor-publish
cd /tmp/blazor-publish/wwwroot
aws s3 sync _framework/ s3://mvcprogrammer.com/blazor/_framework/ --delete \
  --cache-control "public, max-age=604800, s-maxage=31536000, immutable" \
  --exclude "*.br" --exclude "*.gz" --exclude "blazor.webassembly.js" --exclude "dotnet.js"
aws s3 sync . s3://mvcprogrammer.com/blazor/ --delete \
  --cache-control "public, max-age=300, s-maxage=31536000" \
  --exclude "*.br" --exclude "*.gz" --exclude "_framework/*" \
  --include "_framework/blazor.webassembly.js" --include "_framework/dotnet.js"
aws cloudfront create-invalidation --distribution-id E2NFN5MW02S8Y9 --paths "/*"
```

## Angular edition (angular.mvcprogrammer.com)

Added 2026-10-15. The Angular 22 build in `angular/` is published to the `angular/` prefix of the same
bucket and served by a third distribution, set up the same way as the Blazor edition above. The
`deploy-angular` job in the workflow tests, builds, and syncs it on every push to `main`; nothing in
the other two jobs changed.

| Piece | Value |
| --- | --- |
| CloudFront distribution | `E33NA2ZQ9O29DK` (dkysvm4o06d9w.cloudfront.net), origin path `/angular`, same S3 OAC `E2KEES7ZY0UA4S`, `/api/*` to the Experience API with its OAC `EADX2EY7VKO1Y`, 403 → `/index.html` 200 |
| Response headers policy | the static site's `mvcprogrammer-security-headers` (`28b549c3-c562-418c-a803-abe16efe78eb`), unchanged: Angular needs no `'wasm-unsafe-eval'` and nothing inline |
| ACM certificate | `arn:aws:acm:us-east-1:334383610383:certificate/fab70e2b-d72f-4c74-b3c8-2bcdcc89bc89` (angular.mvcprogrammer.com, DNS-validated) |
| Route 53 | A and AAAA aliases for `angular.mvcprogrammer.com` to the distribution |
| Bucket policy | the `AWS:SourceArn` condition lists every distribution (four since the React edition) |
| Experience API | Lambda permission `angular-cloudfront-invoke` lets the new distribution invoke the function URL. Outside the SAM template, like the Blazor one |
| Contact Lambda | function URL CORS and `ALLOWED_ORIGIN` list every origin (four since the React edition) |
| GitHub variable | `ANGULAR_DISTRIBUTION_ID` = `E33NA2ZQ9O29DK` |
| IAM | `infra/iam/github-actions-deploy-role-policy.json` lists the distribution under `cloudfront:CreateInvalidation`; apply with the `put-role-policy` command in the Blazor section |

All of it was created 2026-10-15 with the commands below, which the React edition reused the next day.

### Create the resources

The distribution is a copy of the Blazor one with four changes: the alias, the origin path, the
certificate, and the response headers policy (the static site's, since there is no WebAssembly).

```bash
# 1. Certificate (us-east-1), then add the CNAME it asks for to the hosted zone and wait for ISSUED
aws acm request-certificate --region us-east-1 --domain-name angular.mvcprogrammer.com --validation-method DNS
aws acm describe-certificate --region us-east-1 --certificate-arn arn:aws:acm:us-east-1:334383610383:certificate/fab70e2b-d72f-4c74-b3c8-2bcdcc89bc89 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

# 2. Distribution, cloned from the Blazor edition's config
aws cloudfront get-distribution-config --id E2NFN5MW02S8Y9 --query DistributionConfig > /tmp/blazor-config.json
python3 - <<'PY'
import json, time
c = json.load(open('/tmp/blazor-config.json'))
c['CallerReference'] = f'angular-{int(time.time())}'
c['Comment'] = 'angular.mvcprogrammer.com (Angular edition)'
c['Aliases'] = {'Quantity': 1, 'Items': ['angular.mvcprogrammer.com']}
c['ViewerCertificate']['ACMCertificateArn'] = 'arn:aws:acm:us-east-1:334383610383:certificate/fab70e2b-d72f-4c74-b3c8-2bcdcc89bc89'
c['ViewerCertificate']['Certificate'] = 'arn:aws:acm:us-east-1:334383610383:certificate/fab70e2b-d72f-4c74-b3c8-2bcdcc89bc89'
for origin in c['Origins']['Items']:
    if origin.get('OriginPath') == '/blazor':
        origin['OriginPath'] = '/angular'
c['DefaultCacheBehavior']['ResponseHeadersPolicyId'] = '28b549c3-c562-418c-a803-abe16efe78eb'
json.dump(c, open('/tmp/angular-config.json', 'w'), indent=2)
PY
aws cloudfront create-distribution --distribution-config file:///tmp/angular-config.json \
  --query 'Distribution.[Id,DomainName,ARN]' --output text

# 3. Let the new distribution read the bucket and call the API
aws s3api get-bucket-policy --bucket mvcprogrammer.com --query Policy --output text > /tmp/bucket-policy.json
#    add "arn:aws:cloudfront::334383610383:distribution/E33NA2ZQ9O29DK" to the AWS:SourceArn list, then
aws s3api put-bucket-policy --bucket mvcprogrammer.com --policy file:///tmp/bucket-policy.json
aws lambda add-permission --function-name mvcprogrammer-experience-api \
  --statement-id angular-cloudfront-invoke --action lambda:InvokeFunctionUrl \
  --principal cloudfront.amazonaws.com \
  --source-arn arn:aws:cloudfront::334383610383:distribution/E33NA2ZQ9O29DK

# 4. DNS: A and AAAA aliases, the same change batch shape as the apex (CloudFront zone Z2FDTNDATAQYW2)
aws route53 change-resource-record-sets --hosted-zone-id Z02467662SJ3B6YDOZKEF --change-batch file://records.json

# 5. Contact form: the function URL's CORS and the Lambda's origin list
aws lambda update-function-url-config --function-name mvcprogrammer-contact \
  --cors 'AllowOrigins=https://mvcprogrammer.com,https://blazor.mvcprogrammer.com,https://angular.mvcprogrammer.com,AllowMethods=POST,AllowHeaders=content-type'
aws lambda update-function-configuration --function-name mvcprogrammer-contact \
  --environment "Variables={TO_EMAIL=neal.thomas@mvcprogrammer.com,FROM_EMAIL=website@mvcprogrammer.com,ALLOWED_ORIGIN=https://mvcprogrammer.com,https://blazor.mvcprogrammer.com,https://angular.mvcprogrammer.com}"

# 6. Deploy role and GitHub: add the distribution ARN to infra/iam/github-actions-deploy-role-policy.json,
#    apply it with put-role-policy, and set the repository variable
gh variable set ANGULAR_DISTRIBUTION_ID --body E33NA2ZQ9O29DK
```

Manual deploy, the same two syncs the workflow runs:

```bash
cd angular && npm ci && npm test && npm run build && cd dist/portfolio-angular/browser
aws s3 sync . s3://mvcprogrammer.com/angular/ --delete \
  --cache-control "public, max-age=604800, s-maxage=31536000, immutable" \
  --exclude "*" --include "main-*.js" --include "polyfills-*.js" --include "chunk-*.js" --include "styles-*.css"
aws s3 sync . s3://mvcprogrammer.com/angular/ --delete \
  --cache-control "public, max-age=300, s-maxage=31536000" \
  --exclude "main-*.js" --exclude "polyfills-*.js" --exclude "chunk-*.js" --exclude "styles-*.css"
aws cloudfront create-invalidation --distribution-id E33NA2ZQ9O29DK --paths "/*"
```

## React edition (react.mvcprogrammer.com)

Added 2026-10-16. The React 19 build in `react/` (Vite) is published to the `react/` prefix of the same
bucket and served by a fourth distribution, set up the same way as the Angular edition above. The
`deploy-react` job in the workflow tests, type-checks, builds, and syncs it on every push to `main`;
nothing in the other three jobs changed.

| Piece | Value |
| --- | --- |
| CloudFront distribution | `E2C51AKAKJUCBO` (d16qoactawb5x7.cloudfront.net), origin path `/react`, same S3 OAC `E2KEES7ZY0UA4S`, `/api/*` to the Experience API with its OAC `EADX2EY7VKO1Y`, 403 → `/index.html` 200, the `mvcprogrammer-www-redirect` function on the default behavior, access logs under `react/` |
| Response headers policy | the static site's `mvcprogrammer-security-headers` (`28b549c3-c562-418c-a803-abe16efe78eb`), unchanged: React needs no `'wasm-unsafe-eval'` and nothing inline |
| ACM certificate | `arn:aws:acm:us-east-1:334383610383:certificate/ed06510b-294a-4f56-9852-634dec4c2528` (react.mvcprogrammer.com, DNS-validated) |
| Route 53 | A and AAAA aliases for `react.mvcprogrammer.com` to the distribution |
| Bucket policy | the `AWS:SourceArn` condition lists all four distributions |
| Experience API | Lambda permission `react-cloudfront-invoke` lets the new distribution invoke the function URL. Outside the SAM template, like the other two |
| Contact Lambda | function URL CORS and `ALLOWED_ORIGIN` list all four origins |
| GitHub variable | `REACT_DISTRIBUTION_ID` = `E2C51AKAKJUCBO` |
| IAM | `infra/iam/github-actions-deploy-role-policy.json` lists the distribution under `cloudfront:CreateInvalidation`; apply with the `put-role-policy` command in the Blazor section |

The resources were created with the Angular edition's commands above, with `angular` replaced by
`react` throughout and the distribution cloned from the Angular one (`E33NA2ZQ9O29DK`), which already
carries the static site's headers policy, the beacon function, and access logging.

Manual deploy, the same two syncs the workflow runs (the fingerprinted bundles live under `bundles/`;
everything else, `index.html` included, gets the short browser TTL):

```bash
cd react && npm ci && npm test && npm run build && cd dist
aws s3 sync bundles/ s3://mvcprogrammer.com/react/bundles/ --delete \
  --cache-control "public, max-age=604800, s-maxage=31536000, immutable"
aws s3 sync . s3://mvcprogrammer.com/react/ --delete \
  --cache-control "public, max-age=300, s-maxage=31536000" \
  --exclude "bundles/*"
aws cloudfront create-invalidation --distribution-id E2C51AKAKJUCBO --paths "/*"
```
