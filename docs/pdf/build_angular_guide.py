"""Builds docs/ANGULAR-EDITION.pdf, the guideline for the Angular edition of mvcprogrammer.com.

    python3 -m venv .venv && .venv/bin/pip install reportlab fonttools brotli
    .venv/bin/python docs/pdf/build_fonts.py /tmp/pdf-fonts
    .venv/bin/python docs/pdf/build_angular_guide.py /tmp/pdf-fonts docs/ANGULAR-EDITION.pdf

The styling and helpers are shared with build_blazor_guide.py and build_react_guide.py through guide_common.py.
"""
import sys
from reportlab.lib.units import inch
from reportlab.platypus import KeepTogether, Spacer
from guide_common import BLOB, REPO, TREE, b, build, c, code_block, link, p, palette_table, register_fonts, table

FONT_DIR, OUT = sys.argv[1], sys.argv[2]
register_fonts(FONT_DIR)

SRC = "angular/src/app/"
story = []

# ---------------------------------------------------------------- Title
story += [
    p("The Angular edition", "title"),
    p("How angular.mvcprogrammer.com is built, how it differs from the vanilla edition at mvcprogrammer.com, the "
      "Blazor edition at blazor.mvcprogrammer.com, and the React edition at react.mvcprogrammer.com, and the rules for "
      "changing, testing, and deploying it.", "subtitle"),
]

# ---------------------------------------------------------------- 1
story += [
    p("1. Why there are four editions", "h1"),
    p("The portfolio ships four times. The default edition is plain HTML, CSS, and JavaScript at the repository root, "
      "served at " + link("mvcprogrammer.com", "https://mvcprogrammer.com") + ". The Blazor edition is a Blazor "
      "WebAssembly app under " + c("blazor/") + ", served at " + link("blazor.mvcprogrammer.com", "https://blazor.mvcprogrammer.com")
      + " and documented in " + link("docs/BLAZOR-EDITION.pdf", BLOB + "docs/BLAZOR-EDITION.pdf") + ". The Angular edition "
      "is an Angular 22 workspace under " + c("angular/") + ", served at "
      + link("angular.mvcprogrammer.com", "https://angular.mvcprogrammer.com") + ". The React edition is a React 19 app "
      "built with Vite under " + c("react/") + ", served at " + link("react.mvcprogrammer.com", "https://react.mvcprogrammer.com")
      + " and documented in " + link("docs/REACT-EDITION.pdf", BLOB + "docs/REACT-EDITION.pdf") + ". All four show the "
      "same content, load the same stylesheet under their own palettes, and call the same Experience API. The Angular edition exists to show that "
      "content consumed from standalone components, signals, and a reactive form, next to the React, C#, and vanilla versions."),
    p("The one rule that matters", "h2"),
    p("<b>Every content, markup, behavior, or styling change made to one edition is made to the other three in the same "
      "commit.</b> Before finishing any change to the site, check the other editions for the same change. Section 4 "
      "lists which files are shared (one edit) and which are duplicated (four edits)."),
    p("No exceptions", "h2"),
    p("Content is identical on every edition. The editions cross-link through the About core-skill chips "
      "(<b>Angular</b>, <b>React</b>, <b>Blazor</b>, <b>JavaScript</b>, each with a title hint such as <i>See the Angular edition of "
      "this site</i>) and the hero highlights (<b>Angular</b> and <b>React</b> of <i>Angular / React</i> to "
      "their editions), and through the edition menu in the header: a pill naming the open edition that lists all four. "
      "A link to the edition already open simply reloads it. The portfolio card carries no edition links. The spec in " + c("sections/static-sections.spec.ts") + " pins the Angular side of it."),
    KeepTogether([
        p("The one exception: color", "h2"),
        p("Each edition carries its own palette. One small file per edition, loaded after the shared " + c("styles.css")
          + ", overrides only the design tokens (" + c("--bg") + ", " + c("--accent") + ", " + c("--hover") + ", and the rest) "
          "with " + c("light-dark()") + " values, so one declaration covers both color schemes and no rule from the shared "
          "stylesheet is repeated. Older browsers ignore " + c("light-dark()") + " and fall back to the shared JetBrains "
          "Rider palette. The four palettes, with the page, the accent, and the hover color "
          "for each scheme:"),
        palette_table(),
        p("The Angular build emits " + c("angular.css") + " under the bundle name " + c("angular") + " (the " + c("bundleName") + " option in " + c("angular.json") + ") so that " + c("ng serve") + " does not name it " + c("styles.css") + " and shadow the shared file; in production the name is hashed either way.", "caption"),
    ]),
    p("Every edition's colophon describes its own palette, and the four are listed with screenshots in the README of "
      "this repository and on the GitHub profile README."),
]

