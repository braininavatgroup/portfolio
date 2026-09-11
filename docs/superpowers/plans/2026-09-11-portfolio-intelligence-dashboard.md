# Portfolio intelligence dashboard implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the local traffic report into a private decision dashboard with anonymous journeys, content outcomes, city-level geography, assigned-link context from Airtable, and safe links into Clarity.

**Architecture:** The public portfolio sends consent-gated `portfolio_*` events to the dormant Analytics Engine sink with one random identifier per browser tab. The local `npm run insights` job reads Clarity, Cloudflare Web Analytics, Analytics Engine, and a read-only Airtable projection into separate last-known-good snapshots, then derives journeys and findings without sending identity back to production. The HTML dashboard is a self-contained local file; its only network behavior is an explicit click to an allowlisted Clarity or Airtable URL.

**Tech stack:** TypeScript, React 19, Vitest, Node.js ESM, Cloudflare Workers and Analytics Engine SQL, Airtable Web API, macOS Keychain and launchd, managed Playwright verification.

**Spec:** `docs/superpowers/specs/2026-09-11-portfolio-intelligence-dashboard-design.md`

## Global constraints

- Begin from a fresh worktree of fetched `origin/main`. PR #5 at `b1387f2` and PR #6 at `5ca1f8d` are prerequisites. Confirm both commits are ancestors of the implementation head before changing analytics code.
- Keep `PORTFOLIO_INSIGHT_EVENTS_SINK` set to `off` until the combined deployment candidate passes all checks.
- The public sink stores no names, companies, job titles, Airtable IDs, IP addresses, user-agent strings, latitude, longitude, postal codes, referrers, prose, or email addresses.
- `session_id` is random, stored in `sessionStorage`, and scoped to one browser tab. It is not a cookie or a returning-visitor identifier.
- City is the most specific retained geography. Display it as the network location reported for the request.
- Assigned-link copy says `Activity from <name>'s assigned link`; it never says the recipient visited or read the site.
- The Airtable report adapter is read-only and requests only the fields listed in Task 4.
- Raw local journey snapshots expire after 180 days. Anonymous aggregate history may remain indefinitely.
- A failed source keeps its last-known-good value and displays the source timestamp. Missing data never renders as zero.
- Findings need at least five eligible sessions and must print the count, denominator, window, and comparison.
- The local HTML has no scripts, remote resources, forms, or automatic requests. Anchors must pass the Clarity or Airtable URL allowlist.
- Follow `docs/design-conventions.md` for the supporting-page visual style. Do not add public application tokens or components.
- Each durable test below owns the named failure until the associated feature is removed. Do not replace these checks with raw test-count assertions.

---

### Task 1: Add tab-scoped session identity and edge geography

**Files:**
- Modify: `lib/portfolio-analytics.ts`
- Modify: `lib/portfolio-analytics.test.ts`
- Modify: `lib/server/portfolio-insight-sink.ts`
- Modify: `lib/server/portfolio-insight-sink.test.ts`
- Modify: `worker-configuration.main-preview.d.ts`

**Interfaces:**
- Produces: `getPortfolioTabSessionId(storage: Storage, makeId?: () => string): string`
- Produces: `PortfolioInsightPayload` with `session_id: string`
- Produces: `insightDataPoint(payload, geo)` where `geo` is `{ country: string; regionCode: string; city: string; metroCode: string; device: DeviceClass }`
- Preserves: `trackPortfolioInsight(action, dimensions): boolean` and the existing no-throw beacon behavior

- [ ] **Step 1: Write the failing browser identity tests**

Add tests that pass two independent in-memory `Storage` objects and deterministic ID factories:

```ts
it("reuses one random session id in a tab and changes it in another tab", () => {
  const tabA = createMemoryStorage();
  const tabB = createMemoryStorage();
  expect(getPortfolioTabSessionId(tabA, () => "session-a")).toBe("session-a");
  expect(getPortfolioTabSessionId(tabA, () => "unused")).toBe("session-a");
  expect(getPortfolioTabSessionId(tabB, () => "session-b")).toBe("session-b");
});
```

