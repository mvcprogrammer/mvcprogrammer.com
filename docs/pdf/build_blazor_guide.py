"""Builds docs/BLAZOR-EDITION.pdf, the guideline for the Blazor edition of mvcprogrammer.com.

    python3 -m venv .venv && .venv/bin/pip install reportlab fonttools brotli
    .venv/bin/python docs/pdf/build_fonts.py /tmp/pdf-fonts
    .venv/bin/python docs/pdf/build_blazor_guide.py /tmp/pdf-fonts docs/BLAZOR-EDITION.pdf

The styling and helpers are shared with build_angular_guide.py and build_react_guide.py through guide_common.py.
"""
import sys
from reportlab.lib.units import inch
from reportlab.platypus import KeepTogether, Spacer
from guide_common import BLOB, REPO, TREE, b, build, c, code_block, link, p, palette_table, register_fonts, table

FONT_DIR, OUT = sys.argv[1], sys.argv[2]
register_fonts(FONT_DIR)

story = []

# ---------------------------------------------------------------- Title
story += [
    p("The Blazor edition", "title"),
    p("How blazor.mvcprogrammer.com is built, how it differs from the vanilla edition at mvcprogrammer.com, "
      "and the rules for changing, testing, and deploying it.", "subtitle"),
]

# ---------------------------------------------------------------- 1
story += [
    p("1. Why there are four editions", "h1"),
    p("The portfolio ships four times. The default edition is plain HTML, CSS, and JavaScript at the repository root, "
      "served at " + link("mvcprogrammer.com", "https://mvcprogrammer.com") + ". The Blazor edition is a standalone "
      "Blazor WebAssembly app on .NET 10 under " + c("blazor/") + ", served at "
      + link("blazor.mvcprogrammer.com", "https://blazor.mvcprogrammer.com") + ". The Angular edition is an Angular 22 "
      "app under " + c("angular/") + ", served at " + link("angular.mvcprogrammer.com", "https://angular.mvcprogrammer.com")
      + " and documented in its own guideline, " + link("docs/ANGULAR-EDITION.pdf", BLOB + "docs/ANGULAR-EDITION.pdf")
      + ". The React edition is a React 19 app built with Vite under " + c("react/") + ", served at "
      + link("react.mvcprogrammer.com", "https://react.mvcprogrammer.com") + " and documented in "
      + link("docs/REACT-EDITION.pdf", BLOB + "docs/REACT-EDITION.pdf")
      + ". All four show the same content, load the same stylesheet under their own palettes, and call the same Experience API. The Blazor "
      "edition exists to show that content consumed from C# running in the browser, not to replace the static site."),
    p("The one rule that matters", "h2"),
    p("<b>Every content, markup, behavior, or styling change made to one edition is made to the other three in the same "
      "commit.</b> Before finishing any change to the site, check the other editions for the same change. Section 4 "
      "lists which files are shared by linking (one edit) and which are duplicated (four edits)."),
    p("No exceptions", "h2"),
    p("Content is identical on every edition. The editions cross-link through the About core-skill chips "
      "(<b>Angular</b>, <b>React</b>, <b>Blazor</b>, <b>JavaScript</b>, each with a title hint such as <i>See the Angular edition of "
      "this site</i>) and through the edition menu in the header: a pill naming the open edition that lists all four. "
      "The hero highlights are plain text (their Angular and React links were removed on 2026-10-19). "
      "A link to the edition already open simply reloads it. The portfolio card carries no edition "
      "links. The bUnit tests, " + c("AboutSection_ShouldLinkEditionTagsWithHints") + " and " + c("HeroSection_ShouldRenderPlainHighlights") + ", pin the Blazor side of it."),
    KeepTogether([
        p("The one exception: color", "h2"),
        p("Each edition carries its own palette. One small file per edition, loaded after the shared " + c("styles.css")
          + ", overrides only the design tokens (" + c("--bg") + ", " + c("--accent") + ", " + c("--hover") + ", and the rest) "
          "with " + c("light-dark()") + " values, so one declaration covers both color schemes and no rule from the shared "
          "stylesheet is repeated. Older browsers ignore " + c("light-dark()") + " and fall back to the shared JetBrains "
          "Rider palette. The four palettes, with the page, the accent, and the hover color "
          "for each scheme:"),
        palette_table(),
        p("The Blazor edition links " + c("blazor.css") + " from " + c("index.html") + " as a plain static file, so nothing rewrites " + c("light-dark()") + " on the way to the browser; the published " + c("wwwroot/blazor.css") + " is the file as committed.", "caption"),
    ]),
    p("Every edition's colophon describes its own palette, and the four are listed with screenshots in the README of "
      "this repository and on the GitHub profile README."),
]

