# Quarterly Dashboard Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, interactive quarterly pitch-conversion dashboard at `/demos/quarterly-dashboard` without committing a row-level dataset.

**Architecture:** A pure TypeScript module deterministically generates and aggregates pitch records. A client React component holds filters and drill-down state, while a thin App Router page owns metadata. The route has no backend or Google-service dependency.

**Tech Stack:** TypeScript 5.9, React 19, Vinext App Router, Vitest, Testing Library, global CSS tokens

**Spec:** `docs/superpowers/specs/2026-09-04-quarterly-dashboard-demo-design.md`

## Global Constraints

- Do not commit row-level real-estate data or generated fixture files.
- Generate the eight-quarter corpus from one fixed numeric seed at runtime.
- Keep all reporting calculations pure and independently testable.
- Preserve the original teal-and-cream visual direction with documented root tokens.
- Add no backend, credentials, Google integration, dependency, screenshot, case-study copy, or portfolio record.
- Use `.quarterly-dashboard-*` class names and `data-*` attributes for state.
- Keep raw color literals inside the `:root` token block only.
- Make every action keyboard reachable and apply the existing focus-ring treatment.

---

### Task 1: Deterministic records and reporting calculations

**Files:**
- Create: `lib/quarterly-dashboard.test.ts`
- Create: `lib/quarterly-dashboard.ts`

**Interfaces:**
- Produces: `Pitch`, `PitchStage`, `DashboardFilters`, `DashboardSummary`, `QuarterTrend`, `generatePitchDataset(seed?)`, `filterPitches(pitches, filters)`, `summarizePitches(pitches)`, `buildQuarterTrend(pitches)`, and `pitchesToCsv(pitches)`.

- [x] **Step 1: Write failing generator and calculation tests**

Cover identical output for identical seeds, different output for different seeds, the 2024 Q3 through 2026 Q2 period range, valid stage-specific optional fields, composed year/quarter/stage/lost-to filters, resolved-pitch conversion math, chronological trend order, and CSV quoting for commas and quotes.

- [x] **Step 2: Run the focused test and verify RED**

Run `npm test -- lib/quarterly-dashboard.test.ts` and confirm failure because `./quarterly-dashboard` does not exist.

- [x] **Step 3: Implement the pure module**

Use a small integer PRNG seeded with `20260529`. Generate 24 to 52 records per quarter. Derive the stage, dates, prices, property label, and optional competitor from the PRNG. Keep all dates as `YYYY-MM-DD` strings and avoid locale-dependent parsing in the reporting functions.

- [x] **Step 4: Run the focused test and verify GREEN**

Run `npm test -- lib/quarterly-dashboard.test.ts` and require a clean pass.

### Task 2: Interactive dashboard behavior

**Files:**
- Create: `components/QuarterlyDashboard.test.tsx`
- Create: `components/QuarterlyDashboard.tsx`

**Interfaces:**
- Consumes: every public interface from `lib/quarterly-dashboard.ts`.
- Produces: `QuarterlyDashboard`, a client component with summary/detail modes, controlled filters, drill-down actions, CSV download, and print action.

- [x] **Step 1: Write failing interaction tests**

Render the component in JSDOM and assert the initial 2026 Q2 summary. Test changing quarter, selecting a trend point, opening Signed detail from a scorecard, filtering Lost detail by competitor, returning to Summary without losing filters, and rendering the empty-state sentence when a valid filter combination has no rows.

- [x] **Step 2: Run the component test and verify RED**

Run `npm test -- components/QuarterlyDashboard.test.tsx` and confirm failure because the component does not exist.

- [x] **Step 3: Implement state and semantic markup**

Use real `button`, `select`, `table`, `caption`, and heading elements. Use one memoized generated corpus. Derive filtered rows and metrics from state rather than storing duplicated results. Give chart points descriptive accessible names such as `Show 2025 Q4`. Implement CSV download with a Blob and temporary anchor, and call `window.print()` for Print/PDF.

- [x] **Step 4: Run the component test and verify GREEN**

Run `npm test -- components/QuarterlyDashboard.test.tsx` and require a clean pass.

### Task 3: Route and visual treatment

**Files:**
- Create: `app/demos/quarterly-dashboard/page.test.tsx`
- Create: `app/demos/quarterly-dashboard/page.tsx`
- Modify: `app/globals.css`
- Modify: `docs/design-tokens.md`

**Interfaces:**
- Consumes: `QuarterlyDashboard` from `components/QuarterlyDashboard.tsx`.
- Produces: a public App Router route with page metadata and a responsive, printable dashboard.

- [x] **Step 1: Write the failing route test**

Assert that the page returns `QuarterlyDashboard` and exports metadata titled `Quarterly pitch conversion | Bradley Berkman`.

- [x] **Step 2: Run the route test and verify RED**

Run `npm test -- app/demos/quarterly-dashboard/page.test.tsx` and confirm failure because the route does not exist.

- [x] **Step 3: Add the page and scoped CSS**

Add the original palette as documented `--dashboard-*` tokens in `:root`. Build the desktop grid, scrolling chart and table regions, 760px responsive stack, hover rules inside `@media (pointer: fine)`, `:focus-visible` outlines, reduced-motion compatibility, and `@media print` rules. Keep declarations alphabetized within each new rule.

- [x] **Step 4: Run route, component, token, and lint checks**

Run `npm test -- app/demos/quarterly-dashboard/page.test.tsx components/QuarterlyDashboard.test.tsx tests/design-tokens.test.ts`, then `npm run lint`, and fix only failures caused by this feature.

### Task 4: Built-route and browser proof

**Files:**
- Modify: `tests/rendered-routes.test.mjs`

**Interfaces:**
- Consumes: the completed `/demos/quarterly-dashboard` route.
- Produces: built-output coverage and browser verification artifacts scoped to this workspace.

- [x] **Step 1: Add a failing rendered-route assertion**

Request `/demos/quarterly-dashboard` from the built worker and assert status 200 plus the dashboard title, filters, chart label, Pitch Detail tab, and Download CSV control.

- [x] **Step 2: Run the rendered route test and verify RED against the pre-change build**

Run `node --test tests/rendered-routes.test.mjs` before rebuilding and confirm the new assertion fails because the route is absent from the current `dist` artifact.

- [x] **Step 3: Build and run all automated proof**

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `node --test tests/rendered-routes.test.mjs`.

- [x] **Step 4: Verify the running route**

Attach the parallel-web-verification runner to the workspace server. Check `/demos/quarterly-dashboard` at 1440x900 and 390x844 in fresh browser contexts. Require no navigation failure or uncaught page error, inspect both screenshots, exercise filters and drill-down with Playwright, and record any device-only visual judgment for the user’s review.