Extend the beacon assertion so its decoded body includes `session_id: "session-a"`. Add an opt-out assertion proving that denied analytics creates no session key and sends no beacon.

- [ ] **Step 2: Run the browser tests and confirm the contract is absent**

Run: `npx vitest run lib/portfolio-analytics.test.ts`

Expected: FAIL because `getPortfolioTabSessionId` is not exported and beacon bodies have no `session_id`.

- [ ] **Step 3: Implement the tab identity**

Use the fixed key `biv_portfolio_insight_session_v1`. Accept only IDs matching `/^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/u`; otherwise replace them with `crypto.randomUUID()`. Wrap every storage access in `try`/`catch`, retaining the generated value in module memory when private mode rejects storage. Create the ID lazily inside `postInsightEvent`, after the existing eligibility and payload validation have passed. Add it beside `action` and `dimensions` in the POST body. Never set it as a Clarity tag.

- [ ] **Step 4: Write the failing sink geography and leak tests**

Update the fixed layout expectation to:

```ts
expect(point.blobs).toEqual([
  "contact_action", "", "", "a1b2c3d4e5f6", "email", "", "", "",
  "DE", "mobile", "v2", "session-a", "BE", "Berlin", "27612",
]);
```

Test malformed or oversized session IDs, regions, cities, and metro codes. Serialize the written point and assert that it excludes the request IP, cookies, full user agent, latitude, longitude, postal code, colo, and unknown `cf` properties.

- [ ] **Step 5: Run the sink tests and confirm the v1 layout fails**

Run: `npx vitest run lib/server/portfolio-insight-sink.test.ts`

Expected: FAIL because the sink does not parse `session_id` or retain the approved geography.

- [ ] **Step 6: Implement and document the v2 Analytics Engine layout**

Keep blobs 1 through 10 unchanged. Set `blob11` to `v2`, then store `session_id`, `region_code`, `city`, and `metro_code` in blobs 12 through 15. Normalize country to the existing two-character form, region code to at most 16 ASCII letters/numbers/hyphens, city with `/^[\p{L}\p{M}\p{N} .'-]{1,96}$/u`, and metro code to at most 16 alphanumeric characters. Missing values become empty strings. Read only `request.cf.country`, `regionCode`, `city`, and `metroCode`; do not add header fallbacks for the new fields.

- [ ] **Step 7: Run the focused seam checks**

Run: `npx vitest run lib/portfolio-analytics.test.ts lib/server/portfolio-insight-sink.test.ts && npm run typecheck`

Expected: PASS. These tests own tab lifetime, consent gating, payload bounds, fixed blob placement, and forbidden-field exclusion until the client adapter or sink is removed.

- [ ] **Step 8: Commit the client and sink contract**

```bash
git add lib/portfolio-analytics.ts lib/portfolio-analytics.test.ts lib/server/portfolio-insight-sink.ts lib/server/portfolio-insight-sink.test.ts worker-configuration.main-preview.d.ts
git commit -m "feat(BIV-421): record anonymous portfolio journeys"
```

### Task 2: Read event-level Analytics Engine rows

**Files:**
- Modify: `scripts/portfolio-insights.mjs`
- Modify: `scripts/portfolio-insights-report.mjs`
- Modify: `scripts/portfolio-insights-report.test.ts`

**Interfaces:**
- Produces: `insightEventQuery(range): string`
- Produces: `normalizeInsightEvents(rows): InsightEvent[]`
- `InsightEvent`: `{ timestamp: string; action: string; contentId: string; contentKind: string; campaign: string; contactKind: string; source: string; targetId: string; targetKind: string; country: string; device: string; schema: "v1" | "v2"; sessionId: string; regionCode: string; city: string; metroCode: string; activeSeconds: number; completionPercent: number }`
- Preserves: existing aggregate `summarizeInsightEvents` output for terminal and historical compatibility

- [ ] **Step 1: Write the failing row-normalization tests**

Cover a v2 row, a v1 row with empty journey and city fields, invalid timestamps, and numeric clamping:

