"""Builds docs/REACT-EDITION.pdf, the guideline for the React edition of mvcprogrammer.com.

    python3 -m venv .venv && .venv/bin/pip install reportlab fonttools brotli
    .venv/bin/python docs/pdf/build_fonts.py /tmp/pdf-fonts
    .venv/bin/python docs/pdf/build_react_guide.py /tmp/pdf-fonts docs/REACT-EDITION.pdf

The styling and helpers are shared with build_blazor_guide.py and build_angular_guide.py through guide_common.py.
"""
import sys
from reportlab.lib.units import inch
from reportlab.platypus import KeepTogether, Spacer
from guide_common import BLOB, REPO, TREE, b, build, c, code_block, link, p, palette_table, register_fonts, table

FONT_DIR, OUT = sys.argv[1], sys.argv[2]
register_fonts(FONT_DIR)

SRC = "react/src/app/"
story = []

# ---------------------------------------------------------------- Title
story += [
    p("The React edition", "title"),
    p("How react.mvcprogrammer.com is built, how it differs from the vanilla edition at mvcprogrammer.com, the "
      "Angular edition at angular.mvcprogrammer.com, and the Blazor edition at blazor.mvcprogrammer.com, and the rules "
      "for changing, testing, and deploying it.", "subtitle"),
]

# ---------------------------------------------------------------- 1
story += [
    p("1. Why there are four editions", "h1"),
    p("The portfolio ships four times. The default edition is plain HTML, CSS, and JavaScript at the repository root, "
      "served at " + link("mvcprogrammer.com", "https://mvcprogrammer.com") + ". The Blazor edition is a Blazor "
      "WebAssembly app under " + c("blazor/") + ", served at " + link("blazor.mvcprogrammer.com", "https://blazor.mvcprogrammer.com")
      + " and documented in " + link("docs/BLAZOR-EDITION.pdf", BLOB + "docs/BLAZOR-EDITION.pdf") + ". The Angular edition "
      "is an Angular 22 workspace under " + c("angular/") + ", served at "
      + link("angular.mvcprogrammer.com", "https://angular.mvcprogrammer.com") + " and documented in "
      + link("docs/ANGULAR-EDITION.pdf", BLOB + "docs/ANGULAR-EDITION.pdf") + ". The React edition is a React 19 "
      "application built with Vite under " + c("react/") + ", served at "
      + link("react.mvcprogrammer.com", "https://react.mvcprogrammer.com") + ". All four show the same content, load "
      "the same stylesheet under their own palettes, and call the same Experience API. The React edition exists to show that content consumed "
      "from function components and hooks, next to the Angular, C#, and vanilla versions."),
    p("The one rule that matters", "h2"),
    p("<b>Every content, markup, behavior, or styling change made to one edition is made to the other three in the same "
      "commit.</b> Before finishing any change to the site, check the other editions for the same change. Section 4 "
      "lists which files are shared (one edit) and which are duplicated (four edits)."),
    p("No exceptions", "h2"),
    p("Content is identical on every edition. The editions cross-link through the About core-skill chips "
      "(<b>Angular</b>, <b>React</b>, <b>Blazor</b>, <b>JavaScript</b>, each with a title hint such as <i>See the React edition of "
      "this site</i>) and through the edition menu in the header: a pill naming the open "
      "edition that lists all four. The hero highlights are plain text (their Angular and React links were removed on 2026-10-19). A link to the edition already open simply reloads it. The portfolio card carries no edition links. The test in " + c("sections/static-sections.test.tsx") + " pins the React side of it."),
    KeepTogether([
        p("The one exception: color", "h2"),
        p("Each edition carries its own palette. One small file per edition, loaded after the shared " + c("styles.css")
          + ", overrides only the design tokens (" + c("--bg") + ", " + c("--accent") + ", " + c("--hover") + ", and the rest) "
          "with " + c("light-dark()") + " values, so one declaration covers both color schemes and no rule from the shared "
          "stylesheet is repeated. Older browsers ignore " + c("light-dark()") + " and fall back to the shared JetBrains "
          "Rider palette. The four palettes, with the page, the accent, and the hover color "
          "for each scheme:"),
        palette_table(),
        p("Vite's CSS minifier would rewrite " + c("light-dark()") + " into a variable polyfill that only works when " + c("color-scheme") + " is declared in the same file, and it is declared in the shared " + c("styles.css") + ", so " + c("vite.config.ts") + " pins " + c("build.cssTarget") + " to browsers that support the function and the minifier leaves it alone. Check the production stylesheet under " + c("dist/bundles/") + " after any change to the palette, not only the dev server.", "caption"),
    ]),
    p("Every edition's colophon describes its own palette, and the four are listed with screenshots in the README of "
      "this repository and on the GitHub profile README."),
]

