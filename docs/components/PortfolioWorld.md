# PortfolioWorld

Source: [`components/PortfolioWorld.tsx`](../../components/PortfolioWorld.tsx) ·
Gallery: `/design#world` · Tests: `components/PortfolioWorld.test.tsx`

The spatial map. One 2D `<canvas>` — not Three.js — paints the rules, labels
and marks under a hand-rolled projection, with every node also a real
`<button>` over it so the map stays keyboard-reachable. Selecting a node or
thread recomposes the map under one fixed camera: the spotlit node hangs
beneath Bradley, relations land in zones, the rest disperses into the field
behind (design-conventions §6.12). Colours come from the enclosing
`.portfolio-composition` via `getComputedStyle`, so dark and `[data-theme]` work.

## Props

`activeThreadId`, `selectedId`, `onReset`, `onSelect` required; `activeVisual`,
`onCloseVisual`, `registerAvatarStage` optional — see `PortfolioWorldProps`.
Pure helpers: `connectorSegment`, `composeSpotlightGoals`; the rules live in
`lib/portfolio-world-{zones,field,projection}.ts`, `portfolio-story-tree.ts`,
and `portfolio-node-envelope.ts`.

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
- **Only `activeVisual` disables node buttons**; the dimmed field stays
  clickable. `.portfolio-visual-open` belongs on the composition root.
- **A dragged node springs back.** Nothing persists, and a drag never selects.
- **Poses are seeded per page load** (`setWorldSeed`; `?seed=<n>` pins it in
  dev). Tests pass `stillRng` or `createRng` and assert rules, not coordinates.
- **The field seats after the lit nodes settle**, outside the overlap solver.
  Pass every drawn lit line to `fieldGoals` or the field may sit on it.
- **Canvas type and size are code-side.** `FONT` paints 12.5px record labels;
  `BRADLEY_FONT` paints Bradley at 14px medium with his PNG at 21px. Label
  widths are cached per wrap; do not measure in the frame.
- **Past changes opacity, not color** (`PAST_WORLD_ALPHA`); the register stays.
