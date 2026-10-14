"""Builds docs/BLAZOR-EDITION.pdf, the guideline for the Blazor edition of mvcprogrammer.com.

    python3 -m venv .venv && .venv/bin/pip install reportlab fonttools brotli
    .venv/bin/python docs/pdf/build_fonts.py /tmp/pdf-fonts
    .venv/bin/python docs/pdf/build_guide.py /tmp/pdf-fonts docs/BLAZOR-EDITION.pdf
"""
import sys
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether, PageBreak, Paragraph, Preformatted, SimpleDocTemplate, Spacer, Table, TableStyle,
)

FONT_DIR, OUT = sys.argv[1], sys.argv[2]

pdfmetrics.registerFont(TTFont("Inter", f"{FONT_DIR}/Inter-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Inter-SemiBold", f"{FONT_DIR}/Inter-SemiBold.ttf"))
pdfmetrics.registerFont(TTFont("Inter-Bold", f"{FONT_DIR}/Inter-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Mono", f"{FONT_DIR}/JetBrainsMono-Regular.ttf"))
pdfmetrics.registerFontFamily("Inter", normal="Inter", bold="Inter-SemiBold", italic="Inter", boldItalic="Inter-SemiBold")

INK = colors.HexColor("#1e1f22")
BODY = colors.HexColor("#33363b")
MUTED = colors.HexColor("#6b7079")
ACCENT = colors.HexColor("#2f62d9")
RULE = colors.HexColor("#d9dce2")
CODE_BG = colors.HexColor("#f3f4f7")
HEAD_BG = colors.HexColor("#eef2fb")

REPO = "https://github.com/mvcprogrammer/mvcprogrammer.com"
BLOB = f"{REPO}/blob/main/"
TREE = f"{REPO}/tree/main/"

S = {
    "title": ParagraphStyle("title", fontName="Inter-Bold", fontSize=24, leading=30, textColor=INK, spaceAfter=4),
    "subtitle": ParagraphStyle("subtitle", fontName="Inter", fontSize=11, leading=15, textColor=MUTED, spaceAfter=18),
    "h1": ParagraphStyle("h1", keepWithNext=1, fontName="Inter-SemiBold", fontSize=14.5, leading=19, textColor=INK, spaceBefore=18, spaceAfter=6),
    "h2": ParagraphStyle("h2", keepWithNext=1, fontName="Inter-SemiBold", fontSize=11, leading=15, textColor=INK, spaceBefore=10, spaceAfter=3),
    "body": ParagraphStyle("body", fontName="Inter", fontSize=9.4, leading=13.6, textColor=BODY, spaceAfter=6),
    "bullet": ParagraphStyle("bullet", fontName="Inter", fontSize=9.4, leading=13.6, textColor=BODY, leftIndent=14, bulletIndent=3, spaceAfter=3),
    "cell": ParagraphStyle("cell", fontName="Inter", fontSize=8.6, leading=12, textColor=BODY),
    "cellsmall": ParagraphStyle("cellsmall", fontName="Inter", fontSize=8, leading=11.5, textColor=BODY),
    "cellhead": ParagraphStyle("cellhead", fontName="Inter-SemiBold", fontSize=8.6, leading=12, textColor=INK),
    "code": ParagraphStyle("code", fontName="Mono", fontSize=7.9, leading=11.2, textColor=INK, alignment=TA_LEFT),
    "caption": ParagraphStyle("caption", fontName="Inter", fontSize=8.2, leading=11, textColor=MUTED, spaceBefore=2, spaceAfter=8),
}


def p(text, style="body"):
    return Paragraph(text, S[style])


def b(text):
    return Paragraph(text, S["bullet"], bulletText="•")


def c(text):
    """Inline code."""
    return f'<font name="Mono" size="8.3" color="#1e1f22">{text}</font>'


def link(text, url):
    return f'<a href="{url}" color="#2f62d9"><u>{text}</u></a>'