# ---------------------------------------------------------------- 2
story += [
    p("2. Where things live", "h1"),
    p("The project follows the folder-by-kind layout from the coding standards, in React's dress: plural folder "
      "names under " + c("src/app/") + ", PascalCase files for components and kebab-case files for everything else, "
      "and one " + c("*.test.ts(x)") + " beside each source file."),
    table(
        ["Path", "What it holds"],
        [
            [c("react/"), "The project: one Vite application, " + c("portfolio-react") + ", React 19, strict TypeScript, Vitest with Testing Library."],
            [c("scripts/sync-shared.mjs"), "Copies the shared root files into " + c("public/") + " before every build and serve (the " + c("prebuild") + " and " + c("prestart") + " npm hooks). " + c("public/") + " is generated and not committed."],
            [c("index.html"), "The shell: metadata, the shared stylesheet link, the boot screen inside " + c("#root") + ", and the module script tag Vite rewrites."],
            [c("vite.config.ts"), "The React plugin, " + c("assetsDir: 'bundles'") + ", " + c("assetsInlineLimit: 0") + ", " + c("cssTarget") + " (keeps " + c("light-dark()") + " in the palette, section 1), and the Vitest section (jsdom, globals, the setup file)."],
            [c("src/main.tsx"), "The " + c("siteOptions") + " literal, " + c("createSiteServices()") + ", and " + c("createRoot().render()") + " under " + c("StrictMode") + ". Imports " + c("react.css") + "."],
            [c("src/react.css"), "The only extra stylesheet: this edition's palette (section 1), the boot screen, and the " + c("aria-invalid") + " validation state."],
            [c("src/app/App.tsx"), c("App") + " (SiteProvider, BrowserRouter, Layout) and " + c("Layout") + ": skip link, icon sprite, header, " + c("&lt;main&gt;") + " with the routes, footer."],
            [c("pages/"), c("Home") + " (the sections in page order; starts the engagement tracker in an effect) and " + c("NotFound") + "."],
            [c("sections/"), "One component per section of the page: Hero, About, Quote, Services, Portfolio, Resume, Contact, Colophon. JSX lifted from " + c("index.html") + "."],
            [c("components/"), "Header (menu, scroll state, current section), footer, icon and icon sprite, social links, the experience timeline with its skill filter, and the kiosk demo dialog."],
            [c("configurations/"), c("SiteOptions") + "."],
            [c("interfaces/"), c("ExperienceClient") + ", " + c("ContactClient") + ", " + c("ContactTopicState") + ", " + c("EngagementTracker") + ": the contracts the components depend on, so tests swap in fakes."],
            [c("services/"), c("FetchExperienceClient") + " and " + c("FetchContactClient") + " over " + c("fetch") + " with " + c("AbortSignal.timeout") + ", " + c("ListenerContactTopicState") + ", and " + c("BeaconEngagementTracker") + "."],
            [c("providers/"), c("createSiteServices()") + " (validates the options, builds the services) and " + c("SiteProvider") + " with the " + c("useSite()") + " hook. The counterpart of " + c("AddPortfolioServices()") + " and " + c("provideSite()") + "."],
            [c("models/, requests/"), "Interfaces matching " + c("api/openapi.yaml") + " and the contact Lambda's JSON body."],
            [c("enumerations/"), c("WorkMode") + ", a const object and union type matching the API's kebab-case values."],
            [c("exceptions/"), c("HttpStatusError") + ", thrown by the clients for a non-2xx response, carrying the status."],
            [c("formatters/"), c("monthLabel") + " (2023-12 to Dec 2023) and " + c("placeLabel") + " (Remote, Hybrid, or the place)."],
            [c("validators/"), c("validateContactForm()") + " with the length rules and the phone-required-for-call rule, plus " + c("REPLY_BY_PHONE") + "."],
            [c("src/testing/"), "Fakes of the clients and the tracker, fixture factories, the test options, " + c("renderWithSite()") + ", and DOM helpers. Section 6."],
            [c("react/README.md"), "The short version of this document, kept in the repo."],
        ],
        [2.0 * inch, 5.0 * inch],
    ),
    Spacer(1, 6),
    p("The project is not in " + c("mvcprogrammer.com.sln") + "; open " + c("react/") + " as its own project in the IDE."),
]

