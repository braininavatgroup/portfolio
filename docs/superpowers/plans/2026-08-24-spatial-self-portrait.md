# Spatial self-portrait implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the introductory body transition with an immediately usable Bradley-centered map and a persistent portfolio index or project dossier.

**Architecture:** Keep the existing stage model and Three.js graph. Add a pure node-to-dossier selector and an HTML `PortfolioDossier`, then make `PortfolioExperience` start in graph mode and coordinate both views. Preserve `/work` and case-study routes.

**Tech Stack:** React 19, TypeScript, React Three Fiber, Vitest, Testing Library, Vinext.

**Spec:** `docs/superpowers/specs/2026-08-24-spatial-self-portrait-design.md`

## Global constraints

- Use only existing Bradley portfolio data and copy.
- Do not copy Andrew Trousdale's taxonomy, copy, orange accent, typeface, node glyphs, or exact card treatment.
- Do not invent media or evidence.
- Keep the graph visible at widths of `760px` and below.
- Preserve canonical routes, keyboard access, HTML fallback reachability, and the dormant chat activation boundary.
- Do not deploy, publish, push, or open a pull request.

---

### Task 1: Derive a dossier from a graph node

**Files:**
- Create: `lib/portfolio-dossier.ts`
- Create: `lib/portfolio-dossier.test.ts`

**Interfaces:**
- Consumes: `SpatialGraphNode`, `TripletRole`, and `getCaseStudy(slug)`.
- Produces: `getPortfolioDossier(node): PortfolioDossierRecord | undefined`.

- [ ] **Step 1: Write failing tests**

Test with real `portfolioNodes` that selecting Dubs approach returns the full three-step Dubs case study with `selectedRole: "approach"`. Test that the root and a node with `projectSlug: "missing-project"` both return `undefined`. These tests catch partial dossiers, a false root project, and stale graph references.

- [ ] **Step 2: Verify red**

Run `npm test -- lib/portfolio-dossier.test.ts`. Expect failure because the module does not exist.

- [ ] **Step 3: Implement the selector**

```ts
export type PortfolioDossierRecord = CaseStudy & {
  selectedRole: TripletRole;
};

export function getPortfolioDossier(
  node: SpatialGraphNode,
): PortfolioDossierRecord | undefined {
  if (node.role === "root" || !node.projectSlug) return undefined;
  const caseStudy = getCaseStudy(node.projectSlug);
  return caseStudy ? { ...caseStudy, selectedRole: node.role } : undefined;
}
```

- [ ] **Step 4: Verify green and commit**

Run `npm test -- lib/portfolio-dossier.test.ts`. Commit the two explicit paths as `feat: derive project dossiers from map nodes`.

---

### Task 2: Render the index and project dossier

**Files:**
- Create: `components/PortfolioDossier.tsx`
- Create: `components/PortfolioDossier.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `PortfolioDossierRecord | undefined`, `DomainId | null`, grouped `portfolioData.projects`, and index/domain callbacks.
- Produces: an accessible complementary region named `Portfolio index` or `<title> project dossier`.

- [ ] **Step 1: Write failing component tests**

In index mode assert the `Portfolio index` complementary region, an expanded `Music promotion` button, and a real `/work/kickoff-intake` link. In project mode use the real Dubs approach node and assert `Dubs project dossier`, expanded `Approach`, and `/work/dubs`. These tests catch lost routes, the wrong default section, and inaccessible generic containers.

- [ ] **Step 2: Verify red**

Run `npm test -- components/PortfolioDossier.test.tsx`. Expect failure because the component does not exist.

- [ ] **Step 3: Implement index mode**

Use `groupProjectsByFacet(portfolioData.projects, "domain", domains)`. Render native accordion buttons with `aria-expanded` and `aria-controls`. Open Music promotion initially or the selected domain when present. Render every project as a real `Link` to `/work/:slug`.

- [ ] **Step 4: Implement project mode**

Render a return-to-index button, project domain/title/summary, evidence status, three role accordions, underlying entity summaries, supporting evidence, and `Read the full <title> case study`. Initialize the open role from `dossier.selectedRole`.

- [ ] **Step 5: Style and verify**

Add an off-white, right-side desktop object with a private scroll region, solid rules, existing colors, and restrained shadow. At `760px`, dock it to the bottom and leave the upper graph visible. Run `npm test -- components/PortfolioDossier.test.tsx` and expect PASS.

- [ ] **Step 6: Commit**

Commit the three explicit paths as `feat: add the portfolio map dossier`.

---

### Task 3: Open on Bradley's map and synchronize both views

**Files:**
- Modify: `lib/portfolio-adapter.ts`
- Modify: `lib/spatial-graph.test.ts`
- Modify: `lib/node-interaction.ts`
- Modify: `lib/node-interaction.test.ts`
- Modify: `components/scene/GraphNode.tsx`
- Modify: `components/PortfolioExperience.tsx`
- Modify: `components/PortfolioExperience.test.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `getPortfolioDossier`, `PortfolioDossier`, graph nodes, and existing domain focus.
- Produces: an immediately interactive graph with Bradley as root and synchronized index or project dossier state.

- [ ] **Step 1: Write failing integration tests**

Require the production root title `Bradley Berkman`. Require `nodeAction(root)` to equal `index`, while project steps remain `inspect`. On first render require the Portfolio index and reject both `Explore the work` and `Moving through the glass`. These tests catch restoration of the abstract root or entrance gate.

- [ ] **Step 2: Verify red**

Run `npm test -- lib/spatial-graph.test.ts lib/node-interaction.test.ts components/PortfolioExperience.test.tsx`. Expect failures against the old root, root action, and entrance UI.

- [ ] **Step 3: Implement root identity and action**

Change the adapted root title to `Bradley Berkman`. Extend `NodeAction` to `"none" | "index" | "inspect"`. Return `index` for the root. Render the root HTML label and pointer action in `GraphNode`.

- [ ] **Step 4: Remove entrance orchestration**

Render the canvas with phase `graph` on first load. Remove the transition timer, scene-click entry handler, landing headline, enter button, and replay control. A root selection clears selected node and domain. A project selection derives and shows its dossier.

- [ ] **Step 5: Connect the composition**

Render `PortfolioDossier` beside the graph. Domain accordion actions reuse selected-domain camera focus. Replace the rendered `NodeDrawer`, but retain its file until visual acceptance. Keep `KeyboardNavigator` reachable near the dossier. Keep chat behavior unchanged and position its resting state away from the dossier.

- [ ] **Step 6: Verify behavior**

Run `npm test -- lib/portfolio-dossier.test.ts components/PortfolioDossier.test.tsx lib/spatial-graph.test.ts lib/node-interaction.test.ts components/PortfolioExperience.test.tsx components/KeyboardNavigator.test.tsx`. Expect PASS.

- [ ] **Step 7: Run unconditional checks**

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `node --test tests/rendered-html.test.mjs tests/rendered-routes.test.mjs`, and `git diff --check`. Every command must exit zero.

- [ ] **Step 8: Walk the visual result**

Capture `/` at `1440x1000` and exact device-emulated `390x844`. Inspect initial index mode and Dubs project mode for root identity, direct project reachability, graph/dossier competition, mobile graph retention, focus states, and scroll containment.

- [ ] **Step 9: Commit**

Commit the explicit integrated paths as `feat: open on the spatial self-portrait`.