# ---------------------------------------------------------------- 2
story += [
    p("2. Where things live", "h1"),
    p("Both projects follow the folder-by-kind layout from the coding standards: plural folder names, a matching "
      "suffix on each class, and a namespace that follows the folder."),
    table(
        ["Path", "What it holds"],
        [
            [c("blazor/src/Portfolio.Blazor/"), "The app. One project, " + c("Microsoft.NET.Sdk.BlazorWebAssembly") + ", net10.0, nullable and analyzers on, warnings are errors."],
            [c("Program.cs"), "Host builder. Registers " + c("App") + " and " + c("HeadOutlet") + ", then calls " + c("AddPortfolioServices()") + "."],
            [c("App.razor"), "Router. No " + c("FocusOnNavigate") + ", because in-page links are hash navigations."],
            [c("Layout/MainLayout.razor"), "Skip link, icon sprite, header, " + c("&lt;main&gt;") + ", footer."],
            [c("Pages/Home.razor"), "The one page: a list of section components in page order."],
            [c("Sections/"), "One component per section of the page: Hero, About, Services, Portfolio, Quote, Resume, Contact, Colophon. Markup lifted from " + c("index.html") + "."],
            [c("Components/"), "Header (menu, scroll state, current section), footer, icon and icon sprite, social links, the experience timeline with its skill filter, and the kiosk demo dialog."],
            [c("Configurations/SiteOptions"), "Lambda URLs and API paths, bound from " + c("wwwroot/appsettings.json") + " and validated with data annotations."],
            [c("Interfaces/, Services/"), c("IExperienceClient") + " and " + c("IContactClient") + " (typed HttpClients) and " + c("IContactTopicState") + " (the call-to-action buttons preselect the form topic)."],
            [c("Models/, Requests/"), "Records matching " + c("api/openapi.yaml") + " and the contact Lambda's JSON body."],
            [c("ViewModels/ContactForm.cs"), "Mutable, data-annotated model bound to the " + c("EditForm") + "; converts itself to a " + c("ContactRequest") + "."],
            [c("Serialization/"), c("System.Text.Json") + " source-generator context, so the trimmed build needs no reflection."],
            [c("Extensions/"), c("ServiceCollectionExtensions") + " (DI registration) and " + c("PositionExtensions") + " (date and place labels)."],
            [c("wwwroot/js/site.js"), "The only JavaScript: document events, IntersectionObserver, matchMedia, the native dialog, and focus. Loaded as an ES module through " + c("IJSRuntime") + "."],
            [c("wwwroot/blazor.css"), "This edition's palette (section 1), the boot screen, and the error bar. Everything else is the shared " + c("styles.css") + "."],
            [c("blazor/tests/Portfolio.Blazor.Tests/"), "bUnit on xunit.v3. Section 6."],
            [c("blazor/README.md"), "The short version of this document, kept in the repo."],
        ],
        [2.75 * inch, 4.25 * inch],
    ),
    Spacer(1, 6),
    p("The root " + c("mvcprogrammer.com.sln") + " includes the Blazor app, its tests, the Experience API, its seed tool, "
      "and the API tests, so an IDE opens everything at once."),
]

