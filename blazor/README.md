# Blazor edition

The same site as the static page at the repository root, rebuilt as a standalone Blazor
WebAssembly app on .NET 10 and served at [blazor.mvcprogrammer.com](https://blazor.mvcprogrammer.com).
It exists to show the same content, the same stylesheet, and the same Experience API
consumed from C# running in the browser.

## Layout

```
blazor/src/Portfolio.Blazor/
  Program.cs                  Host builder; services come from AddPortfolioServices().
  App.razor                   Router. No FocusOnNavigate: in-page links are hash navigations.
  Layout/MainLayout.razor     Skip link, icon sprite, header, <main>, footer.
  Pages/Home.razor            The one page: a list of section components.
  Sections/                   One component per section of the page, markup lifted from ../index.html.
  Components/                 Header (menu, scroll state, current section), footer, icon sprite,
                              experience timeline with skill filter, kiosk demo dialog.
  Configurations/SiteOptions  Lambda URLs and API paths, bound from wwwroot/appsettings.json.
  Interfaces/, Services/      IExperienceClient and IContactClient (typed HttpClients),
                              IContactTopicState (call-to-action buttons preselect the form topic).
  Models/, Requests/          Records matching api/openapi.yaml and the contact Lambda's body.
  ViewModels/ContactForm.cs   Mutable, data-annotated model bound to the EditForm.
  Serialization/              System.Text.Json source generator context (no reflection in the trimmed build).
  wwwroot/js/site.js          The only JavaScript: document events, IntersectionObserver, matchMedia, <dialog>.
  wwwroot/blazor.css          Boot screen and error bar; everything else is the shared styles.css.
```

The stylesheet, fonts, images, icons, and `api/seed/positions.json` are linked into `wwwroot`
from the repository root by the project file, not copied, so the two editions cannot drift.

## Run it

```bash
dotnet run --project blazor/src/Portfolio.Blazor      # http://localhost:5215
dotnet publish blazor/src/Portfolio.Blazor -c Release -o publish
```

```bash
dotnet test --project blazor/tests/Portfolio.Blazor.Tests
```

The tests are bUnit on xunit.v3. Components render against fakes of the two client interfaces
and a bUnit JS module stub for `site.js`, so the skill filter, the seed fallback, the contact
form's validation and status messages, the mobile menu, and the kiosk dialog are all exercised
without a browser. The clients are tested over a stubbed `HttpMessageHandler`. The workflow runs
the suite before every publish.

The dev server has no `/api`, so the timeline falls back to the bundled seed and the skill
filter stays hidden. Serve the publish output behind the real CloudFront behaviors (or any
host that proxies `/api`) to see the filter.

## Hosting

Published to the `blazor/` prefix of the `mvcprogrammer.com` bucket and served by CloudFront
distribution `E2NFN5MW02S8Y9` with its own ACM certificate, a Route 53 alias, and a response
headers policy whose CSP adds `'wasm-unsafe-eval'`. `/api/*` goes to the same Experience API
Lambda. A 403 from S3 (any path that is not a file) returns `index.html` so the Blazor router
answers deep links. Details in [docs/DEPLOY.md](../docs/DEPLOY.md).

Asset fingerprinting (`OverrideHtmlAssetPlaceholders`) is off because its import map is an
inline script, which the CSP does not allow. The framework files still carry content hashes in
their names, so the deploy gives them a long browser TTL.