# ---------------------------------------------------------------- 2
story += [
    p("2. Where things live", "h1"),
    p("The workspace follows the folder-by-kind layout from the coding standards, in Angular's dress: plural folder "
      "names under " + c("src/app/") + ", the Angular 20+ file naming (no " + c(".component") + " or " + c(".service")
      + " suffixes), and one spec file beside each source file."),
    table(
        ["Path", "What it holds"],
        [
            [c("angular/"), "The workspace: one application project, " + c("portfolio-angular") + ", zoneless, strict TypeScript, Vitest."],
            [c("scripts/sync-shared.mjs"), "Copies the shared root files into " + c("public/") + " before every build and serve (the " + c("prebuild") + " and " + c("prestart") + " npm hooks). " + c("public/") + " is generated and not committed."],
            [c("src/index.html"), "The shell: metadata, the shared stylesheet link, the boot screen inside " + c("&lt;app-root&gt;") + ". The build appends its own script and stylesheet tags."],
            [c("src/angular.css"), "The only extra stylesheet: this edition's palette (section 1), the boot screen, " + c("display: contents") + " for every component host element, and form validation state. Emitted under the bundle name " + c("angular") + "."],
            [c("src/app/app.ts"), "Layout: skip link, icon sprite, header, " + c("&lt;main&gt;") + " with the router outlet, footer."],
            [c("src/app/app.config.ts"), "Router, global error listeners, and " + c("provideSite()") + " with the endpoints."],
            [c("src/app/app.routes.ts"), c('""') + " is Home; " + c("**") + " is NotFound, for the paths CloudFront hands to " + c("index.html") + "."],
            [c("pages/"), c("Home") + " (the sections in page order) and " + c("NotFound") + "."],
            [c("sections/"), "One component per section of the page: Hero, About, Quote, Services, Freelance, Portfolio, Resume, Contact, Colophon. Templates lifted from " + c("index.html") + "."],
            [c("components/"), "Header (menu, scroll state, current section), footer, icon and icon sprite, social links, the experience timeline with its skill filter, and the kiosk demo dialog."],
            [c("configurations/"), c("SiteOptions") + " and its " + c("SITE_OPTIONS") + " injection token."],
            [c("interfaces/"), c("ExperienceClient") + ", " + c("ContactClient") + ", " + c("ContactTopicState") + ": abstract classes that double as injection tokens, so components depend on the contract and tests swap in fakes."],
            [c("services/"), c("HttpExperienceClient") + " and " + c("HttpContactClient") + " over " + c("HttpClient") + ", and " + c("SubjectContactTopicState") + "."],
            [c("providers/"), c("provideSite()") + ": validates the options, then registers HttpClient over fetch, the options, the two clients, and the topic state. The counterpart of the Blazor edition's " + c("AddPortfolioServices()") + "."],
            [c("models/, requests/"), "Interfaces matching " + c("api/openapi.yaml") + " and the contact Lambda's JSON body."],
            [c("enumerations/"), c("WorkMode") + ", a string enum matching the API's kebab-case values."],
            [c("pipes/"), c("monthLabel") + " (2023-12 to Dec 2023) and " + c("placeLabel") + " (Remote, Hybrid, or the place)."],
            [c("validators/"), c("phoneRequiredForCall") + ", the contact form's one cross-field rule, with the " + c("REPLY_BY_PHONE") + " constant."],
            [c("src/testing/"), "Fakes of the two clients, fixture factories, the test options, and DOM helpers shared by the specs. Section 6."],
            [c("angular/README.md"), "The short version of this document, kept in the repo."],
        ],
        [2.0 * inch, 5.0 * inch],
    ),
    Spacer(1, 6),
    p("The workspace is not in " + c("mvcprogrammer.com.sln") + "; open " + c("angular/") + " as its own project in the IDE."),
]