def code_block(lines):
    t = Table([[Preformatted("\n".join(lines), S["code"])]], colWidths=[7.0 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBEFORE", (0, 0), (0, -1), 2, ACCENT),
    ]))
    return [t, Spacer(1, 8)]


def table(head, rows, widths, first_style="cell"):
    data = [[Paragraph(h, S["cellhead"]) for h in head]]
    data += [[Paragraph(cell, S[first_style] if i == 0 else S["cell"]) for i, cell in enumerate(row)] for row in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, ACCENT),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def on_page(canvas, doc):
    canvas.saveState()
    w, h = letter
    canvas.setFont("Inter", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.75 * inch, h - 0.5 * inch, "mvcprogrammer.com  ·  The Blazor edition")
    canvas.drawRightString(w - 0.75 * inch, h - 0.5 * inch, "Guideline, October 2026")
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(0.75 * inch, h - 0.58 * inch, w - 0.75 * inch, h - 0.58 * inch)
    canvas.drawCentredString(w / 2, 0.5 * inch, f"{doc.page}")
    canvas.restoreState()


story = []

# ---------------------------------------------------------------- Title
story += [
    p("The Blazor edition", "title"),
    p("How blazor.mvcprogrammer.com is built, how it differs from the vanilla edition at mvcprogrammer.com, "
      "and the rules for changing, testing, and deploying it.", "subtitle"),
]