# ---------------------------------------------------------------- 3
story += [
    p("3. How the Blazor edition differs from the vanilla edition", "h1"),
    p("The visible page is the same. The differences are in how it gets there."),
    table(
        ["Concern", "Vanilla edition (root)", "Blazor edition (blazor/)"],
        [
            ["Rendering", "Hand-written HTML. The page reads fully with JavaScript disabled.", "Razor components rendered by .NET on WebAssembly. A boot screen shows until the runtime loads; nothing renders without it."],
            ["Where state lives", "DOM attributes and closures in " + c("main.js") + ".", "C# fields in the component code-behinds; the UI re-renders from them."],
            ["JavaScript", c("main.js") + ", about 660 lines, owns every behavior.", c("site.js") + ", about 280 lines, exposes only the browser APIs .NET cannot reach. Each watcher returns a handle with " + c("dispose()") + "."],
            ["Experience timeline", "The timeline is in the HTML. When " + c("/api/experience") + " answers, the script re-renders it and shows the skill filter. On failure the HTML stays as it was.", c("ExperienceTimeline") + " loads from the API. If that fails, times out, or returns HTML, it loads the bundled seed " + c("data/positions.json") + " (linked from " + c("api/seed/") + "). The filter shows only when skills load."],
            ["Skill chips", "Same ordering: pinned list first, then the rest, then demoted; twelve shown before the more button.", "Same constants and ordering in C#. Pinning a different skill means editing all four."],
            ["Contact form", "HTML5 validation plus " + c("checkValidity()") + "; fetch to the Lambda; status text for 429, other failures, and success.", c("EditForm") + " over " + c("ContactForm") + " with data annotations and a conditional phone rule; " + c("ContactClient") + " posts; the same status messages, plus a timeout message when the 20 second client timeout cancels."],
            ["Topic preselection", "Call-to-action buttons set the select's value directly.", c("IContactTopicState") + ", a singleton the buttons call and the form subscribes to."],
            ["Configuration", "Endpoints sit in " + c("data-") + " attributes in the HTML.", c("SiteOptions") + " bound from " + c("wwwroot/appsettings.json") + " and validated at startup."],
            ["Header behavior", "Scroll listener, IntersectionObserver, Escape and outside-click handlers in " + c("main.js") + ".", "The same observers in " + c("site.js") + ", reporting to " + c("SiteHeader") + " through " + c("[JSInvokable]") + " methods. Document listeners exist only while the menu is open."],
            ["Theme toggle", "A click handler in " + c("main.js") + " sets " + c("data-theme") + " on the root and saves the choice.", c("SiteHeader") + " calls " + c("toggleTheme") + " in " + c("site.js") + " through the module reference. The component keeps no theme state; the stylesheet picks the icon, and the shared " + c("theme.js") + " in the head applies a saved choice before the runtime starts."],
            ["Kiosk demo", "Button opens a native dialog; the iframe is cleared on close.", c("KioskDialog") + " renders the iframe only while open and tears it down on " + c("OnClosed") + "."],
            ["Styling", "Shared stylesheet plus " + c("vanilla.css") + " (palette).", "Shared stylesheet plus " + c("blazor.css") + " (palette, boot screen, error bar). Razor components carry no scoped CSS."],
            ["Build output", "The files as committed.", c("dotnet publish") + ": trimmed, invariant globalization, no time zone data, no fingerprint placeholders (the import map would be an inline script, which the CSP forbids)."],
            ["Hosting", "Root of the private S3 bucket, distribution for mvcprogrammer.com.", c("blazor/") + " prefix of the same bucket, distribution " + c("E2NFN5MW02S8Y9") + ", own ACM certificate, CSP with " + c("'wasm-unsafe-eval'") + ", S3 403 rewritten to " + c("index.html") + " so deep links reach the router."],
            ["Tests", "None in the repo for the static page.", "118 bUnit and xUnit cases, run before every publish. (The Angular and React editions have their own Vitest suites.)"],
        ],
        [1.15 * inch, 2.85 * inch, 3.0 * inch],
    ),
]

# ---------------------------------------------------------------- 4
story += [
    p("4. Shared by linking versus duplicated by hand", "h1"),
    p("The Blazor project file pulls the shared assets from the repository root with " + c("&lt;Content Link=...&gt;")
      + " items, so they are one file on disk and cannot drift. (The Angular and React editions copy the same files with a script "
      "before each build.) Everything else is written once per edition."),
    p("Edit once (linked into wwwroot)", "h2"),
    b(c("styles.css") + ", the whole stylesheet. The palette on top of it is per edition (section 1), so a color change is four edits."),
    b(c("assets/**") + ": fonts (Inter and JetBrains Mono as variable WOFF2 subsets) and images."),
    b(c("favicon.svg") + ", " + c("favicon.ico") + ", " + c("apple-touch-icon.png") + "."),
    b(c("api/seed/positions.json") + ", served to the Blazor edition as " + c("data/positions.json") + "."),
    p("Edit twice (one copy per edition)", "h2"),
    b("Markup: " + c("index.html") + ", again in " + c("blazor/.../Sections/*.razor") + " and " + c("Components/*.razor") + ", again in the Angular edition's " + c("sections/") + " and " + c("components/") + " templates, and again in the React edition's JSX under the same folder names."),
    b("Behavior: " + c("main.js") + ", again in the Razor code-behind files plus " + c("wwwroot/js/site.js") + ", again in the Angular component classes, and again in the React components and hooks."),
    b("Constants that shape the page: pinned and demoted skills, the visible chip count, status messages, section ids and labels."),
    b("Endpoints: " + c("data-") + " attributes in " + c("index.html") + " and " + c("wwwroot/appsettings.json") + "."),
    p("When a change touches a duplicated file, the commit is not finished until all four copies match. When the Blazor "
      "copy changes behavior, add or update the bUnit test that proves it."),
]