```ts
expect(normalizeInsightEvents([{
  timestamp: "2026-09-11 14:30:00.000",
  action: "content_open",
  content_id: "record-9q",
  schema: "v2",
  session_id: "session-a",
  region_code: "NY",
  city: "New York",
  metro_code: "501",
  active_seconds: 0,
  completion_percent: 0,
}])[0]).toMatchObject({
  sessionId: "session-a", regionCode: "NY", city: "New York", metroCode: "501",
});
```

- [ ] **Step 2: Run the report test and observe the missing exports**

Run: `npx vitest run scripts/portfolio-insights-report.test.ts -t "event-level insight rows"`

Expected: FAIL because `normalizeInsightEvents` and `insightEventQuery` do not exist.

- [ ] **Step 3: Add the raw SQL query and normalizer**

Select `timestamp`, aliases for blobs 1 through 15, and doubles 1 and 2 from `portfolio_insights`. Filter with the existing escaped UTC range, order by `timestamp ASC`, and cap the response at 10,000 rows. Return `{ events, truncated: rows.length === 10_000 }` beside the existing aggregate answers. A truncated response is usable but must display a warning.

- [ ] **Step 4: Run focused analytics tests**

Run: `npx vitest run scripts/portfolio-insights-report.test.ts`

Expected: PASS. This test owns fixed-column decoding, chronological order, v1 compatibility, and the truncation signal until Analytics Engine is removed.

- [ ] **Step 5: Commit event-level reads**

```bash
git add scripts/portfolio-insights.mjs scripts/portfolio-insights-report.mjs scripts/portfolio-insights-report.test.ts
git commit -m "feat(BIV-421): read portfolio event journeys"
```

### Task 3: Add source-wise snapshots and retention

**Files:**
- Create: `scripts/portfolio-insights-storage.mjs`
- Create: `scripts/portfolio-insights-storage.test.ts`
- Modify: `scripts/portfolio-insights.mjs`

**Interfaces:**
- Produces: `readSourceSnapshot(directory, source): Promise<SourceSnapshot | null>`
- Produces: `writeSourceSnapshot(directory, source, value, capturedAt): Promise<void>`
- Produces: `resolveSourceResult({ fresh, previous, error, capturedAt }): SourceState`
- Produces: `pruneRawSnapshots(directory, now, retentionDays = 180): Promise<string[]>`
- `SourceSnapshot`: `{ capturedAt: string; value: unknown }`
- `SourceState`: `{ status: "fresh" | "stale" | "unavailable"; capturedAt: string | null; value: unknown; error?: string }`

- [ ] **Step 1: Write failing storage tests in a temporary directory**

Test that a successful fetch replaces only its source file, a failed fetch returns the prior value as `stale`, an absent prior value returns `unavailable`, and pruning removes only `raw-events-*.json` files older than 180 days. Assert the identity-bearing Airtable snapshot and generated HTML are mode `0600`, while the enclosing directory is `0700`.

- [ ] **Step 2: Run the tests and confirm the module is missing**

Run: `npx vitest run scripts/portfolio-insights-storage.test.ts`

Expected: FAIL because `portfolio-insights-storage.mjs` does not exist.

- [ ] **Step 3: Implement atomic local storage**

Write a sibling temporary file with mode `0600`, rename it over the target, and call `chmod` after rename. Use one file per source: `source-clarity.json`, `source-cloudflare.json`, `source-insights.json`, and `source-airtable.json`. Store `{ capturedAt, value }`; never replace a good file with an error object. Store event-level results separately as `raw-events-YYYY-MM-DDTHH-MM-SS-sssZ.json` so the retention rule cannot delete source state or aggregate history.

- [ ] **Step 4: Integrate source states into the CLI snapshot**

Make each remote fetch resolve independently. Write a source snapshot only after parsing succeeds. Put `sources.<name>` on the report snapshot and keep the existing top-level keys during the transition so the terminal report remains compatible. Call `pruneRawSnapshots` only after the aggregate history and current dashboard have both been written successfully.

- [ ] **Step 5: Run the storage and existing report suites**

Run: `npx vitest run scripts/portfolio-insights-storage.test.ts scripts/portfolio-insights-report.test.ts scripts/portfolio-insights-dashboard.test.ts`

Expected: PASS. These tests own last-known-good behavior, permissions, atomic replacement, and the 180-day deletion boundary until local snapshots are removed.

