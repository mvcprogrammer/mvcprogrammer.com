# Visitor dashboard

A private page at [stats.mvcprogrammer.com](https://stats.mvcprogrammer.com) that turns the
CloudFront access logs and the first-party engagement beacon into headline numbers, a daily chart,
and breakdowns by edition, referrer, screen, country, section reached, time on page, and the links
that matter. It is a React 19 + Vite app with Chart.js, built the way the React edition in
`../react` is built (TypeScript strict, no CSS-in-JS, no `style` attributes, bundles under
`bundles/`, Vitest with Testing Library), and it reads static JSON day files, so there is no server
and no database.

## How the data gets here

```
CloudFront logs (S3)  ──►  tools/stats-export.mjs  ──►  data/index.json + data/days/YYYY-MM-DD.json  ──►  this app
                          (shared parser in tools/lib)     one record per visit, no IPs                (filters and sums in the browser)
```

`tools/stats-export.mjs` at the repository root writes one JSON file per calendar day (in
`America/New_York`) with the day's request totals and one small record per visit: a salted visitor
token, the local hour, the editions loaded, the referrer host, the country of the serving edge, and
what the beacon reported (screen, color scheme, sections reached, seconds visible, links clicked).
The app fetches the days in the chosen range in parallel, applies the filters, and computes every
number on the page from those records, so any combination of filters is exact, unique visitors
inside a filter included. The schema is documented in the exporter and typed in
`src/app/data/types.ts`; `schemaVersion` guards both ends.

## Layout

```
stats/
  scripts/sync-shared.mjs       Copies styles.css, the icons, and the fonts from the repository root into public/.
  index.html                    The shell: noindex, the shared stylesheet link, the boot screen, the module script.
  vite.config.ts                Vite with the React plugin, bundles under bundles/, nothing inlined; the Vitest config.
  src/main.tsx                  Registers the Chart.js pieces, creates the fetch client, renders App.
  src/stats.css                 Everything the dashboard adds to styles.css: controls, chips, tiles, panels, states, phone layout.
  src/app/App.tsx               Header (edition switcher, range picker, compare, updated stamp), chips, the page, footer.
  src/app/pages/Dashboard.tsx   Loads the range, derives every number, lays out tiles, the main chart, and the panels.
  src/app/components/           KpiTile, Sparkline, Bars, Panel, TableTwin, DateRangePicker, EditionSwitcher,
                                SegmentChips, Updated, TimeSeriesChart, DonutPanel, HourChart, TimeOnPageChart,
                                ScannerPanel, and the loading, empty, and error states.
  src/app/aggregation/          Pure functions: filter visits by segments, summarize, build the daily or weekly series.
  src/app/data/                 The day-file and index types and the fetch client with its cache.
  src/app/query/                The query (range, compare, segments) and its round trip through the URL.
  src/app/charts/               Chart.js registration and the hook that reads chart colors from the stylesheet tokens.
  src/app/formatters/           Numbers, percentages, durations, day labels, relative times, flags, country names.
  src/app/dates.ts              Day-key arithmetic in the site's time zone, mirroring tools/lib/cf-logs.mjs.
  src/testing/                  The chart stub, the fake client, and a deterministic day-file generator.
```

The URL is the only state: `?range=7d`, or `?from=2026-10-01&to=2026-10-15`, `&compare=1`, and
`&seg=edition:react,screen:phone`. Bookmarks and the back button work; the default view has a bare
URL.

## Run it

Node 24 and npm. All commands run from `stats/`.

```bash
npm ci
npm run data                           # writes 90 days of day files into public/data from the cached logs
                                       # (needs the AWS CLI; add --no-sync after `--` to skip the download)
npm start                              # http://localhost:5173, copies the shared files first
npm run build                          # dist/ (type check, then Vite)
npm test                               # Vitest on jsdom
npm run typecheck
```

`npm run data` passes through to `node ../tools/stats-export.mjs --days 90 --out public/data`; set
`CF_STATS_EXCLUDE_IPS` to leave your own visits out, as with the text report. Without any logs,
`src/testing/fixtures.ts` has `generateDays()` for a plausible synthetic month.

The charts are drawn on canvas and the bars in the panels are inline SVG with attribute widths, so
the page runs under the site's Content Security Policy unchanged (no inline script or style). Every
chart has a "Show as table" twin for screen readers and for copying the numbers out.

## Hosting

Published to the `stats/` prefix of the site bucket and served by its own CloudFront distribution
behind a Cognito sign-in checked at the edge; the day files are written to `stats/data/` by the
scheduled workflow. Details in [docs/DEPLOY.md](../docs/DEPLOY.md).