# ---------------------------------------------------------------- 5
story += [
    p("5. Running it locally", "h1"),
    p("Node is not needed. The .NET 10 SDK is. All commands run from the repository root."),
    *code_block([
        "dotnet run --project blazor/src/Portfolio.Blazor       # http://localhost:5115",
        "dotnet publish blazor/src/Portfolio.Blazor -c Release -o publish",
    ]),
    p("The dev server has no " + c("/api") + ", so the timeline falls back to the bundled seed and the skill filter stays "
      "hidden. To see the filter, serve the publish output behind the real CloudFront behaviors or any host that proxies "
      + c("/api") + " to the Experience API. The Experience API itself runs locally with "
      + c("dotnet run --project api/src/Experience.Api") + " and serves the seed without AWS credentials."),
    p("The contact Lambda rejects Origins it does not know, so the form cannot send from a local preview in either edition."),
]

# ---------------------------------------------------------------- 6
story += [
    p("6. Testing", "h1"),
    p("The suite is bUnit 2 on xunit.v3 4, running on Microsoft.Testing.Platform. Components render against fakes of the two "
      "client interfaces and a bUnit JS module stub for " + c("site.js") + ", so the skill filter, the seed fallback, the "
      "contact form's validation and status messages, the mobile menu, and the kiosk dialog are all exercised without a "
      "browser. The two HTTP clients are tested over a stubbed " + c("HttpMessageHandler") + ". The deploy workflow runs "
      "the suite before every publish, so a red test blocks the Blazor deploy."),
    KeepTogether([p("Commands", "h2"), *code_block([
        "# run the suite",
        "dotnet test --project blazor/tests/Portfolio.Blazor.Tests",
        "# print every test name",
        "dotnet test --project blazor/tests/Portfolio.Blazor.Tests --output Detailed",
        "# discover without running",
        "dotnet test --project blazor/tests/Portfolio.Blazor.Tests --list-tests",
        "# one class, one method (a leading or trailing * is the wildcard)",
        'dotnet test --project blazor/tests/Portfolio.Blazor.Tests --filter-class "*ContactSectionTests"',
        "dotnet test --project blazor/tests/Portfolio.Blazor.Tests \\",
        '  --filter-method "*SendAsync_ShouldShowTimeoutMessageOnCancellation"',
        "# the whole solution from the repository root: Blazor tests and API tests",
        "dotnet test",
    ])]),
    p("The root " + c("global.json") + " opts " + c("dotnet test") + " into Microsoft.Testing.Platform, so the switches "
      "above are the platform's. " + c("--filter-class") + " and " + c("--filter-method") + " take a leading or trailing "
      + c("*") + ". <b>VSTest-era options are not understood.</b> Passing " + c('--logger "console;verbosity=normal"')
      + " makes the run report <i>Zero tests ran</i> and exit with code 5; that is the flag, not the tests."),
    p("Conventions the suite follows", "h2"),
    b("Test class is the class under test plus " + c("Tests") + "; the project is " + c(".Tests") + ". Method names are " + c("Method_ShouldExpectedResult") + ", with " + c("ShouldThrow") + ", " + c("ShouldTransform") + ", and friends as the suffix."),
    b("Arrange, Act, Assert, each marked with a comment. Scenario setup across several fakes lives in " + c("Arrange_<Scenario>()") + " helpers; fixtures come from " + c("Create<Thing>()") + " factories."),
    b("Regions group constructor tests first, then one region per method under test, then " + c("Helper Methods") + " at the bottom."),
    b("Every test has an XML summary stating the behavior it validates."),
    b("Dependencies of the class under test are faked, never the class itself. " + c("Assert.Equal") + " for exact values, " + c("Assert.Single") + " when one element is expected, " + c("Assert.ThrowsAsync") + " for async failures, " + c("CancellationToken.None") + " unless cancellation is the subject."),
    b("Async component assertions use " + c("cut.WaitForAssertionAsync(...)") + " because the first render happens before " + c("OnInitializedAsync") + " completes."),
    p("Test project layout", "h2"),
    p("Folders mirror the app. The counts are test methods; theories expand to more cases at run time (117 in all)."),
    table(
        ["File", "Tests", "What it proves"],
        [
            [link("Components/ExperienceTimelineTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Components/ExperienceTimelineTests.cs"), "15", "API render, date and place labels, every fallback path (error, non-JSON, timeout, empty), chip order and the more button, filtering, restore without refetch, cancellation on dispose."],
            [link("Components/SiteHeaderTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Components/SiteHeaderTests.cs"), "16", "Watchers start on render, the theme button (icons and name, one module call per press), the edition list (four entries, current marked, open and watch, close, focus return), menu toggle and document watch, close on nav click, focus return, scrolled class, current-section marking, module release."],
            [link("Components/KioskDialogTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Components/KioskDialogTests.cs"), "7", "No iframe while closed, open shows the modal, open is idempotent, close removes the iframe, close button behavior, the portfolio card opens it."],
            [link("Components/ChromeComponentTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Components/ChromeComponentTests.cs"), "4", "Icon references a sprite symbol, every symbol exists, three social profiles, footer year and legal links."],
            [link("Sections/ContactSectionTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Sections/ContactSectionTests.cs"), "12", "Phone field hidden by default, topic preselection and unsubscribe, phone reveal, post and confirmations, honeypot forwarded, 429, generic failure, timeout, no post when invalid."],
            [link("Sections/StaticSectionTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Sections/StaticSectionTests.cs"), "4", "The JavaScript tag links to the static edition, the resume button uses the configured URL, the colophon links to the Blazor source, Home renders every section in order."],
            [link("Sections/CallToActionTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Sections/CallToActionTests.cs"), "1", "The Services button selects its contact topic."],
            [link("Services/ExperienceClientTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Services/ExperienceClientTests.cs"), "10", "Paths and deserialization, query-string escaping, blank skill ignored, error status, HTML body, null body, cancellation, skills, seed."],
            [link("Services/ContactClientTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Services/ContactClientTests.cs"), "5", "Null guards, camelCase JSON to the endpoint, status code on rejection, cancellation."],
            [link("Services/ContactTopicStateTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Services/ContactTopicStateTests.cs"), "6", "Notify every subscriber, no subscribers, unsubscribe during notification, unsubscribe stops notifications, null guards."],
            [link("Extensions/ServiceCollectionExtensionsTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Extensions/ServiceCollectionExtensionsTests.cs"), "4", "Clients and state registered, options bound, options validated, bad arguments throw."],
            [link("Extensions/PositionExtensionsTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Extensions/PositionExtensionsTests.cs"), "5", "Month labels, unparseable input returned as is, place label per work mode, null guards."],
            [link("ViewModels/ContactFormTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/ViewModels/ContactFormTests.cs"), "5", "Validation passes and fails as expected, phone required only for a call, the request drops the phone otherwise."],
            [link("Fakes/, Helpers/", TREE + "blazor/tests/Portfolio.Blazor.Tests"), "", c("FakeExperienceClient") + " and " + c("FakeContactClient") + " (scriptable, record their calls), " + c("StubHttpMessageHandler") + ", " + c("TestData") + " factories, and " + c("BunitContextExtensions") + " (options, services, the " + c("site.js") + " module stub in loose mode)."],
        ],
        [2.95 * inch, 0.55 * inch, 3.5 * inch],
        first_style="cellsmall",
    ),
]

