# PortfolioNodeMark

Source: [`components/PortfolioNodeMark.tsx`](../../components/PortfolioNodeMark.tsx) ·
Gallery: `/design#marks`

The shared Reading Room mark. It draws the primitives
[`lib/portfolio-node-mark.ts`](../../lib/portfolio-node-mark.ts) returns for a
family into an 18px SVG box with `stroke: currentColor`, round caps, and miter
joins. `identity` renders `.portfolio-node-brain`, a 15px mask of
`/biv-brain-symbol.svg` filled with `currentColor`. One 15-unit envelope and a
1.45 stroke govern the factual marks.

Two siblings share the module and the envelope. `PortfolioContactMark` is a
Contact row's mark, one of [`lib/portfolio-contact-mark.ts`](../../lib/portfolio-contact-mark.ts)'s
kinds in identity colour. `PortfolioControlMark` is a button with `data-control`
and a glyph from [`lib/portfolio-control-mark.ts`](../../lib/portfolio-control-mark.ts).
It accepts an optional caption and every other button prop. Map and Guide clip
the SVG brain pattern inside their supplied outlines. Guide uses a 1.15 outline;
other marks use 1.45.

## Props

`family` and `register` are required and come from
[`lib/portfolio-world.ts`](../../lib/portfolio-world.ts). Seven families, six
registers. Story stays a distinct register but resolves to the Arc red pair.

## Requires

An ancestor defining the `--world-*` properties, normally
`.portfolio-composition`. The mark is `aria-hidden`; its wrapper carries the label.

## Example

```tsx
import { PortfolioControlMark, PortfolioNodeMark } from "components/PortfolioNodeMark";

export function PortfolioNodeMarkExample() {
  // The mark takes its shape from `family` and its color from `register`,
  // and must sit inside a `.portfolio-composition` for `--world-*` to resolve.
  // Patterned Map and Guide controls use the same SVG brain asset as identity.
  // The accessible names come from `aria-label`.
  return (
    <div className="portfolio-composition">
      <PortfolioNodeMark family="identity" register="identity" />
      <PortfolioControlMark aria-label="Show portfolio map" kind="map" label="Map" />
      <PortfolioControlMark aria-label="Open the Guide" kind="chat" label="Guide" />
    </div>
  );
}
```

## Pitfalls

- **Outside `.portfolio-composition` it renders in inherited text colour.**
- **The geometry constant is 15, the box is 18.**
  `PORTFOLIO_NODE_MARK_SIZE = 15` sets the viewBox extent
  (`15 × 0.6 × 2 = 18` units) inside an 18px element, with `overflow: visible`.
  A new family authored at 18 draws 20% oversized.
- **This is the one composition component with no `"use client"`**, because it
  has no state. Keep it that way.
- **A control mark needs its own `aria-label`.** The glyph is `aria-hidden`,
  and the caption is optional.
- **Map and Guide need `/biv-brain-symbol.svg`.** Without it, only the outline renders.
