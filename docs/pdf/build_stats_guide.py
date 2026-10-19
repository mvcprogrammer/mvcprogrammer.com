"""Builds docs/STATS-DASHBOARD.pdf, the guideline for the visitor dashboard at stats.mvcprogrammer.com.

    python3 -m venv .venv && .venv/bin/pip install reportlab fonttools brotli pillow
    .venv/bin/python docs/pdf/build_fonts.py /tmp/pdf-fonts
    .venv/bin/python docs/pdf/build_stats_guide.py /tmp/pdf-fonts docs/STATS-DASHBOARD.pdf

The styling and helpers are shared with the three edition guidelines through guide_common.py. The
screenshot on the first page is docs/images/stats-dashboard-light.png (see the README for the recipe).
"""
import os
import sys
from reportlab.lib.units import inch
from reportlab.platypus import Image, KeepTogether, Spacer
from guide_common import BLOB, REPO, TREE, S, b, build, c, code_block, link, p, register_fonts, table
from reportlab.platypus import Paragraph

FONT_DIR, OUT = sys.argv[1], sys.argv[2]
register_fonts(FONT_DIR)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = "stats/src/app/"
story = []

# ---------------------------------------------------------------- Title
story += [
    p("The visitor dashboard", "title"),
    p("How stats.mvcprogrammer.com is built: the day files exported from the CloudFront access logs, the React page "
      "that reads them, what every number means, and the rules for changing, testing, and deploying it.", "subtitle"),
]
shot = os.path.join(ROOT, "docs", "images", "stats-dashboard-light.png")
if os.path.exists(shot):
    # The top 1,150 pixels (header, tiles, chart, first panels) at the text width; the full screenshot would not fit under the title.
    from PIL import Image as PilImage
    cropped = os.path.join(os.path.dirname(OUT) if os.path.dirname(OUT) else ".", ".stats-dashboard-crop.png")
    with PilImage.open(shot) as full:
        full.crop((0, 0, 1280, 1150)).save(cropped)
    story += [Image(cropped, width=7.0 * inch, height=7.0 * inch * 1150 / 1280), Paragraph("The dashboard on a laptop, seven days with the previous period compared. The same page on a phone stacks the tiles in two columns and the panels in one.", S["caption"]), Spacer(1, 8)]

# ---------------------------------------------------------------- 1
story += [
    p("1. What it is and what it is not", "h1"),
    p("The site has no third-party analytics, by design and by the promise on its privacy page. What it has is a line in "
      "the CloudFront access log for every request to all four editions, and a first-party beacon (" + c("GET /ping")
      + ") that adds the page load with the screen class and color scheme, the sections a visitor reached, the "
      "edition and profile links they followed, and how long the page stayed visible. " + c("tools/cf-stats.mjs")
      + " has printed a text report from those logs since October 2026. The dashboard shows the same figures as a page: "
      "headline tiles with deltas and sparklines, a daily chart, and breakdowns by edition, referrer, screen, country, "
      "section, time on page, and click, with a date range, a previous-period comparison, and click-to-filter segments. "
      "It is private, behind a sign-in, and reads static JSON files; there is no server, no database, and no cookie on "
      "the public site."),
    p("Non-goals", "h2"),
    b("Not real time. The files are rebuilt hourly from 6 am to 6 pm Eastern and once more at 9 pm; the Updated stamp says when."),
    b("Not a general analytics product. The panels are the ones that answer the site's questions; anything else is a text-report change first."),
    b("Not public. The page and its data sit behind Cognito; a data URL without a session is redirected to sign-in."),
    b("Not a fifth edition. The dashboard wears the shared stylesheet's base JetBrains Rider palette, which none of the public editions uses, and it has no mirror in the other stacks."),
]