# ---------------------------------------------------------------- 1
story += [
    p("1. Why there are two editions", "h1"),
    p("The portfolio ships twice. The default edition is plain HTML, CSS, and JavaScript at the repository root, "
      "served at " + link("mvcprogrammer.com", "https://mvcprogrammer.com") + ". The Blazor edition is a standalone "
      "Blazor WebAssembly app on .NET 10 under " + c("blazor/") + ", served at "
      + link("blazor.mvcprogrammer.com", "https://blazor.mvcprogrammer.com") + ". Both show the same content, load the "
      "same stylesheet, and call the same Experience API. The Blazor edition exists to show that content consumed from "
      "C# running in the browser, not to replace the static site."),
    p("The one rule that matters", "h2"),
    p("<b>Every content, markup, behavior, or styling change made to one edition is made to the other in the same "
      "commit.</b> Before finishing any change to the site, check the other edition for the same change. Section 4 "
      "lists which files are shared by linking (one edit) and which are duplicated (two edits)."),
    p("The deliberate exception", "h2"),
    p("The linked tag in the About section's core skills differs on purpose. The default edition shows "
      "<b>Blazor</b> linking to blazor.mvcprogrammer.com; the Blazor edition shows <b>JavaScript</b> linking to "
      "mvcprogrammer.com. Each edition points at the other. Keep that asymmetry. A bUnit test, "
      + c("AboutSection_ShouldLinkJavaScriptTagToStaticEdition") + ", pins the Blazor side of it."),
    p("The Blazor edition stays off the GitHub profile README until the owner decides otherwise."),
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
            [c("Sections/"), "One component per section of the page: Hero, About, Services, Freelance, Portfolio, Quote, Resume, Contact, Colophon. Markup lifted from " + c("index.html") + "."],
            [c("Components/"), "Header (menu, scroll state, current section), footer, icon and icon sprite, social links, the experience timeline with its skill filter, and the kiosk demo dialog."],
            [c("Configurations/SiteOptions"), "Lambda URLs and API paths, bound from " + c("wwwroot/appsettings.json") + " and validated with data annotations."],
            [c("Interfaces/, Services/"), c("IExperienceClient") + " and " + c("IContactClient") + " (typed HttpClients) and " + c("IContactTopicState") + " (the call-to-action buttons preselect the form topic)."],
            [c("Models/, Requests/"), "Records matching " + c("api/openapi.yaml") + " and the contact Lambda's JSON body."],
            [c("ViewModels/ContactForm.cs"), "Mutable, data-annotated model bound to the " + c("EditForm") + "; converts itself to a " + c("ContactRequest") + "."],
            [c("Serialization/"), c("System.Text.Json") + " source-generator context, so the trimmed build needs no reflection."],
            [c("Extensions/"), c("ServiceCollectionExtensions") + " (DI registration) and " + c("PositionExtensions") + " (date and place labels)."],
            [c("wwwroot/js/site.js"), "The only JavaScript: document events, IntersectionObserver, matchMedia, the native dialog, and focus. Loaded as an ES module through " + c("IJSRuntime") + "."],
            [c("wwwroot/blazor.css"), "Boot screen and error bar only. Everything else is the shared " + c("styles.css") + "."],
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
            ["JavaScript", c("main.js") + ", about 470 lines, owns every behavior.", c("site.js") + ", about 100 lines, exposes only the browser APIs .NET cannot reach. Each watcher returns a handle with " + c("dispose()") + "."],
            ["Experience timeline", "The timeline is in the HTML. When " + c("/api/experience") + " answers, the script re-renders it and shows the skill filter. On failure the HTML stays as it was.", c("ExperienceTimeline") + " loads from the API. If that fails, times out, or returns HTML, it loads the bundled seed " + c("data/positions.json") + " (linked from " + c("api/seed/") + "). The filter shows only when skills load."],
            ["Skill chips", "Same ordering: pinned list first, then the rest, then demoted; twelve shown before the more button.", "Same constants and ordering in C#. Pinning a different skill means editing both."],
            ["Contact form", "HTML5 validation plus " + c("checkValidity()") + "; fetch to the Lambda; status text for 429, other failures, and success.", c("EditForm") + " over " + c("ContactForm") + " with data annotations and a conditional phone rule; " + c("ContactClient") + " posts; the same status messages, plus a timeout message when the 20 second client timeout cancels."],
            ["Topic preselection", "Call-to-action buttons set the select's value directly.", c("IContactTopicState") + ", a singleton the buttons call and the form subscribes to."],
            ["Configuration", "Endpoints sit in " + c("data-") + " attributes in the HTML.", c("SiteOptions") + " bound from " + c("wwwroot/appsettings.json") + " and validated at startup."],
            ["Header behavior", "Scroll listener, IntersectionObserver, Escape and outside-click handlers in " + c("main.js") + ".", "The same observers in " + c("site.js") + ", reporting to " + c("SiteHeader") + " through " + c("[JSInvokable]") + " methods. Document listeners exist only while the menu is open."],
            ["Kiosk demo", "Button opens a native dialog; the iframe is cleared on close.", c("KioskDialog") + " renders the iframe only while open and tears it down on " + c("OnClosed") + "."],
            ["Build output", "The files as committed.", c("dotnet publish") + ": trimmed, invariant globalization, no time zone data, no fingerprint placeholders (the import map would be an inline script, which the CSP forbids)."],
            ["Hosting", "Root of the private S3 bucket, distribution for mvcprogrammer.com.", c("blazor/") + " prefix of the same bucket, distribution " + c("E2NFN5MW02S8Y9") + ", own ACM certificate, CSP with " + c("'wasm-unsafe-eval'") + ", S3 403 rewritten to " + c("index.html") + " so deep links reach the router."],
            ["Tests", "None in the repo for the static page.", "111 bUnit and xUnit cases, run before every publish."],
        ],
        [1.15 * inch, 2.85 * inch, 3.0 * inch],
    ),
]

