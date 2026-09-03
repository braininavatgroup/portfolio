# PortfolioWorld

Source: [`components/PortfolioWorld.tsx`](../../components/PortfolioWorld.tsx) · Gallery: `/design#world` · Tests: `components/PortfolioWorld.test.tsx`

The spatial map. One 2D `<canvas>` — not Three.js — paints the rules, labels and
marks under a hand-rolled projection, with real `<button>` nodes for keyboard access.
Selection recomposes one fixed camera: the spotlight hangs beneath Bradley,
relations land in zones, and the rest disperses into the field (§6.12). Colours come from `.portfolio-composition` through `getComputedStyle`.

## Props

`activeThreadId`, `selectedId`, `onReset`, `onSelect` required; `activeVisual`, `activeVisualFrame`, `onCloseVisual`, `registerAvatarStage`, `brainFood` optional.
Pure helpers: `connectorSegment`, `composeSpotlightGoals`, `clearSpotlightLabelRays`;
rules live in `lib/portfolio-world-{zones,field,projection}.ts`,
`portfolio-story-tree.ts`, and `portfolio-node-envelope.ts`.

## Requires

A `.portfolio-composition` ancestor, for `--world-*`, `--ink`, `--map-*` and
`--map-connector`. It renders eagerly and needs no lazy boundary.

## Example

```tsx
import { PortfolioWorld } from "components/PortfolioWorld";
import { useState } from "react";

export function PortfolioWorldExample() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="portfolio-composition">
      <section className="scene-shell">
        <PortfolioWorld
          activeThreadId={null}
          onReset={() => setSelectedId(null)}
          onSelect={(node) => setSelectedId(node.id)}
          selectedId={selectedId}
        />
      </section>
    </div>
  );
}
```

## Pitfalls

- **Escape is not handled here.** Blank-space click calls `onReset` (under a
  7px movement threshold); the Escape binding lives in `PortfolioExperience`.
- **It sizes itself from the viewport, not its parent.** `.portfolio-world` is
  `position: fixed`; it shrinks to a box only inside a containing block.
- **`activeVisual` and Brain Food disable node buttons**; otherwise dimmed nodes stay clickable. Brain Food hides links. An active visual hides map geometry and shows one complete asset at a time, with an unlabeled close mark in the stage's top-right safe area and unlabeled gallery arrows whose tips align to the visible asset edges below, inside any transparent export gutter. `activeVisualFrame` chooses the opening asset.
- **A dragged node springs back.** Nothing persists, and a drag never selects.
- **Poses are seeded per page load** (`setWorldSeed`; `?seed=<n>` pins it in
  dev). Tests pass `stillRng` or `createRng` and assert rules, not coordinates.
- **The field seats after the lit nodes settle**, outside the overlap solver.
  Pass every drawn lit line to `fieldGoals` or the field may sit on it.
- **A lower relation is valid; a line through any label is not.** The stable composition clears selected-label rays, then nudges related nodes sideways when their labels approach a non-incident lit line. Bradley's trunk and its strongest branch share one rounded canvas path so their elbow stays clean.
- **Canvas type and size are code-side.** `FONT` paints 12.5px record labels;
  `BRADLEY_FONT` paints Bradley at 14px medium with his PNG at 21px. Label
  widths are cached per wrap; do not measure in the frame.
- **Past changes opacity, not color** (`PAST_WORLD_ALPHA`); the register stays.
