Reduce the 4xx error rate on mvcprogrammer.com. Context from an investigation done on 2026-10-07 from the lightsplitters.com session:

- CloudFront distribution E23085GR2SZJHC (account 334383610383, us-east-1) serves this repo from the private S3 bucket `mvcprogrammer.com`. Over the last 14 days it saw ~41,500 requests with a 61% 4xx rate. Most of it is vulnerability scanners in bursts (one day had 13,746 requests at 93% 4xx), but busy hours also show a steady ~45-50% 4xx baseline whose cause is unknown.
- Every file the site references resolves; there are no broken links. The only legitimate 404s are `/favicon.ico` and `/apple-touch-icon.png`, which browsers and crawlers request on their own.
- The distribution's custom error response maps S3 403 to `/index.html` with a 404 status and a 10-second error TTL, so every scanner probe ships the full 41 KB home page and most go back to the origin.
- CloudFront standard logging was turned on 2026-10-07 to `s3://mvcprogrammer-cf-logs-334383610383/cf/` (gzip W3C format, 30-day expiry). Logs arrive within about an hour.
- Deploys happen through `.github/workflows/deploy.yml` on push to main. Its `aws s3 sync` uses an explicit `--include` list, so any new file must be added there or it will not be uploaded. Do not add Claude attribution to commits.

Do these tasks:

1. Add `favicon.ico` (16, 32 and 48 px) and `apple-touch-icon.png` (180 px, opaque, full bleed) rendered from `favicon.svg`. Link both from the `<head>` of index.html, privacy.html and terms.html alongside the existing SVG icon, add them to the deploy workflow's include list, and add the touch icon to `site.webmanifest` icons.

2. Add a small `404.html` in the site's style (same fonts, light/dark theme, a link home) and add it to the deploy include list. Then change the CloudFront custom error responses so both 403 and 404 return `/404.html` with status 404 and an ErrorCachingMinTTL of 300. Use `aws cloudfront get-distribution-config` / `update-distribution` with the ETag, and update docs/DEPLOY.md where it describes the error page setting (around the "Optional: under Error pages" line). Keep the CSP compatible: no inline script or style.

3. Analyse the CloudFront logs once at least a day of data exists. Download `s3://mvcprogrammer-cf-logs-334383610383/cf/` to a scratch folder, gunzip, and report the top 30 requested URIs with status >= 400, grouped by status, plus the top user agents and the share of 4xx hitting `www.` vs the apex. Decide from that whether any old-site URLs (the 2015-2025 versions had `/images/`, `/css/`, `/js/`, `single-blog.html`) still get real traffic and deserve 301 redirects in the CloudFront Function `mvcprogrammer-www-redirect`; add redirects only for paths with real referrers or browser user agents, not scanner noise.

4. Build and verify locally, commit, push, and confirm after the GitHub Actions deploy that `https://mvcprogrammer.com/favicon.ico`, `/apple-touch-icon.png` and `/404.html` return 200 and a junk path returns a 404 with the small page.

After the log review, say whether logging can be turned off again to keep AWS costs minimal.
