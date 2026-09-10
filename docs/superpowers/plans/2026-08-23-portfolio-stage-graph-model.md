# Portfolio Stage Graph Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Replace the spatial graph's fixed model/system/artifact chain with the approved stage model and a data-derived `brain -> instinct -> approach -> output` projection while keeping existing project routes and current case-study/index consumers working.

**Architecture:** Keep `lib/portfolio.ts` as the temporary source of today's `ArtifactRecord[]`. A pure model module defines and validates the stage contract; a one-way adapter converts current records into that contract; a composition module exposes the approved lookup interface. A separate spatial projector converts one ordered projection into renderer-owned graph nodes, positions, routes, and interaction behavior. Current case-study and index pages remain on the legacy records in this workspace so later workspaces can migrate them without creating a second content model.

**Tech Stack:** TypeScript 5.9, React 19, Vinext, Vitest, Testing Library, React Three Fiber, Three.js, ESLint

**Spec:** `docs/superpowers/specs/2026-08-23-portfolio-stage-graph-model-design.md`

## Scope constraints

- `instinct`, `approach`, and `output` are projection roles for `instinct-approach-output/v1`, not canonical entity kinds.
- The stage contract leaves entity facets and relation `type` strings open and preserves values it does not understand.
- Visual geometry, colors, token kinds, and domain angles remain outside entity records.
- Structural validation rejects corrupt data; product assertions such as terminal outputs live in focused tests.
- Production logic derives collection sizes from data. Tests may use small fixtures, but they do not freeze the current portfolio's project, entity, or label counts.
- Existing `/work/:slug` routes remain canonical. The graph's three step nodes may all open a grouped drawer and link to that same project page.
- The center brain remains inert until it has a real action, so it receives no pointer or button affordance.
- The index and fixed five-section case-study renderer remain compatible consumers in Workspace 1. Their presentation migration belongs to their own workspaces.

## File map

| File | Responsibility |
| --- | --- |
| `lib/portfolio-model.ts` | Stage types, validator, and pure lookup construction |
| `lib/portfolio-model.test.ts` | Contract, grouped-step, open-metadata, and corruption tests |
| `lib/portfolio-adapter.ts` | Temporary `ArtifactRecord[]` to `PortfolioStageData` migration |
| `lib/portfolio-adapter.test.ts` | Editorial mapping and route-preservation tests |
| `lib/portfolio-data.ts` | Validated stage instance and approved public selectors |
| `lib/spatial-graph.ts` | UI projection nodes, dynamic layout, canonical routes, and terminal checks |
| `lib/spatial-graph.test.ts` | Shape, grouping, reachability, layout, and terminal-output tests |
| `lib/reachability.ts` | Route manifests for the new spatial node type |
| `lib/node-interaction.ts` | Affordance-to-action rule for root and projected steps |
| `components/scene/OutputToken.tsx` | Renderer-owned name for the visually dominant output glyph |
| `components/scene/output-token-map.ts` | Temporary project-to-token lookup outside the content contract |
| `components/scene/GraphNodeLabel.tsx` | DOM-testable persistent role and title label |
| `components/scene/GraphNode.tsx` | Three-dimensional role styling and selection |
| `components/NodeDrawer.tsx` | Grouped step framing and underlying entity content |
| `components/KeyboardNavigator.tsx` | Keyboard traversal over supplied spatial nodes |
| `components/PortfolioExperience.tsx` | Shared graph state, revised copy, and selector wiring |
| `components/scene/{PortfolioCanvas,BrainGraph,Cable}.tsx` | New spatial-node plumbing |
| `app/globals.css` | Wrapping, focus-visible, role, and output-prominence styles |

---

### Task 1: Define and validate the stage contract

**Files:**

- Create: `lib/portfolio-model.ts`
- Create: `lib/portfolio-model.test.ts`

**Produces:**

```ts
export type PortfolioStageData = {
  version: "stage-graph-1";
  projects: ProjectRecord[];
  entities: PortfolioEntity[];
  relations: EntityRelation[];
  projections: PortfolioProjection[];
};

export type PortfolioModel = {
  data: PortfolioStageData;
  getProject(slug: string): ProjectRecord | undefined;
  getEntity(id: string): PortfolioEntity | undefined;
  getProjection(id: string): PortfolioProjection | undefined;
  getBranch(projectId: string, projectionId: string): TripletBranch | undefined;
  getBranchEntities(branch: TripletBranch): PortfolioEntity[];
};

export function validatePortfolioData(data: PortfolioStageData): string[];
export function createPortfolioModel(data: PortfolioStageData): PortfolioModel;
```