- [ ] **Step 6: Commit snapshot handling**

```bash
git add scripts/portfolio-insights-storage.mjs scripts/portfolio-insights-storage.test.ts scripts/portfolio-insights.mjs
git commit -m "feat(BIV-421): preserve portfolio insight source snapshots"
```

### Task 4: Add the read-only Airtable assignment adapter

**Files:**
- Create: `scripts/portfolio-insights-airtable.mjs`
- Create: `scripts/portfolio-insights-airtable.test.ts`
- Modify: `scripts/portfolio-insights.mjs`
- Modify: `scripts/setup-portfolio-insights.sh`
- Create: `scripts/setup-portfolio-insights.test.ts`

**Interfaces:**
- Produces: `fetchPortfolioAssignments({ token, fetchImpl, baseId }): Promise<PortfolioAssignment[]>`
- `PortfolioAssignment`: `{ actionRecordId: string; campaignCode: string; sentAt: string | null; channel: string; portfolioUrl: string; action: string; state: string; person: { name: string; airtableUrl: string } | null; company: string | null; job: { title: string; stage: string; outcome: string | null } | null }`
- Consumes: the four Action fields from `docs/superpowers/plans/2026-09-11-job-search-portfolio-link-fields.md`

- [ ] **Step 1: Write failing projection, pagination, and duplicate tests**

Stub `fetchImpl` and require exactly these field projections:

```js
const FIELDS = {
  Actions: ["Action", "State", "Person", "Job", "Company", "Portfolio Campaign Code", "Portfolio Link Sent", "Portfolio Link Channel", "Portfolio URL"],
  People: ["Name"],
  Jobs: ["Job", "Stage", "Outcome Reason"],
  Companies: ["Company Name"],
};
```

Assert `GET` only, follow Airtable offsets, resolve linked IDs locally, preserve an unmapped link as anonymous, render a Person-less Action as unassigned outreach, reject linked-field cardinality greater than one, and throw `duplicate campaign code: <code>` for two non-empty matching codes.

- [ ] **Step 2: Run the adapter test and confirm it fails**

