# PortfolioNodeMark

Source: [`components/PortfolioNodeMark.tsx`](../../components/PortfolioNodeMark.tsx) ·
Gallery: `/design#marks`

The one register mark. It draws the primitives
[`lib/portfolio-node-mark.ts`](../../lib/portfolio-node-mark.ts) returns for a
family into an 18px SVG box with `stroke: currentColor`, carrying `data-family`
and `data-register`. `identity` renders `.portfolio-node-brain`, a 15px mask
of `/biv-brain-symbol.png` filled with `currentColor`. One envelope, one
stroke weight; the register alone varies (Rule 6.4). `PortfolioWorld` alone paints the Bradley root with the same PNG at 21px.

Two siblings share the module and the envelope. `PortfolioContactMark` is a
Contact row's mark, one of [`lib/portfolio-contact-mark.ts`](../../lib/portfolio-contact-mark.ts)'s
kinds in identity colour. `PortfolioControlMark` is a control drawn as a mark:
a `<button>` with `data-control`, a glyph from
[`lib/portfolio-control-mark.ts`](../../lib/portfolio-control-mark.ts), an
invisible 40px hit box, an optional 12px `label`, and every other button prop
passed through. `map` is the brain mask; `send` and `minimize` draw at 14px.

## Props

`family` and `register`, both required, both from
[`lib/portfolio-world.ts`](../../lib/portfolio-world.ts). Seven families, six
registers; a node's own fields are the intended source.

## Requires

An ancestor defining the `--world-*` properties — in practice
`.portfolio-composition`. The mark is `aria-hidden`, so whatever wraps it
carries the label.

## Example

```tsx
import { PortfolioControlMark, PortfolioNodeMark } from "components/PortfolioNodeMark";

export function PortfolioNodeMarkExample() {
  // The mark takes its shape from `family` and its color from `register`,
  // and must sit inside a `.portfolio-composition` for `--world-*` to resolve.
  // A control is the same envelope drawn as a button: glyph, 40px hit box,
  // and a caption; the accessible name comes from `aria-label`.
  return (
    <div className="portfolio-composition">
      <PortfolioNodeMark family="operation" register="warm" />
      <PortfolioControlMark aria-label="Show portfolio map" kind="map" label="Map" />
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
- **A control mark needs its own `aria-label`.** The glyph is `aria-hidden`
  and the caption is optional, so the button's name comes from the prop.