**Step 1: Write the failing contract tests**

Create a compact fixture with one project, four entities, one open relation type, and a branch whose approach step contains two entities. Assert:

```ts
const model = createPortfolioModel(fixture);

expect(model.getProject("example")?.facets).toEqual({
  domain: ["music"],
  experimentalFacet: ["kept-verbatim"],
});
expect(model.getBranchEntities(fixture.projections[0].branches[0]).map(({ id }) => id))
  .toEqual(["example:instinct", "example:spec", "example:system", "example:output"]);
expect(model.data.relations[0].type).toBe("supports-in-a-way-not-yet-taxonomized");
```

Add table-driven invalid fixtures covering duplicate IDs, missing projection roots, missing project/entity/relation references, empty step entity lists, and an entity assigned to a branch but absent from that project's `entityIds`. Assert stable, path-specific messages rather than thrown implementation errors.

**Step 2: Confirm the tests fail for the missing module**

Run:

```bash
npx vitest run lib/portfolio-model.test.ts
```

Expected: FAIL because `./portfolio-model` does not exist.

**Step 3: Implement the exact stage types**

Copy the approved `ProjectRecord`, `PortfolioEntity`, `EntityRelation`, `TripletRole`, `TripletStep`, `TripletBranch`, and `PortfolioProjection` definitions from the spec. Keep `facets` as `Record<string, readonly string[]>` and relation `type` as `string`; add no enums for either.

Implement `validatePortfolioData` as a pure accumulator. It must:

```ts
const duplicateIds = (label: string, ids: readonly string[]) => {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) issues.push(`${label} has duplicate id: ${id}`);
    seen.add(id);
  }
};
```

Build sets for project, entity, relation, and projection IDs; then validate every reference. For branch membership, construct each project's entity-ID set and check every `step.entityIds` member against it. Do not normalize, delete, or reinterpret metadata.

Implement `createPortfolioModel` with maps closed over the supplied data. Throw one `Error` containing the joined structural issues when validation fails. Flatten step entity IDs in step order for `getBranchEntities`; preserve duplicates if a future valid projection intentionally repeats an entity.

**Step 4: Run focused and baseline tests**

Run:

```bash
npx vitest run lib/portfolio-model.test.ts lib/portfolio.test.ts
```

Expected: PASS.

**Step 5: Commit explicit paths**

```bash
git add lib/portfolio-model.ts lib/portfolio-model.test.ts
git diff --cached --check
git commit -m "feat: define portfolio stage model"
```

---

### Task 2: Adapt today's records and publish the lookup interface

**Files:**

- Create: `lib/portfolio-adapter.ts`
- Create: `lib/portfolio-adapter.test.ts`
- Create: `lib/portfolio-data.ts`
- Modify: `lib/portfolio.test.ts`

**Consumes:** `ArtifactRecord[]` from `lib/portfolio.ts`

**Produces:**

```ts
export const MAIN_PROJECTION_ID = "instinct-approach-output/v1";
export function adaptArtifactRecords(records: readonly ArtifactRecord[]): PortfolioStageData;

export const portfolioData: PortfolioStageData;
export const mainProjection: PortfolioProjection;
export const getProject: PortfolioModel["getProject"];
export const getEntity: PortfolioModel["getEntity"];
export const getProjection: PortfolioModel["getProjection"];
export const getBranch: PortfolioModel["getBranch"];
export const getBranchEntities: PortfolioModel["getBranchEntities"];
```

**Step 1: Write the failing adapter tests**

Use a one-record `ArtifactRecord` fixture with the existing five source entries and two evidence items. Assert the following editorial mapping:

```ts
expect(branch.steps.map(({ role }) => role)).toEqual([
  "instinct",
  "approach",
  "output",
]);
expect(branch.steps[0].entityIds).toEqual([
  "example:judgment",
  "example:principle",
  "example:decision",
]);
expect(branch.steps[1].entityIds).toEqual([
  "example:spec",
  "example:system",
]);
expect(branch.steps[2].entityIds).toEqual([
  "example:artifact",
  "example:operation",
  "example:evidence:0",
  "example:evidence:1",
]);
expect(data.projects[0].facets).toEqual({
  domain: ["music"],
  evidenceStatus: ["partial"],
});
expect(data.entities.find(({ id }) => id === "example:artifact")?.links)
  .toEqual([{ label: "View case study", href: "/work/example" }]);
```

Also adapt the real `artifacts` array and assert that every current slug resolves through `getProject`, every branch resolves through `getBranch`, every project owns all branch entities, and the stage validator reports no issues. Derive expected slugs from the input records rather than repeating the current list.

**Step 2: Confirm the tests fail**

Run:

```bash
npx vitest run lib/portfolio-adapter.test.ts
```

Expected: FAIL because the adapter module does not exist.

**Step 3: Implement the one-way adapter**

Create one root entity:

```ts
const rootEntity: PortfolioEntity = {
  id: "portfolio:brain",
  title: "Judgment",
  summary: "I find where judgment matters, then build the system around it.",
};
```

For every record, find each legacy chain entry by its existing layer and create:

- `:judgment`, `:principle`, and `:decision` entities in the instinct step;
- `:spec` and `:system` entities in the approach step;
- `:artifact`, `:operation`, and indexed evidence entities in the output step.

Use the legacy layer names only in adapter-owned source facets such as `{ sourceLayer: ["spec"] }`. Evidence entities use `{ evidenceStatus: [item.status] }`. Project facets hold current domain and evidence status. The project's `entityIds` is the flattened list for its branch.

Use `record.slug` as the temporary project ID and `${record.slug}:branch` as its branch ID. Declare each step list as `[string, ...string[]]` when it is assembled so the adapter satisfies the non-empty tuple contract without a cast at the return boundary. Evidence and relation IDs use their input index only within the stable project prefix.

Create open, descriptive relations from judgment to specification (`informed`), specification to system (`developed-into`), system to current artifact (`produced`), artifact to operation (`operated-as`), and artifact to each evidence entity (`supported-by`). Store their IDs on the branch. No union constrains these strings.

Set projection and step framing as:

```ts
{
  role: "instinct",
  title: judgment.title,
  summary: record.principle,
  entityIds: instinctIds,
}
{
  role: "approach",
  title: spec.title,
  summary: system.detail,
  entityIds: approachIds,
}
{
  role: "output",
  title: record.title,
  summary: record.summary,
  entityIds: outputIds,
}
```

`adaptArtifactRecords` returns raw data and does not import React, routes, Three.js, or layout constants.

**Step 4: Compose and validate the live stage data**

In `lib/portfolio-data.ts`, adapt `artifacts`, pass the result to `createPortfolioModel`, require the main projection once, and re-export bound selectors:

```ts
const model = createPortfolioModel(adaptArtifactRecords(artifacts));
const selectedProjection = model.getProjection(MAIN_PROJECTION_ID);
if (!selectedProjection) throw new Error(`Missing projection: ${MAIN_PROJECTION_ID}`);

export const portfolioData = model.data;
export const mainProjection: PortfolioProjection = selectedProjection;
export const {
  getProject,
  getEntity,
  getProjection,
  getBranch,
  getBranchEntities,
} = model;
```

Update `lib/portfolio.test.ts` so its legacy tests cover uniqueness, source record completeness, and the timeline only. Remove graph-node count, fixed layer-count, and unique-token assertions; those invariants move to stage/spatial tests.

**Step 5: Verify and commit**

Run:

```bash
npx vitest run lib/portfolio-model.test.ts lib/portfolio-adapter.test.ts lib/portfolio.test.ts
npx tsc --noEmit
```

Expected: PASS.

```bash
git add lib/portfolio-adapter.ts lib/portfolio-adapter.test.ts lib/portfolio-data.ts lib/portfolio.test.ts
git diff --cached --check
git commit -m "feat: adapt portfolio records to stage graph"
```

---

### Task 3: Derive a dynamic spatial graph and prove reachability

**Files:**

- Create: `lib/spatial-graph.ts`
- Create: `lib/spatial-graph.test.ts`
- Modify: `lib/reachability.ts`
- Modify: `lib/reachability.test.ts`

