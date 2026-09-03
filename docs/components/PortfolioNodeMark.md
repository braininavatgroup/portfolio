# PortfolioNodeMark

Source: [`components/PortfolioNodeMark.tsx`](../../components/PortfolioNodeMark.tsx) ·
Gallery: `/design#marks`

The shared Reading Room mark draws each family in an 18px SVG box with
`currentColor`, round caps, miter joins, and a 1.45 stroke. `identity` is a 15px
mask of `/biv-brain-symbol.svg` in the same envelope.

`PortfolioContactMark` draws identity-colour contact kinds.
`PortfolioControlGlyph` exposes the non-interactive artwork from
[`lib/portfolio-control-mark.ts`](../../lib/portfolio-control-mark.ts), including
the mobile-only sidebar frame. `PortfolioControlMark` wraps it in a button.
Map and Guide use patterned interiors; Guide alone uses a 1.15 outline.

## Props

`family` and `register` are required and come from
[`lib/portfolio-world.ts`](../../lib/portfolio-world.ts). Seven families, six
registers. Story stays a distinct register but resolves to the Arc red pair.

## Requires

An ancestor defining the `--world-*` properties, normally
`.portfolio-composition`. The mark is `aria-hidden`; its wrapper carries the label.

## Example

```tsx
import { PortfolioControlGlyph, PortfolioControlMark, PortfolioNodeMark } from "components/PortfolioNodeMark";

export function PortfolioNodeMarkExample() {
  // The mark takes its shape from `family` and its color from `register`,
  // and must sit inside a `.portfolio-composition` for `--world-*` to resolve.
  // Patterned Map and Guide controls use the same SVG brain asset as identity.
  // The accessible names come from `aria-label`.
  return (
    <div className="portfolio-composition">
      <PortfolioNodeMark family="identity" register="identity" />
      <PortfolioControlGlyph kind="reader" />
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
- **A bare glyph is not a control.** `PortfolioControlGlyph` supplies no button,
  label, focus, or click behavior; its surrounding surface owns interaction.
- **Map and Guide need `/biv-brain-symbol.svg`.** Without it, only the outline renders.