# ---------------------------------------------------------------- 7
story += [
    p("7. Deploying", "h1"),
    p("The " + c("deploy-blazor") + " job in " + link(".github/workflows/deploy.yml", BLOB + ".github/workflows/deploy.yml")
      + " runs on every push to " + c("main") + ", in parallel with the static site's job. It sets up .NET 10, runs the "
      "tests in Release, publishes, assumes the deploy role through OIDC, and syncs the output in two passes before "
      "invalidating the distribution."),
    b("Fingerprinted framework files under " + c("_framework/") + " get a one-week browser TTL and " + c("immutable") + "."),
    b("Everything else, including the two unfingerprinted loaders " + c("blazor.webassembly.js") + " and " + c("dotnet.js") + ", gets a five-minute browser TTL."),
    b("Pre-compressed " + c(".br") + " and " + c(".gz") + " twins stay out of the bucket; CloudFront compresses on the fly."),
    p("A manual deploy is the same two syncs plus an invalidation; the exact commands are in the Blazor section of "
      + link("docs/DEPLOY.md", BLOB + "docs/DEPLOY.md") + ", together with the distribution, certificate, Route 53, "
      "bucket policy, and IAM details. Resource IDs are documented there once and are not repeated here."),
]

# ---------------------------------------------------------------- 8
story += [
    KeepTogether([
    p("8. Checklist for a change", "h1"),
    p("Use this before marking any site change done."),
    table(
        ["Step", "Do"],
        [
            ["1", "Make the change in the edition you started with."],
            ["2", "If the file is shared by linking (section 4), you are done with content. If it is duplicated, make the matching change in the other three editions."],
            ["3", "If the Blazor behavior changed, add or update the bUnit test that proves it. Follow the naming and layout conventions in section 6."],
            ["4", "Run " + c("dotnet test --project blazor/tests/Portfolio.Blazor.Tests") + " and make it green. Run " + c("dotnet build") + " on the app; warnings are errors."],
            ["5", "Preview the editions locally: " + c("python3 -m http.server 8080") + " at the root, " + c("dotnet run --project blazor/src/Portfolio.Blazor") + ", and " + c("npm start") + " in " + c("angular/") + " and in " + c("react/") + "."],
            ["6", "Check the cross-links survived: the edition menu in the header and the four About chips, identical on every edition, with their hints; the hero highlights stay plain."],
            ["7", "Commit all editions together. No AI attribution trailers in the message."],
            ["8", "Push to " + c("main") + " only when asked. The workflow tests, publishes, and deploys every edition."],
        ],
        [0.5 * inch, 6.5 * inch],
    )]),
]