**Produces:**

```ts
export type SpatialNodeRole = "root" | TripletRole;
export type SpatialGraphNode = {
  id: string;
  label: string;
  detail: string;
  role: SpatialNodeRole;
  position: readonly [number, number, number];
  entityIds: readonly string[];
  parentId?: string;
  projectId?: string;
  projectSlug?: string;
  href?: string;
  groupId?: string;
};

export type SpatialGroup = { id: string; label: string; angle: number };

export function projectSpatialGraph(input: {
  projection: PortfolioProjection;
  projects: readonly ProjectRecord[];
  root: PortfolioEntity;
  groups: readonly SpatialGroup[];
}): SpatialGraphNode[];

export function terminalNodeIds(nodes: readonly SpatialGraphNode[]): string[];
```

**Step 1: Write the failing projector tests**

Use two projects with different group facets, and add a third branch in one group so its angular offset proves the projector is data-derived. Assert:

```ts
expect(nodes[0]).toMatchObject({
  id: "portfolio:brain",
  role: "root",
  parentId: undefined,
  href: undefined,
});

for (const branch of projection.branches) {
  const branchNodes = nodes.filter(({ projectId }) => projectId === branch.projectId);
  expect(branchNodes.map(({ role }) => role)).toEqual(["instinct", "approach", "output"]);
  expect(branchNodes.map(({ href }) => href)).toEqual([
    `/work/${project.slug}`,
    `/work/${project.slug}`,
    `/work/${project.slug}`,
  ]);
  expect(branchNodes[0].parentId).toBe("portfolio:brain");
  expect(branchNodes[1].parentId).toBe(branchNodes[0].id);
  expect(branchNodes[2].parentId).toBe(branchNodes[1].id);
}
expect(terminalNodeIds(nodes)).toEqual(
  projection.branches.map(({ id }) => `${id}:output`),
);
```

Assert every position contains three finite numbers, distinct projects do not receive identical positions, and no fixture assertion contains the live total of projects or nodes.

Rewrite reachability tests to derive canonical project routes from `portfolioData.projects`. Graph and keyboard manifests contain one entry per actionable spatial node; the flat manifest contains one route per project. Compare route sets, allowing repeated graph routes without inventing anchor routes.

**Step 2: Confirm the new tests fail**

Run:

```bash
npx vitest run lib/spatial-graph.test.ts lib/reachability.test.ts
```

Expected: FAIL because the spatial projector and migrated types are absent.

**Step 3: Implement layout from supplied arrays**

Use role radii, not project counts:

```ts
const radiusByRole: Record<TripletRole, number> = {
  instinct: 1.7,
  approach: 3.1,
  output: 4.6,
};
```

Read a project's first `facets?.domain` value as the optional renderer group. Resolve its angle from the supplied groups; distribute unknown groups evenly after known groups. Compute per-group branch offsets using that group's actual branch array. Use the branch's ordered `steps` to set IDs, labels, summaries, entity IDs, parent IDs, and one canonical project href. The projector must not inspect legacy chain layers or infer entity kinds.

Implement `terminalNodeIds` from absence of children, excluding the root. The product test, rather than the generic helper, asserts those terminal nodes have role `output` for this projection.

**Step 4: Publish the new graph without breaking legacy consumers**

Leave `PortfolioNode` and `portfolioNodes` in `lib/portfolio.ts` until the coherent UI migration in Task 5. The new spatial graph is additive at this commit, so every commit remains type-safe and runnable.

In `lib/spatial-graph.ts`, export the live `portfolioNodes` only after the pure function declarations:

```ts
const root = getEntity(mainProjection.rootEntityId);
if (!root) throw new Error(`Missing root entity: ${mainProjection.rootEntityId}`);

export const portfolioNodes = projectSpatialGraph({
  projection: mainProjection,
  projects: portfolioData.projects,
  root,
  groups: domains,
});
```

This composition may import `domains` because spatial grouping is renderer-owned; `portfolio-model.ts` and `portfolio-adapter.ts` may not.

Update `reachability.ts` to accept `readonly SpatialGraphNode[]`. `graphNodeRoutes` and `keyboardNodeRoutes` return every actionable node href. Replace `flatIndexNodeRoutes(nodes)` with `projectRoutes(projects)`, returning `/work/${project.slug}` once per project.