# ---------------------------------------------------------------- 3
story += [
    p("3. How the React edition differs from the others", "h1"),
    p("The visible page is the same. The differences are in how it gets there. The Blazor column is in the Blazor guideline."),
    table(
        ["Concern", "Vanilla edition (root)", "Angular edition (angular/)", "React edition (react/)"],
        [
            ["Rendering", "Hand-written HTML; reads fully without JavaScript.", "Standalone components, OnPush, zoneless; a boot screen until the bundle runs.", "Function components rendered by " + c("createRoot") + " under " + c("StrictMode") + "; the same boot screen until the 97 kB (compressed) bundle runs."],
            ["Where state lives", "DOM attributes and closures in " + c("main.js") + ".", "Signals on the components; " + c("computed()") + " derives labels and paths.", c("useState") + " on the components; labels and paths are derived in the render. The kiosk dialog's open state is lifted to the portfolio section."],
            ["JavaScript", c("main.js") + ", about 660 lines.", "None outside the components; " + c("DestroyRef") + " and effect cleanups.", "None outside the components. " + c("useEffect") + " attaches " + c("IntersectionObserver") + ", " + c("matchMedia") + ", and the document listeners and returns their teardown."],
            ["Experience timeline", "In the HTML; re-rendered from the API when it answers.", c("ExperienceTimeline") + " loads from the API, falls back to the seed, wrapped in " + c("PendingTasks") + ".", "Same component and same fallback in one " + c("useEffect") + " with an " + c("active") + " flag, so a response after unmount (or StrictMode's first run) is dropped."],
            ["Skill chips", "Pinned, rest, demoted; twelve before the more button.", "Same constants as statics on " + c("ExperienceTimeline") + ".", "Same constants exported from " + c("ExperienceTimeline.tsx") + " with " + c("orderChips()") + ". Pinning a different skill means editing all four."],
            ["Contact form", "HTML5 validation plus " + c("checkValidity()") + "; fetch.", "A typed " + c("FormBuilder") + " group; the phone control is enabled only for a call.", "Controlled fields in one " + c("useState") + ", " + c("validateContactForm()") + " on every render, " + c("aria-invalid") + " on fields the visitor left or a submit found invalid. Same status messages, including the timeout one."],
            ["Topic preselection", "Buttons set the select's value.", c("ContactTopicState") + ", a Subject the form subscribes to.", c("ContactTopicState") + " with " + c("subscribe()") + " returning an unsubscribe function; the form subscribes in an effect and returns it."],
            ["Configuration", c("data-") + " attributes in the HTML.", "A " + c("SiteOptions") + " literal validated by " + c("provideSite()") + ", injected through a token.", "A " + c("SiteOptions") + " literal in " + c("main.tsx") + ", validated by " + c("createSiteServices()") + ", supplied by " + c("SiteProvider") + " and read with " + c("useSite()") + "."],
            ["Header behavior", "Listeners in " + c("main.js") + ".", "Observers in " + c("SiteHeader") + "; re-attached after " + c("NavigationEnd") + ".", "Observers in " + c("SiteHeader") + " effects; the section observer depends on " + c("useLocation().pathname") + " so it re-attaches after a navigation."],
            ["Theme toggle", "A click handler in " + c("main.js") + " sets " + c("data-theme") + " and saves the choice.", "A " + c("toggleTheme()") + " method on " + c("SiteHeader") + ".", "An exported " + c("toggleTheme()") + " function used as the button's " + c("onClick") + ". All four keep no theme state; the stylesheet picks the icon, and the shared " + c("theme.js") + " in the head applies a saved choice before the first render."],
            ["Kiosk demo", "Native dialog; iframe cleared on close.", c("KioskDialog") + " calls " + c("showModal()") + "; iframe while the " + c("open") + " signal is true.", c("KioskDialog") + " takes " + c("open") + " and " + c("onClose") + " props; an effect calls " + c("showModal()") + " or " + c("close()") + ", the dialog's " + c("close") + " event reports back, the iframe exists only while open."],
            ["Styling", "Shared stylesheet plus " + c("vanilla.css") + " (palette).", "Shared stylesheet plus " + c("angular.css") + " (palette, boot screen); no component styles (CSP).", "Shared stylesheet plus " + c("react.css") + " (palette, boot screen). <b>No CSS-in-JS and no " + c("style") + " attribute</b>: the CSP forbids inline styles. No host elements, so no " + c("display: contents") + " list to maintain."],
            ["Build output", "The files as committed.", c("ng build") + ": esbuild, fingerprinted bundles, critical CSS not inlined.", c("tsc -b") + " then " + c("vite build") + ": one fingerprinted script and stylesheet under " + c("bundles/") + ", nothing inlined, no source maps."],
            ["Hosting", "Bucket root, distribution for mvcprogrammer.com.", c("angular/") + " prefix, own distribution, S3 403 rewritten to " + c("index.html") + ".", c("react/") + " prefix, own distribution, the static site's response headers policy unchanged, S3 403 rewritten to " + c("index.html") + " so React Router answers deep links."],
            ["Tests", "None for the static page.", "140 Vitest cases on jsdom.", "188 Vitest cases on jsdom with Testing Library, run before every build."],
        ],
        [0.95 * inch, 1.6 * inch, 2.1 * inch, 2.35 * inch],
        first_style="cellsmall",
    ),
]

