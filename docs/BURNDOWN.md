# The board's dates, hours, and burndown

The [project board](https://github.com/users/mvcprogrammer/projects/1) carries four figures per
item beyond its status: `Estimate` (story points), `Started`, `Completed`, and `Actual hours`.
This page says where each one comes from, how the sprint burndown is drawn from them, and what the
numbers can and cannot tell you. The two scripts are `tools/board-backfill.mjs` and
`tools/burndown.mjs`; both need Node 22+ and the `gh` CLI signed in with the `project` scope.

## Points are the plan

`Estimate` is set in Fibonacci story points when an item is made Ready, before any work. It is the
only figure here that is a forecast. Items that predate the board (the work from the site's launch
on 2026-10-06 up to the board's creation on 2026-10-19) carry a T-shirt `Size` that was assigned
when they were written up, but no points, because a point estimate written after the work is done
is a recollection shaped by knowing the answer, not an estimate. Those items therefore never sit in
a sprint and never appear on a burndown.

## Dates and hours are measurements from git

`tools/board-backfill.mjs` fills `Started`, `Completed`, and `Actual hours` for every Done item
from commits alone. Nothing is typed in from memory. The commits that did an item's work come from
two places:

- the commit hashes written in the issue body (`mvcprogrammer.com ff2815e, 7f7a555; mvcprogrammer dd54882`),
  looked up in this repository and, after a repository name, in a sibling clone of the profile
  repository;
- every commit on the branch of a merged pull request whose title or body mentions the issue.

From those commits:

- **Started** is the earliest author date.
- **Completed** is the merge time of the last pull request, or the latest commit when the work went
  straight to `main` (which was the practice before 2026-10-18).
- **Actual hours** are built from the commit times. Commits closer together than two hours belong
  to one working session; each session counts from thirty minutes before its first commit to its
  last commit; an item's hours are the sum of its sessions, rounded to a quarter hour.

Dates are calendar days in Eastern time, the days on which the work happened, so a commit at ten in
the evening on the 19th is the 19th even though GitHub records its merge after midnight UTC.

Items whose body says the work was not in git (an AWS console change, a browser sign-in) keep the
`Completed` date they were given and get no hours. An epic takes its dates from its slices and no
hours, so nothing is counted twice. Re-running the script is safe: it writes the same values again.

## What the hours do and do not say

Git only sees commit instants. It cannot see the reading, the thinking, the console work, or the
time between a session's last commit and the next session's first, and the thirty-minute allowance
before a first commit is a convention, not a measurement. The hours are therefore a floor. They
are consistent, which is what matters for the one use they have: dividing hours by points over a
sprint gives a figure, hours per point, that is comparable from sprint to sprint and that sizes the
next one. A sprint where the work is done with an AI pair programmer and committed in large pieces,
as Sprint 1 was, shows a very low figure; that is a true statement about how the work was done, not
an error in the method.

## The burndown

`tools/burndown.mjs` reads the board and, for one sprint (the one containing today by default, or
`--sprint "Sprint 1"`), plots two lines over the sprint's fourteen days: the ideal line from the
sprint's total points on its first day to zero on its last, and the actual line, the points of the
items not yet Done at the end of each day, using each item's `Completed` date. It writes
`docs/images/burndown-<sprint>.svg`, an SVG with no script and no external font that follows the
viewer's light or dark scheme, and prints the day-by-day table, the items, and hours per point.
The README shows the current sprint's chart; regenerate it whenever an item closes:

```sh
node tools/burndown.mjs
```

GitHub Projects can draw a burn-up of its own, but only on paid plans and only from the day the
chart is created; this script is how the board gets a burndown from day one and from evidence.

## Keeping it honest

- Set the points before the work starts. If an item is re-estimated, record why on the issue.
- Add an item to a sprint only when it is being worked in that sprint; an item pulled in or pushed
  out changes the sprint's total, and the chart shows that as a step.
- When a pull request closes an issue, say so in its body (`Closes #N`), so the backfill can find
  its commits. Work that never touches git says so in the issue body (`not in git`).