**Step 5: Verify and commit**

Run:

```bash
npx vitest run lib/spatial-graph.test.ts lib/reachability.test.ts
npx tsc --noEmit
```

Expected: PASS.

```bash
git add lib/spatial-graph.ts lib/spatial-graph.test.ts lib/reachability.ts lib/reachability.test.ts
git diff --cached --check
git commit -m "feat: derive spatial graph from projection"
```

---

### Task 4: Make persistent graph labels readable and outputs dominant

**Files:**

- Create: `components/scene/GraphNodeLabel.tsx`
- Create: `components/scene/GraphNodeLabel.test.tsx`
- Create: `components/scene/OutputToken.tsx`
- Create: `components/scene/output-token-map.ts`
- Modify: `app/globals.css`

**Step 1: Write the failing DOM label tests**

Render `GraphNodeLabel` with an approach node and assert it exposes one real button with both the projection role and full title. Render it with `interactive={false}` and assert it exposes text but no button:

```tsx
expect(screen.getByRole("button", { name: /Approach.+Requirements and field map/ })).toBeTruthy();
expect(screen.getByText("Approach")).toBeTruthy();
expect(screen.getByText("Requirements and field map")).toBeTruthy();
```

Fire a click and assert `onSelect(node)`. This component remains ordinary DOM so label behavior is testable without mounting WebGL.

**Step 2: Confirm the test fails**

Run:

```bash
npx vitest run components/scene/GraphNodeLabel.test.tsx
```

Expected: FAIL because the component does not exist.

**Step 3: Implement the label and renderer-owned token mapping**

`GraphNodeLabel` accepts:

```ts
type GraphNodeLabelProps = {
  node: SpatialGraphNode;
  interactive: boolean;
  onSelect: (node: SpatialGraphNode) => void;
};
```

For step nodes, render a role `<span>` and title `<strong>` inside the button. For inert nodes, render the same content in a non-interactive `<span>`. The root currently receives no HTML label from `GraphNode`, so no decorative label becomes a hidden control.

Copy the glyph implementation from `ArtifactToken.tsx` to `OutputToken.tsx` and rename its exported component. Keep the old file in place until the UI switches atomically in Task 5. Keep the current token-kind union temporary in `lib/portfolio.ts`. In `output-token-map.ts`, build a module-private map from current record slug to token and export:

```ts
export function getOutputToken(projectSlug: string): ArtifactTokenKind | undefined;
```

This is explicitly renderer compatibility, not entity metadata.

**Step 4: Add wrapping and focus styles**

Replace the label's single-line rule with bounded wrapping:

```css
.graph-node-label {
  max-width: 12rem;
  min-width: 7rem;
  white-space: normal;
  text-wrap: balance;
}

.graph-node-label strong,
.graph-node-label span {
  display: block;
}

.graph-node-label-role {
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.graph-node-label:focus-visible {
  outline: 3px solid #76951a;
  outline-offset: 3px;
}
```

Retain or increase the output token's current scale and position its label below the token. Do not add visual fields to `PortfolioEntity` or `TripletStep`.

**Step 5: Verify and commit**

Run:

```bash
npx vitest run components/scene/GraphNodeLabel.test.tsx lib/spatial-graph.test.ts
npx tsc --noEmit
npm run lint
```

Expected: PASS.

```bash
git add components/scene/GraphNodeLabel.tsx components/scene/GraphNodeLabel.test.tsx components/scene/OutputToken.tsx components/scene/output-token-map.ts app/globals.css
git diff --cached --check
git commit -m "feat: improve spatial graph legibility"
```

---

### Task 5: Group entities in the drawer and keyboard path

**Files:**

- Delete: `components/scene/ArtifactToken.tsx`
- Modify: `components/scene/GraphNode.tsx`
- Modify: `components/scene/BrainGraph.tsx`
- Modify: `components/scene/Cable.tsx`
- Modify: `components/scene/PortfolioCanvas.tsx`
- Modify: `components/NodeDrawer.tsx`
- Modify: `components/NodeDrawer.test.tsx`
- Modify: `components/KeyboardNavigator.tsx`
- Modify: `components/KeyboardNavigator.test.tsx`
- Modify: `components/PortfolioExperience.tsx`
- Modify: `lib/node-interaction.ts`
- Modify: `lib/node-interaction.test.ts`
- Modify: `lib/portfolio.ts`

