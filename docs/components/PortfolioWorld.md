# PortfolioWorld

Source: [`components/PortfolioWorld.tsx`](../../components/PortfolioWorld.tsx) ·
Gallery: `/design#world` · Tests: `components/PortfolioWorld.test.tsx`

The spatial map. A single 2D `<canvas>` — **not** Three.js — paints the
Silverpoint rules, the labels, and the register marks under a shallow hand-
rolled projection, while every node is also a real `<button>` positioned over
the canvas so the map stays keyboard-reachable and screen-readable. Selecting
a node or a thread recomposes the field around it and eases the camera; blank
space is a reset target, not a pan surface (Rule 6.8). Node drags are
persisted as `userPlaced` only while nothing is selected. Colors are read from
the enclosing `.portfolio-composition` with `getComputedStyle` (`cssColor()`),
so the canvas follows light and dark without a second palette.

## Props

`activeThreadId`, `selectedId`, `onReset`, `onSelect` are required;
`activeVisual`, `onCloseVisual`, `registerAvatarStage` are optional. See
[`PortfolioWorldProps`](../../components/PortfolioWorld.tsx). The module also
exports the pure projection helpers `projectWorldPoint`,
`translateWorldPointByScreenDelta`, and `connectorSegment`.

## Requires

A `.portfolio-composition` ancestor (for `--world-*`, `--ink`, `--map-*`) and a
sized parent — the live page uses `.scene-shell` and reserves the dossier width
through `--reader-width`. It renders eagerly and needs no lazy boundary.

## Example

Import: `import { PortfolioWorld } from "./PortfolioWorld";`

```tsx
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

- **Escape is not handled here.** Blank-space click calls `onReset`; the
  Escape-to-overview binding lives in `PortfolioExperience`. A standalone host
  that wants it must add it.
- **A zero-height parent renders an empty map.** The canvas is sized from a
  `ResizeObserver` on the section; nothing draws until the box has area.
- **`activeVisual` disables every node button** while the visual stage is open,
  and `.portfolio-visual-open` belongs on the composition root — the component
  does not add it.
- **Give it a stable `--reader-width`.** The layout reserves that width for the
  dossier; a gallery-style full-bleed stage must set it to `0px` explicitly.
- **The label font is a code-side constant** (`FONT`, `400 12.5px "NHG
  portfolio"…`), not a token. If the type scale changes, this string has to
  change with it.
- **Hex literals in this file are `getComputedStyle` fallbacks only** (Rule
  1.4). Do not add new code-side colors.
