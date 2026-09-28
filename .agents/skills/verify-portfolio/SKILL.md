---
name: verify-portfolio
description: "Check that bradleyberkman.com works in production the way a visitor uses it: every route, record and interactive control in the feature map, read-only, plus the insights dashboard from fixture data. Use after a deploy, before calling a portfolio change done, or when asked whether a page or control works."
---

# Verify the portfolio

`features/README.md` is the feature map: every route, record and interactive
control a visitor can reach, how they reach it, and the check that proves it
works. `npm run live` walks it. Read the map before you verify anything; its
header defines the checks.

## Run

From the repository root:

```
node .agents/skills/verify-portfolio/verify.mjs              # both lanes, about three minutes
node .agents/skills/verify-portfolio/verify.mjs live         # or: insights
node .agents/skills/verify-portfolio/verify.mjs live -- --only writ   # rows whose feature, source or probe contains "writ"
```

- `live` runs `npm run live`: the map against this checkout (offline), then
  every row against production. HTTP rows by fetch; `page` rows in headless
  Chromium, failing on any console error, page error, failed request or HTTP
  error; `probe` rows by the visitor interactions in `scripts/live-probes.mjs`,
  each in a fresh browser context. The deploy job runs the same command with
  `--dist dist` to also prove production serves the tested build.
- `insights` renders the insights dashboard from `scripts/portfolio-insights-fixture.mjs`
  into a temp directory, checks it with `scripts/verify-insights-dashboard.mjs`
  at desktop and phone sizes in light and dark, then deletes the temp
  directory. The real dashboard is behind Cloudflare Access; this lane is the
  browser view of its template.

Both need Playwright and a Chromium: `loadPlaywright()` finds the project's,
`PLAYWRIGHT_MODULE`, a copy npx unpacked, or the global install the browser
skill uses. `npm run clip:setup` installs one. Before it runs, the CLI prints
the checkout and `origin/main`: production deploys from main, so a `FAIL` from
a branch may be the branch's map or probes, not production.

## Read-only

Production is only read. The check's browser answers the analytics beacons
itself (the insight sink, Clarity, Cloudflare RUM), so a run leaves nothing in
Bradley's visitor data. No probe sends the Guide a question or writes a
feedback note; the rows marked `uncovered` are those write paths and name the
tests that cover them. Probe side effects (the tour demo's saved driver, the
privacy opt-out) live in the probe's own browser context and die with it.

## Reading the result

Each line starts with `ok`, `FAIL`, `DOWN`, `STALE` or `skip`:

- `STALE`: the map disagrees with the checkout (a record, route file,
  component sheet or probe with no row, or a row naming something gone). The
  run stops before the network. Fix the map, not production.
- `DOWN`: production did not answer (DNS, network, Cloudflare). Not a product
  verdict; rerun, then check Cloudflare status.
- `FAIL`: production answered and the answer is wrong. That is the product,
  or a probe whose selector no longer matches what a visitor sees.
- `skip`: an `uncovered` row, printed with its reason.

Evidence goes to `.context/verification/verify-portfolio-<time>/`: `run.log`,
`live.log`, `live/live-report.json` with a screenshot per probe (failures
prefixed `FAIL-`), `insights.log` and `insights/` with the dashboard's
`report.json` and screenshots. Cleanup closes every browser the run opened and
deletes the insights temp directory; the evidence stays.

## Keeping the map current

Add, move or remove a record, route or component and its row changes in the
same PR: `tests/feature-map.test.ts` (in `npm test`) and the first step of
`npm run live` fail until it does. A new interaction is a probe in
`scripts/live-probes.mjs` plus the row that names it; an unused probe is stale
too. Prefer selectors a visitor would name (roles, accessible names, labels
from `content/portfolio-content.json`) so copy changes flow through.