**Step 1: Rewrite component tests around supplied projection data**

Create an approach-node fixture with two `entityIds`, supply matching entities, and assert the drawer renders:

- eyebrow `Approach`;
- position `2 of 3 in this projection`;
- the step framing title and detail;
- headings and summaries for both underlying entities;
- one canonical `View case study` link.

Keep the close-and-focus-restoration test.

For `KeyboardNavigator`, pass a four-node fixture containing root, instinct, approach, and output. Focus the trigger, move next, and assert the selected node is approach; move previous and assert instinct. Derive the displayed total from the supplied actionable array. Also render only the root and assert the control disables instead of implying that navigation is available.

Rewrite interaction tests with a root fixture and all three step roles. Root returns `none`; each step with project context returns `inspect`. Add a corrupt step lacking `projectId`/`href` and assert `none`, proving an inert node cannot advertise interaction.

**Step 2: Confirm component tests fail against old props**

Run:

```bash
npx vitest run components/NodeDrawer.test.tsx components/KeyboardNavigator.test.tsx lib/node-interaction.test.ts
```

Expected: FAIL because components still consume the legacy graph type and module-global nodes.

**Step 3: Implement grouped drawer content**

Change `NodeDrawer` props to:

```ts
type NodeDrawerProps = {
  node: SpatialGraphNode;
  entities: readonly PortfolioEntity[];
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};
```

Return `null` for root. Use a role record only for display labels and ordinal text:

```ts
const roleDetails = {
  instinct: { label: "Instinct", position: "1 of 3" },
  approach: { label: "Approach", position: "2 of 3" },
  output: { label: "Output", position: "3 of 3" },
} as const;
```

Render all supplied entities in node `entityIds` order. Render entity links only when present; do not infer evidence claims from facet names.

Render the node's canonical `View case study` link once. When an entity link has the same href, omit that duplicate from the entity section; preserve any distinct entity links.

**Step 4: Make keyboard navigation data-driven**

Add `nodes: readonly SpatialGraphNode[]` to `KeyboardNavigator`. Filter locally with `nodeAction(node) === "inspect"`. Replace model/system/artifact display labels with role labels. Keep arrows, Enter, Escape, focus return, and selection behavior. Disable the trigger when no actionable nodes exist.

In `PortfolioExperience`, import `portfolioNodes`, `SpatialGraphNode`, and `getEntity` from their owning modules. Store `SpatialGraphNode | null`. For a selected step, resolve its `entityIds` in order with `getEntity`; pass them to `NodeDrawer`. Pass the same `portfolioNodes` to `PortfolioCanvas` and `KeyboardNavigator` so mouse and keyboard cannot silently diverge.

Revise visible copy to `Follow a cable from instinct through approach to output.` and the legend to `Instinct`, `Approach`, `Output`. Leave the existing `All work` label unchanged because Workspace 2 owns that naming decision.

**Step 5: Migrate scene rendering and interaction atomically**

Update `node-interaction.ts` to accept `SpatialGraphNode` and return `inspect` only when `role !== "root"`, `projectId` exists, and `href` exists.

Update `GraphNode`, `BrainGraph`, `CableNetwork`, and `PortfolioCanvas` imports and callbacks to `SpatialGraphNode`. Replace kind checks with role checks. Use renderer colors keyed by `root`, `instinct`, `approach`, and `output`. An output node uses `OutputToken` only when `getOutputToken(node.projectSlug)` resolves; otherwise it renders a larger fallback sphere so output remains visually dominant for future records.

Only attach mesh pointer handlers and pointer cursor changes when `nodeAction(node) === "inspect"`. Continue stopping propagation before selection. `GraphNodeLabel` receives that same boolean, keeping visible affordance and behavior synchronized.

Make `nodes: readonly SpatialGraphNode[]` a required `PortfolioCanvas` prop and pass it through `BrainGraph` and `CableNetwork`. Keep domain camera focus and display labels renderer-owned through the existing `domains` configuration. Remove `ArtifactToken.tsx` after all imports use `OutputToken`.