# ---------------------------------------------------------------- 2
story += [
    p("2. Where things live", "h1"),
    table(
        ["Path", "What it holds"],
        [
            [c("tools/lib/cf-logs.mjs"), "The shared parser: log download with the AWS CLI, W3C line parsing, the scanner list, sessions with a 30-minute gap, the visit rule, and the calendar math that cuts days in America/New_York whatever the machine's zone."],
            [c("tools/cf-stats.mjs"), "The text report, unchanged in output, now a thin caller of the library."],
            [c("tools/stats-export.mjs"), "The exporter: one JSON day file per day plus an index, from the same rows and visits as the report."],
            [c("tools/test/"), "Node test-runner tests over a synthetic log (" + c("fixtures/sample-log.mjs") + ", nine named scenarios) and a golden day file."],
            [c("stats/"), "The dashboard: React 19, TypeScript strict, Vite, Chart.js 4 through react-chartjs-2, Vitest with Testing Library. Same conventions as " + c("react/") + ": no CSS-in-JS, no " + c("style") + " attribute, bundles under " + c("bundles/") + ", " + c("cssTarget") + " pinned."],
            [c("stats/src/app/pages/Dashboard.tsx"), "Loads the days in the range (and the previous period when comparing), derives every number in one " + c("useMemo") + ", and lays out the tiles, the chart, and the panels."],
            [c("stats/src/app/aggregation/"), "Pure functions: " + c("filterVisits()") + ", " + c("summarize()") + " (the Summary every panel reads), " + c("buildSeries()") + " (daily, or weekly past 90 days), quantiles, deltas, buckets."],
            [c("stats/src/app/query/"), "The Query (range, preset, compare, segments) and its round trip through the URL; " + c("useQuery()") + " binds it to " + c("history") + "."],
            [c("stats/src/app/data/"), "The day-file and index types with " + c("SCHEMA_VERSION") + ", and the fetch client with its in-memory cache."],
            [c("stats/src/app/components/"), "Tiles, sparkline, bars, panel, table twin with CSV download, the controls, the charts, and the loading, empty, and error states."],
            [c("stats/src/app/charts/"), "Chart.js registration (only the controllers and elements used) and " + c("useChartTheme()") + ", which reads the chart colors from the stylesheet tokens through probe classes, so both themes match the page."],
            [c("stats/src/stats.css"), "Everything the dashboard adds to " + c("styles.css") + "; the six-color categorical ramp, the up and down colors, and the skeleton tone are " + c("light-dark()") + " tokens at the top."],
            [c(".github/workflows/stats.yml"), "The scheduled export: tests, download, export, sync to " + c("stats/data/") + ", invalidate."],
            [c("infra/lambda/stats-auth/"), "The Lambda@Edge sign-in check (cognito-at-edge), its tests, and its packaging."],
            [c("docs/DEPLOY.md"), "The Visitor dashboard section: pipeline secrets and variables, the distribution, Cognito, and the edge function, step by step."],
        ],
        [2.35 * inch, 4.65 * inch],
    ),
]