Run: `npx vitest run scripts/portfolio-insights-airtable.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the four-table read**

Use base `app0LM9NfGL4ZHi3j` and table IDs from the approved spec. URL-encode repeated `fields[]` parameters and page offsets. Reject any non-2xx response without including the bearer token in the error. Build record maps before joining Actions. Accept campaign codes only when they match `/^[a-z0-9][a-z0-9_-]{5,63}$/u`.

- [ ] **Step 4: Add the named read-only credential path**

Resolve `AIRTABLE_API_TOKEN` first, then Keychain service `biv-portfolio-insights`, account `airtable-read-token`. Extend `setup-portfolio-insights.sh` with an Airtable stage that explains the token must have record read access only for the Job Search base and verifies one projected Actions request before storing it. Never put this token into launchd environment text.

- [ ] **Step 5: Run the adapter and setup checks**

Run: `npx vitest run scripts/portfolio-insights-airtable.test.ts scripts/setup-portfolio-insights.test.ts`

Expected: PASS. These tests own method restriction, field projection, pagination, linked-record cardinality, and duplicate-code refusal until Airtable no longer owns assignments.

- [ ] **Step 6: Commit the local identity reader**

```bash
git add scripts/portfolio-insights-airtable.mjs scripts/portfolio-insights-airtable.test.ts scripts/portfolio-insights.mjs scripts/setup-portfolio-insights.sh scripts/setup-portfolio-insights.test.ts
git commit -m "feat(BIV-421): resolve assigned links from Airtable"
```

### Task 5: Derive journeys, content measures, audience rows, and findings

**Files:**
- Create: `scripts/portfolio-insights-intelligence.mjs`
- Create: `scripts/portfolio-insights-intelligence.test.ts`
- Modify: `scripts/portfolio-insights.mjs`

**Interfaces:**
- Produces: `buildPortfolioIntelligence({ events, assignments, contentCatalog, clarity, cloudflare, previous, window }): PortfolioIntelligence`
- Produces: `groupJourneys(events): Journey[]`
- Produces: `summarizeContent(journeys): ContentSummary[]`
- Produces: `summarizeAudience(journeys): AudienceSummary`
- Produces: `deriveFindings(current, previous): Finding[]`
- `Journey`: `{ sessionId: string; campaignCode: string | null; assignment: PortfolioAssignment | null; entryAt: string; events: InsightEvent[]; contentIds: string[]; evidenceIds: string[]; contactKinds: string[]; geo: { country: string; regionCode: string; city: string; metroCode: string }; device: string }`
- `ContentSummary`: `{ contentId: string; label: string; kind: string; sessions: number; medianActiveSeconds: number; medianCompletionPercent: number; evidenceOpenRate: number; contactActionRate: number; commonEntrySource: string; commonNextContent: string | null; assignedShare: number; anonymousShare: number; comparison: string }`
- `AudienceSummary`: `{ sources: Array<{ value: string; sessions: number }>; devices: Array<{ value: string; sessions: number }>; locations: Array<{ country: string; regionCode: string; city: string; metroCode: string; sessions: number }> }`
- `Finding`: `{ kind: "assigned-link" | "content" | "geography" | "frustration" | "error" | "performance"; message: string; count: number; denominator: number; currentWindow: string; comparisonWindow: string }`
- `PortfolioIntelligence`: `{ findings: Finding[]; assignedLinks: Array<{ assignment: PortfolioAssignment; journeys: Journey[] }>; anonymousJourneys: Journey[]; content: ContentSummary[]; audience: AudienceSummary; diagnostics: Record<string, unknown> }`

- [ ] **Step 1: Write failing journey ownership tests**

Use fixtures where the same `session_id` appears with two campaign codes, two different session IDs use one campaign code, v1 events have no session ID, and timestamps arrive out of order. Require the reducer to sort valid sessions, quarantine a session that changes campaign assignment, and never merge anonymous or v1 events into an assigned journey.

- [ ] **Step 2: Write failing content and finding tests**

Require one eligible session per denominator, the maximum attention snapshot per content per session, median active seconds and completion, evidence-open and contact-action rates, common entry source and next content, assigned and anonymous shares, and the exact small-sample sentence `not enough data for a pattern` below five sessions. Test each approved finding trigger with its count, denominator, current window, and comparison window.

- [ ] **Step 3: Run the new reducer suite and confirm failure**

Run: `npx vitest run scripts/portfolio-insights-intelligence.test.ts`

Expected: FAIL because the reducer module does not exist.

- [ ] **Step 4: Implement deterministic reducers**

Treat `entry`, `content_open`, `content_attention`, `evidence_open`, `guide_evidence`, and `contact_action` as the supported journey vocabulary. Load labels and kinds from `content/portfolio-content.json`, using `records` and `threads`; unknown IDs remain visible as escaped IDs. Select the maximum attention values within a session before calculating medians. Use session counts, not event counts, for rates. Group missing geography under `Unknown`. Include common entries, transitions, exits, and paths that reach evidence or contact. Generate findings only for the rules in the design spec, including repeat link activity after 24 hours and changes in Clarity frustration, Cloudflare 5xx, and Web Vitals. Do not introduce a composite score or LLM call.

- [ ] **Step 5: Run reducer and type checks**

Run: `npx vitest run scripts/portfolio-insights-intelligence.test.ts && npm run typecheck`

Expected: PASS. This suite owns journey isolation, event ordering, denominators, medians, geography grouping, and the five-session evidence threshold until intelligence reporting is removed.

- [ ] **Step 6: Commit the decision model**

```bash
git add scripts/portfolio-insights-intelligence.mjs scripts/portfolio-insights-intelligence.test.ts scripts/portfolio-insights.mjs
git commit -m "feat(BIV-421): derive portfolio content and journey findings"
```

### Task 6: Replace the traffic-first dashboard with decision sections

**Files:**
- Modify: `scripts/portfolio-insights-dashboard.mjs`
- Modify: `scripts/portfolio-insights-dashboard.test.ts`

**Interfaces:**
- Consumes: `PortfolioIntelligence` from Task 5 and `SourceState` from Task 3
- Produces: `renderDashboard({ snapshot, history, generatedAt }): string`
- Produces: `safeExternalLink(url, kind): string | null`, where `kind` is `"clarity" | "airtable"`

- [ ] **Step 1: Replace the fixture with one hostile, complete intelligence snapshot**

Include a recipient named `<Alex & Co>`, duplicate-code error text, a stale Clarity source, five-session content evidence, city rows, one assigned journey, one anonymous journey, and attempted links to an unrelated host. The fixture must exercise every dashboard section and escaping boundary.

- [ ] **Step 2: Write failing semantic HTML tests**

Assert this order: `What changed`, `Assigned links`, `Content resonance`, `Journeys`, `Audience`, `Observe in Clarity`, then collapsed `Diagnostics`. Assert the approved attribution phrase, per-source timestamps, stale labels, small-sample language, `Unknown` geography, no returning-visitor claim, no `<script>`, no forms, no external resources, and no disallowed anchor hosts.

- [ ] **Step 3: Run the dashboard tests and confirm the old layout fails**

Run: `npx vitest run scripts/portfolio-insights-dashboard.test.ts`

Expected: FAIL because the current page leads with traffic tiles and has none of the new sections.

- [ ] **Step 4: Implement the section renderers**

Keep `escapeHtml` as the only string interpolation path. Render assigned Actions as expandable rows with recipient, assigned company, job, stage, sent time, latest activity, link sessions, opened content and evidence, contact actions, and outcome. Put event-ordered anonymous tab journeys inside the expanded row. Render content measures without a score. Label geography `Network location reported for this request`.

- [ ] **Step 5: Implement link allowlisting**

Allow only `https://clarity.microsoft.com/projects/view/yatoiqtrjm/` and `https://airtable.com/app0LM9NfGL4ZHi3j/` prefixes after parsing with `new URL`. Add `target="_blank" rel="noreferrer"`. Reject credentials, non-HTTPS URLs, lookalike hosts, and encoded host tricks. When a verified pre-filtered Clarity URL is unavailable, link to the project and render the exact campaign/content/city filter steps beside it.