Finally remove `PortfolioNode`, `domainOrder`, `domainCounts`, `layerRadius`, `chainNodes`, and legacy `portfolioNodes` from `lib/portfolio.ts`. Keep `ArtifactRecord`, `artifacts`, `artifactSlugs`, `getArtifact`, domain display metadata, timeline, and case-study strings for transitional consumers.

**Step 6: Verify and commit**

Run:

```bash
npx vitest run components/NodeDrawer.test.tsx components/KeyboardNavigator.test.tsx components/scene/GraphNodeLabel.test.tsx lib/keyboard-navigation.test.ts lib/node-interaction.test.ts lib/spatial-graph.test.ts lib/reachability.test.ts
npx tsc --noEmit
npm run lint
```

Expected: PASS.

```bash
git add components/scene/ArtifactToken.tsx components/scene/GraphNode.tsx components/scene/BrainGraph.tsx components/scene/Cable.tsx components/scene/PortfolioCanvas.tsx components/NodeDrawer.tsx components/NodeDrawer.test.tsx components/KeyboardNavigator.tsx components/KeyboardNavigator.test.tsx components/PortfolioExperience.tsx lib/node-interaction.ts lib/node-interaction.test.ts lib/portfolio.ts
git diff --cached --check
git commit -m "feat: expose grouped projection steps"
```

---

### Task 6: Prove compatibility, rendered routes, and final graph quality

**Files:**

- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/rendered-routes.test.mjs`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-23-portfolio-stage-graph-model-design.md`

**Step 1: Replace fixed rendered-chain assertions**

Keep the current `/work/:slug` and five-section case-study assertions as compatibility coverage, but derive routes from the rendered index rather than embedding today's list. Inside one test, render `/work`, collect unique matches with `/href=["']\/work\/([^"'#?]+)["']/g`, assert at least one project route exists, and render each collected route. For every response, assert status 200, canonical case-study landmarks, and the existing five legacy section IDs. This proves all index links resolve while leaving project count and slugs data-driven.

In `tests/rendered-html.test.mjs`, update the `/?view=graph` test to assert the new legend language and the accessible keyboard entry control. Do not expect WebGL canvas labels in server-rendered HTML; their DOM behavior is covered by `GraphNodeLabel.test.tsx`.

**Step 2: Run the complete verification ladder**

Run from a clean process state:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:rendered
git diff --check origin/main...
```

Expected: every command exits 0. Record the final test count as an observation in the PR, not an invariant in code.

**Step 3: Run the allocated-port preview**

Start:

```bash
npm run dev -- --port "$CONDUCTOR_PORT"
```

Using the Conductor preview, verify at desktop and narrow mobile widths:

- all labels are visible without hover and long titles wrap;
- output tokens remain more visually prominent than instinct and approach nodes;
- every pointer cursor, hover response, and label button opens the grouped drawer;
- the center brain has no click or hover cue;
- keyboard traversal reaches every actionable node, shows focus, opens the canonical project page, and returns focus after Escape/close;
- overview and each domain focus remain navigable;
- reduced motion and WebGL fallback still expose project navigation outside the canvas;
- cables preserve `brain -> instinct -> approach -> output`, with outputs terminal.

If preview browser control remains unavailable, mark this walk `NOT VERIFIED` in the PR with the exact reason; automated proof may land, but final visual acceptance remains a user review item.

**Step 4: Update owning documentation**

Update `README.md` to name `lib/portfolio-model.ts`, `lib/portfolio-adapter.ts`, and `lib/spatial-graph.ts`, identify `ArtifactRecord[]` as temporary input compatibility, and state that the approved projection is stage-specific.

Append a short implementation record to the design spec containing the actual validation/build results and any visual-walk limitation. Do not broaden the approved contract based on implementation convenience.

**Step 5: Review the final branch and commit**

Run:

```bash
git status --short
git diff --stat origin/main...
git diff --check origin/main...
git log --oneline origin/main..HEAD
```

Inspect every changed path and confirm no unrelated user work is staged.

```bash
git add tests/rendered-html.test.mjs tests/rendered-routes.test.mjs README.md docs/superpowers/specs/2026-08-23-portfolio-stage-graph-model-design.md
git diff --cached --check
git commit -m "docs: record stage graph verification"
```

After this commit, rerun the full verification ladder because the branch artifact changed. Publish the branch, then open a pull request against `main`. Do not merge or supply Bradley's independent review.
