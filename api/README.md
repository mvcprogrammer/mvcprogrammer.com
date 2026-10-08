# Experience API

A small, public, read-only API that is the source of truth for the Experience section of
[mvcprogrammer.com](https://mvcprogrammer.com). C# on .NET 10, hosted on AWS Lambda (arm64)
behind a CloudFront `/api/*` behavior, reading a single DynamoDB table.

It exists to be read as much as to be run. The contract came first, the code follows it, and
the pieces are the ones I reach for on real projects: a storage facade with a hand-rolled
mapper, a thin service layer for the rules, endpoints that only translate HTTP, and tests at
the seams.

## Layout

```
api/
  openapi.yaml              The contract. Written before any code; linted with Redocly.
  template.yaml             SAM: table, function, IAM-only function URL, CloudFront OAC + cache policy.
  seed/positions.json       The data. Serves local runs and tests; seeds DynamoDB.
  src/Experience.Api/       The function.
    Program.cs              Minimal API host. On Lambda, AddAWSLambdaHosting swaps in the event loop.
    Endpoints/              HTTP in, HTTP out. No rules here.
    Services/               Ordering, filtering, skill aggregation. Storage-agnostic.
    Data/                   IExperienceRepository facade; DynamoDB and JSON-file implementations; PositionMapper.
    Http/                   ETag + Cache-Control responses, RFC 9457 problems, shared JSON options.
    Models/                 Records matching the schemas in openapi.yaml.
  src/Experience.Seed/      Console tool that loads positions.json into the table through the same mapper.
  tests/Experience.Api.Tests/   xunit.v3: service rules, mapper round trips, and end-to-end over the in-process host.
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
  routes, and the facade, and answer `501` with a problem body. The function's IAM policy is
  read-only until they ship. The seed tool is the write path for now.
- **Cold start.** .NET on arm64 with ReadyToRun and `CreateSlimBuilder`. The site keeps a
  server-rendered copy of the timeline as its fallback, so a cold start is never on the
  critical path for a reader.

Deployment, seeding, and the CloudFront wiring are in [docs/DEPLOY.md](../docs/DEPLOY.md).