- [ ] **Step 6: Apply the supporting-page visual rules**

Keep the existing system font, restrained palette, CSS-only light/dark mode, table fallbacks, and self-contained inline SVG. Make sections usable at 1440 by 900 and 390 by 844. The mobile layout must stack summary cells and keep tables horizontally scrollable instead of shrinking copy below 11px.

- [ ] **Step 7: Run dashboard and safety tests**

Run: `npx vitest run scripts/portfolio-insights-dashboard.test.ts`

Expected: PASS. The suite owns section order, attribution wording, freshness, empty states, escaping, and link allowlisting until the HTML dashboard is replaced.

- [ ] **Step 8: Commit the dashboard**

```bash
git add scripts/portfolio-insights-dashboard.mjs scripts/portfolio-insights-dashboard.test.ts
git commit -m "feat(BIV-421): render the portfolio decision dashboard"
```

### Task 7: Finish CLI failure behavior and scheduled operation

**Files:**
- Modify: `scripts/portfolio-insights.mjs`
- Modify: `scripts/portfolio-insights-report.mjs`
- Modify: `scripts/portfolio-insights-report.test.ts`
- Modify: `scripts/schedule-portfolio-insights.sh`
- Modify: `package.json`

**Interfaces:**
- Preserves: `npm run insights`, `--days`, `--json`, `--history`, `--dashboard`, and each `--no-*` source switch
- Produces: one run result that can be partial without erasing a healthy source

- [ ] **Step 1: Write failing end-to-end CLI fixture tests**

Inject source functions into a new exported `runInsights(options, dependencies)` function. Cover Clarity `429` with a cached result, Airtable failure with anonymous analytics still rendered, Analytics Engine unavailable, duplicate codes, an empty window, and a raw-event response at the 10,000-row cap.

- [ ] **Step 2: Run the focused CLI tests and confirm failure**

Run: `npx vitest run scripts/portfolio-insights-report.test.ts -t "source failure behavior"`

Expected: FAIL because the current `main` function owns concrete network calls and overwrites one monolithic snapshot.

