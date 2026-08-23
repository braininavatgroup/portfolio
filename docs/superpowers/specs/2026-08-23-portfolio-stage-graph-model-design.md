# Portfolio stage graph model design

**Status:** Approved stage design. This model replaces the current prototype assumptions, but it is not the permanent portfolio content contract.

**Date:** 2026-08-23

## Purpose

The portfolio needs a graph that is readable now and a content model that can change as the work becomes better understood. The current records bind each project to five fixed case-study sections and derive three spatial nodes from that sequence. That arrangement made the prototype possible, but it treats today's labels and chain length as permanent facts.

This stage introduces entities, relations, and ordered projections. It makes one projection shape explicit:

```text
main brain -> instinct -> approach -> output
```

That order is canonical for this projection only. Future projection shapes may use different roles, lengths, branching rules, and visual treatments.

## Kickoff baseline

The baseline was measured from the current data rather than copied into a new requirement:

- 9 project records
- 28 spatial nodes
- 27 actionable labels
- 9 model nodes, 9 system nodes, and 9 artifact nodes
- 35 characters in the longest actionable label
- 41 passing unit and component tests across 11 test files

The current spatial renderer always displays actionable labels. It renders labels at `0.62rem` on one line, which makes long model and system labels hard to read. Output tokens are already visually stronger than the other nodes. Every non-center node opens the detail drawer. The center brain is inert and does not display pointer or click cues.

These measurements describe the starting point. Tests must not preserve the counts, labels, or equal distribution.

## Design principles

1. Separate content from the story a UI tells with that content.
2. Let one visible step group several entities.
3. Keep the current triplet sequence explicit without turning it into a universal schema.
4. Store descriptive metadata without choosing a permanent entity taxonomy.
5. Keep visual encoding in the renderer until repeated designs justify shared visual fields.
6. Validate only failures that can corrupt references or make the stage projection unusable.
7. Preserve working routes and interactions while the UI moves to the new model.

## Alternatives considered

The current fixed chain is easy to render, but it makes judgment, model, system, artifact, and operation mandatory sections for every project. Making those sections optional or repeatable would loosen the rule without addressing the deeper problem: the content and its presentation would still be the same structure.

A fully general graph of typed entities and relations would preserve more possible stories. It would also require a permanent entity vocabulary, more authoring decisions, and a renderer capable of making arbitrary graphs legible. None of those choices has enough evidence yet.

The chosen stage model keeps entities and relations independent while defining one projection that the current portfolio can test. It creates room for later models without asking this implementation to predict them.

## Stage model

### Portfolio data

The top-level data set contains projects, entities, relations, and projections. Its version identifies this stage model. A later model may migrate the data without pretending to remain structurally identical.

```ts
type PortfolioStageData = {
  version: "stage-graph-1";
  projects: ProjectRecord[];
  entities: PortfolioEntity[];
  relations: EntityRelation[];
  projections: PortfolioProjection[];
};
```

### Projects

A project is the routing and editorial boundary for a case study. It is not an entity kind.

```ts
type ProjectRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  entityIds: string[];
  facets?: Record<string, readonly string[]>;
};
```

`facets` hold filterable, project-defined metadata. Initial data may include domain, maturity, medium, or evidence state, but the core model does not require those names.

### Entities

An entity is a piece of portfolio content that may appear in one or more projections.

```ts
type PortfolioEntity = {
  id: string;
  title: string;
  summary: string;
  detail?: string;
  facets?: Record<string, readonly string[]>;
  links?: EntityLink[];
};

type EntityLink = {
  label: string;
  href: string;
};
```

The stage model has no closed `kind` union. Facts such as app, report, workflow, decision, document, shipped, or partial may be expressed through facets when useful. Unknown facets remain intact so later filters can use them without changing the base interface.

### Relations

Relations connect entities independently of any one projection.

```ts
type EntityRelation = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  label?: string;
};
```

Relation types remain data-defined in this stage. Examples such as `informed`, `uses`, `produced`, or `supports` may appear in the initial content, but they are not a permanent closed list.

This separation also avoids forcing artifact and evidence into competing entity kinds. An output can support a claim through a relation. Supporting material can be represented as its own entity when it needs a title, links, or metadata.

### Projection shape

The current spatial and case-study views consume an explicit projection shape identified as `instinct-approach-output/v1`.

