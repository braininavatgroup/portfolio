# PortfolioWorld

Source: [`components/PortfolioWorld.tsx`](../../components/PortfolioWorld.tsx) · Gallery: `/design#world` · Tests: `components/PortfolioWorld.test.tsx`

The spatial map. One 2D `<canvas>` paints the marks, labels, and relationships,
with a real `<button>` over every node. Selection recomposes one fixed camera:
Bradley, the spotlit node, its zoned relations, and the dispersed field. Canvas
colours resolve from the enclosing `.portfolio-composition`.

## Props

`activeThreadId`, `selectedId`, `onReset`, and `onSelect` are required. `compact`
keeps the priority labels visible; `nodesInTabOrder={false}` routes keyboard
navigation through Contents. Avatar-stage and Brain Food props are optional.
See `PortfolioWorldProps`;
helpers live in `lib/portfolio-world-*`, `portfolio-story-tree.ts`, and
`portfolio-node-envelope.ts`.

## Requires

A `.portfolio-composition` ancestor for the `--world-*`, `--ink`, and `--map-*` tokens; no lazy boundary.

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
          compact
          nodesInTabOrder={false}
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

- **Escape is not handled here.** Blank-space click (under 7px) calls `onReset`.
- **It fills its positioned slot.** Give the slot `position: relative`;
  `ResizeObserver` owns sizing. `compact` is explicit: the owner passes it, and
  compact labels sit right of nodes in the left 30 percent, else left.
- **Brain Food disables node buttons and hides connectors.** Outside that
  mode, every map node remains available; portfolio media never mounts here.
- **Default overview is the connected spatial graph.** Seeded candidate seats fill the measured canvas at every aspect ratio and use the selected-map overlap solver. Authored positions supply a loose positional preference rather than fixed wide-screen geometry. Every factual and Theme-membership relationship remains visible at rest, with thinner, quieter strokes than selected-map connections. Labels sit beneath their marks, bounded to two lines; narrow slots abbreviate long labels while their buttons retain full names. `lib/portfolio-overview-layout.ts` clips straight overview connectors two pixels clear of each label line, with a seven-pixel fade at clipped ends.
- **A dragged node springs back.** Nothing persists, and a drag never selects.
- **Poses are seeded per page load** (`setWorldSeed`; `?seed=<n>` pins it);
  tests assert rules, not coordinates. The overview derives its seats from the measured slot; selected poses retain their seeded spatial layout.
- **The field seats after the lit nodes settle**, outside the overlap solver;
  pass every drawn lit line to `fieldGoals`. A lower relation is valid, but no
  line crosses a label: selected-label rays clear first, then related nodes
  nudge sideways away from non-incident lit lines.
- **Canvas type and size are code-side.** Labels are 12.5px, Bradley 14px with
  his enlarged-crop circle at the authored 21px scale with the shared 0.9 artwork reduction. The canvas and DOM share `/glyph-textures/circle.svg`; canvas sizing accounts for its transparent inset. Widths cache per wrap; never measure in the frame.
- **Past changes opacity, not color** (`PAST_WORLD_ALPHA`); the register stays.