- [ ] **Step 3: Extract and use `runInsights`**

Keep the executable `main()` thin. Resolve all source results, derive intelligence from the source states, atomically write the HTML and aggregate history, then prune raw files. Preserve terminal output, but lead it with the same actionable findings as the HTML. Exit non-zero only when no useful current or cached source can produce a dashboard.

- [ ] **Step 4: Update scheduling and scripts**

Make the launchd job create the history directory as `0700` and verify it with `stat` before installation. Keep the 07:10 schedule. Add a package script `test:insights` that runs every `scripts/portfolio-insights*.test.ts` file, without changing the full `npm test` contract.

- [ ] **Step 5: Run the full insights suite**

Run: `npm run test:insights`

Expected: PASS. The CLI fixtures own partial-source reporting, safe write order, empty periods, and scheduled permissions until the scheduled job is removed.

- [ ] **Step 6: Commit orchestration and scheduling**

```bash
git add scripts/portfolio-insights.mjs scripts/portfolio-insights-report.mjs scripts/portfolio-insights-report.test.ts scripts/schedule-portfolio-insights.sh package.json package-lock.json
git commit -m "feat(BIV-421): run portfolio intelligence as a resilient daily job"
```

### Task 8: Verify Clarity navigation and update privacy and operations copy

**Files:**
- Modify: `docs/portfolio-insights-operations.md`
- Modify: `app/privacy/page.tsx`
- Modify: `components/PortfolioAnalytics.test.tsx`
- Modify: `docs/components/PortfolioAnalytics.md`
- Modify: `content/portfolio-content.json` only if the current privacy page sources copy from this file

**Interfaces:**
- Consumes: final v2 event fields, source retention, and allowlisted controls
- Produces: operator instructions for a supported Clarity route, or exact manual filters when URL state is not durable

- [ ] **Step 1: Test Clarity URL persistence in the attended project**

Open the Clarity project, apply one campaign tag, one content tag, and one city filter, then copy and reopen the resulting URL in a fresh browser context. Record which filters survive. Do not rely on query parameters that Clarity does not reproduce itself.

- [ ] **Step 2: Write the navigation result into the dashboard fixture test**

If Clarity preserves a supported URL, assert that exact allowlisted shape. Otherwise assert a project link plus visible steps naming `portfolio_campaign`, `portfolio_content_id`, city, and the requested click, scroll, attention, or recording view.

- [ ] **Step 3: Update the privacy copy through the copy-deck contract**

Read `docs/content/copy-deck.md`, export a fresh deck, edit the privacy key that owns analytics storage, and apply it back to `content/portfolio-content.json` or the owning page. State that consented portfolio actions use an anonymous tab session ID and approximate city-level network location, and that raw local journeys remain for 180 days. Explain that a directly shared link may carry an opaque code Bradley can match locally to the context in which he sent it. Do not claim personal identification or precise location.

- [ ] **Step 4: Update the component sheet and operations runbook**

Document the v2 payload, Airtable read-only token, four source snapshots, freshness states, 180-day pruning, attribution wording, Clarity navigation behavior, duplicate-code recovery, Analytics Engine rollback, and scheduled permissions. Replace stale statements that custom events and campaigns are Clarity-dashboard-only.

- [ ] **Step 5: Run copy and component proof**

Run: `npx vitest run components/PortfolioAnalytics.test.tsx lib/portfolio-content-schema.test.ts lib/portfolio-copy-deck.test.ts tests/component-sheets.test.ts`

Expected: PASS. These checks own public copy accuracy and component-sheet parity until the analytics contract changes.

- [ ] **Step 6: Commit documentation and privacy copy**

```bash
git add docs/portfolio-insights-operations.md app/privacy/page.tsx components/PortfolioAnalytics.test.tsx docs/components/PortfolioAnalytics.md content/portfolio-content.json
git commit -m "docs(BIV-421): explain portfolio intelligence privacy and operation"
```

Only add paths that actually changed after following the copy-deck ownership rules.

### Task 9: Run combined-head proof and visual verification

**Files:**
- Test only: all changed files from Tasks 1 through 8
- Evidence output: `.context/verification/biv-421/`

