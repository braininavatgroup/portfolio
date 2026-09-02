# PortfolioWorld

Source: [`components/PortfolioWorld.tsx`](../../components/PortfolioWorld.tsx) ·
Gallery: `/design#world` · Tests: `components/PortfolioWorld.test.tsx`

The spatial map. One 2D `<canvas>` — not Three.js — paints the rules, labels
and marks under a hand-rolled projection, with every node also a real
`<button>` positioned over it so the map stays keyboard-reachable. Selecting a
node or thread recomposes the field and eases the camera. Colours are read off
the enclosing `.portfolio-composition` with `getComputedStyle` (`cssColor`), so
the canvas follows light, dark and `[data-theme]` without a second palette.

## Props

`activeThreadId`, `selectedId`, `onReset`, `onSelect` required; `activeVisual`,
`onCloseVisual`, `registerAvatarStage` optional — see
[`PortfolioWorldProps`](../../components/PortfolioWorld.tsx). It also exports
the pure `connectorSegment` helper; projection helpers live in
[`lib/portfolio-world-projection.ts`](../../lib/portfolio-world-projection.ts).

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
  `position: fixed; inset: 0 var(--reader-width) 0 0`. It only shrinks to a box
  when an ancestor establishes a containing block — which is what
  `.design-stage`'s `transform` does in the gallery.
- **`activeVisual` disables every node button**, and `.portfolio-visual-open`
  belongs on the composition root — the component does not add it.
- **A dragged node persists as `userPlaced` only at rest**, with no selection
  and no active thread.
- **Canvas type and size are code-side.** `FONT` paints 12.5px record labels;
  `BRADLEY_FONT` paints Bradley at 14px medium, with his PNG at 21px rather
  than the factual marks' `PORTFOLIO_NODE_MARK_SIZE` (15px).
- **Past changes opacity, not color.** `PAST_WORLD_ALPHA` applies to the canvas
  mark and label in both modes. The node keeps its native register token, and
  the reader index remains full strength.
