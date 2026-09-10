# Spatial self-portrait design

**Status:** Direction approved for a reversible visual mockup. Written review pending.

**Date:** 2026-08-24

## Decision

Remove the body-to-brain entrance from the main portfolio route. Open directly on the spatial graph and make its central brain node Bradley Berkman.

The root is no longer the abstract concept `Judgment`, and the graph is no longer a destination behind an introductory animation. It is a self-portrait: Bradley at the center, with each project extending through instinct, approach, and output.

On desktop, the spatial field and a compact index or project dossier remain visible together. On narrow screens, the graph remains present as a reduced field behind or above a docked dossier. The mockup does not inherit another portfolio's content taxonomy, copy, exact symbols, typeface, accent color, or card styling.

## Alternatives considered

### Immediate spatial self-portrait

This is the selected direction. It keeps the distinctive Three.js work, removes the delayed reveal, and lets a conventional index make the experimental map usable on first load.

### Preserve the body entrance

This would retain the current character and camera journey, then reveal the same graph-and-index composition. It was rejected for the first mockup because the entrance repeats the self-portrait idea before visitors can reach the work.

### Replace the scene with a flat network

This would most closely match the reference site's economy and reduce rendering cost. It was rejected because it would discard the portfolio's strongest original visual asset and pull the result too close to the reference.

## Initial composition

The shared header stays fixed at the top. The graph occupies the viewport beneath it.

The root brain is always visible and gains an HTML label with Bradley's name and the existing portfolio throughline. The root remains visually lime and distinct from instinct, approach, and output nodes. Activating the root restores the index state.

A compact dossier sits on the right at desktop widths. Its initial state contains:

- a short portfolio introduction using existing Bradley copy
- three domain accordions: Music promotion, Consulting, and Development
- the existing nine project titles and summaries
- a clear current-project or current-domain indication when the map is focused

The dossier uses Bradley's existing warm neutral, off-white, dark green, and lime palette. It may borrow the reference's density and object-like behavior, but not its exact dashed rules, geometric category marks, orange highlight, or typography.

## Project selection

Selecting an instinct, approach, or output node keeps the graph visible and changes the dossier from index mode to project mode. Project mode shows:

- a return-to-index control
- domain, project title, and existing summary
- Instinct, Approach, and Output accordions derived from the selected project's canonical branch
- the selected role expanded by default
- existing evidence status and supporting entities
- the canonical case-study link

The dossier represents the whole project even when a visitor selected one step. The selected step controls emphasis and the initially expanded accordion; it does not fragment the project into a separate page.

For the first mockup, Dubs is the representative project because its current data already contains a complete instinct, approach, and output branch. Missing proof remains labeled as missing. The mockup will not invent screenshots, releases, usage, or outcomes.

## Spatial response

The graph begins in its current overview arrangement without the `body` or `entering` phases. Nodes and cables may settle with a short entrance motion, but visitors can read and operate the index immediately.

Selecting a project emphasizes the root-to-selected-step path and frames that branch or domain without replacing the graph. Unrelated branches may dim, but the first mockup will avoid destructive filtering until the framing behavior has been walked in-browser.

The camera no longer travels through a glass head. Reduced-motion users receive the final graph framing immediately.

## Desktop evidence objects

Real project media may later appear as separate objects around the dossier. They can rise in stacking order on focus and expand into a gallery.

The first mockup does not render evidence objects because the portfolio dataset does not yet contain verified media assets. Textual evidence remains inside the dossier. This prevents empty placeholders from becoming a design dependency and avoids implying that unpublished proof exists.

## Narrow-screen behavior

At `760px` and below, keep the spatial field visible rather than hiding it by default. The dossier docks to the lower portion of the viewport and gets its own scroll region. Its collapsed or index state leaves enough graph visible to understand Bradley as the center of the system.

Opening project details may enlarge the dossier, but a visible control restores the map-forward state. The final height, camera crop, and gesture behavior belong to the visual walk because they depend on real labels, the browser viewport, and touch ergonomics.

## Interaction and accessibility

- The index and project sections use native buttons with `aria-expanded` and `aria-controls`.
- The dossier is a non-modal complementary region. It does not trap focus.
- The root brain has an accessible action that restores the index.
- Existing keyboard graph navigation remains available.
- Closing project mode returns focus to the control or node that opened it when possible.
- Map, Work, and canonical case-study routes remain real links.
- WebGL failure continues to leave HTML routes to every project.

## Component boundaries

`PortfolioExperience` owns the selected domain, selected node, and dossier mode. It starts in graph mode and no longer owns entry-transition timing.

`PortfolioDossier` is a new HTML component with two explicit states:

```ts
type PortfolioDossierState =
  | { mode: "index"; selectedDomain: DomainId | null }
  | { mode: "project"; projectSlug: string; selectedRole: TripletRole };
```

The component receives derived portfolio data and callbacks. It does not know about Three.js camera geometry.

A pure selector converts a spatial node into the canonical project, branch steps, entities, and evidence needed by project mode. Missing or stale references return no dossier record, and `PortfolioExperience` safely restores index mode.

`BrainGraph` and `GraphNode` render the Bradley root label and root action. Camera framing remains inside `PortfolioCanvas`. The existing `NodeDrawer` stays in the repository until the mockup proves the dossier replacement and all callers migrate.

## Verification

Durable behavior will be developed test-first. Focused tests will prove:

- the main route starts with the map and index available, with no entrance button or travel status
- the root entity is Bradley Berkman and restores index mode
- every listed project links to its canonical route
- selecting a project node derives the complete project dossier and opens the selected role
- missing project data falls back to the index instead of rendering a broken dossier
- accordions expose correct expanded state and accessible relationships
- keyboard navigation and WebGL-independent project reachability remain intact

The affected component suite, typecheck, lint, build, rendered-route tests, and `git diff --check` must pass before each commit.

Visual acceptance requires fresh captures at desktop and an exact 390px emulated viewport. The walk will check first-load legibility, graph and dossier competition, root identity, Dubs selection, dossier scrolling, focus indication, reduced motion, and the amount of graph retained on mobile.

## First mockup boundary

The first implementation changes only the main spatial route and shared graph behavior. It does not redesign the `/work` index or case-study routes, add media, activate portfolio chat, deploy, publish, or change production configuration.

If the graph-and-dossier composition survives the visual walk, the next design slice can bring the Work index and case studies into the same object language without forcing their longer narratives into the compact dossier.
