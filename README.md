<div align="center">

# Neal Thomas

**Senior full-stack engineer** &nbsp;·&nbsp; C# / .NET &nbsp;·&nbsp; Angular &nbsp;·&nbsp; React &nbsp;·&nbsp; SQL Server &nbsp;·&nbsp; AWS
<br>Tampa Bay, Florida

[![mvcprogrammer.com](https://img.shields.io/badge/mvcprogrammer.com-2f62d9?style=flat-square&logo=googlechrome&logoColor=white)](https://mvcprogrammer.com)
&nbsp;[![LinkedIn](https://img.shields.io/badge/LinkedIn-2f62d9?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/mvcprogrammer/)
&nbsp;[![Email](https://img.shields.io/badge/Email-2f62d9?style=flat-square&logo=minutemailer&logoColor=white)](mailto:neal.thomas@mvcprogrammer.com)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mvcprogrammer/mvcprogrammer/main/docs/images/mvcprogrammer-com-dark.png">
  <img alt="mvcprogrammer.com, the home page" src="https://raw.githubusercontent.com/mvcprogrammer/mvcprogrammer/main/docs/images/mvcprogrammer-com-light.png" width="920">
</picture>

<sub>**[mvcprogrammer.com](https://mvcprogrammer.com)** is my portfolio and the source in this repository. Plain HTML, CSS, and JavaScript on S3 and CloudFront, with a C# / .NET 10 API on Lambda and DynamoDB behind the same domain.<br>[How it is built and deployed](docs/DEPLOY.md) &nbsp;·&nbsp; [The Experience API](api/README.md)</sub>

</div>

<br>

I build back ends that run around the clock and front ends people like using. Fifteen-plus years on C# / .NET and SQL Server, with Angular and React on top. Most recently I re-architected a polling Windows service into an event-driven **RabbitMQ** pipeline that processes **1M+ API requests, 24/7**. Before that I built and maintained a proprietary accounting system (general ledger, receivables, payables, bank reconciliation, financial reporting) on Angular and ASP.NET Core. AI-assisted tools like Claude Code are part of my daily workflow.

## Projects

Most of my enterprise work lives in private repositories, so these three public sites stand in for it: they show how I write code and the stack I reach for. Each is mine end to end, design through deployment, and all three run serverless on AWS.

| Project | What it is |
| --- | --- |
| **[mvcprogrammer.com](https://mvcprogrammer.com)**<br><sub>[source](https://github.com/mvcprogrammer/mvcprogrammer) · [API](api/README.md) · [deploy notes](docs/DEPLOY.md)</sub> | My portfolio. No framework, no build step, no third-party scripts, and a strict Content Security Policy. The Experience section is served by a read-only API on Lambda, spec-first with OpenAPI 3.1 and tested over the in-process host. GitHub Actions deploys every push with OIDC, so no AWS keys are stored anywhere.<br><sub>HTML · CSS · JavaScript · C# / .NET 10 · Lambda · DynamoDB · OpenAPI 3.1 · S3 · CloudFront · GitHub Actions</sub> |
| **Property search kiosk**<br><sub>[screen](https://github.com/mvcprogrammer/sandkey-display-web) · [API](https://github.com/mvcprogrammer/sandkey) · [try it live](https://display.lightsplitters.com/)</sub> | A touch-screen MLS kiosk in the window of a Clearwater Beach real estate office, running since 2009 and rebuilt in 2026. A React screen that keeps the layout the office knows by heart, over a fully tested serverless .NET API with secrets in SSM, rate limiting on the one endpoint that sends email, and OpenTelemetry tracing.<br><sub>React 18 · TypeScript · Vite · ASP.NET Core on .NET 10 · Lambda · SAM / CloudFormation · OpenTelemetry · xUnit</sub> |
| **[lightsplitters.com](https://lightsplitters.com)**<br><sub>[source](https://github.com/mvcprogrammer/lightsplitters.com)</sub> | The site for my photography studio, prerendered to static HTML. A second app in the same workspace is the template for every client's wedding site or family album, each served from its own S3 folder at its own subdomain with no AWS changes per client.<br><sub>Angular 22 · TypeScript · S3 · CloudFront Functions · Lambda + SES · Stripe</sub> |

## Tech stack

| Area | Tools |
| --- | --- |
| **Back end** | C# / .NET 10 and .NET Core, ASP.NET Core Web API and MVC, minimal APIs, EF Core, Dapper, MediatR, SignalR, OpenAPI, RabbitMQ, Hangfire, Polly |
| **Front end** | Angular, React, TypeScript, vanilla JavaScript, HTML / CSS, Vite |
| **Data** | SQL Server: complex queries, stored procedures, indexing, execution plans, performance tuning, deadlock diagnosis. DynamoDB single-table design |
| **Cloud and delivery** | AWS Lambda, S3, CloudFront, Route 53, IAM, SSM, SAM / CloudFormation, GitHub Actions with OIDC, Azure DevOps, Docker |
| **Quality** | xUnit, NUnit, NSubstitute, Moq, Telerik JustMock, WebApplicationFactory integration tests, analyzers as build errors, OpenTelemetry, Serilog, Datadog |
| **Domains** | Accounting (GL, AR/AP, bank reconciliation, QuickBooks API) · Healthcare (HL7 v2, FHIR, HIPAA) · Real estate (Stellar MLS via the Bridge Data Output API) · Financial trading systems |

<br>

<div align="center">
<sub>Résumé, freelance, and contact: <a href="https://mvcprogrammer.com/#resume">mvcprogrammer.com</a></sub>
</div>
