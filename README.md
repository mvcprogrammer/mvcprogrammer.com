# Hi, I'm Neal Thomas

**Senior Full-Stack Software Engineer** · C# / .NET Core · Angular · SQL Server · AWS
Tampa Bay, Florida · 15+ years building enterprise API applications

[![Website](https://img.shields.io/badge/mvcprogrammer.com-0A66C2?style=flat&logo=googlechrome&logoColor=white)](https://mvcprogrammer.com)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/mvcprogrammer/)
[![Email](https://img.shields.io/badge/neal.thomas%40mvcprogrammer.com-2F62D9?style=flat&logo=minutemailer&logoColor=white)](mailto:neal.thomas@mvcprogrammer.com)

I build back ends that run around the clock and front ends people like using. Most recently I re-architected a legacy polling Windows service into an event-driven **RabbitMQ** pipeline that processes **1M+ API requests, 24/7**. Before that I built and maintained a proprietary accounting system (general ledger, receivables, payables, bank reconciliation, financial reporting) on Angular and ASP.NET Core.

---

## Live projects

The three cards in the [portfolio](https://mvcprogrammer.com/#portfolio), in the same order. Each is mine end to end: design, code, infrastructure, and deployment. All three run on **AWS**.

### [mvcprogrammer.com](https://mvcprogrammer.com) · this repo

My portfolio, written in **plain HTML, CSS, and vanilla JavaScript**. No framework, no build step, no dependencies.

- **Hand-written front end:** mobile-first responsive CSS, automatic light/dark theme via `prefers-color-scheme`, self-hosted fonts, accessible markup (ARIA, semantic landmarks), and structured data (JSON-LD) for search. Progressive enhancement: the Experience timeline is in the HTML and is re-rendered from the API with a skill filter once it answers.
- **Serverless static hosting on AWS:** private **S3** bucket behind **CloudFront** with Origin Access Control, **ACM** TLS certificate, **Route 53** DNS, HTTP/2 + HTTP/3.
- **Hardened by default:** a strict Content Security Policy (no inline script, nothing third-party), HSTS, and security headers set by a CloudFront response headers policy; a **CloudFront Function** redirects `www` to the apex.
- **CI/CD with no stored secrets:** **GitHub Actions** deploys every push to `main`, syncing to S3 and invalidating CloudFront, authenticated with **OIDC** and a least-privilege IAM role.
- **Experience API:** a read-only **C# / .NET 10** minimal API on **AWS Lambda** (arm64) behind CloudFront at `/api/*`, reading a single **DynamoDB** table. Spec-first (the OpenAPI 3.1 contract was committed before the code), a repository facade with a hand-rolled mapper, ETag and Cache-Control caching, RFC 9457 problem details, an IAM-only function URL that accepts only CloudFront, and xunit tests over the in-process host. Write endpoints are specified and stubbed. Details: [api/README.md](api/README.md).

The stack, as listed on the site: HTML · CSS · Vanilla JavaScript · JSON-LD · C# / .NET 10 on Lambda · DynamoDB · OpenAPI 3.1 · Amazon S3 · CloudFront + OAC · CloudFront Functions · ACM · Route 53 · IAM · GitHub Actions (OIDC) · Content Security Policy

Full infrastructure walkthrough: [docs/DEPLOY.md](docs/DEPLOY.md)

### Interactive property search kiosk · [sandkey-display-web](https://github.com/mvcprogrammer/sandkey-display-web) + [SandKey](https://github.com/mvcprogrammer/sandkey)

A touch-screen property kiosk behind the window of a Clearwater Beach real estate office, running since 2009. The screen shows an aerial photograph of Sand Key with two buttons, sales and rentals, and lets a visitor browse active MLS listings from the Bridge Data Output (Stellar MLS) feed, look at photos, and ask to be emailed details or called back. The 2026 rebuild has two halves, both on AWS.

**Try it live:** the [kiosk card on the site](https://mvcprogrammer.com/#portfolio) has a "Try the live kiosk" button that opens the real [display.lightsplitters.com](https://display.lightsplitters.com/) in a dialog, scaled to your window. The iframe is created only when the dialog opens and removed when it closes, so the kiosk's Lambda is reached only by visitors who ask; the site's Content Security Policy allows that one `frame-src`. Open the kiosk's URL directly on a laptop or phone and it fits itself the same way.

**The screen** ([sandkey-display-web](https://github.com/mvcprogrammer/sandkey-display-web)) is a **React 18** + **TypeScript** single-page app built with **Vite**, fixed to the kiosk's 1920×1080 glass.

- **A port, not a redesign:** the office knows the 2013 layout by muscle memory, so the original stylesheet and class names were carried over and every component renders them. Twelve screens captured from the live kiosk are the golden reference, and the development fixtures are extracted from those captures. An automated check confirms every class name the live kiosk renders is present in the source.
- **Pixel-level details:** the on-screen keyboard and keypad sit on background artwork that draws the key faces, so each key's geometry is tabulated to line up with the image.
- **Seven deliberate departures, documented:** a pluralisation bug fixed, rentals routed to their own detail page, photos loaded straight from the Bridge CDN instead of proxied through the app tier, a "Loading..." state while the Lambda warms, and three changes the office asked for in September 2026, including dropping the confusing building-selection overlay.
- **Legacy behaviour kept where it matters:** routes keep their original shape, the modal keeps jquery.bpopup's 650ms timing, and the three-minute idle timer still returns to the lock screen, now surviving navigation instead of relying on full page loads.
- **Fits any window, kiosk untouched:** when the viewport is not 1920 wide, a `Stage` component wraps the screen in a true 1920×1080 box and scales it with a CSS transform, letterboxed; the modal portals into that box so it scales too. At exactly 1920 wide, which is the office kiosk with or without browser chrome, nothing is wrapped and the DOM is byte-for-byte what it was, verified by screenshot comparison.
- **Mock API for local work:** a fixture server replays captured responses so the screens can be developed without MLS credentials; the Vite dev server proxies `/api` the way CloudFront does in production.

**The API** ([SandKey](https://github.com/mvcprogrammer/sandkey)) is the legacy ASP.NET Core 6 MVC backend redone as a clean, fully tested, serverless **.NET 10** API.

- **Serverless .NET:** ASP.NET Core on **.NET 10**, hosted in **AWS Lambda** (arm64, ReadyToRun) through `Amazon.Lambda.AspNetCoreServer.Hosting`. The same build runs locally under Kestrel.
- **Infrastructure as code:** one **AWS SAM / CloudFormation** stack creates Lambda and its function URL, a private **S3** bucket for the web bundle, the **ACM** certificate, the **Route 53** alias, and a **CloudFront** distribution. That distribution routes `/api/*` to Lambda and everything else to S3, with Origin Access Control signing both origins.
- **No secrets in the repo:** credentials come from **SSM Parameter Store** SecureStrings at startup, through a least-privilege IAM policy. Options are validated on start, so a missing secret stops the app at startup instead of failing on the first request.
- **Resilience and errors:** typed `HttpClient`s from `IHttpClientFactory` with the standard resilience handler (`Microsoft.Extensions.Http.Resilience`). Typed exceptions are mapped to **RFC 7807 ProblemDetails** (404 / 502 / 504) by a single `IExceptionHandler`. Every I/O method takes a `CancellationToken`.
- **Security and privacy:** a delegating handler adds the feed's access token only to outgoing requests, so it never appears in logged URLs. A fixed-window **rate limiter** guards the one endpoint that sends email. Visitor email addresses and phone numbers never reach a log line, and a test checks this.
- **Performance:** source-generated `System.Text.Json` serialization (no reflection, no `dynamic`), and listing photos load directly from the feed's CDN instead of passing through the API.
- **Observability:** **OpenTelemetry** tracing for ASP.NET Core and outbound HTTP, OTLP export, plus `/health` (liveness) and `/ready` (readiness, checks the feed).
- **Quality gates:** 100+ **xUnit** tests with **NSubstitute** and `FakeLogger<T>`, in-memory hosting via `WebApplicationFactory`, and `TreatWarningsAsErrors`, .NET analyzers, and `EnforceCodeStyleInBuild`, so style and XML docs are enforced by the compiler. NuGet versions are managed centrally.
- **Local dev:** hitting Run on the API also starts the Vite-built kiosk screen through `SpaProxy`. The proxy is a Debug-only reference, so it never ships in the Lambda package.

### [lightsplitters.com](https://lightsplitters.com) · Angular 22 on AWS · [source](https://github.com/mvcprogrammer/lightsplitters.com)

The website for LightSplitters Media, my photography studio in Tampa Bay: weddings, studio and pet portraits, family albums, and archival prints and framing. An **Angular 22** workspace (standalone components, signals, OnPush) holding two apps.

- **The main site** is prerendered to static HTML, so there is no server to run. All copy, prices, packages, and photo metadata live in content files rather than components, and a new line of business is a content entry plus a route.
- **Client sites from one build:** a second app is the template for every couple's wedding website and every family album. Each client is a folder in S3 holding a `site.json` and photos, served at its own `<slug>.lightsplitters.com` through a wildcard DNS record and certificate, so adding a client needs no AWS changes. A publish script copies the photos the JSON references and refuses to publish if one is missing.
- **Galleries and images:** masonry grid with filter chips, a native `<dialog>` lightbox with keyboard navigation, and a responsive `<picture>` component serving WebP and JPEG at two sizes with a crop focus per photo.
- **Small serverless back end:** the contact form posts to a **Lambda** Function URL that sends through **SES**; print orders go through **Stripe Payment Links** with no custom cart.
- **Hosting:** private **S3** behind **CloudFront** with Origin Access Control, **Route 53**, and an **ACM** wildcard certificate. A **CloudFront Function** maps each subdomain to its S3 folder, redirects `www` to the apex, and 301s retired URLs. A deploy script builds both apps, syncs with long-lived caching for hashed assets, refreshes every client folder, and invalidates CloudFront.

> Three projects, three deliberate choices: vanilla JavaScript where a framework would be overhead, Angular where an app structure pays off, and serverless .NET where an always-on server would only add cost.

---

## Tech stack

| Area | Tools |
| --- | --- |
| **Languages** | C#, TypeScript, JavaScript, SQL (T-SQL) |
| **Front end** | Angular 2+, vanilla JS, HTML / CSS, Vite, REST API consumption |
| **.NET & APIs** | .NET 10 / .NET Core, ASP.NET Core Web API & MVC, EF Core, Dapper, MediatR, AutoMapper, SignalR / WebSockets, OpenAPI / Swagger, ProblemDetails, rate limiting, source-generated System.Text.Json, OAuth 2.0 / JWT |
| **Databases** | SQL Server: complex queries, stored procedures, indexing, execution plans, performance tuning, deadlock diagnosis · DynamoDB (single-table design) |
| **Messaging & resilience** | RabbitMQ, AWS SQS / SNS, Hangfire, Polly, Microsoft.Extensions.Http.Resilience, async/await, TPL, `Parallel.ForEachAsync`, `SemaphoreSlim` |
| **Cloud & DevOps** | AWS (Lambda, DynamoDB, S3, CloudFront, Route 53, ACM, IAM, SSM Parameter Store, EC2, RDS, CloudWatch), AWS SAM / CloudFormation, GitHub Actions (OIDC), Azure DevOps, Docker, Git |
| **Observability** | OpenTelemetry, Serilog, Seq, Datadog, CloudWatch, health checks |
| **Architecture** | SOLID, CQRS, dependency injection, event-driven design, serverless, microservices, legacy modernization |
| **Testing** | xUnit, NUnit, Telerik JustMock, Moq, NSubstitute, WebApplicationFactory integration tests, .NET analyzers as build errors |
| **Domains** | Accounting (GL, AR/AP, bank reconciliation, QuickBooks API) · Healthcare (HL7 v2, FHIR, HIPAA) · Real estate (Stellar MLS via the Bridge Data Output API: listings, photos, paging, token handling) · Financial trading systems (day-trading platforms, 15 years in C++ before .NET) |
| **AI-assisted dev** | Claude / Claude Code, ChatGPT, LangChain |

---

## Highlights

- **Event-driven at scale:** designed a RabbitMQ publish/subscribe topology with durable queues, dead-letter handling, and Polly retries with exponential backoff, so traffic spikes are absorbed by the queue instead of dropped.
- **Healthcare interoperability:** always-on HL7 v2 and FHIR integrations with external systems in a HIPAA-regulated environment.
- **Accounting systems:** built a proprietary accounting platform designed to run without a traditional month-end close; CQRS with MediatR and real-time updates over SignalR.
- **MLS integration:** Stellar MLS listing data through the Bridge Data Output API, from the CENTURY 21 years to the 2026 kiosk rebuild; available for freelance Bridge API integration work.
- **Modernization:** led a platform migration from .NET Framework 3.x to .NET Core MVC, and rebuilt a 17-year-old kiosk backend as a serverless .NET 10 API ([SandKey](https://github.com/mvcprogrammer/sandkey)).

---

<sub>Résumé and code samples: [mvcprogrammer.com](https://mvcprogrammer.com)</sub>