# ---------------------------------------------------------------- 4
story += [
    p("4. Shared by copying versus duplicated by hand", "h1"),
    p("Vite serves " + c("public/") + " as-is, so the shared files are copied there by " + c("scripts/sync-shared.mjs")
      + " before every build and serve, the same way the Angular edition does it, and " + c("public/") + " stays out of "
      "git, so there is still one source on disk. Everything else is written once per edition."),
    p("Edit once (copied into public/)", "h2"),
    b(c("styles.css") + ", the whole stylesheet, linked from " + c("index.html") + " by hand, ahead of the build's own stylesheet. The palette on top of it is per edition (section 1), so a color change is four edits."),
    b(c("assets/**") + ": fonts (Inter and JetBrains Mono as variable WOFF2 subsets) and images. The bundles go under " + c("bundles/") + " so the deploy can give the two folders different cache headers."),
    b(c("favicon.svg") + ", " + c("favicon.ico") + ", " + c("apple-touch-icon.png") + "."),
    b(c("api/seed/positions.json") + ", served to the React edition as " + c("data/positions.json") + "."),
    p("Edit four times (one copy per edition)", "h2"),
    b("Markup: " + c("index.html") + ", the Razor sections and components, the Angular templates, and the JSX under " + c(SRC + "sections/") + " and " + c(SRC + "components/") + "."),
    b("Behavior: " + c("main.js") + ", the Razor code-behinds plus " + c("site.js") + ", the Angular component classes, and the React components and hooks."),
    b("Constants that shape the page: pinned and demoted skills, the visible chip count, status messages, section ids and labels."),
    b("Endpoints: " + c("data-") + " attributes in " + c("index.html") + ", " + c("wwwroot/appsettings.json") + ", " + c("app.config.ts") + ", and the " + c("siteOptions") + " literal in " + c("main.tsx") + "."),
    p("When a change touches a duplicated file, the commit is not finished until all four copies match. When the "
      "React copy changes behavior, add or update the test that proves it."),
]