# ---------------------------------------------------------------- 3
story += [
    p("3. How the Angular edition differs from the others", "h1"),
    p("The visible page is the same. The differences are in how it gets there. The React edition is compared column by column in its own guideline."),
    table(
        ["Concern", "Vanilla edition (root)", "Blazor edition (blazor/)", "Angular edition (angular/)"],
        [
            ["Rendering", "Hand-written HTML; reads fully without JavaScript.", "Razor components on .NET in WebAssembly; a boot screen until the runtime loads.", "Standalone components, OnPush, zoneless; a short boot screen until the 95 kB (compressed) bundle runs."],
            ["Where state lives", "DOM attributes and closures in " + c("main.js") + ".", "C# fields in the code-behinds.", "Signals on the components; the templates read them, " + c("computed()") + " derives labels and paths."],
            ["JavaScript", c("main.js") + ", about 470 lines.", c("site.js") + ", about 100 lines of browser APIs behind JS interop.", "None outside the components. They call " + c("IntersectionObserver") + ", " + c("matchMedia") + ", and " + c("&lt;dialog&gt;") + " directly, cleaning up through " + c("DestroyRef") + " and effect cleanups."],
            ["Experience timeline", "In the HTML; re-rendered from the API when it answers, HTML stays on failure.", c("ExperienceTimeline") + " loads from the API, falls back to the bundled seed.", "Same component and same fallback, written with " + c("async/await") + " over Promise-returning clients and wrapped in " + c("PendingTasks") + " so tests and the router can wait on it."],
            ["Skill chips", "Pinned, rest, demoted; twelve before the more button.", "Same constants in C#.", "Same constants as statics on " + c("ExperienceTimeline") + ". Pinning a different skill means editing all four."],
            ["Contact form", "HTML5 validation plus " + c("checkValidity()") + "; fetch.", c("EditForm") + " with data annotations; typed HttpClient.", "A typed " + c("FormBuilder") + " group with the same rules; the phone control is enabled only for a call, so a hidden field never validates. Same status messages, including the timeout one."],
            ["Topic preselection", "Buttons set the select's value.", c("IContactTopicState") + " singleton.", c("ContactTopicState") + ", a Subject the buttons push to and the form subscribes to with " + c("takeUntilDestroyed()") + "."],
            ["Configuration", c("data-") + " attributes in the HTML.", c("appsettings.json") + " bound to " + c("SiteOptions") + ".", "A " + c("SiteOptions") + " literal in " + c("app.config.ts") + ", validated by " + c("provideSite()") + " and injected through " + c("SITE_OPTIONS") + "."],
            ["Header behavior", "Listeners in " + c("main.js") + ".", "Observers in " + c("site.js") + " reporting through " + c("[JSInvokable]") + ".", "Observers in " + c("SiteHeader") + "; the section observer attaches after each " + c("NavigationEnd") + " because the sections render after the header."],
            ["Kiosk demo", "Native dialog; iframe cleared on close.", c("KioskDialog") + " with JS interop for " + c("showModal") + ".", c("KioskDialog") + " calls " + c("showModal()") + " itself; the iframe exists only while the " + c("open") + " signal is true."],
            ["Styling", "Shared stylesheet plus " + c("vanilla.css") + " (palette).", "Shared stylesheet plus " + c("blazor.css") + " (palette, boot screen).", "Shared stylesheet plus " + c("angular.css") + " (palette, boot screen). <b>No component styles</b>: Angular injects them inline, which the CSP forbids. Host elements get " + c("display: contents") + " so the sticky header and the grids are unaffected."],
            ["Build output", "The files as committed.", c("dotnet publish") + ", trimmed.", c("ng build") + ": esbuild, fingerprinted bundles, critical-CSS inlining off (it would be an inline " + c("&lt;style&gt;") + ")."],
            ["Hosting", "Bucket root, distribution for mvcprogrammer.com.", c("blazor/") + " prefix, own distribution, CSP with " + c("'wasm-unsafe-eval'") + ".", c("angular/") + " prefix, own distribution, the static site's response headers policy unchanged, S3 403 rewritten to " + c("index.html") + "."],
            ["Tests", "None for the static page.", "118 bUnit and xUnit cases.", "140 Vitest cases on jsdom, run before every build."],
        ],
        [0.95 * inch, 1.75 * inch, 2.0 * inch, 2.3 * inch],
        first_style="cellsmall",
    ),
]

