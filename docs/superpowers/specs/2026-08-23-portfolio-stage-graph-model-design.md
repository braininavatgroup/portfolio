# Portfolio stage graph model design

**Status:** Approved for this stage, not the permanent portfolio contract.

**Date:** 2026-08-23

## Decision

Replace the prototype's fixed five-section records with entities, relations, and one ordered projection shape:

```text
main brain -> instinct -> approach -> output
```

Each project contributes one branch. The role order is canonical only for `instinct-approach-output/v1`. A visible step may group several entities, and optional relations may connect steps or branches without changing the main sequence.

This strikes the useful middle ground. Making the old chain optional would still bind content to presentation. A fully general graph would force permanent entity and relation taxonomies before the portfolio has earned them.

## Baseline

The current data contains 9 projects, 28 spatial nodes, and 27 actionable labels, split evenly across model, system, and artifact. The longest label has 35 characters. All 41 unit and component tests pass.

Labels remain visible but render at `0.62rem` on one line. Output tokens already dominate visually. Every non-center node opens details; the center brain is inert. These are measurements, not counts or labels to preserve in tests.

## Stage model

```ts
type PortfolioStageData = {
  version: "stage-graph-1";
  projects: ProjectRecord[];
  entities: PortfolioEntity[];
  relations: EntityRelation[];
  projections: PortfolioProjection[];
};

type ProjectRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  entityIds: string[];
  facets?: Record<string, readonly string[]>;
};

type PortfolioEntity = {
  id: string;
  title: string;
  summary: string;
  detail?: string;
  facets?: Record<string, readonly string[]>;
  links?: { label: string; href: string }[];
};

type EntityRelation = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  label?: string;
};

type TripletRole = "instinct" | "approach" | "output";

type TripletStep = {
  role: TripletRole;
  title: string;
  summary: string;
  entityIds: [string, ...string[]];
};

type TripletBranch = {
  id: string;
  projectId: string;
  steps: [
    TripletStep & { role: "instinct" },
    TripletStep & { role: "approach" },
    TripletStep & { role: "output" },
  ];
  relationIds?: string[];
};

type PortfolioProjection = {
  id: string;
  shape: "instinct-approach-output/v1";
  title: string;
  rootEntityId: string;
  branches: TripletBranch[];
  relationIds?: string[];
};
```

A project is a routing and editorial boundary, not an entity kind. Entities contain reusable content. Their open `facets` support later filters such as domain, maturity, medium, or evidence state without fixing those names in the interface. Unknown facets remain intact.

Entity and relation types remain data-defined. An output can support a claim through a relation, and supporting material can become its own entity when it needs content or links. The model does not force artifact and evidence into competing kinds.

A projection step owns its framing title and summary. The same entity may appear in another projection with a different role or framing. The first implementation describes one real projection shape instead of inventing a generic projection language.

## Public interface

The data module publishes pure lookups before UI migration:

```ts
getProject(slug: string): ProjectRecord | undefined
getEntity(id: string): PortfolioEntity | undefined
getProjection(id: string): PortfolioProjection | undefined
getBranch(projectId: string, projectionId: string): TripletBranch | undefined
getBranchEntities(branch: TripletBranch): PortfolioEntity[]
```

These functions return content and projection data. They do not expose routes, click behavior, CSS, Three.js positions, or token geometry.

## UI behavior

The spatial graph derives one visible node per triplet step plus the shared root. Layout uses the supplied branches and steps rather than fixed project, domain, or node counts. Output is terminal only for this projection shape.

The renderer keeps visual choices outside entity records:

- persistent, wrapping labels that stay readable without hover
- role styling for instinct, approach, and output
- larger, more detailed output tokens during this stage
- interactive styling only when a node opens details or navigates
- an inert center brain until it receives a real action

Selecting a grouped step opens one drawer with the step framing and its underlying entities. A temporary renderer-owned mapping may preserve today's distinct output tokens. It is not part of the content interface.

The graph, drawer, and keyboard navigator use the instinct, approach, and output projection in this stage. The case-study page and flat index intentionally remain compatibility consumers of `ArtifactRecord`. Case studies still render the legacy Judgment, Spec or model, System, Artifact, and Other minds sections. A separate case-study workspace owns their migration to stage-model selectors. Filter controls are deferred unless the revised graph needs them for navigation.

## Validation and failure handling

Shared validation checks only structural corruption:

- unique IDs within each collection
- valid project, entity, and relation references
- at least one entity per triplet step
- branch entities assigned to that branch's project

Focused tests enforce current product behavior:

- every branch follows root, instinct, approach, output
- every visible branch is reachable and its output is terminal
- every interactively styled node produces a result
- every project and actionable node retains an HTML route

Static data failures fail tests and the build. The client does not repair malformed content.

## Migration

1. Add stage records and pure lookups without changing UI imports.
2. Editorially map existing content into grouped triplet steps. Judgment, principle, and decision may inform instinct. Model, specification, and system may share approach. Shipped or delivered material may inform output.
3. Temporarily adapt the current `ArtifactRecord[]` input into the stage model while case-study and index consumers remain on their compatibility path.
4. Move the graph, keyboard navigation, and drawers to the new selectors.
5. In the separate case-study workspace, migrate case studies and the index to stage-model selectors without changing current routes or presentation prematurely.
6. After those consumers migrate, remove `ChainLayer`, the five-entry `chain()` helper, legacy graph construction, and transitional exports.

Current slugs and routes remain stable. The five-section shape is the current compatibility contract and becomes unsupported only after its consumers migrate and transitional exports are removed. The editorial mapping above is not an automatic rule for later records or projection shapes.

## Verification

Test-first implementation covers model lookups, grouped entities, open facets and relation types, structural validation, route preservation, projection reachability, interactions, persistent labels, keyboard traversal, grouped drawer content, builds, and rendered HTML routes without WebGL. Tests derive counts from data instead of freezing today's totals.

Final acceptance includes a Conductor preview walk at the allocated port. Check label wrapping and overlap in overview and domain focus, output prominence, focus indication, and whether secondary relations obscure the triplet.

## Implementation record

Implementation reached the automated verification boundary on 2026-08-23. Fresh post-fix verification recorded `npm test` passing 72 tests in 16 files. `npm run lint` and `npx tsc --noEmit` exited cleanly. `npm run build` completed all five vinext build stages. `npm run test:rendered` rebuilt the application and passed 3 top-level tests, including data-driven traversal and project-title identity checks for every route found in the rendered `/work` index. `git diff --check` also exited cleanly.

The build emitted vinext's route-classification notice for `/`, `/work`, and `/work/:slug`; it did not report a build error. The interactive Conductor preview walk is still pending main-agent verification. Automated results do not establish label wrapping, output prominence, pointer cues, keyboard focus behavior in a browser, camera navigation, reduced-motion behavior, WebGL fallback, or final cable legibility.

The first user preview found excessive clustering and text prominence. The follow-up bounds-fit and unboxed-label correction is present in the implementation. Narrow-phone review and final visual acceptance remain for the user's eye; this record does not claim that visual walk is complete.

## Deferred

- permanent entity and relation taxonomies
- a generic language for other projection shapes
- canonical node geometry, color, scale, tokens, or media
- rules for future role counts, repeated roles, branches, or cycles
- filter UI beyond preserving filterable facets

These are deferred product choices, not gaps in this stage.