# ---------------------------------------------------------------- 5
story += [
    p("5. Running it locally", "h1"),
    p("Node 24 and npm; the .NET SDK is not needed. All commands run from " + c("react/") + "."),
    *code_block([
        "npm ci",
        "npm start                      # http://localhost:5173, copies the shared files first",
        "npm run build                  # dist/ (tsc -b, then vite build)",
        "npm run preview                # serves dist/ at http://localhost:4173",
    ]),
    p("The dev server has no " + c("/api") + ", so the timeline falls back to the bundled seed and the skill filter stays "
      "hidden. To see the filter, serve the build output behind the real CloudFront behaviors or any host that proxies "
      + c("/api") + " to the Experience API. The dev server injects its own inline scripts for hot reloading, which "
      "is fine locally; the production build has none."),
    p("The contact Lambda rejects Origins it does not know, so the form cannot send from a local preview in any edition."),
]

# ---------------------------------------------------------------- 6
story += [
    p("6. Testing", "h1"),
    p("The suite is Vitest 5 on jsdom with React Testing Library, using the Vitest globals. Components render under a "
      + c("SiteProvider") + " holding fakes of the client interfaces (" + c("renderWithSite()") + " adds a memory router), "
      "so the skill filter, the seed fallback, the contact form's validation and status messages, the mobile menu, the "
      "section observer, and the kiosk dialog are all exercised without a browser. The two fetch clients are tested "
      "against a stubbed " + c("fetch") + ". The deploy workflow runs the suite and " + c("tsc -b") + " before every "
      "build, so a red test blocks the React deploy."),
    KeepTogether([p("Commands", "h2"), *code_block([
        "# run the suite once",
        "npm test",
        "# re-run on change",
        "npm run test:watch",
        "# tests whose name matches (a regular expression)",
        'npx vitest run -t "ContactSection"',
        'npx vitest run -t "should fall back to the seed"',
        "# one file",
        "npx vitest run src/app/components/SiteHeader.test.tsx",
        "# type-check the app, the tests, and the Vite config",
        "npm run typecheck",
    ])]),
    p("Conventions the suite follows", "h2"),
    b("One " + c("*.test.ts") + " or " + c("*.test.tsx") + " beside each source file. " + c("describe") + " names the component or function, a nested " + c("describe") + " names the method or concern, and " + c("it") + " states the behavior in a sentence, so the report reads like the C# names " + c("Method_ShouldExpectedResult") + "."),
    b("Arrange, Act, Assert, each marked with a comment. Scenario setup across the fakes lives in " + c("arrange...") + " helpers at the bottom of the file; fixtures come from " + c("create...") + " factories in " + c("src/testing/test-data.ts") + "."),
    b("Dependencies of the component under test are faked, never the component itself. " + c("createSiteTestServices()") + " builds the fakes, the real topic state, and the test options in one call."),
    b("Async rules: a state change after a promise is awaited with " + c("findBy...") + " or " + c("waitFor") + "; a call into the component from outside React (the topic state, an observer callback) is wrapped in " + c("act()") + "."),
    b("jsdom has no " + c("IntersectionObserver") + ", no " + c("matchMedia") + ", and no modal dialogs. The components guard for that; the tests stub the observer and the dialog methods where the behavior matters, and query a closed dialog's button with " + c("hidden: true") + "."),
    p("Test layout", "h2"),
    p("Files mirror the app. The counts are test cases as Vitest reports them (256 in all)."),
    table(
        ["File", "Tests", "What it proves"],
        [
            [link("components/ExperienceTimeline.test.tsx", BLOB + SRC + "components/ExperienceTimeline.test.tsx"), "19", "API render, date and place labels, Present, every fallback path (error, empty, not a list, seed failure, empty seed, skills failure, no skills), late response after unmount, chip order, the more button, chip titles, filtering, restore without refetch, filter failure, the loading class."],
            [link("components/SiteHeader.test.tsx", BLOB + SRC + "components/SiteHeader.test.tsx"), "26", "Nav links and initial state, the theme toggle (both OS schemes, a saved choice both ways, no matchMedia, blocked storage, icons and name), the edition list (four entries, current marked, open and close, Escape, outside click, listener release), menu toggle, close on nav click, Escape with focus return, outside and inside clicks, the breakpoint, listeners released, scrolled class, current link set, cleared near the top, kept further down, no sections, no observer in the browser, disconnect on unmount, replaced after navigation."],
            [link("components/KioskDialog.test.tsx", BLOB + SRC + "components/KioskDialog.test.tsx"), "8", "No iframe while closed, open shows the configured kiosk modally, showModal not repeated, close button, close while not open, backdrop versus inside click, parent closing it, Escape through the close event."],
            [link("components/IconSprite.test.tsx", BLOB + SRC + "components/IconSprite.test.tsx"), "14", "Every symbol the page references exists in the sprite; the sprite is hidden."],
            [link("components/Icon, SocialLinks, SiteFooter", TREE + SRC + "components"), "3", "Icon references a sprite symbol, three social profiles, footer year and legal links."],
            [link("sections/ContactSection.test.tsx", BLOB + SRC + "sections/ContactSection.test.tsx"), "25", "Phone field hidden by default, reveal and hide, topic preselection and unsubscribe, post and both confirmations with reset, honeypot forwarded, disabled while sending, 429, generic failure, timeout, non-HTTP error, values kept after failure, no post when invalid, when a call has no number, or the message is too short, blur marks a field, fixing clears it, and the message table."],
            [link("sections/static-sections.test.tsx", BLOB + SRC + "sections/static-sections.test.tsx"), "7", "Hero with plain highlights, the four About chips, the quote, the portfolio links and kiosk button, the iframe removed on close, the resume URL and education, the colophon."],
            [link("sections/call-to-action.test.tsx", BLOB + SRC + "sections/call-to-action.test.tsx"), "1", "The Services button selects its contact topic."],
            [link("pages/Home, pages/NotFound, App.test.tsx", TREE + SRC), "6", "Home renders every section in order and starts and stops the tracker, NotFound, the layout around the routed page, an unknown path routes to NotFound, App under the browser router."],
            [link("providers/site-services.test.ts, SiteProvider.test.tsx", TREE + SRC + "providers"), "14", "Every service built, invalid options rejected before building, each required key, each URL key, every problem named at once, the provider hands services down, useSite throws without one."],
            [link("services/fetch-experience-client.test.ts", BLOB + SRC + "services/fetch-experience-client.test.ts"), "12", "Paths, Accept header and timeout signal, query-string escaping, blank skill ignored, error status, non-JSON body, null bodies, skills, seed, the global fetch by default, a rejected fetch propagated."],
            [link("services/fetch-contact-client.test.ts", BLOB + SRC + "services/fetch-contact-client.test.ts"), "5", "JSON post with the headers and timeout signal, empty success body, status code on rejection, timeout propagated, the global fetch by default."],
            [link("services/beacon-engagement-tracker.test.ts", BLOB + SRC + "services/beacon-engagement-tracker.test.ts"), "14", "Load ping with screen class and color scheme, view pings once per section, click pings for edition and profile links with their place, leave pings with the visible seconds accumulated across hide and show, silence on localhost, no observer in the browser, failed pings ignored, restart, stop, stop before start."],
            [link("services/listener-contact-topic-state.test.ts", BLOB + SRC + "services/listener-contact-topic-state.test.ts"), "5", "Notify every subscriber, no subscribers, no replay, unsubscribe stops notifications, unsubscribe during a select."],
            [link("formatters/, validators/, exceptions/", TREE + SRC), "33", "Month labels and unparseable input, place label per work mode, every contact form rule in every reply state, the HttpStatusError shape."],
            [link("src/testing/", TREE + "react/src/testing"), "", c("FakeExperienceClient") + ", " + c("FakeContactClient") + ", and " + c("FakeEngagementTracker") + " (scriptable, record their calls), " + c("createSiteTestServices()") + ", " + c("renderWithSite()") + ", " + c("TEST_SITE_OPTIONS") + ", fixture factories, " + c("jsonResponse()") + ", and " + c("textOf()") + "."],
        ],
        [2.95 * inch, 0.55 * inch, 3.5 * inch],
        first_style="cellsmall",
    ),
]