# ---------------------------------------------------------------- 4
story += [
    p("4. Shared by copying versus duplicated by hand", "h1"),
    p("Angular refuses asset paths outside the workspace, so the shared files cannot be linked the way the Blazor "
      "project file links them. " + c("scripts/sync-shared.mjs") + " copies them into " + c("public/") + " before every "
      "build and serve instead, and " + c("public/") + " stays out of git, so there is still one source on disk. "
      "Everything else is written once per edition."),
    p("Edit once (copied into public/)", "h2"),
    b(c("styles.css") + ", the whole stylesheet, linked from " + c("index.html") + " by hand, ahead of the build's own stylesheet. The palette on top of it is per edition (section 1), so a color change is four edits."),
    b(c("assets/**") + ": fonts (Inter and JetBrains Mono as variable WOFF2 subsets) and images."),
    b(c("favicon.svg") + ", " + c("favicon.ico") + ", " + c("apple-touch-icon.png") + "."),
    b(c("api/seed/positions.json") + ", served to the Angular edition as " + c("data/positions.json") + "."),
    p("Edit four times (one copy per edition)", "h2"),
    b("Markup: " + c("index.html") + ", the Razor sections and components, the templates under " + c(SRC + "sections/") + " and " + c(SRC + "components/") + ", and the React edition's JSX under the same folder names."),
    b("Behavior: " + c("main.js") + ", the Razor code-behinds plus " + c("site.js") + ", the Angular component classes, and the React components and hooks."),
    b("Constants that shape the page: pinned and demoted skills, the visible chip count, status messages, section ids and labels."),
    b("Endpoints: " + c("data-") + " attributes in " + c("index.html") + ", " + c("wwwroot/appsettings.json") + ", the " + c("siteOptions") + " literal in " + c("app.config.ts") + ", and the one in the React edition's " + c("main.tsx") + "."),
    p("When a change touches a duplicated file, the commit is not finished until all four copies match. When the "
      "Angular copy changes behavior, add or update the spec that proves it."),
]

# ---------------------------------------------------------------- 5
story += [
    p("5. Running it locally", "h1"),
    p("Node 24 and npm; the .NET SDK is not needed. All commands run from " + c("angular/") + "."),
    *code_block([
        "npm ci",
        "npm start                      # http://localhost:4200, copies the shared files first",
        "npm run build                  # dist/portfolio-angular/browser/",
    ]),
    p("The dev server has no " + c("/api") + ", so the timeline falls back to the bundled seed and the skill filter stays "
      "hidden. To see the filter, serve the build output behind the real CloudFront behaviors or any host that proxies "
      + c("/api") + " to the Experience API. The dev server also injects its own inline scripts for live reload, which "
      "is fine locally; the production build has none."),
    p("The contact Lambda rejects Origins it does not know, so the form cannot send from a local preview in any edition."),
]

