# PortfolioNodeMark

Source: [`components/PortfolioNodeMark.tsx`](../../components/PortfolioNodeMark.tsx) · Gallery: `/design#marks`

Shared artwork for controls, nodes, identity, and contacts. Nodes use an 18px surface and 1.45px stroke; controls use a 20px surface, maximum 18px ink, and 1.25px stroke. `lib/portfolio-glyph-metrics.ts` owns these dimensions, round caps/joins, named sizes, and the approved 0.9 artwork scale. Scaling changes ink, not layout cells or hit targets. Canvas glyphs use the same scale.

Paths are authored directly; `portfolio-control-geometry.ts` is test/authoring only. Toolbar cells remain 32px in 40px rows. Explicit grid tracks prevent artwork overflow from shifting centers; `scripts/check-toolbar-geometry.mjs` checks browser alignment.

Map, Guide, and connected-bust avatar use independent 1.65× brain crops. Reader and identity share the approved circular crop: `translate(1.15 3.17) rotate(-37) scale(1.6)`. Hidden avatar is a solid muted silhouette. Panel controls share a square frame.

`PortfolioControlGlyph` is bare artwork; `PortfolioControlMark` wraps it in a button. `PortfolioContactMark` shares contact/social artwork with carousel links. `/design#marks` shows all families and named sizes.

## Props

`family` and `register` are required and come from [`lib/portfolio-world.ts`](../../lib/portfolio-world.ts). Seven families, six registers. Story stays a distinct register but resolves to the Arc red pair.

## Requires

An ancestor defining the `--world-*` properties, normally `.portfolio-composition`. The mark is `aria-hidden`; its wrapper carries the label.

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
- **The geometry constant is 15, the box is 18.** `PORTFOLIO_NODE_MARK_SIZE = 15` sets the viewBox extent (`15 × 0.6 × 2 = 18` units) inside an 18px element, with `overflow: visible`. A new family authored at 18 draws 20% oversized.
- **This is the one composition component with no `"use client"`**, because it has no state. Keep it that way.
- **A control mark needs its own `aria-label`.** The glyph is `aria-hidden`, and the caption is optional.
- **A bare glyph is not a control.** `PortfolioControlGlyph` supplies no button, label, focus, or click behavior; its surrounding surface owns interaction.
- **Generated textures must ship in `/glyph-textures/`.** Missing images leave patterned controls with only their outlines.

Textures are generated SVG images in `public/glyph-textures/`. Cropping and clipping happen in vector coordinates; image-local IDs cannot collide during drag cloning. Run `npm run glyphs:generate` after changing brain artwork, crops, or silhouettes. Tests reject stale generated assets.
