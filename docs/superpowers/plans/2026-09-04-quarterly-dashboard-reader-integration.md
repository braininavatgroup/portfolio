# Quarterly Dashboard Reader Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the quarterly dashboard to the real-estate portfolio record with a compact live preview and a reliable return path from the full dashboard.

**Architecture:** Extend the existing portfolio visual block with a ready `interactive` format, a known preview identifier, and an internal destination. Render that block through a dedicated compact component in `PortfolioReader`; keep the full dashboard route independent and add a canonical link back to the selected real-estate record.

**Tech Stack:** TypeScript 5.9, React 19, Vinext App Router, Vitest, Testing Library, global CSS tokens

**Spec:** `docs/superpowers/specs/2026-09-04-quarterly-dashboard-demo-design.md`

## Global Constraints

- Do not add an iframe, screenshot, row-level dataset, backend, or external service.
- Reuse `generatePitchDataset`, `filterPitches`, `summarizePitches`, and `buildQuarterTrend` for the preview.
- Keep the full dashboard outside `PortfolioExperience`; never mount two portfolio experiences.
- Open the full dashboard in the same tab and provide `/?view=graph#real-estate` as the canonical return destination.
- Preserve the authored body order and the existing reader width, spacing, typography, focus, and class-naming contracts.
- Add a component sheet and compiled `/design` example for every new component under `components/`.

---

### Task 1: Interactive visual contract and record placement

**Files:**
- Modify: `lib/portfolio-structure.ts`
- Modify: `lib/portfolio-world.ts`
- Modify: `content/portfolio-content.json`
- Modify: `lib/portfolio-content-parity.test.ts`

**Interfaces:**
- Produces: `PortfolioVisualFormat` including `"interactive"`; `PortfolioVisualPreview = "quarterly-dashboard"`; optional `preview` and `href` fields on visual skeletons and merged blocks.
- Produces: a ready `real-estate-quarterly-dashboard` block after `real-estate-operation-map`.

- [x] **Step 1: Write the failing contract test**

Add a real-world assertion that the merged `real-estate` body ends with an interactive block whose preview is `quarterly-dashboard`, destination is `/demos/quarterly-dashboard`, and `isPortfolioVisualReady` returns true.

```ts
expect(realEstate.body.at(-1)).toMatchObject({
  format: "interactive",
  href: "/demos/quarterly-dashboard",
  preview: "quarterly-dashboard",
  status: "ready",
  type: "visual",
});
expect(isPortfolioVisualReady(realEstate.body.at(-1) as PortfolioVisualBlock)).toBe(true);
```

- [x] **Step 2: Verify RED**

Run `npm test -- lib/portfolio-content-parity.test.ts`. The test must fail because the interactive block is absent.

- [x] **Step 3: Implement the visual contract**

Add the format and preview types, copy `preview` and `href` through `mergeBody`, and treat a ready interactive block as valid only when both fields are present. Add the structural block and its minimal factual visual text.

- [x] **Step 4: Verify GREEN**

Run `npm test -- lib/portfolio-content-parity.test.ts` and require a clean pass.

### Task 2: Compact dashboard preview in the reader

**Files:**
- Create: `components/QuarterlyDashboardPreview.tsx`
- Create: `components/QuarterlyDashboardPreview.test.tsx`
- Modify: `components/PortfolioReader.tsx`
- Modify: `components/PortfolioReader.test.tsx`
- Modify: `app/globals.css`
- Create: `docs/components/QuarterlyDashboardPreview.md`
- Modify: `docs/components/README.md`
- Modify: `app/design/sheet-examples.tsx`
- Modify: `app/design/sheet-examples.test.tsx`

**Interfaces:**
- Produces: `QuarterlyDashboardPreview({ href, label })`, one accessible link containing the fixed 2026 Q2 label, Pitches, Signed, Conversion, an eight-point trend, and `Explore the dashboard`.
- Consumes: interactive visual blocks in `PortfolioReader.VisualBlock`.

- [x] **Step 1: Write failing preview and reader tests**