# ---------------------------------------------------------------- 9
story += [
    KeepTogether([
    p("9. Links", "h1"),
    table(
        ["What", "Where"],
        [
            ["Live, Blazor edition", link("https://blazor.mvcprogrammer.com", "https://blazor.mvcprogrammer.com")],
            ["Live, vanilla edition", link("https://mvcprogrammer.com", "https://mvcprogrammer.com")],
            ["Live, Angular edition", link("https://angular.mvcprogrammer.com", "https://angular.mvcprogrammer.com")],
            ["Angular guideline", link("docs/ANGULAR-EDITION.pdf", BLOB + "docs/ANGULAR-EDITION.pdf")],
            ["Live, React edition", link("https://react.mvcprogrammer.com", "https://react.mvcprogrammer.com")],
            ["React guideline", link("docs/REACT-EDITION.pdf", BLOB + "docs/REACT-EDITION.pdf")],
            ["Repository", link(REPO, REPO)],
            ["Blazor app source", link("blazor/src/Portfolio.Blazor", TREE + "blazor/src/Portfolio.Blazor")],
            ["Blazor tests", link("blazor/tests/Portfolio.Blazor.Tests", TREE + "blazor/tests/Portfolio.Blazor.Tests")],
            ["Blazor README", link("blazor/README.md", BLOB + "blazor/README.md")],
            ["Deploy walkthrough", link("docs/DEPLOY.md", BLOB + "docs/DEPLOY.md")],
            ["Deploy workflow", link(".github/workflows/deploy.yml", BLOB + ".github/workflows/deploy.yml")],
            ["Experience API spec", link("api/openapi.yaml", BLOB + "api/openapi.yaml")],
            ["Experience API tests", link("api/tests/Experience.Api.Tests", TREE + "api/tests/Experience.Api.Tests")],
            ["Contact Lambda", link("infra/lambda/contact/index.mjs", BLOB + "infra/lambda/contact/index.mjs")],
            ["Workflow runs", link("GitHub Actions", REPO + "/actions/workflows/deploy.yml")],
        ],
        [1.8 * inch, 5.2 * inch],
    )]),
]

build(
    OUT, story,
    title="The Blazor edition of mvcprogrammer.com",
    subject="Guideline for building, testing, and deploying the Blazor edition",
    running_title="mvcprogrammer.com  ·  The Blazor edition",
    dated="Guideline, October 2026",
)
