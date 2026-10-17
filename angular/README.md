# Angular edition

The same site as the static page at the repository root, rebuilt as an Angular 22 application and
served at [angular.mvcprogrammer.com](https://angular.mvcprogrammer.com). It exists to show the
same content, the same stylesheet, and the same Experience API consumed from TypeScript components
with signals, next to the vanilla edition, the React edition in `../react`, and the Blazor edition in `../blazor`.

## Layout

```
angular/
  scripts/sync-shared.mjs       Copies the shared root files into public/ before every build and serve.
  src/index.html                The shell: metadata, the shared stylesheet link, the boot screen.
  src/angular.css               The only extra stylesheet: this edition's palette, boot screen, component host elements, validation.
  src/main.ts                   Bootstraps App with app.config.ts.
  src/app/app.ts                Layout: skip link, icon sprite, header, <main> with the router outlet, footer.
  src/app/app.config.ts         Router, global error listeners, and provideSite() with the endpoints.
  src/app/app.routes.ts         "" is Home; everything else is NotFound.
  src/app/pages/                Home (the sections in order; starts the engagement tracker) and NotFound.
  src/app/sections/             One component per section of the page, markup lifted from ../index.html.
  src/app/components/           Header (menu, scroll state, current section), footer, icon and sprite,
                                social links, the experience timeline with its skill filter, the kiosk dialog.
  src/app/configurations/       SiteOptions and its injection token.
  src/app/interfaces/           ExperienceClient, ContactClient, ContactTopicState, EngagementTracker: abstract
                                classes that double as injection tokens, so components depend on the contract.
  src/app/services/             The HttpClient implementations, the Subject-backed topic state, and the
                                beacon tracker (GET /ping, mirrored from ../main.js).
  src/app/providers/            provideSite(): validates the options and registers everything above.
  src/app/models/, requests/    Interfaces matching api/openapi.yaml and the contact Lambda's body.
  src/app/enumerations/         WorkMode.
  src/app/pipes/                monthLabel ("2023-12" to "Dec 2023") and placeLabel.
  src/app/validators/           The phone-required-for-call rule of the contact form.
  src/testing/                  Fakes, fixtures, and helpers shared by the specs.
```

The stylesheet, fonts, images, icons, and `api/seed/positions.json` are copied into `public/` from
the repository root by `scripts/sync-shared.mjs`, which the `prebuild` and `prestart` npm scripts
run, so the editions cannot drift. `public/` is generated and is not committed. Angular refuses asset
paths outside the workspace, which is why a copy stands in for the Blazor project's linked files.

Component styles are not used anywhere: Angular would inject them as inline `<style>` elements,
which the site's Content Security Policy forbids. The few additions live in `src/angular.css`, together with this edition's palette (the four Google
logo colors, applied by overriding the shared design tokens with `light-dark()`), and
the production build has critical-CSS inlining switched off for the same reason. Every component
host element gets `display: contents` there, so the sticky header and the grids see the same
children the static markup gives them.

The longer guideline, with the edition-by-edition comparison, the mirror rule, the test layout,
and a change checklist, is [docs/ANGULAR-EDITION.pdf](../docs/ANGULAR-EDITION.pdf). It is built by
the scripts in `docs/pdf/` (see the docstring in `build_angular_guide.py`).

## Run it

Node 24 and npm. All commands run from `angular/`.

```bash
npm ci
npm start                              # http://localhost:4200, copies the shared files first
npm run build                          # dist/portfolio-angular/browser/
```

```bash
npm test                               # run the suite once (Vitest on jsdom)
npm run test:watch                     # re-run on change
npx ng test --watch=false --filter "ContactSection"     # one suite or test by name
npx ng test --watch=false --include "**/site-header.spec.ts"
```

The tests are Vitest through the Angular CLI's unit-test builder, on jsdom. Components render
through TestBed against fakes of the two client interfaces, so the skill filter, the seed fallback,
the contact form's validation and status messages, the mobile menu, and the kiosk dialog are all
exercised without a browser. The two HTTP clients are tested over `HttpTestingController`. The
workflow runs the suite before every build.

The dev server has no `/api`, so the timeline falls back to the bundled seed and the skill filter
stays hidden. Serve the build output behind the real CloudFront behaviors (or any host that proxies
`/api`) to see the filter.

## Hosting

Published to the `angular/` prefix of the `mvcprogrammer.com` bucket and served by its own
CloudFront distribution with its own ACM certificate and Route 53 alias, using the static site's
response headers policy unchanged. `/api/*` goes to the same Experience API Lambda. A 403 from S3
(any path that is not a file) returns `index.html` so the Angular router answers deep links.
Details in [docs/DEPLOY.md](../docs/DEPLOY.md).
