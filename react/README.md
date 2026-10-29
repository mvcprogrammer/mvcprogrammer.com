# React edition

The same site as the static page at the repository root, rebuilt as a React 19 application with
Vite and served at [react.mvcprogrammer.com](https://react.mvcprogrammer.com). It exists to show
the same content, the same stylesheet, and the same Experience API consumed from function
components and hooks in TypeScript, next to the vanilla edition, the Angular edition in
`../angular`, and the Blazor edition in `../blazor`.

## Layout

```
react/
  scripts/sync-shared.mjs       Copies the shared root files into public/ before every build and serve.
  index.html                    The shell: metadata, the shared stylesheet link, the boot screen, the module script.
  vite.config.ts                Vite with the React plugin, bundles under bundles/, nothing inlined; the Vitest config.
  src/main.tsx                  The site options, createSiteServices(), and the React root.
  src/react.css                 The only extra stylesheet: this edition's palette, boot screen, and form validation state.
  src/app/App.tsx               App (provider + browser router) and Layout: skip link, sprite, header, main, footer.
  src/app/pages/                Home (the sections in order; starts the engagement tracker) and NotFound.
  src/app/sections/             One component per section of the page, markup lifted from ../index.html as JSX.
  src/app/components/           Header (menu, scroll state, current section), footer, icon and sprite,
                                social links, the experience timeline with its skill filter, and DemoDialog,
                                the native dialog the kiosk and the FHIR patient explorer demos open in.
  src/app/configurations/       SiteOptions.
  src/app/interfaces/           ExperienceClient, ContactClient, ContactTopicState, EngagementTracker.
  src/app/services/             The fetch implementations, the listener-backed topic state, and the
                                beacon tracker (GET /ping, mirrored from ../main.js).
  src/app/providers/            createSiteServices() (validates the options, builds the services) and
                                SiteProvider with the useSite() hook.
  src/app/models/, requests/    Interfaces matching api/openapi.yaml and the contact Lambda's body.
  src/app/enumerations/         WorkMode.
  src/app/exceptions/           HttpStatusError, thrown by the clients for a non-2xx response.
  src/app/formatters/           monthLabel ("2023-12" to "Dec 2023") and placeLabel.
  src/app/validators/           The contact form rules, including phone-required-for-call.
  src/testing/                  Fakes, fixtures, and helpers shared by the tests.
```

The stylesheet, the theme script (`theme.js`, which applies a saved light or dark choice before the
first paint), fonts, images, icons, and `api/seed/positions.json` are copied into `public/` from
the repository root by `scripts/sync-shared.mjs`, which the `prebuild` and `prestart` npm scripts
run, so the editions cannot drift. `public/` is generated and is not committed.

There is no CSS-in-JS and no `style` attribute anywhere: the site's Content Security Policy forbids
inline styles. The few additions live in `src/react.css`, together with this edition's palette (the
react.dev slate and cyan, applied by overriding the shared design tokens with `light-dark()`), which
Vite bundles into a fingerprinted
stylesheet next to the script, and `assetsInlineLimit` is zero so nothing becomes a `data:` URI.
The bundles go under `bundles/` rather than Vite's default `assets/`, because `public/assets/` holds
the shared fonts and images and the deploy syncs the two with different cache headers.

The longer guideline, with the edition-by-edition comparison, the mirror rule, the test layout,
and a change checklist, is [docs/REACT-EDITION.pdf](../docs/REACT-EDITION.pdf). It is built by
the scripts in `docs/pdf/` (see the docstring in `build_react_guide.py`).

## Run it

Node 24 and npm. All commands run from `react/`.

```bash
npm ci
npm start                              # http://localhost:5173, copies the shared files first
npm run build                          # dist/ (type check, then Vite)
npm run preview                        # serves dist/ at http://localhost:4173
```

```bash
npm test                               # run the suite once (Vitest on jsdom)
npm run test:watch                     # re-run on change
npx vitest run -t "ContactSection"     # tests whose name matches
npx vitest run src/app/components/SiteHeader.test.tsx    # one file
npm run typecheck                      # tsc -b over the app, the tests, and the Vite config
```

The tests are Vitest with React Testing Library on jsdom. Components render under a `SiteProvider`
holding fakes of the client interfaces, so the skill filter, the seed fallback, the contact form's
validation and status messages, the mobile menu, and the demo dialogs are all exercised without a
browser. The two fetch clients are tested against a stubbed `fetch`. The workflow runs the suite
and the type check before every build.

The dev server has no `/api`, so the timeline falls back to the bundled seed and the skill filter
stays hidden. Serve the build output behind the real CloudFront behaviors (or any host that proxies
`/api`) to see the filter.

## Hosting

Published to the `react/` prefix of the `mvcprogrammer.com` bucket and served by its own
CloudFront distribution with its own ACM certificate and Route 53 alias, using the static site's
response headers policy unchanged. `/api/*` goes to the same Experience API Lambda. A 403 from S3
(any path that is not a file) returns `index.html` so React Router answers deep links.
Details in [docs/DEPLOY.md](../docs/DEPLOY.md).