# ---------------------------------------------------------------- 6
story += [
    p("6. Testing", "h1"),
    p("The suite is Vitest 4 through the Angular CLI's unit-test builder, on jsdom, with the Vitest globals. Components "
      "render through " + c("TestBed") + " against fakes of the two client interfaces, so the skill filter, the seed "
      "fallback, the contact form's validation and status messages, the mobile menu, the section observer, and the "
      "kiosk dialog are all exercised without a browser. The two HTTP clients are tested over "
      + c("HttpTestingController") + ". The deploy workflow runs the suite before every build, so a red test blocks the "
      "Angular deploy."),
    KeepTogether([p("Commands", "h2"), *code_block([
        "# run the suite once",
        "npm test",
        "# re-run on change",
        "npm run test:watch",
        "# one suite or one test, by name (a regular expression)",
        'npx ng test --watch=false --filter "ContactSection"',
        'npx ng test --watch=false --filter "should fall back to the seed"',
        "# one file",
        'npx ng test --watch=false --include "**/site-header.spec.ts"',
    ])]),
    p("Conventions the suite follows", "h2"),
    b("One " + c("*.spec.ts") + " beside each source file. " + c("describe") + " names the class, a nested " + c("describe") + " names the method, and " + c("it") + " states the behavior in a sentence, so the report reads like the C# names " + c("Method_ShouldExpectedResult") + "."),
    b("Arrange, Act, Assert, each marked with a comment. Scenario setup across the fakes lives in " + c("arrange...") + " helpers at the bottom of the file; fixtures come from " + c("create...") + " factories in " + c("src/testing/test-data.ts") + "."),
    b("Dependencies of the class under test are faked, never the class itself. " + c("createSiteTestServices()") + " builds the fakes, the real topic state, and the test options in one call."),
    b("Zoneless rules: every async step is followed by " + c("await fixture.whenStable()") + ". The components wrap their loads in " + c("PendingTasks") + ", which is what makes that wait reliable."),
    b("jsdom has no " + c("IntersectionObserver") + ", no " + c("matchMedia") + ", and no modal dialogs. The components guard for that; the specs stub the observer and the dialog methods where the behavior matters."),
    p("Test layout", "h2"),
    p("Files mirror the app. The counts are test cases as Vitest reports them (140 in all)."),
    table(
        ["File", "Tests", "What it proves"],
        [
            [link("components/experience-timeline/experience-timeline.spec.ts", BLOB + SRC + "components/experience-timeline/experience-timeline.spec.ts"), "16", "API render, date and place labels, every fallback path (error, empty, not a list, seed failure, empty seed, skills failure), chip order, the more button, chip titles, filtering, restore without refetch, filter failure, late response after destroy."],
            [link("components/site-header/site-header.spec.ts", BLOB + SRC + "components/site-header/site-header.spec.ts"), "19", "Nav links and initial state, the edition list (four entries, current marked, open and close, Escape, outside click), menu toggle, close on nav click, Escape with focus return, outside and inside clicks, listeners released, scrolled class, section observer after navigation, current link set and cleared, observer replaced and disconnected, no observer in the browser."],
            [link("components/kiosk-dialog/kiosk-dialog.spec.ts", BLOB + SRC + "components/kiosk-dialog/kiosk-dialog.spec.ts"), "7", "No iframe while closed, show renders the configured kiosk and opens modally, show is idempotent, close button, close before open, backdrop versus inside click, close event removes the iframe."],
            [link("components/icon-sprite/icon-sprite.spec.ts", BLOB + SRC + "components/icon-sprite/icon-sprite.spec.ts"), "14", "Every symbol the page references exists in the sprite."],
            [link("components/icon, social-links, site-footer", TREE + SRC + "components"), "3", "Icon references a sprite symbol, three social profiles, footer year and legal links."],
            [link("sections/contact-section/contact-section.spec.ts", BLOB + SRC + "sections/contact-section/contact-section.spec.ts"), "15", "Phone field hidden and disabled by default, topic preselection and unsubscribe, phone reveal and hide, post and confirmations, honeypot forwarded, 429, generic failure, timeout, non-HTTP error, no post when invalid, when a call has no number, or the message is too short."],
            [link("sections/static-sections.spec.ts", BLOB + SRC + "sections/static-sections.spec.ts"), "6", "Hero, the About tag exception, the quote, the portfolio links and kiosk button, the resume URL and education, the colophon."],
            [link("sections/call-to-action.spec.ts", BLOB + SRC + "sections/call-to-action.spec.ts"), "2", "The Services and Freelance buttons select their contact topic."],
            [link("pages/home, pages/not-found, app.spec.ts", TREE + SRC), "5", "Home renders every section in order, NotFound, the layout around the routed page, an unknown path routes to NotFound."],
            [link("services/beacon-engagement-tracker.spec.ts", BLOB + SRC + "services/beacon-engagement-tracker.spec.ts"), "12", "Load ping with screen class and color scheme, view pings once per section, click pings for edition and profile links with their place, leave pings with the visible seconds, silence on localhost, no observer in the browser, failed pings ignored, restart and stop."],
            [link("services/http-experience-client.spec.ts", BLOB + SRC + "services/http-experience-client.spec.ts"), "9", "Paths, timeout option, query-string escaping, blank skill ignored, error status, null bodies, skills, seed."],
            [link("services/http-contact-client.spec.ts", BLOB + SRC + "services/http-contact-client.spec.ts"), "3", "JSON post to the endpoint with the Accept header and timeout, empty success body, status code on rejection."],
            [link("services/subject-contact-topic-state.spec.ts", BLOB + SRC + "services/subject-contact-topic-state.spec.ts"), "4", "Notify every subscriber, no subscribers, unsubscribe stops notifications, no replay."],
            [link("providers/site-providers.spec.ts", BLOB + SRC + "providers/site-providers.spec.ts"), "6", "Everything registered, one topic state, invalid options rejected before providing, validation messages."],
            [link("pipes/, validators/", TREE + SRC), "19", "Month labels and unparseable input, place label per work mode, the phone rule in every reply state."],
            [link("src/testing/", TREE + "angular/src/testing"), "", c("FakeExperienceClient") + " and " + c("FakeContactClient") + " (scriptable, record their calls), " + c("createSiteTestServices()") + ", " + c("TEST_SITE_OPTIONS") + ", fixture factories, and the " + c("type") + ", " + c("choose") + ", and " + c("textOf") + " DOM helpers."],
        ],
        [2.95 * inch, 0.55 * inch, 3.5 * inch],
        first_style="cellsmall",
    ),
]

