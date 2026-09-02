# PortfolioNodeMark

Source: [`components/PortfolioNodeMark.tsx`](../../components/PortfolioNodeMark.tsx) ·
Gallery: `/design#marks`

The one register mark. It draws the primitives
[`lib/portfolio-node-mark.ts`](../../lib/portfolio-node-mark.ts) returns for a
family into an 18px SVG box with `stroke: currentColor`, carrying `data-family`
and `data-register`. The `identity` family is the exception: it renders
`.portfolio-node-brain`, a 15px mask of `/biv-brain-symbol.png` filled with
`currentColor` and no containing shape. Every reusable mark shares one envelope
and stroke weight; the register alone varies (Rule 6.4). `PortfolioWorld`
deliberately paints the Bradley root with the same PNG at 21px.

`PortfolioContactMark` (same module) is a Contact row's mark, one of the kinds
in [`lib/portfolio-contact-mark.ts`](../../lib/portfolio-contact-mark.ts):
same box and stroke, identity colour, `data-family="contact"`. GitHub and
LinkedIn are filled silhouettes, the brain symbol's treatment.

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
import { PortfolioNodeMark } from "components/PortfolioNodeMark";

export function PortfolioNodeMarkExample() {
  // The mark takes its shape from `family` and its color from `register`,
  // and must sit inside a `.portfolio-composition` for `--world-*` to resolve.
  return (
    <div className="portfolio-composition">
      <PortfolioNodeMark family="operation" register="warm" />
    </div>
  );
}
```

## Pitfalls

- **Outside `.portfolio-composition` it renders in inherited text colour.** The
  registers are composition-scoped aliases.
- **Only `data-register` drives colour.** `data-family` appears nowhere in
  `app/globals.css`; it is there for selection and debugging, not styling.
- **The geometry constant is 15, the box is 18.**
  `PORTFOLIO_NODE_MARK_SIZE = 15` sets the viewBox extent
  (`15 × 0.6 × 2 = 18` units) inside an 18px element, with `overflow: visible`.
  A new family authored at 18 draws 20% oversized.
- **This is the one composition component with no `"use client"`**, because it
  has no state. Keep it that way.