# ---------------------------------------------------------------- 3
story += [
    p("3. How the data flows", "h1"),
    *code_block([
        "CloudFront logs (S3)   -->  tools/stats-export.mjs    -->  stats/data/index.json       -->  the page",
        "four prefixes, gzipped      parse, drop scanners,          days/YYYY-MM-DD.json             fetch the range,",
        "W3C lines                   build visits, salt tokens      one record per visit, no IPs     filter, sum, draw",
    ]),
    p("The day file", "h2"),
    p("One file per calendar day in the site's time zone, holding the day's request totals and one small record per "
      "visit that started that day. Records rather than pre-summed counters, so any combination of filters is exact in "
      "the browser, unique visitors inside a filter included, and the files stay small at this site's traffic: about "
      "200 bytes a visit, under 10 KB on a busy day. A day with no log lines at all gets no file and shows as missing, "
      "never as a quiet day."),
    table(
        ["Field", "Meaning"],
        [
            [c("token"), "A salted SHA-256 of the IP address and browser string, cut to ten hex digits. The same browser gets the same token every day; nothing can be recovered from it. The salt is a repository secret."],
            [c("hour"), "The local hour the visit started."],
            [c("editions"), "The editions it loaded a page on, in display order; a visit that moved between editions lists each."],
            [c("referrer"), "The external referrer host; absent for a direct visit."],
            [c("country, edge"), "The two-letter country of the CloudFront edge that served it (" + c("tools/lib/edge-locations.mjs") + ") and the edge code. Served from, not located in."],
            [c("loads, screen, scheme"), "From the load ping; absent when the script never ran."],
            [c("sections"), "The sections reached, in page order."],
            [c("seconds"), "The largest seconds-visible value the leave ping reported."],
            [c("clicks"), "The edition, GitHub, and profile links followed, as " + c("kind/target/place") + "."],
            [c("apiCalls, skills, resumes"), "Experience API calls, skill-filter clicks by skill, resume downloads by edition tag."],
        ],
        [1.6 * inch, 5.4 * inch],
    ),
    Spacer(1, 6),
    p("Definitions", "h2"),
    p("These match the text report where it defines a term and tighten it where it does not. Both tools use the same code for every one of them."),
    table(
        ["Term", "Definition"],
        [
            ["Request", "One log line."],
            ["Scanner", "A request whose user agent matches the bot list, has no user agent, or ended in 4xx; counted in the scanner share and nowhere else."],
            ["Visitor", "One browser: IP address plus user agent string, carried as the salted token."],
            ["Visit", "A visitor's requests with no gap over 30 minutes, which include a page and at least one asset, API call, or ping. The owner's own IP is excluded before anything is counted."],
            ["Beacon reach", "Visits that sent any ping (load, view, click, or leave), as a share of visits: how many visits ran JavaScript at all. Screen and color scheme come from the load ping alone, which shipped on October 18, 2026."],
            ["Engaged visit", "A visit with at least one section view ping."],
            ["Time on page", "The largest leave value a visit reported; shown as the median with the 75th percentile beside it, never as a mean alone."],
            ["Section reach", "Engaged visits that reached a section, as a share of engaged visits, in page order."],
            ["Edition and GitHub clicks", "Visits with a click ping of that kind, by target and by the place the link was (header menu, About chips, hero, footer)."],
            ["Returning visitor", "A token seen on more than one day inside the range."],
            ["Unique visitors", "Distinct tokens among the visits in the range, under whatever filters are active."],
            ["Compare", "Every headline number against the same-length period immediately before the range, as a signed percentage with an arrow; beacon reach as points."],
        ],
        [1.4 * inch, 5.6 * inch],
    ),
]