The preview test must assert the literal initial metrics already established by the full dashboard test and an anchor destination of `/demos/quarterly-dashboard`. The reader test must select `real-estate` and find the same link in the rendered body.

```tsx
expect(screen.getByRole("link", { name: /explore the dashboard/i })).toHaveAttribute(
  "href",
  "/demos/quarterly-dashboard",
);
expect(screen.getByText("48")).toBeInTheDocument();
expect(screen.getByText("48.5%")).toBeInTheDocument();
```

- [x] **Step 2: Verify RED**

Run `npm test -- components/QuarterlyDashboardPreview.test.tsx components/PortfolioReader.test.tsx`. The focused preview test must fail because the component does not exist; the reader assertion must fail because interactive blocks have no renderer.

- [x] **Step 3: Implement the compact renderer**

Generate the corpus once, filter to 2026 Q2, derive metrics and trend, and render a compact SVG with semantic labels. In `VisualBlock`, route only the known `quarterly-dashboard` preview to the new component; unknown interactive preview identifiers render no broken link. Add reader-scoped CSS and the required component documentation/example.

- [x] **Step 4: Verify GREEN**

Run the two focused tests plus `tests/component-sheets.test.ts`, `app/design/sheet-examples.test.tsx`, and `tests/design-tokens.test.ts`.

### Task 3: Full dashboard return path

**Files:**
- Modify: `components/QuarterlyDashboard.tsx`
- Modify: `components/QuarterlyDashboard.test.tsx`
- Modify: `app/demos/quarterly-dashboard/page.tsx`
- Modify: `app/demos/quarterly-dashboard/page.test.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-routes.test.mjs`

**Interfaces:**
- `QuarterlyDashboard` accepts optional `returnHref` and `returnLabel` props.
- The public route passes `returnHref="/?view=graph#real-estate"` and `returnLabel="Back to Real-estate deal tracker"`.

- [x] **Step 1: Write failing return-navigation tests**

Assert that the component renders an accessible return link when props are supplied and that the route supplies the canonical real-estate destination.

```tsx
expect(screen.getByRole("link", { name: "Back to Real-estate deal tracker" })).toHaveAttribute(
  "href",
  "/?view=graph#real-estate",
);
```

- [x] **Step 2: Verify RED**

Run `npm test -- components/QuarterlyDashboard.test.tsx app/demos/quarterly-dashboard/page.test.tsx`. The new assertions must fail because the return props do not exist.

- [x] **Step 3: Implement the return bar**

Render a slim navigation row inside the dashboard shell and above its tabs. Keep the link out of print output. Pass the canonical destination from the route and extend the built-route assertion.

- [x] **Step 4: Verify GREEN**

Run the two focused tests and require a clean pass.

### Task 4: Journey verification and delivery

**Files:**
- Modify: `tests/rendered-routes.test.mjs`
- Modify: `docs/superpowers/plans/2026-09-04-quarterly-dashboard-reader-integration.md`

**Interfaces:**
- Proves: direct record URL to preview, preview to dashboard, dashboard return to the record, responsive behavior, and production build integrity.

- [x] **Step 1: Run affected automated proof**

Run `npm test -- lib/portfolio-content-parity.test.ts components/QuarterlyDashboardPreview.test.tsx components/PortfolioReader.test.tsx components/QuarterlyDashboard.test.tsx app/demos/quarterly-dashboard/page.test.tsx tests/component-sheets.test.ts app/design/sheet-examples.test.tsx tests/design-tokens.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, and `node --test tests/rendered-routes.test.mjs`.

- [x] **Step 2: Run browser journey proof**

At desktop and phone widths, open `/?view=graph#real-estate`, activate `Explore the dashboard`, verify the dashboard route and return link, activate the return link, and verify the real-estate reader is selected again. Record console errors, page errors, failed requests, and screenshots under `.context/verification/`.

- [ ] **Step 3: Publish and merge**

Inspect the staged diff, commit explicit paths, push the current branch, open a pull request against `main`, monitor required checks and review, repair any failures on the same branch, and merge through the normal protected-branch workflow once the repository permits it.
