# The APIs behind mvcprogrammer.com

Two small, public functions, both C# on .NET 10 on AWS Lambda (arm64) behind CloudFront
behaviors under `/api`, both specified in the one `openapi.yaml` before any code:

- **Experience API** (`/api/experience`, `/api/skills`): the source of truth for the Experience
  section of [mvcprogrammer.com](https://mvcprogrammer.com), reading a single DynamoDB table.
- **FHIR API** (`/api/fhir/*`): the function behind the [patient explorer](https://fhir.mvcprogrammer.com/),
  a facade over a public FHIR R4 sandbox of synthetic records. See [FHIR API](#fhir-api) below.

# Experience API

It exists to be read as much as to be run. The contract came first, the code follows it, and
the pieces are the ones I reach for on real projects: a storage facade with a hand-rolled
mapper, a thin service layer for the rules, endpoints that only translate HTTP, and tests at
the seams.

## Layout

```
api/
  openapi.yaml              The contract for both functions. Written before any code; linted with Redocly.
  template.yaml             SAM: table, function, IAM-only function URL, CloudFront OAC + cache policy.
  template-fhir.yaml        SAM for the FHIR function (see below).
  seed/positions.json       The data. Serves local runs and tests; seeds DynamoDB.
  src/Api.Shared/           What both functions share: ETag + Cache-Control responses, RFC 9457 problems, JSON options.
  src/Experience.Api/       The function.
    Program.cs              Minimal API host. On Lambda, AddAWSLambdaHosting swaps in the event loop.
    Endpoints/              HTTP in, HTTP out. No rules here.
    Services/               Ordering, filtering, skill aggregation. Storage-agnostic.
    Data/                   IExperienceRepository facade; DynamoDB and JSON-file implementations; PositionMapper.
    Models/                 Records matching the schemas in openapi.yaml.
  src/Experience.Seed/      Console tool that loads positions.json into the table through the same mapper.
  src/Fhir.Api/             The FHIR function (see below).
  tests/Experience.Api.Tests/   xunit.v3: service rules, mapper round trips, and end-to-end over the in-process host.
  tests/Fhir.Api.Tests/     xunit.v3: mappers, the rate limiter, and end-to-end with a scripted fake sandbox.
```

## Run it

```bash
# From the repo root. Serves seed/positions.json; no AWS credentials needed.
dotnet run --project api/src/Experience.Api
curl -s http://localhost:5000/api/experience?skill=angular | jq
curl -si http://localhost:5000/api/experience/advancedmd | head -5

dotnet test --project api/tests/Experience.Api.Tests
```

Set `TABLE_NAME` and the app reads DynamoDB instead; that is how it runs on Lambda.

## Design notes

- **Spec first.** `openapi.yaml` is the contract. Endpoint names, status codes, headers, and
  schemas in code match it; the tests check the visible parts.
- **Facade, not ORM.** `IExperienceRepository` is the only thing the service sees. The DynamoDB
  implementation uses the low-level client and `PositionMapper`, a hand-written two-way map
  between `Position` and an item. The JSON-file implementation serves local runs and tests
  from the same seed file that loads the table, so the fixture and the data cannot drift.
- **Single table.** One partition (`RESUME`), one item per position (`POSITION#<id>`). A
  single `Query` returns the resume; `GetItem` fetches one. Sorting and skill aggregation
  happen in code because the data is small and the code is clearer than a GSI.
- **Cache by design.** Every data response carries a strong ETag (hash of the body) and
  `Cache-Control: public, max-age=300, s-maxage=3600`. CloudFront caches on path plus the
  `skill` query string, and honours `If-None-Match`, so the function rarely runs.
- **Errors are problems.** `application/problem+json` per RFC 9457, with stable `type` URIs.
  Unhandled exceptions become a 500 problem with nothing from the stack in the body.
- **Locked front door.** The function URL requires IAM auth and only CloudFront, signing
  with an origin access control, is permitted to invoke it. The raw URL answers 403.
- **Writes are specified, not built.** `POST`, `PUT`, and `DELETE` exist in the spec, the
  routes, and the facade, and answer `501` with a problem body. The function's IAM policy
  allows only reads until they ship. The seed tool is the write path for now.
- **Cold start.** .NET on arm64 with ReadyToRun and `CreateSlimBuilder`. The site keeps a
  server-rendered copy of the timeline as its fallback, so a cold start is never on the
  critical path for a reader.

Deployment, seeding, and the CloudFront wiring are in [docs/DEPLOY.md](../docs/DEPLOY.md).

# FHIR API

The function behind the [patient explorer](https://fhir.mvcprogrammer.com/), which the FHIR API card on every edition of mvcprogrammer.com opens, a patient
explorer over a public FHIR R4 sandbox that holds synthetic data only. It owns no data: every
request is answered from the sandbox, mapped at the boundary into the small DTOs in `openapi.yaml`
(tag `FHIR`), with a `trace` of the upstream calls for the page's "under the hood" panel.

## Layout

```
api/src/Fhir.Api/
  Program.cs                Minimal API host, same shape as the Experience one.
  Configuration/            FhirOptions: base URL, page cap, page sizes, timeouts, retry, rate limit, capability TTL.
  Endpoints/                /api/fhir/patients, .../{id}/summary, .../{id}/raw, /api/fhir/capability, /api/fhir/health.
  Fhir/                     IFhirGateway over a Firely FhirClient: read, search with paging, _summary=count, metadata;
                            UpstreamNotFound / UpstreamUnavailable / UpstreamTimeout; CapabilityCache.
  Services/                 PatientExplorerService: the Patient first, then four bounded searches concurrently.
  Mapping/                  PatientMapper, ConditionMapper, VitalSignMapper, CapabilityMapper (US Core fields only).
  Http/                     RateLimiter and the endpoint filters (rate limit, upstream problems).
  Models/                   Records matching the schemas in openapi.yaml.
```

## Run it

```bash
# From the repo root. Reads the public HAPI sandbox; no AWS credentials needed.
API_VERSION=1.0.0 dotnet run --project api/src/Fhir.Api
curl -s "http://localhost:5000/api/fhir/patients?family=Smith" | jq '.count, .items[0], .trace'
curl -s http://localhost:5000/api/fhir/patients/<id>/summary | jq '.patient, .counts, .trace.totalDurationMs'
curl -s http://localhost:5000/api/fhir/capability | jq .ok

dotnet test --project api/tests/Fhir.Api.Tests
```

`FHIR_BASE_URL` switches the sandbox; `https://r4.smarthealthit.org` is the fallback when HAPI is
wiped or down. `FHIR_SOURCE_NAME` is the label the trace carries.

## Design notes

- **The function is the boundary.** The browser never talks to the sandbox. Resources are parsed
  by the Firely SDK (`Hl7.Fhir.R4`) into typed objects and mapped to DTOs; only the raw-bundle
  endpoint passes FHIR JSON through, as a `collection` Bundle of what the summary fetched.
- **Bounded, not `$everything`.** A summary reads `Patient/{id}`, then runs `Condition?patient=`,
  `Observation?patient=&category=vital-signs`, and `_summary=count` for Encounter and Observation
  at once, each following `link[rel=next]` up to five pages. Counts are exact regardless of the
  cap; `trace.truncated` says when a list is not.
- **Resilient.** The named HttpClient carries Microsoft's standard resilience handler (Polly v8):
  6 s per attempt, two retries with exponential backoff and jitter, a circuit breaker, 22 s in
  total, under the 25 s Lambda timeout and CloudFront's 30 s origin limit. Timeouts become `504`
  problems, server errors and non-FHIR bodies `502`, a missing patient `404`; failures are
  `no-store`.
- **Capability, lazily.** The sandbox `CapabilityStatement` is read on first use and kept per
  instance for an hour, never on cold start. The endpoint reports only the resources and search
  parameters the explorer depends on, plus an overall `ok`.
- **A budget, not a WAF.** Sixty requests per address per ten minutes, per warm instance, in
  memory. CloudFront caching keeps most repeat requests off the function anyway.
- **ETags with a caveat.** Search and summary responses carry timings and a `generatedAt` stamp in
  the trace, so each origin render gets a new ETag; browsers still revalidate against CloudFront's
  cached copy within the TTL. The raw and capability responses are byte-stable and answer `304`.
- **Nothing stored, little logged.** No cookies, no analytics, no PHI (the data is synthetic), and
  the logs carry method, path, status, duration, and upstream timing.
- **Tests without a mocking library.** A scripted fake `HttpMessageHandler` plays the sandbox,
  including a hang, a 503, and a non-FHIR body, so the real resilience pipeline runs in the tests.

Deployment and the CloudFront wiring are in [docs/DEPLOY.md](../docs/DEPLOY.md), section FHIR API.
