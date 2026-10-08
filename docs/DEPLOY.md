# Deploying mvcprogrammer.com

Plain HTML, CSS, and vanilla JavaScript. No framework, no build step, no backend. Hosted as static files on Amazon S3 behind CloudFront. This is the infrastructure walkthrough that used to live in the README.

## Files

```
index.html                  the single page
404.html                    small not-found page, served by CloudFront for any missing path
privacy.html, terms.html    privacy policy and SMS terms (required for the toll-free SMS registration)
styles.css                  mobile-first styles, light/dark via prefers-color-scheme
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
      "ContentSecurityPolicy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests"
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

Both hostnames point at the same distribution, so without a redirect the site is reachable at two URLs. A CloudFront Function on viewer-request fixes that:

```js
function handler(event) {
  var request = event.request;
  if (request.headers.host && request.headers.host.value === 'www.mvcprogrammer.com') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://mvcprogrammer.com' + request.uri } }
    };
  }
  return request;
}
```

Create it under CloudFront > Functions, publish it, and associate it with the default behavior's viewer request event.

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
  --include "styles.css" --include "main.js" \
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

## Resume download

The resume is deliberately kept out of this public repo. The PDF lives in the site bucket under a prefix the deploy workflow never syncs, and the download button goes through a small Lambda that sends a text message before redirecting to the file.

**Pieces (all us-east-1):**

| Piece | Name |
| --- | --- |
| PDF object | `s3://mvcprogrammer.com/resume/Neal_Thomas_Resume.pdf`, served at `https://mvcprogrammer.com/resume/Neal_Thomas_Resume.pdf` |
| Lambda | `mvcprogrammer-resume-download` (Node 22, arm64), public function URL referenced from the Resume button in `index.html` |
| Role | `mvcprogrammer-resume-download-lambda` (basic execution + `sns:Publish` on the topic) |
| SNS topic | `mvcprogrammer-resume-downloads` (subscribe a phone number for SMS, an email address for a copy) |

The Lambda publishes one message per visitor IP per 15 minutes, skips link-preview bots and `HEAD` requests, and always answers `302` to the PDF even if SNS fails. It publishes with `MessageStructure: json`, so each protocol gets its own body. SMS receives the short line filed with the toll-free registration (device, IP, source, "Reply STOP to end."). Email receives a report with the device, IP, reverse DNS host, network owner and approximate city from a keyless ipinfo.io lookup (capped at 1.5 s, skipped silently on failure), links to look the IP up at ipinfo, ARIN RDAP and AbuseIPDB, and the full user agent. Append `?src=linkedin` (or any tag) to the function URL to see where a download came from. `privacy.html` discloses the lookup; keep it in step if the data collected changes.

**Update the PDF** (export from Word or Pages first):

```bash
aws s3 cp ~/Downloads/Neal_Thomas_Resume.pdf s3://mvcprogrammer.com/resume/Neal_Thomas_Resume.pdf \
  --content-type application/pdf \
  --content-disposition 'attachment; filename="Neal_Thomas_Resume.pdf"' \
  --cache-control "public, max-age=300, s-maxage=3600"
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

CloudFront access logs are separate and go to S3, not CloudWatch: standard logging on the distribution writes gzipped W3C files to `s3://mvcprogrammer-cf-logs-334383610383/cf/` (enabled 2026-10-07, bucket lifecycle expires them after 30 days). Sync the prefix locally and `gunzip` to analyse them. Logging itself is free; the only cost is S3 storage, so turn it off under the distribution's Logging settings once it has answered the question that prompted it.

Reviewed 2026-10-08 over the first two days of logs (about 4,800 requests): every 4xx was scanner traffic (PHP and `.env`
probes, WordPress paths, `POST /`), none of the old site's URLs (`/images/`, `/js/`, `/css/`, `single-blog.html`) arrived
with a referrer or from a real visitor, and every visit referred from LinkedIn, Facebook, Google, or GitHub loaded `/` cleanly.
So no legacy redirects were added. Scanners mostly hit `www.`, where they get a 301 and go away. Storage runs about 0.4 MB
a day. To stop logging:

```bash
# Logging lives in DistributionConfig.Logging; set Enabled to false and update with the current ETag
aws cloudfront get-distribution-config --id E23085GR2SZJHC --query 'DistributionConfig.Logging'
```

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
           "repo:mvcprogrammer@<OWNER_ID>/mvcprogrammer@<REPO_ID>:ref:refs/heads/main",
           "repo:mvcprogrammer/mvcprogrammer:ref:refs/heads/main"
         ] }
       }
     }]
   }
   ```

   GitHub's OIDC token identifies the repository as `repo:<owner>@<owner id>/<repo>@<repo id>:ref:...`, so the trust policy lists that form first. The plain `owner/repo` form is kept as a fallback. Find the IDs with `curl -s https://api.github.com/repos/mvcprogrammer/mvcprogrammer | grep -E '"id"'` (the first `id` is the repo, the one under `owner` is the owner), or read the exact `sub` value from a failed `AssumeRoleWithWebIdentity` event in CloudTrail.

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