# ---------------------------------------------------------------- 4
story += [
    p("4. The page", "h1"),
    p("A thin header with the controls, a row of headline tiles, one large chart, then a grid of breakdown panels; the "
      "layout Plausible, Fathom, and the GA4 overview share, because it is what people expect from an analytics page. "
      "Everything below the header reacts to the controls, and the controls live in the URL (" + c("?range=7d&compare=1&seg=edition:react,screen:phone")
      + "), so the back button and bookmarks work and the default view has a bare URL."),
    table(
        ["Control", "What it does"],
        [
            ["Edition switcher", "All plus the four editions, as a segmented control; a shorthand for the edition filter."],
            ["Range", "Today, 7, 30, or 90 days, this month, last month, or a custom pair of dates bounded by the earliest day with data and today."],
            ["Compare", "Overlays the previous period on the chart as a dashed line and puts a delta on every tile."],
            ["Filters", "Clicking a row in the Editions, Referrers, Screens, Color scheme, or Countries panel adds a chip; chips are removable one by one or all at once. One filter per dimension; filters combine with AND."],
            ["Updated", "How long ago the export ran, with the exact time in the tooltip."],
            ["Chart point", "Clicking a day narrows the range to that day (a week, in weekly mode)."],
        ],
        [1.4 * inch, 5.6 * inch],
    ),
    Spacer(1, 6),
    p("Tiles and panels", "h2"),
    table(
        ["Piece", "Shows", "Empty when"],
        [
            ["Visitors, Visits", "Unique visitors and visit count, with the seven most recent points as a sparkline.", "Never; zero is zero."],
            ["Beacon reach", "Share of visits that sent any ping; greyed when none did.", ""],
            ["Time on page", "Median seconds visible; 75th percentile in the tooltip.", ""],
            ["Edition clicks, GitHub clicks", "Visits that switched edition, and visits that opened the profile or a repository.", ""],
            ["Resume downloads", "A seventh tile, only when the range has any.", ""],
            ["Per day (or per week)", "Visits and visitors, or beacon reach, time on page, or edition clicks; previous period dashed; days without a file shaded; weekly from 91 days.", ""],
            ["Editions", "Horizontal bars, visits that loaded each; a visit on two editions counts in both.", "No visits in this range"],
            ["Referrers", "Top ten hosts with direct grouped, Others collapsed.", "No visits in this range"],
            ["Screens and color scheme", "Two small doughnuts with legends that filter.", "No beacon data in this range"],
            ["Countries", "Top ten with flags, derived from the edge location, so labelled served from.", "No visits in this range"],
            ["Reading funnel", "Bars in page order, share of engaged visits.", "No section views in this range"],
            ["Time on page", "Histogram over six fixed buckets with the median and 75th percentile.", "No time-on-page data in this range"],
            ["Edition clicks", "By target edition with where the link was, share of beacon-reached visits.", "No edition clicks in this range"],
            ["GitHub and profile clicks", "Profile first, then repositories, then LinkedIn and Flickr, with places.", "No profile clicks in this range"],
            ["Time of day", "24 columns of visit starts in Eastern time.", "No visits in this range"],
            ["Experience API", "Share of visits that loaded it and the skill-filter clicks.", "No API calls in this range"],
            ["Scanner share", "Requests against scanner requests per period; collapsed, for operations.", "Hidden with no requests"],
        ],
        [1.6 * inch, 3.6 * inch, 1.8 * inch],
        first_style="cellsmall",
    ),
    Spacer(1, 6),
    p("States and accessibility", "h2"),
    b("Loading: tiles and panels render skeletons in the final layout. Empty: a range with no day files names the earliest and latest available days as links. Partial: days without a file are shaded on the chart and listed in a note. Error: the message and a retry button, never a blank page."),
    b("Every chart has a Show as table twin for screen readers, with a Download CSV button that exports exactly those rows. Bars are inline SVG with attribute widths; deltas carry an arrow so color is never the only signal. Lighthouse accessibility and best practices score 100."),
    b("Light and dark follow the OS through the shared tokens; the charts re-read their colors when the scheme changes. Phone: tiles in two columns, panels stacked, controls behind a Filters button."),
]

# ---------------------------------------------------------------- 5
story += [
    p("5. Running it locally", "h1"),
    p("Node 24, npm, and the AWS CLI with read access to the log bucket (only for the export). All commands run from " + c("stats/") + "."),
    *code_block([
        "npm ci",
        "npm run data                   # 90 days of day files into public/data from the cached logs",
        "npm start                      # http://localhost:5173, copies the shared files first",
        "npm run build                  # dist/ (tsc -b, then vite build)",
        "cd .. && node --test 'tools/test/*.test.mjs'   # the parser and exporter",
    ]),
    p("Set " + c("CF_STATS_EXCLUDE_IPS") + " to leave your own visits out of the export, as with the text report. Without any logs, "
      + c("generateDays()") + " in " + c("src/testing/fixtures.ts") + " produces a plausible synthetic month. The dev server has "
      "no sign-in; the production page is only ever reached through Cognito."),
]