# ---------------------------------------------------------------- 7
story += [
    p("7. Deploying", "h1"),
    p("The " + c("deploy-angular") + " job in " + link(".github/workflows/deploy.yml", BLOB + ".github/workflows/deploy.yml")
      + " runs on every push to " + c("main") + ", in parallel with the other three jobs. It sets up Node 24 with the npm "
      "cache, runs " + c("npm ci") + ", " + c("npm test") + ", and " + c("npm run build") + " (which copies the shared "
      "files first), assumes the deploy role through OIDC, and syncs the output in two passes before invalidating the "
      "distribution."),
    b("The fingerprinted bundles (" + c("main-*.js") + ", " + c("polyfills-*.js") + ", " + c("chunk-*.js") + ", " + c("angular-*.css") + ") get a one-week browser TTL and " + c("immutable") + "."),
    b("Everything else, " + c("index.html") + ", the shared stylesheet, icons, images, and the seed, gets a five-minute browser TTL."),
    b("CloudFront compresses on the fly; nothing is pre-compressed."),
    p("A manual deploy is the same two syncs plus an invalidation; the exact commands, the resource creation steps, "
      "and the distribution, certificate, Route 53, bucket policy, and IAM details are in the Angular section of "
      + link("docs/DEPLOY.md", BLOB + "docs/DEPLOY.md") + ". Resource IDs are documented there once and are not repeated here."),
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
            ["2", "If the file is shared (section 4), you are done with content. If it is duplicated, make the matching change in the other three editions."],
            ["3", "If the Angular behavior changed, add or update the spec that proves it. Follow the conventions in section 6."],
            ["4", "Run " + c("npm test") + " and " + c("npm run build") + " in " + c("angular/") + " and make both green. Warnings in the build are errors in review."],
            ["5", "Preview the editions locally: " + c("python3 -m http.server 8080") + " at the root, " + c("dotnet run --project blazor/src/Portfolio.Blazor") + ", and " + c("npm start") + " in " + c("angular/") + " and in " + c("react/") + "."],
            ["6", "Check the cross-links survived: the edition menu in the header, the four About chips, and the two hero highlights, identical on every edition, with their hints."],
            ["7", "If you added a component, add its selector to the " + c("display: contents") + " list in " + c("angular.css") + ". Never add component styles. A color change edits the palette block at the top of the same file, and the other three palette files if it is meant to be shared."],
            ["8", "Commit all editions together. No AI attribution trailers in the message."],
            ["9", "Push to " + c("main") + " only when asked. The workflow tests, builds, and deploys every edition."],
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
            ["Live, Angular edition", link("https://angular.mvcprogrammer.com", "https://angular.mvcprogrammer.com")],
            ["Live, Blazor edition", link("https://blazor.mvcprogrammer.com", "https://blazor.mvcprogrammer.com")],
            ["Live, vanilla edition", link("https://mvcprogrammer.com", "https://mvcprogrammer.com")],
            ["Repository", link(REPO, REPO)],
            ["Angular workspace", link("angular/", TREE + "angular")],
            ["Angular app source", link("angular/src/app", TREE + "angular/src/app")],
            ["Angular README", link("angular/README.md", BLOB + "angular/README.md")],
            ["Blazor guideline", link("docs/BLAZOR-EDITION.pdf", BLOB + "docs/BLAZOR-EDITION.pdf")],
            ["Live, React edition", link("https://react.mvcprogrammer.com", "https://react.mvcprogrammer.com")],
            ["React guideline", link("docs/REACT-EDITION.pdf", BLOB + "docs/REACT-EDITION.pdf")],
            ["Deploy walkthrough", link("docs/DEPLOY.md", BLOB + "docs/DEPLOY.md")],
            ["Deploy workflow", link(".github/workflows/deploy.yml", BLOB + ".github/workflows/deploy.yml")],
            ["Experience API spec", link("api/openapi.yaml", BLOB + "api/openapi.yaml")],
            ["Contact Lambda", link("infra/lambda/contact/index.mjs", BLOB + "infra/lambda/contact/index.mjs")],
            ["Workflow runs", link("GitHub Actions", REPO + "/actions/workflows/deploy.yml")],
        ],
        [1.8 * inch, 5.2 * inch],
    )]),
]

build(
    OUT, story,
    title="The Angular edition of mvcprogrammer.com",
    subject="Guideline for building, testing, and deploying the Angular edition",
    running_title="mvcprogrammer.com  ·  The Angular edition",
    dated="Guideline, October 2026",
)
