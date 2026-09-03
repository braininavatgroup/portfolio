# PortfolioWorld

Source: [`components/PortfolioWorld.tsx`](../../components/PortfolioWorld.tsx) ·
Gallery: `/design#world` · Tests: `components/PortfolioWorld.test.tsx`

The spatial map. One 2D `<canvas>` paints the marks, labels, and relationships,
with a real `<button>` over every node. Selection recomposes one fixed camera:
Bradley, the spotlit node, its zoned relations, and the dispersed field. Canvas
colours resolve from the enclosing `.portfolio-composition`.

## Props

`activeThreadId`, `selectedId`, `onReset`, and `onSelect` are required.
`compact` keeps Bradley, all Stories, the selected node, and the hovered node
labeled. `nodesInTabOrder={false}` keeps buttons pointer-operable while routing
keyboard navigation through Contents. `activeVisual`, `onCloseVisual`,
`registerAvatarStage`, and `brainFood` are optional. See `PortfolioWorldProps`.
Pure helpers are `connectorSegment` and `composeSpotlightGoals`; the placement
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

- **Escape is not handled here.** Blank-space click calls `onReset` (under a
  7px movement threshold); the Escape binding lives in `PortfolioExperience`.
- **It sizes itself from its own slot.** Give the containing slot a definite
  size. `ResizeObserver` owns sizing; viewport resize is only the fallback.
- **Compactness is explicit.** A narrow slot does not infer `compact`; its
  owner passes the flag. Labels on nodes left of 30 percent of the slot sit to
  the right, and all other compact labels sit to the left.
- **`activeVisual` and Brain Food disable node buttons.** Every other node,
  including the dimmed field, stays clickable. Brain Food hides connectors;
  `.portfolio-visual-open` belongs on the composition root.
- **A dragged node springs back.** Nothing persists, and a drag never selects.
- **Poses are seeded per page load** (`setWorldSeed`; `?seed=<n>` pins it in
  dev). Tests pass `stillRng` or `createRng` and assert rules, not coordinates.
- **The field seats after the lit nodes settle**, outside the overlap solver.
  Pass every drawn lit line to `fieldGoals` or the field may sit on it.
- **Canvas type and size are code-side.** Labels are 12.5px, Bradley is 14px,
  and his SVG brain paints at 21px. Widths cache per wrap.
- **Past changes opacity, not color** (`PAST_WORLD_ALPHA`); the register stays.