# ---------------------------------------------------------------- 6
story += [
    p("6. Testing", "h1"),
    p("Three suites, all run by the workflows before anything deploys."),
    table(
        ["Suite", "Runs with", "What it proves"],
        [
            [c("tools/test/") + " (26)", c("node --test"), "Parsing and decoding, the window filter, gunzipping a folder, scanner and owner classification, the 30-minute split, a session across local midnight, the visit rule, the command line, the calendar math on both sides of a daylight saving change, every field of a visit record, no IP or browser string in a record, the golden day file byte for byte, determinism, the index merge."],
            [c("stats/src/**/*.test.ts(x)") + " (85)", c("vitest run"), "Date math, the query round trip, the fetch client (cache, 404 as missing, retry after 500, newer schema refused), every aggregation function, the series (daily, weekly, missing days), the formatters, each component (tiles, sparkline, bars, chips, switcher, picker, updated, table twin, states), the Dashboard over a fake client (numbers, panels, filtering, compare, empty, error), and the App (controls to URL, URL to controls, back button, index failure)."],
            [c("infra/lambda/stats-auth/") + " (6)", c("node --test"), "The options built from the parameters with hardened cookies, a missing parameter refused, the SSM read with decryption, one authenticator per container, and the fail-closed 503 with a retry on the next request."],
        ],
        [1.7 * inch, 1.0 * inch, 4.3 * inch],
        first_style="cellsmall",
    ),
    Spacer(1, 6),
    b("Conventions follow the React edition: one test file beside each source file, Arrange, Act, Assert comments, fakes for the dependencies and never for the unit under test, " + c("findBy") + " or " + c("waitFor") + " for anything asynchronous."),
    b("Chart.js draws on canvas, which jsdom lacks, so " + c("src/testing/setup.ts") + " replaces the chart components with a stub that exposes the labels and datasets as data attributes; panel tests check what would have been drawn."),
    b("A schema change bumps " + c("SCHEMA_VERSION") + " in both the exporter and " + c("types.ts") + ", regenerates the golden file with " + c("UPDATE_GOLDEN=1") + ", and is followed by a full rebuild of the day files in the bucket."),
]

# ---------------------------------------------------------------- 7
story += [
    p("7. Deploying and signing in", "h1"),
    p("Two workflows and one distribution. " + link(".github/workflows/stats.yml", BLOB + ".github/workflows/stats.yml")
      + " runs every hour from 6 am to 6 pm Eastern and once more at 9 pm (a UTC cron that covers both EDT and EST, with a "
      "first job that checks the clock in America/New_York and skips the hours not wanted that day): it tests the parser, "
      "downloads the window's logs, rebuilds the "
      "last three days (CloudFront delivers some files hours late), syncs them to " + c("stats/data/") + " with a one-hour "
      "browser TTL, and invalidates " + c("/data/*") + ". The " + c("deploy-stats") + " job in "
      + link("deploy.yml", BLOB + ".github/workflows/deploy.yml") + " builds and syncs the page on every push to "
      + c("main") + " once " + c("STATS_DISTRIBUTION_ID") + " is set, and never touches " + c("data/") + "."),
    p("The page is served from the " + c("stats/") + " prefix of the site bucket by its own distribution with the site's "
      "security headers plus " + c("X-Robots-Tag: noindex") + " and a disallow-all " + c("robots.txt") + ". A Cognito user pool "
      "with one user, a hosted sign-in page, and the " + c("stats-auth") + " Lambda@Edge viewer-request function keep "
      "everything behind a session, the data files included: no cookie means a redirect to sign-in, a valid session "
      "proceeds, " + c("/signout") + " ends it. The function reads its configuration from SSM Parameter Store and fails "
      "closed. Every command, id, secret name, and variable is in the Visitor dashboard section of "
      + link("docs/DEPLOY.md", BLOB + "docs/DEPLOY.md") + "; nothing is repeated here."),
    p("The " + c("stats/") + " prefix sits in the same bucket as the public site, and the apex distribution serves that bucket from its root, so a bucket-policy statement denies the prefix to every distribution but the stats one; without it the page and the day files would answer at mvcprogrammer.com/stats/ with no sign-in. The export workflow uploads nothing until the distribution id is set, which is done only after that statement is in place."),
    p("Costs: Cognito free under 50,000 monthly users; Lambda@Edge on every request to the distribution (about fifty per page view with the day files), a few thousand a month for one reader at $0.60 per million; kilobytes of S3 and CloudFront; free Actions minutes. Well under a dollar a month."),
]