**Interfaces:**
- Consumes: the complete implementation head and the matching Job Search schema head
- Produces: exact-head proof before deployment

- [ ] **Step 1: Recompute and run repository checks**

Run:

```bash
npm run test:insights
npm run test
npm run typecheck
npm run lint
npm run test:rendered
git diff --check origin/main...HEAD
```

Expected: every command exits 0 against the same `HEAD`.

- [ ] **Step 2: Generate a fixture dashboard without remote credentials**

Use the CLI dependency injection from Task 7 to write a dashboard containing assigned, anonymous, stale, empty, hostile-string, city, evidence, contact, and small-sample states. Confirm the file and its directory permissions with `stat`.

- [ ] **Step 3: Run managed browser proof**

Use the `parallel-web-verification` skill and its checked-in runner. Open the generated local HTML in fresh ephemeral contexts at 1440 by 900 and 390 by 844, each in light and dark. Require no console errors or failed automatic requests. Exercise every disclosure and allowed link without following it away from the local page. Save screenshots and the runner report under `.context/verification/biv-421/`.

- [ ] **Step 4: Inspect the exact diff and record the head**

Run: `git status --short && git rev-parse HEAD && git diff --stat origin/main...HEAD`

Expected: clean status and one immutable head matching all proof artifacts.

### Task 10: Deploy, activate, smoke-test, and update the canonical schedule

**Files:**
- Modify for activation commit: `wrangler.main-preview.jsonc`
- External state: Cloudflare deployment, Analytics Engine dataset, canonical portfolio clone, launchd job

**Interfaces:**
- Consumes: approved and verified pull-request head plus the completed Airtable migration
- Produces: one active v2 event, one locally resolved assigned link, and a rollback path

- [ ] **Step 1: Publish the dormant implementation pull request**

Push every implementation commit, open a pull request against `main`, and record base and head revisions. Run elevated review because the change handles personal Airtable data, production telemetry, retention, and a deployment gate. Fix important findings on the same branch and rerun exact-head proof.

- [ ] **Step 2: Deploy the verified dormant candidate**

Deploy the reviewed artifact with `PORTFOLIO_INSIGHT_EVENTS_SINK=off`. Confirm the public endpoint answers `204` and Analytics Engine receives no row from the probe.

- [ ] **Step 3: Create the narrow activation commit**

Change only `PORTFOLIO_INSIGHT_EVENTS_SINK` from `off` to `analytics-engine`, commit it as `feat(BIV-421): activate portfolio insight events`, rerun worker configuration tests and the full protected checks, then publish and review the new exact head.

- [ ] **Step 4: Deploy and run one controlled assigned-link smoke test**

Create or use one Airtable Action with a unique code. Open its `Portfolio URL` in an isolated browser context with analytics consent granted. Open one content record, one evidence item, and one contact action. Confirm Analytics Engine stores v2 rows with the same tab session, allowed city-level fields, and no forbidden fields. Run `npm run insights` and verify the dashboard says `Activity from <name>'s assigned link` with matching source timestamps.

- [ ] **Step 5: Prove rollback**

Set the gate back to `off` in a rollback candidate and confirm its configuration test passes. Keep this exact change ready; do not deploy it unless the live smoke test exposes unsafe or incorrect behavior.

- [ ] **Step 6: Queue the reviewed pull request**

Use the repository's normal merge queue after every required check and elevated review applies to the activation head. Do not push to protected `main`, approve as Bradley, or use admin merge. Record the resulting merge commit.

- [ ] **Step 7: Update the canonical clone and schedule**

Fast-forward the canonical clone to the deployed commit, run `npm ci`, reinstall `com.biv.portfolio-insights`, and trigger one run. Confirm the job points outside Conductor, the dashboard and Airtable snapshot are `0600`, the directory is `0700`, and the log records all four source freshness times without a secret.

- [ ] **Step 8: Verify the next scheduled run**

After the next 07:10 execution, confirm launchd exit status 0, newer source timestamps for available sources, a preserved Clarity snapshot if quota-limited, and no raw journey file older than 180 days. Record the deployed commit, dataset, smoke-test campaign code, source timestamps, and rollback commit in the PR evidence.
