# The APIs behind mvcprogrammer.com

Two small, public functions, both C# on .NET 10 on AWS Lambda (arm64) behind CloudFront
behaviors under `/api`, both specified in the one `openapi.yaml` before any code:

- **Experience API** (`/api/experience`, `/api/skills`): the source of truth for the Experience
  section of [mvcprogrammer.com](https://mvcprogrammer.com), reading a single DynamoDB table.
- **FHIR API** (`/api/fhir/*`): the function behind the [patient explorer](https://fhir.mvcprogrammer.com/),
  a facade over a public FHIR R4 sandbox of synthetic records. See [FHIR API](#fhir-api) below.

Beside them, one tool that is not a function: the **HL7 ETL** (`api/src/Hl7.Etl`), a console that lands
HL7 v2 messages in Postgres and loads them into the same sandbox as FHIR R4. See [HL7 ETL](#hl7-etl).

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
  Endpoints/                /api/fhir/patients (GET, POST), .../{id} (PUT, PATCH, DELETE), .../{id}/conditions (POST),
                            .../{id}/conditions/{conditionId}/resolve (POST), .../{id}/summary, .../{id}/raw,
                            /api/fhir/capability, /api/fhir/health.
  Fhir/                     IFhirGateway over a Firely FhirClient: read, search with paging, _summary=count, metadata,
                            conditional create, update, delete; the upstream and write exceptions; CapabilityCache;
                            DemoIdentifiers and ConditionPickList (the ten SNOMED CT conditions a visitor may add).
  Services/                 PatientExplorerService (the Patient first, then four bounded searches concurrently),
                            DemoGuardService (seeded patient 403, not this session's 404), PatientWriteService,
                            ConditionWriteService (pick list, active cap, conditional create).
  Mapping/                  PatientMapper, ConditionMapper, VitalSignMapper, CapabilityMapper (US Core fields only);
                            PatientInputMapper / Validator / PatchApplier and ConditionInputMapper for the writes.
  Http/                     Two RateLimiters and the endpoint filters (read and write budgets, upstream and write problems).
  Models/                   Records matching the schemas in openapi.yaml.
```

## Run it

```bash
# From the repo root. Reads the public HAPI sandbox; no AWS credentials needed.
API_VERSION=1.0.0 dotnet run --project api/src/Fhir.Api
curl -s "http://localhost:5000/api/fhir/patients?identifier=mvcprogrammer.com" | jq '.count, .items[0], .trace'   # every record carrying the demo MRN (the explorer opens on this plus family=Programmer)
curl -s "http://localhost:5000/api/fhir/patients?family=Smith" | jq '.count, .items[0], .trace'                  # family or identifier, at least one
curl -s http://localhost:5000/api/fhir/patients/<id>/summary | jq '.patient, .counts, .trace.totalDurationMs'
curl -s http://localhost:5000/api/fhir/capability | jq .ok

dotnet test --project api/tests/Fhir.Api.Tests
```

`FHIR_BASE_URL` switches the sandbox; `https://r4.smarthealthit.org` is the fallback when HAPI is
wiped or down. `FHIR_SOURCE_NAME` is the label the trace carries.

## Design notes

- **Writes under a demo guard.** `POST /fhir/patients` and `PUT`, `PATCH` (JSON Patch), and `DELETE`
  on `/fhir/patients/{id}` are open to visitors of the explorer (specified in `openapi.yaml` 1.2.0,
  built in 1.3.0). `PatientWriteService` enforces the guard: the seeded patient is read-only (403), a
  session can only change what it created (every created patient carries the `X-Demo-Session` token
  as an identifier; anything else is 404, so other records cannot be probed), creates are idempotent
  through a FHIR conditional create on `Idempotency-Key` (a repeat answers 200), and writes have their
  own per-address budget plus a cap of patients per session (429). `PatientInput` is the only shape
  that reaches the sandbox; the patch applier (`PatientPatchApplier`) covers the six RFC 6902
  operations over its five fields in-house, since a general JSON Patch library would need a mutable
  model and brings nothing the five scalar paths need.
- **Delete cascades to conditions.** The sandbox enforces referential integrity: a `DELETE Patient/{id}`
  answers 409 while a `Condition` references it, which #190 made reachable. `PatientWriteService.DeleteAsync`
  therefore lists the patient's conditions (bounded by the condition page size and the page cap) and deletes
  each before the patient, under the same guard; a condition already gone is skipped, so a retry after a
  partial failure finishes the job, and a failed condition delete leaves the patient in place with the usual
  502. HAPI's `_cascade` extension is not used: it is not FHIR and the SMART fallback lacks it.
- **Conditions, the first clinical write.** `POST /fhir/patients/{id}/conditions` (specified in
  `openapi.yaml` 1.4.0, built in 1.5.0) records one of ten listed conditions. `ConditionPickList` is
  the source of truth (a well-formed code off it is 422 before any upstream call), `DemoGuardService`
  is the same guard the patient writes run (403 for the seeded patient, 404 for anyone else's), the
  cap of active conditions per patient is counted on the sandbox (`clinical-status=active`,
  `_summary=count`; at the cap, 422), and the create is a FHIR conditional create on patient, code,
  and active status, so a repeat answers 200 with the existing resource and a resolved condition can
  be recorded again. `ConditionInputMapper` builds the resource and both searches; nothing the
  visitor sends reaches the sandbox but a listed code.
- **Resolve, the one action in a path.** `POST /fhir/patients/{id}/conditions/{conditionId}/resolve`
  (specified in `openapi.yaml` 1.6.0, built in 1.7.0): the same guard first (403 seeded, 404 for a
  foreign patient), then the condition is read and must reference that patient (else the same 404, so
  nothing can be probed), then one `PUT` with `clinicalStatus` resolved and `abatementDateTime` today,
  skipped when it is already resolved, so 204 is idempotent and a repeat costs no write. The
  operation's description records why a `POST` to a sub-resource beat a `PATCH`, a `PUT`, and a `DELETE`;
  `ConditionInputMapper.ToResolved` and `References` carry the transition and the ownership check.
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

# HL7 ETL

The integration-engine job every health system runs, shown end to end on this stack: HL7 v2 messages
(ADT^A01 admissions, ORU^R01 results) land in Postgres integration tables, a .NET console parses them
into FHIR R4 resources and bulk-loads the public HAPI sandbox through transaction bundles, and the
[patient explorer](https://fhir.mvcprogrammer.com/) lists what landed. Synthetic data only: the cohort is
generated in the repo, nothing real passes through. Built as an epic of four slices; this section grows
with them.

## Layout

```
api/src/Hl7.Etl/
  Program.cs                The commands: migrate, generate, status (load arrives with slice 3).
  Sql/                      The hl7 schema: the messages landing table and the functions the repository calls
                            (insert, claim a batch with SKIP LOCKED, complete, fail, status). Applied by migrate, once each.
  Configurations/           EtlOptions (Options pattern; HL7_ETL_CONNECTION overrides the connection string).
  Databases/                MessageRepository: one Npgsql connection per call, one function per method, typed parameters.
  Mappers/                  LandedMessageMapper (reader rows to records by ordinal); MessageMapper, AdmissionMapper, and
                            ResultMapper (HL7 v2 to FHIR R4, see below); Hl7Values (typed field reads); EtlIdentifiers.
  Exceptions/               Hl7MappingException: the control id, the location (PID.7, OBX[3].2), and the reason.
  Generators/               SyntheticCohortGenerator (deterministic per seed) and Hl7MessageComposer (HL7-V2 library, v2.5.1).
  Services/                 MigrationService and GenerateService.
api/tests/Hl7.Etl.Tests/    Generator tests (compose, then parse back), mapper tests (every path, every failure, a Firely
                            round trip), and repository tests against a real Postgres.
```

## Run it

```bash
brew install postgresql@17 && brew services start postgresql@17 && createdb hl7_etl   # once, on a Mac
dotnet run --project api/src/Hl7.Etl -- migrate                   # create or update the hl7 schema; idempotent
dotnet run --project api/src/Hl7.Etl -- generate --patients 25    # land 25 admissions and about 40 results; a rerun lands nothing
dotnet run --project api/src/Hl7.Etl -- status                    # pending, claimed, processed, failed

HL7_ETL_TEST_CONNECTION="Host=localhost;Database=hl7_etl_test" dotnet test --project api/tests/Hl7.Etl.Tests
```

The connection string defaults to `Host=localhost;Database=hl7_etl`; `HL7_ETL_CONNECTION` overrides it. The
repository tests drop and recreate the `hl7` schema of the database named by `HL7_ETL_TEST_CONNECTION`
and are skipped without it; CI runs them against a Postgres service container.

## Design notes

- **Postgres functions as the data path.** The application holds no SQL of its own beyond the one-line
  function calls and the migrator's bootstrap: the Postgres equivalent of the stored-procedure path in the
  coding standard. A Postgres procedure cannot return rows, so these are functions selected from.
- **Land once, claim in batches.** MSH-10 (the message control id) is unique, so a redelivered message
  lands once and `generate` is idempotent. `messages_claim` takes pending rows in arrival order with
  `FOR UPDATE SKIP LOCKED`, stamps the claim and the attempt, and treats a claim older than the stale
  window as abandoned; `complete` and `fail` settle a batch in place. The landing table is the only record
  of progress.
- **Deterministic cohort.** The same seed gives the same patients, visits, and values, so a demo reruns
  and a test asserts exact messages. Every observation is LOINC-coded with UCUM units, so the mapper can
  carry both into FHIR unchanged.
- **The mapping.** ADT^A01 gives a Patient (PID-3 MRN as an identifier typed MR, PID-5 official name,
  PID-8 sex, PID-7 birth date) and an in-progress Encounter (PV1-2 class as v3 ActCode, PV1-3 ward,
  PV1-19 visit number as an identifier typed VN, PV1-44 admit time). ORU^R01 gives one Observation per
  OBX: LOINC code and display from OBX-3, the numeric value with its UCUM unit from OBX-5 and OBX-6,
  status from OBX-11, time from OBX-14 (OBR-7 when absent), the category from the panel in OBR-4
  (vital signs or laboratory). Every resource carries an identifier under the ETL system, and
  encounters and observations reference the patient (and the encounter) by conditional reference,
  `Patient?identifier=system|mrn`, which the loader resolves in-bundle when both land in one batch. A
  message that cannot be mapped raises `Hl7MappingException` naming the control id, the field, and the
  reason; the loader records it against the row and the batch goes on.
- **HL7-V2 over nHapi.** MIT-licensed, targets .NET 10, parses and composes without a per-version schema;
  nHapi is MPL-2.0 and targets netstandard2.0 with a far larger object model than a demo needs.
