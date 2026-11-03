# HL7 ETL

The integration-engine job every health system runs, shown end to end on this stack. HL7 v2 messages
(ADT^A01 admissions, ORU^R01 results) land in a Postgres integration table, a .NET console claims them in
batches, parses them into FHIR R4 resources, and bulk-loads the public HAPI sandbox through transaction
bundles. The [patient explorer](https://fhir.mvcprogrammer.com/) then lists what landed. Synthetic data
only: the cohort is generated in the repo, nothing real passes through.

It exists to be read as much as to be run. The pieces are the ones a real engine needs: a landing table
that is the only record of progress, a loader that can crash or be redelivered without duplicating a
thing, mapping that fails one message at a time, and tests at every seam. The step-by-step demo, with
the commands and what to say at each, is [docs/HL7-ETL-DEMO.pdf](../../../docs/HL7-ETL-DEMO.pdf) (built by
`docs/pdf/build_hl7_demo.py`).

## Run it

```bash
brew install postgresql@17 && brew services start postgresql@17 && createdb hl7_etl   # once, on a Mac

# From the repo root.
dotnet run --project api/src/Hl7.Etl -- migrate                   # create or update the hl7 schema; idempotent
dotnet run --project api/src/Hl7.Etl -- generate --patients 25    # land 25 admissions and about 40 results; a rerun lands nothing
dotnet run --project api/src/Hl7.Etl -- load                      # parse and bulk-load the sandbox, one transaction bundle per batch
dotnet run --project api/src/Hl7.Etl -- status                    # pending, claimed, processed, failed
dotnet run --project api/src/Hl7.Etl -- requeue                   # put every processed message back; load again and nothing duplicates
```

For a demo, build once and call the binary, so each step answers without a compile:

```bash
dotnet build api/src/Hl7.Etl -c Release
B=api/src/Hl7.Etl/bin/Release/net10.0/Hl7.Etl
$B status && $B generate --patients 25 && $B load && $B requeue && $B load
```

The public sandbox is wiped now and then. Run `generate` and `load` again before showing it; the landing
table still holds every message, so `requeue` then `load` also brings the cohort back.

## Commands

| Command    | Arguments                              | What it does                                                                                                                                                                 | Exit code                                                              |
|------------|----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| `migrate`  |                                        | Applies every file in `Sql/` not yet recorded in `hl7.schema_migrations`, in name order, each in its own transaction. Prints what it applied or that the schema is current. | 0                                                                      |
| `generate` | `--patients N` (25), `--seed S` (1)    | Generates the synthetic cohort for the seed and lands each message. Prints how many landed and how many had already landed.                                                  | 0                                                                      |
| `load`     | `--batch-size N` (25), `--max-batches M` (100) | Claims pending messages in batches, maps each, posts one transaction bundle per batch, settles the batch. Prints the run summary.                                     | 0 when every batch and every message succeeded, otherwise 1            |
| `requeue`  |                                        | Puts every processed message back in the queue, to replay the feed. Prints how many.                                                                                         | 0                                                                      |
| `status`   |                                        | Prints the landing table at a glance: pending, claimed, processed, failed.                                                                                                   | 0                                                                      |
| `help`     |                                        | Prints the command list.                                                                                                                                                     | 0 for `help`, 2 for an unknown command                                 |

Ctrl-C cancels the run cleanly (exit 130). A `load` cut off mid-batch leaves that batch claimed; the next
run after the stale window takes it again.

## Configuration

Options bind from the `Etl` configuration section through the Options pattern and are validated at startup,
so a bad value fails before anything runs. Set them as environment variables (`Etl__BatchSize=50`). The
connection string has a shortcut because it is the one value every environment sets.

| Option              | Default                                  | Meaning                                                                                                                              |
|---------------------|------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| `ConnectionString`  | `Host=localhost;Database=hl7_etl`        | Npgsql connection string of the landing database. `HL7_ETL_CONNECTION` overrides it.                                                  |
| `FhirBaseUrl`       | `https://hapi.fhir.org/baseR4`           | The FHIR R4 server the loader writes to; the same public sandbox the explorer reads.                                                  |
| `IdentifierSystem`  | `https://mvcprogrammer.com/fhir/etl`     | The identifier system stamped on every resource the ETL writes, so one search lists the cohort and a rerun matches instead of creating. |
| `BatchSize`         | 25 (1 to 500)                            | Messages claimed per batch; one transaction bundle per batch. `--batch-size` overrides it for one run.                                |
| `StaleClaimMinutes` | 10                                       | A claim older than this belongs to a run that died and is claimed again.                                                               |
| `AttemptTimeoutMs`  | 30000                                    | Per-attempt timeout of a request to the FHIR server.                                                                                   |
| `TotalTimeoutMs`    | 90000                                    | Total budget of one request across retries.                                                                                            |
| `RetryCount`        | 2 (1 to 5)                               | Retries after the first attempt, exponential backoff with jitter. Safe because every bundle is idempotent.                             |

## The landing table

One row per message as received, in `hl7.messages`. The raw text is kept whole so a mapping change can be
replayed from the source. The control id from MSH-10 is unique, so a redelivered message lands once and
`generate` can be rerun. Progress lives in three nullable columns and nowhere else:

| State     | `claimed_at` | `processed_at` | `last_error` | Meaning                                                                                   |
|-----------|--------------|----------------|--------------|-------------------------------------------------------------------------------------------|
| pending   | null         | null           | null         | Landed, not yet taken by a run.                                                           |
| claimed   | set          | null           | any          | Held by a run in progress, or by one that died (claimed again once the claim goes stale). |
| failed    | set          | null           | set          | The last attempt failed for the reason recorded; retried after the stale window.          |
| processed | null         | set            | null         | Loaded; `fhir_bundle_id` holds the server's id for the transaction response that took it. |

`attempt_count` goes up on every claim, so a message that keeps failing is visible from the row. `status`
counts a failed message under pending as well, because it is still work to do.

The application holds no SQL of its own beyond the one-line function calls and the migrator's bootstrap:
the Postgres equivalent of the stored-procedure path in the coding standard. A Postgres procedure cannot
return rows, so these are functions selected from, with typed parameters.

| Function                                 | Called by  | What it does                                                                                                                       |
|------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------------------------|
| `hl7.messages_insert(...)`               | `generate` | Inserts one message; returns the new id, or null when the control id had already landed, so the caller counts both in one call.   |
| `hl7.messages_claim(batch, stale_after)` | `load`     | Takes up to a batch of unprocessed rows in arrival order with `FOR UPDATE SKIP LOCKED`, stamps the claim and the attempt, returns them. |
| `hl7.messages_complete(ids, bundle_id)`  | `load`     | Marks a batch processed with the response bundle's id and clears the claim and the error.                                          |
| `hl7.messages_fail(ids, error)`          | `load`     | Records the reason and keeps the claim, so the same run does not take the batch again at once.                                     |
| `hl7.messages_requeue()`                 | `requeue`  | Clears `processed_at`, the claim, the error, and the bundle id on every processed row.                                             |
| `hl7.messages_status()`                  | `status`   | The four counts.                                                                                                                   |

The files under `Sql/` ship beside the binary. `migrate` applies each once and records it, so a change
to a function is a new file (`003_fail_keeps_claim.sql` replaces the `messages_fail` of `001`), never an
edit to an applied one.

## The mapping

`MessageMapper` reads MSH-9 and hands the message to the mapper for its type. Each resource carries an
identifier under the ETL system, which is what the conditional create matches on.

| Message | Resource    | Fields                                                                                                                                                                                                                                                                                                                 |
|---------|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ADT^A01 | Patient     | PID-3 MRN as an identifier typed MR (the explorer shows it as the MRN), PID-5 official name, PID-8 sex, PID-7 birth date.                                                                                                                                                                                               |
| ADT^A01 | Encounter   | In progress. PV1-2 class as a v3 ActCode, PV1-3 ward as the location, PV1-19 visit number as an identifier typed VN, PV1-44 admit time. References the patient.                                                                                                                                                         |
| ORU^R01 | Observation | One per OBX. LOINC code and display from OBX-3, numeric value with its UCUM unit from OBX-5 and OBX-6, status from OBX-11, effective time from OBX-14 (OBR-7 when absent), category from the panel in OBR-4 (vital signs or laboratory). Identifier is the control id plus the OBX set id. References the patient and the encounter. |

References are written as conditional references, `Patient?identifier=system|mrn`, and resolved by the
loader (below). A message that cannot be mapped raises `Hl7MappingException` with the control id, the
location (`PID.7`, `OBX[3].2`), and the reason; the loader records that against the one row and the batch
goes on without it.

## The load

A batch of claimed messages becomes one transaction bundle. Every entry is a `POST` with `ifNoneExist` on
the ETL identifier, so the server creates what is new and answers 200 for what it already has. That is
what makes the whole feed replayable: `requeue` then `load` reports every resource already present and
nothing created, which is the property a real engine needs after a crash or a redelivery.

The public sandbox refuses conditional references inside a bundle, so the loader resolves them first. A
reference to a patient or encounter in the same batch becomes an in-bundle `urn:uuid` reference. A
reference to one loaded by an earlier batch is resolved to `Patient/{id}` by one identifier search per
target per batch. A message whose target is not on the server yet is failed alone and retried later.

The bundle goes through `IHttpClientFactory` with the standard resilience handler: attempt and total
timeouts, retries with jitter, the values in the options above. A batch the server rejects
(`BundleRejectedException`, carrying the status and the OperationOutcome text), or that does not answer
within the budget, is marked failed with the reason and keeps its claim, so the same run does not spin on
it; the run after the stale window retries it. The run stops when nothing is pending or `--max-batches`
batches have been claimed.

## Tests

```bash
dotnet test --project api/tests/Hl7.Etl.Tests
HL7_ETL_TEST_CONNECTION="Host=localhost;Database=hl7_etl_test" dotnet test --project api/tests/Hl7.Etl.Tests
```

- `Generators/`: the same seed gives the same messages, every message parses back with the fields the mapper
  reads, values keep their precision, and the patients are distinct.
- `Mappers/`: every mapping path and every failure, a round trip through the Firely serializer, and the
  bundle builder's conditional creates and in-bundle references.
- `Services/`: the loader over an in-memory repository and a scripted HTTP handler (`Fakes/`): a clean
  run, a mapping failure inside a batch, a rejected batch, a timeout, an unresolved reference, the batch cap.
- `Databases/`: the repository against a real Postgres, as the coding standard asks of data-access code.
  These drop and recreate the `hl7` schema of the database named by `HL7_ETL_TEST_CONNECTION` and are
  skipped without it. CI runs them against a Postgres service container.

## Layout

```
api/src/Hl7.Etl/
  Program.cs                The commands: migrate, generate, load, requeue, status. Argument parsing and the exit codes.
  Sql/                      The hl7 schema and its functions, applied by migrate once each (see The landing table).
  Configurations/           EtlOptions (see Configuration).
  Databases/                MessageRepository: one Npgsql connection per call, one function per method, typed parameters.
  Exceptions/               Hl7MappingException (control id, location, reason) and BundleRejectedException (status, OperationOutcome text).
  Extensions/               AddEtlServices: options, the one NpgsqlDataSource, the repository, the commands, the resilient HttpClient.
  Generators/               SyntheticCohortGenerator (deterministic per seed), the value tables it draws from, and
                            Hl7MessageComposer (HL7-V2 library, v2.5.1).
  Interfaces/               IMessageRepository and IBundleClient, so the loader is tested without Postgres or the network.
  Mappers/                  LandedMessageMapper (reader rows to records by ordinal); MessageMapper, AdmissionMapper, and
                            ResultMapper (HL7 v2 to FHIR R4); Hl7Values (typed field reads); EtlIdentifiers; BundleBuilder.
  Models/                   InboundMessage and LandedMessage (a row before and after landing), LandingStatus, BatchOutcome, LoadSummary.
  Services/                 MigrationService, GenerateService, LoadService, HttpBundleClient.
api/tests/Hl7.Etl.Tests/    xunit.v3 (see Tests).
```

## Design notes

- **Land first, transform later.** The raw message is the source of truth in the landing table; mapping
  is a function of it that can be rerun. Nothing is parsed on the way in beyond the MSH fields the row
  needs (control id, type, event, sending facility).
- **The landing table is the only record of progress.** No flags on a source table, no second queue.
  Claim with `SKIP LOCKED` in arrival order, settle in place, judge staleness by the claim time. Two
  loaders can run at once without taking the same batch.
- **Fail one message, not the batch.** A message that cannot be mapped or whose target is missing is set
  aside on its own row; the rest of the batch still loads. Only a server rejection or a timeout fails the
  whole batch, because the bundle is one transaction.
- **Idempotent by construction.** Unique control id on the way in, conditional create on the way out,
  identifiers derived from the message rather than generated. Retrying, replaying, and redelivering all
  converge on the same server state.
- **Deterministic cohort.** The same seed gives the same patients, visits, and values, so a demo reruns
  and a test asserts exact messages. Every observation is LOINC-coded with UCUM units, so the mapper
  carries both into FHIR unchanged. Names and values are invented.
- **HL7-V2 over nHapi.** MIT-licensed, targets .NET 10, parses and composes without a per-version schema.
  nHapi is MPL-2.0, targets netstandard2.0, and carries a far larger object model than a demo needs.
- **Found by running it.** Two lessons shaped the loader after the first run against the public server: it
  refuses conditional references inside a bundle (hence the in-bundle references and the identifier lookup),
  and a failed batch that released its claim was taken again by the same run until the batch cap (hence
  `003_fail_keeps_claim.sql`). Both are covered by tests.