# ---------------------------------------------------------------- 7
story += [
    p("7. Deploying", "h1"),
    p("The " + c("deploy-react") + " job in " + link(".github/workflows/deploy.yml", BLOB + ".github/workflows/deploy.yml")
      + " runs on every push to " + c("main") + ", in parallel with the other three jobs. It sets up Node 24 with the npm "
      "cache, runs " + c("npm ci") + ", " + c("npm test") + ", and " + c("npm run build") + " (which copies the shared "
      "files and type-checks first), assumes the deploy role through OIDC, and syncs the output in two passes before "
      "invalidating the distribution."),
    b("The fingerprinted bundles under " + c("bundles/") + " get a one-week browser TTL and " + c("immutable") + "."),
    b("Everything else, " + c("index.html") + ", the shared stylesheet, icons, images, and the seed, gets a five-minute browser TTL."),
    b("CloudFront compresses on the fly; nothing is pre-compressed."),
    p("A manual deploy is the same two syncs plus an invalidation; the exact commands, the resource creation steps, "
      "and the distribution, certificate, Route 53, bucket policy, and IAM details are in the React section of "
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
            ["3", "If the React behavior changed, add or update the test that proves it. Follow the conventions in section 6."],
            ["4", "Run " + c("npm test") + " and " + c("npm run build") + " in " + c("react/") + " and make both green. Warnings in the build are errors in review."],
            ["5", "Preview the editions locally: " + c("python3 -m http.server 8080") + " at the root, " + c("dotnet run --project blazor/src/Portfolio.Blazor") + ", and " + c("npm start") + " in " + c("angular/") + " and in " + c("react/") + "."],
            ["6", "Check the cross-links survived: the edition menu in the header and the four About chips, identical on every edition, with their hints; the hero highlights stay plain."],
            ["7", "Never add a " + c("style") + " attribute, a CSS-in-JS library, or an inline " + c("&lt;script&gt;") + "; the CSP blocks them in production. New rules go in " + c("react.css") + "; a color change edits its palette block, and the other three palette files if it is meant to be shared."],
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
            ["Live, React edition", link("https://react.mvcprogrammer.com", "https://react.mvcprogrammer.com")],
            ["Live, Angular edition", link("https://angular.mvcprogrammer.com", "https://angular.mvcprogrammer.com")],
            ["Live, Blazor edition", link("https://blazor.mvcprogrammer.com", "https://blazor.mvcprogrammer.com")],
            ["Live, vanilla edition", link("https://mvcprogrammer.com", "https://mvcprogrammer.com")],
            ["Repository", link(REPO, REPO)],
            ["React project", link("react/", TREE + "react")],
            ["React app source", link("react/src/app", TREE + "react/src/app")],
            ["React README", link("react/README.md", BLOB + "react/README.md")],
            ["Angular guideline", link("docs/ANGULAR-EDITION.pdf", BLOB + "docs/ANGULAR-EDITION.pdf")],
            ["Blazor guideline", link("docs/BLAZOR-EDITION.pdf", BLOB + "docs/BLAZOR-EDITION.pdf")],
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
    title="The React edition of mvcprogrammer.com",
    subject="Guideline for building, testing, and deploying the React edition",
    running_title="mvcprogrammer.com  ·  The React edition",
    dated="Guideline, October 2026",
)
