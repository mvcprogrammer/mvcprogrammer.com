# FHIR R4 patient explorer

The patient explorer from the FHIR API card, as an Angular 22 application of its own, served at
[fhir.mvcprogrammer.com](https://fhir.mvcprogrammer.com). It started as a copy of the Angular
edition's explorer component, its typed client, models, and tests (see `../angular`), so the two
can evolve apart: the editions keep a card that opens this app, and every feature of the explorer is
built once, here. The C# API behind it is in `../api/src/Fhir.Api`.

## Layout

```
fhir/
  scripts/sync-shared.mjs       Copies the shared root files into public/ before every build and serve.
  src/index.html                The shell: metadata, the shared stylesheet link, the boot screen.
  src/fhir.css                  The only extra stylesheet: the Angular palette, boot screen, host elements, page layout, validation.
  src/main.ts                   Bootstraps App with app.config.ts.
  src/app/app.ts                Layout: skip link, icon sprite, header, <main> with the router outlet, footer.
  src/app/app.config.ts         Router, global error listeners, and provideSite() with the API base and the site URL.
  src/app/app.routes.ts         "" is the explorer page; everything else is NotFound.
  src/app/pages/                Explorer (the one page; starts the engagement tracker) and NotFound.
  src/app/components/           The explorer (search, summary, the edit panel for the four writes, the log), the header (brand
                                back to the site, theme toggle), footer, icon and sprite, social links.
  src/app/configurations/       SiteOptions and its injection token.
  src/app/interfaces/           FhirClient, DemoSession (the session token and idempotency keys), and EngagementTracker: abstract
                                classes that double as injection tokens.
  src/app/services/             HttpFhirClient over HttpClient (reads and writes), BrowserDemoSession (sessionStorage), and the beacon
                                tracker (GET /ping, mirrored from ../main.js).
  src/app/providers/            provideSite(): validates the options and registers everything above.
  src/app/models/, requests/    Interfaces matching the FHIR section of ../api/openapi.yaml, PatientInput and the JSON Patch
                                operation among them.
  src/app/enumerations/         ClinicalStatus and Sex.
  src/app/exceptions/           FhirProblemError, built from an RFC 9457 problem response.
  src/app/validators/           notBlank, for the family-name field.
  src/testing/                  Fakes, fixtures, and helpers shared by the specs.
```

The stylesheet (which carries the explorer's `.fhir-*` rules), the theme script, fonts, images, and
icons are copied into `public/` from the repository root by `scripts/sync-shared.mjs`, which the
`prebuild` and `prestart` npm scripts run. `public/` is generated and is not committed.

Component styles are not used anywhere: Angular would inject them as inline `<style>` elements,
which the site's Content Security Policy forbids. The few additions live in `src/fhir.css`, and the
production build has critical-CSS inlining switched off for the same reason. Every component host
element gets `display: contents` there.

The explorer's markup is the editions' with the headings stepped up (the explorer title is the
page's `h1`), since here it is the page rather than a panel inside a card.

## Run it

Node 24 and npm. All commands run from `fhir/`.

```bash
npm ci
npm start                              # http://localhost:4200, copies the shared files first
npm run build                          # dist/fhir-explorer/browser/
```

```bash
npm test                               # run the suite once (Vitest on jsdom)
npm run test:watch                     # re-run on change
npx ng test --watch=false --filter "FhirExplorer"       # one suite or test by name
```

The edit panel is the write side of the demo. Every write carries the session token (`X-Demo-Session`,
a UUID kept in `sessionStorage` for the life of the tab), a create carries an idempotency key the
explorer reuses until the create succeeds, and a patch is built as a JSON Patch of the fields that
changed since the patient was loaded, each guarded by a `test` of the old value. The function decides
what is allowed: the seeded patient is read-only, and only a patient this session created can be
replaced, patched, or deleted. The panel says which case the selected patient is. With nothing selected the
form holds the new-patient defaults (family name Patient, given name Demo, MRN mvcprogrammer.com), so Create
works without typing; loading a patient replaces them with that patient's own values.

The dev server has no `/api`, so the capability check fails and the explorer says so in its log.
Serve the build output behind the real CloudFront behaviors (or any host that proxies `/api/fhir`)
to search.

## Hosting

Published to the `fhir/` prefix of the `mvcprogrammer.com` bucket and served by its own CloudFront
distribution with its own ACM certificate and Route 53 alias, with the FHIR API as a second origin
behind `/api/fhir/*`. A 403 from S3 (any path that is not a file) returns `index.html` so the
Angular router answers deep links. Details in [docs/DEPLOY.md](../docs/DEPLOY.md).