# ---------------------------------------------------------------- 8
story += [
    KeepTogether([
    p("8. Checklist for a change", "h1"),
    table(
        ["Step", "Do"],
        [
            ["1", "A new figure starts in " + c("tools/lib/cf-logs.mjs") + " or the exporter, with a scenario in the fixture log and a test; the text report and the day file see it together."],
            ["2", "If the day file's shape changes, bump " + c("SCHEMA_VERSION") + " on both ends, regenerate the golden file, and plan the full rebuild."],
            ["3", "Derive the number in " + c("aggregation/") + " as a pure function with a test before touching a component."],
            ["4", "A new panel is a " + c("Panel") + " with an empty text, a table twin, and a test over the fake client; a new filterable dimension goes into " + c("query.ts") + " and " + c("matches()") + "."],
            ["5", "Never add a " + c("style") + " attribute, CSS-in-JS, or an inline script. Colors come from the tokens at the top of " + c("stats.css") + "; charts read them through " + c("useChartTheme()") + "."],
            ["6", "Run " + c("node --test 'tools/test/*.test.mjs'") + " at the root and " + c("npm test") + " plus " + c("npm run build") + " in " + c("stats/") + "; both green. Check the production stylesheet still carries " + c("light-dark()") + "."],
            ["7", "Check light and dark, a phone width, and the empty, partial, and error states."],
            ["8", "Update this guideline, " + c("stats/README.md") + ", and the Visitor dashboard section of " + c("docs/DEPLOY.md") + " when the behavior or the setup changed."],
            ["9", "Commit on a feature branch, review, then merge to " + c("main") + " when asked. No AI attribution trailers."],
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
            ["Live", link("https://stats.mvcprogrammer.com", "https://stats.mvcprogrammer.com")],
            ["Repository", link(REPO, REPO)],
            ["Dashboard project", link("stats/", TREE + "stats")],
            ["Dashboard README", link("stats/README.md", BLOB + "stats/README.md")],
            ["Shared parser", link("tools/lib/cf-logs.mjs", BLOB + "tools/lib/cf-logs.mjs")],
            ["Exporter", link("tools/stats-export.mjs", BLOB + "tools/stats-export.mjs")],
            ["Text report", link("tools/cf-stats.mjs", BLOB + "tools/cf-stats.mjs")],
            ["Export workflow", link(".github/workflows/stats.yml", BLOB + ".github/workflows/stats.yml")],
            ["Deploy workflow", link(".github/workflows/deploy.yml", BLOB + ".github/workflows/deploy.yml")],
            ["Sign-in function", link("infra/lambda/stats-auth/", TREE + "infra/lambda/stats-auth")],
            ["Deploy walkthrough", link("docs/DEPLOY.md", BLOB + "docs/DEPLOY.md")],
            ["Edition guidelines", link("docs/", TREE + "docs")],
            ["Workflow runs", link("GitHub Actions", REPO + "/actions/workflows/stats.yml")],
        ],
        [1.8 * inch, 5.2 * inch],
    )]),
]

build(
    OUT, story,
    title="The visitor dashboard of mvcprogrammer.com",
    subject="Guideline for building, testing, and deploying the visitor dashboard",
    running_title="mvcprogrammer.com  ·  The visitor dashboard",
    dated="Guideline, October 2026",
)
