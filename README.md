<div align="center">

# mvcprogrammer.com

**The source for [mvcprogrammer.com](https://mvcprogrammer.com), the portfolio site of [Neal Thomas](https://github.com/mvcprogrammer).**

[![Live site](https://img.shields.io/badge/mvcprogrammer.com-2f62d9?style=flat-square&logo=googlechrome&logoColor=white)](https://mvcprogrammer.com)
&nbsp;[![Deploy](https://github.com/mvcprogrammer/mvcprogrammer.com/actions/workflows/deploy.yml/badge.svg)](https://github.com/mvcprogrammer/mvcprogrammer.com/actions/workflows/deploy.yml)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mvcprogrammer/mvcprogrammer.com/main/docs/images/mvcprogrammer-com-dark.png">
  <img alt="mvcprogrammer.com, the home page" src="https://raw.githubusercontent.com/mvcprogrammer/mvcprogrammer.com/main/docs/images/mvcprogrammer-com-light.png" width="920">
</picture>

</div>

<br>

The site follows the **KISS principle**: keep it simple, and add nothing that is not earning its place. It is plain HTML, CSS, and vanilla JavaScript with no framework, no build step, no bundler, no third-party scripts, and a strict Content Security Policy. One page, one stylesheet, one deferred script, shipped exactly as written. The static files sit in a private S3 bucket behind CloudFront, and three small Lambda functions do the only work that needs a server: the contact form, the resume download, and the Experience API.

## What is in this repository

| Path | What it is |
| --- | --- |
| `index.html`, `styles.css`, `main.js` | The site. The Experience timeline is in the HTML so it reads without JavaScript; when the API answers, the script re-renders it from JSON and reveals a skill filter. |
| `404.html`, `privacy.html`, `terms.html` | The not-found page and the policies required for the toll-free SMS registration. |
| `assets/` | Self-hosted fonts (Inter and JetBrains Mono as variable WOFF2 subsets) and images. Icons are an inline SVG sprite in the HTML. |
| `api/` | The Experience API: C# on .NET 10, run on AWS Lambda (arm64) and reading a single DynamoDB table. Spec-first with OpenAPI 3.1, tested over the in-process host, deployed with SAM. See [api/README.md](api/README.md). |
| `infra/` | The contact-form and resume-download Lambdas (Node.js 22 on arm64) and the SES DKIM change batch. |
| `docs/` | [DEPLOY.md](docs/DEPLOY.md), the infrastructure walkthrough, and the screenshots above. |
| `.github/workflows/` | The deploy: GitHub Actions authenticated with OIDC, so no AWS keys are stored anywhere. |

## How it is served

- **Hosting.** A private S3 bucket that only CloudFront can read, through Origin Access Control. CloudFront serves over HTTP/2 and HTTP/3 with an ACM certificate, Route 53 aliases the domain, and a CloudFront Function redirects `www` to the apex.
- **Security.** A response headers policy sets a same-origin Content Security Policy, two-year HSTS, `X-Frame-Options: DENY`, `nosniff`, and a locked-down Permissions-Policy. No cookies, no analytics.
- **Experience API.** `/api/experience` and `/api/skills` on the same domain. Responses carry ETags and cache headers so CloudFront answers most requests itself, errors follow RFC 9457 problem details, and the function URL accepts only requests signed by CloudFront. The contract is [api/openapi.yaml](api/openapi.yaml).
- **Deploys.** Every push to `main` assumes a least-privilege IAM role through OIDC, syncs the bucket in two passes (a week of browser caching for fonts and images, five minutes for pages), and invalidates the CloudFront cache. Third-party actions are pinned to commit hashes.

## Preview locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

The full build-and-deploy walkthrough, including the IAM trust policy, the response headers policy, the contact form, and the resume download, is in [docs/DEPLOY.md](docs/DEPLOY.md).

<br>

<div align="center">
<sub>Neal Thomas &nbsp;·&nbsp; <a href="https://github.com/mvcprogrammer">GitHub profile</a> &nbsp;·&nbsp; <a href="https://www.linkedin.com/in/mvcprogrammer/">LinkedIn</a> &nbsp;·&nbsp; <a href="https://mvcprogrammer.com/#resume">Résumé and contact</a></sub>
</div>
