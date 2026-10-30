# Sprint retrospectives

One section per sprint, newest first. Each records the sprint's numbers as the board and git
reported them, what went well, what hurt, and the actions, each as an issue so the next
retrospective can check whether it happened. The numbers come from the board (points, items,
dates; see [BURNDOWN.md](BURNDOWN.md)), the merged pull requests, and the deploy workflow's runs.

## Sprint 1 (2026-10-19 to 2026-11-01)

Held 2026-10-30, the day the last planned item closed.

| Measure | Sprint 1 |
|---|---|
| Items in the sprint | 74 (73 Done; one ungroomed item carried to Sprint 2) |
| Story points done | 149, against 18 planned at the sprint's start |
| Pull requests merged | 91, three of them Dependabot's |
| Commits on main | 190 |
| Issues opened during the sprint | 106 |
| Deploy runs on main that failed | 6 of 60 |
| Done items with no Started date when they closed | 19 |

### What went well

- **Spec first held up under pressure.** Every new FHIR operation landed as the contract, then the
  handler, then the UI, in separate pull requests. The 501 stubs let the explorer work start against
  a settled shape, and the OpenAPI description became the place to argue the one action-shaped route
  (`POST .../conditions/{id}/resolve`) rather than a comment nobody reads.
- **End-to-end checks against the real sandbox caught what unit tests could not.** The fake sandbox
  returned a body on a matched conditional create; HAPI does not. One headless-browser run found
  it (#195), and the same run later found the 409 on deleting a patient with conditions (#196).
  Both became their own issues and shipped the same day.
- **The guard as a shared service.** Pulling the demo guard out of the patient writes into one
  service meant the condition writes inherited the seeded-patient and foreign-patient rules with no
  new code paths to test twice.
- **Process stayed visible.** Every change had an issue, a board column, a branch, a review, and a
  release; the board shows the sprint's items Done with dates, and the burndown redraws itself.
- **Fixes were small and separate.** The gateway fix and the delete cascade shipped as their own
  pull requests rather than folded into the feature that exposed them, so each diff tells one story.

### What hurt

- **The sprint plan did not survive contact.** Eighteen points were planned and 149 were done: the
  explorer's own host, the full write set, the conditions epic, the editorconfig work, and the
  job-description pages were all pulled in mid-sprint. The burndown reads as a cliff, not a slope.
  That is honest, but the sprint boundary carried no information about capacity.
- **Six red deploys on main in three days.** Three Dependabot Angular bumps on 2026-10-26 and a
  lockfile bump on 2026-10-28 broke the Angular build, because a local `legacy-peer-deps` setting
  produced a lockfile that `npm ci` rejected; two more on 2026-10-27 were the same class. A project
  `.npmrc` fixed it (#105), but main was red for stretches.
- **A deploy from the wrong branch.** A Lambda was built by hand while the shared working tree sat
  on a feature branch, so production ran ahead of main for about twenty minutes. The code was
  identical to the open pull request, but the order was wrong and nothing stopped it.
- **Nineteen Done items had no Started date.** Most were slices groomed and finished in long
  sessions without the board being touched at the start. The nightly backfill fills Started from
  git, so the chart is right, but the board was not telling the truth in real time.
- **The local test runner finds no tests.** `dotnet test` reports zero tests locally for the API
  projects while CI runs the same command green; every local run went through the built binary by
  hand, and the trap lived only in notes.
- **Sandbox litter.** Six demo patients with conditions were left on the public HAPI server when
  end-to-end runs failed partway, because the session tokens that could delete them lived in a
  throwaway browser profile.

### Actions

| # | Action | Issue | Sprint |
|---|--------|-------|--------|
| 1 | Plan from the Ready column and name the carry-over; groom what is likely to be pulled in before the sprint starts, even roughly. | process, no issue | Sprint 2 planning |
| 2 | A deploy script that refuses a non-main branch or a dirty tree, for both Lambdas. | #202 | Sprint 2 |
| 3 | Set Started the moment an item moves to In progress; the backfill stays the safety net. | habit, no issue | ongoing |
| 4 | Fix the local test runner or script the built binaries, and document it. | #203 | Sprint 2 |
| 5 | Move the end-to-end explorer check into `tools/` and have it delete what it created on exit. | #204 | Sprint 2 |
| 6 | Group Dependabot's Angular updates so one pull request carries one lockfile change. | #205 | Sprint 2 |