# ---------------------------------------------------------------- 4
story += [
    p("4. Shared by linking versus duplicated by hand", "h1"),
    p("The Blazor project file pulls the shared assets from the repository root with " + c("&lt;Content Link=...&gt;")
      + " items, so they are one file on disk and cannot drift. Everything else is written twice."),
    p("Edit once (linked into wwwroot)", "h2"),
    b(c("styles.css") + ", the whole stylesheet."),
    b(c("assets/**") + ": fonts (Inter and JetBrains Mono as variable WOFF2 subsets) and images."),
    b(c("favicon.svg") + ", " + c("favicon.ico") + ", " + c("apple-touch-icon.png") + "."),
    b(c("api/seed/positions.json") + ", served to the Blazor edition as " + c("data/positions.json") + "."),
    p("Edit twice (one copy per edition)", "h2"),
    b("Markup: " + c("index.html") + " and again in " + c("blazor/.../Sections/*.razor") + " and " + c("Components/*.razor") + "."),
    b("Behavior: " + c("main.js") + " and again in the Razor code-behind files plus " + c("wwwroot/js/site.js") + "."),
    b("Constants that shape the page: pinned and demoted skills, the visible chip count, status messages, section ids and labels."),
    b("Endpoints: " + c("data-") + " attributes in " + c("index.html") + " and " + c("wwwroot/appsettings.json") + "."),
    p("When a change touches a duplicated file, the commit is not finished until both copies match. When the Blazor "
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
    p("Folders mirror the app. The counts are test methods; theories expand to more cases at run time (111 in all)."),
    table(
        ["File", "Tests", "What it proves"],
        [
            [link("Components/ExperienceTimelineTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Components/ExperienceTimelineTests.cs"), "15", "API render, date and place labels, every fallback path (error, non-JSON, timeout, empty), chip order and the more button, filtering, restore without refetch, cancellation on dispose."],
            [link("Components/SiteHeaderTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Components/SiteHeaderTests.cs"), "10", "Watchers start on render, menu toggle and document watch, close on nav click, focus return, scrolled class, current-section marking, module release."],
            [link("Components/KioskDialogTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Components/KioskDialogTests.cs"), "7", "No iframe while closed, open shows the modal, open is idempotent, close removes the iframe, close button behavior, the portfolio card opens it."],
            [link("Components/ChromeComponentTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Components/ChromeComponentTests.cs"), "4", "Icon references a sprite symbol, every symbol exists, three social profiles, footer year and legal links."],
            [link("Sections/ContactSectionTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Sections/ContactSectionTests.cs"), "12", "Phone field hidden by default, topic preselection and unsubscribe, phone reveal, post and confirmations, honeypot forwarded, 429, generic failure, timeout, no post when invalid."],
            [link("Sections/StaticSectionTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Sections/StaticSectionTests.cs"), "4", "The JavaScript tag links to the static edition, the resume button uses the configured URL, the colophon links to the Blazor source, Home renders every section in order."],
            [link("Sections/CallToActionTests.cs", BLOB + "blazor/tests/Portfolio.Blazor.Tests/Sections/CallToActionTests.cs"), "2", "The Services and Freelance buttons select their contact topic."],
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
            ["2", "If the file is shared by linking (section 4), you are done with content. If it is duplicated, make the matching change in the other edition."],
            ["3", "If the Blazor behavior changed, add or update the bUnit test that proves it. Follow the naming and layout conventions in section 6."],
            ["4", "Run " + c("dotnet test --project blazor/tests/Portfolio.Blazor.Tests") + " and make it green. Run " + c("dotnet build") + " on the app; warnings are errors."],
            ["5", "Preview both editions locally: " + c("python3 -m http.server 8080") + " at the root and " + c("dotnet run --project blazor/src/Portfolio.Blazor") + "."],
            ["6", "Check the About tag asymmetry survived: Blazor on the static site, JavaScript on the Blazor site, each linking to the other."],
            ["7", "Commit both editions together. No AI attribution trailers in the message."],
            ["8", "Push to " + c("main") + " only when asked. The workflow tests, publishes, and deploys both editions."],
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

doc = SimpleDocTemplate(
    OUT, pagesize=letter,
    leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.85 * inch, bottomMargin=0.8 * inch,
    title="The Blazor edition of mvcprogrammer.com", author="Neal Thomas",
    subject="Guideline for building, testing, and deploying the Blazor edition",
)
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print("wrote", OUT)