```ts
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

Every branch follows this visible sequence:

```text
projection root -> instinct step -> approach step -> output step
```

A step may group several entities. This is especially useful for approach, where a model, specification, process, and working system may all contribute to one legible node. The projection step owns its framing title and summary because the same entities may be framed differently in another projection.

`relationIds` select optional context links to display alongside the main branch. They do not alter the triplet's order. Cross-branch relations are allowed when the renderer can show them without obscuring the primary progression.

The type above deliberately describes one real shape rather than a generic projection language. When a second projection shape exists, its needs will determine whether the code introduces a union, registry, or different model.

## UI-independent interface

The data module will publish small pure functions before UI consumers migrate:

```ts
getProject(slug: string): ProjectRecord | undefined
getEntity(id: string): PortfolioEntity | undefined
getProjection(id: string): PortfolioProjection | undefined
getBranch(projectId: string, projectionId: string): TripletBranch | undefined
getBranchEntities(branch: TripletBranch): PortfolioEntity[]
```

These functions return content and projection data. They do not return Three.js positions, CSS classes, token geometry, routes, or click behavior.

## Spatial graph

The spatial renderer derives one visible node for each triplet step and one shared root node. It derives cables from the required sequence and may add selected relations as secondary cables.

Layout must depend on the number of branches and their ordered steps. It must not assume nine projects, three domains, or 27 actionable labels. The current radial composition may remain, but angle and spacing calculations must use the supplied projection.

For `instinct-approach-output/v1`, output is the terminal visible step. This is a property of this projection shape, not a claim that every portfolio story ends with an output or that outputs are always terminal entities.

## Legibility and interaction

The renderer will preserve the stronger output token treatment while making instinct and approach nodes readable without hover:

- Every actionable node keeps a persistent text label.
- Labels may wrap and must not rely on a single fixed character count.
- Role styling may distinguish instinct, approach, and output.
- Output tokens remain larger and more visually detailed than the other two roles during this stage.
- Hover and focus may strengthen an existing node but may not reveal its only readable label.
- Pointer and click cues appear only when the node produces a drawer, navigation, or another explicit result.
- The center brain remains visually inert unless a real interaction is added.

Selecting a grouped step opens one drawer for that projection step. The drawer presents the step's framing title and summary, then identifies the entities grouped beneath it. It does not pretend the group is a new canonical entity.

The renderer owns these choices. Entity records will not receive geometry, scale, color, or token fields in this stage. To preserve the current distinct output tokens, the renderer may use a temporary mapping keyed by projection branch or output step. That mapping is not part of the content interface.

## Case-study and index views

The case-study page uses the same branch as the spatial graph. It renders instinct, approach, and output in order, then expands the entities grouped under each step. This removes the fixed five-section requirement without replacing it with a free-form narrative field.

The flat work index remains project-based. It derives project routes from `ProjectRecord.slug` and may expose facets as filters later. Adding filter controls is outside this stage unless needed to keep the revised graph navigable.

## Validation and failure handling

The shared data validator checks only structural corruption:

- project, entity, relation, projection, and branch IDs are unique within their collections
- every referenced project, entity, and relation exists
- every triplet step contains at least one entity
- every branch step references entities assigned to that branch's project

The current projection receives focused product tests rather than universal schema rules:

- each branch has instinct, approach, and output in that order
- each visible branch is reachable from the projection root
- the output step is terminal in the primary branch
- each actionable node produces an inspect or navigation result
- every project and actionable node retains a reachable HTML route

Static data failures should fail tests and the build. The client renderer should not attempt to repair malformed content at runtime.

## Migration

Migration will be incremental and temporary:

1. Add the stage entities, relations, projection records, and pure lookup functions without changing UI imports.
2. Translate the current project content into entities and grouped triplet steps. Judgment, principle, and decision material inform instinct. Model, specification, and system material may share approach. Shipped or delivered material informs output.
3. Derive the current public project, route, and graph exports from the stage model while existing UI consumers migrate. These derived exports are transition code, not the new canonical interface.
4. Move the spatial graph, keyboard navigation, drawers, case-study pages, and flat index to projection and project selectors.
5. Remove the fixed `ChainLayer`, five-entry `chain()` helper, and legacy graph-node construction after all in-repository consumers use the stage model.

The migration must preserve current slugs and routes. It does not promise compatibility for the old five-section content shape after the migration finishes.

Mapping the existing prose into instinct, approach, and output is an editorial migration for these records. It is not an automatic rule that later importers or projection shapes must follow.

## Testing strategy

Implementation will follow test-first cycles for each durable behavior:

1. Model tests establish lookup behavior, grouping several entities in one step, reference validation, and support for unknown facets and relation types.
2. Migration tests prove that current project slugs and routes survive and that every current project appears in the triplet projection. Tests derive counts from the records instead of asserting today's node total.
3. Reachability tests prove the root-to-instinct-to-approach-to-output path and terminal output behavior for every branch.
4. Interaction tests prove that every node with interactive styling produces a drawer or navigation result and that inert decoration has no interactive styling.
5. Component tests prove persistent labels, role copy, keyboard traversal, drawer content for grouped entities, and working links.
6. Build and rendered-route tests prove the conventional HTML pages still work without WebGL.

Browser-controlled visual inspection is unavailable in the current session. Final acceptance therefore includes a Conductor preview walk at the allocated workspace port. The walk checks label wrapping, overlap at overview and domain focus, output prominence, focus indication, and whether secondary relation cables obscure the triplet.

## Deferred decisions

The following choices remain outside this stage by design:

- a permanent entity-kind taxonomy
- a permanent relation-type taxonomy
- a generic language for arbitrary projection shapes
- canonical node geometry, color, scale, token, or media fields
- whether later projections allow different role counts, repeated roles, branching steps, or cycles
- filter-control design beyond preserving filterable facets

These are recorded as deferred product decisions, not placeholders required to implement this stage.
