# PortfolioNodeMark

Source: [`components/PortfolioNodeMark.tsx`](../../components/PortfolioNodeMark.tsx) ·
Gallery: `/design#marks`

The shared Reading Room mark draws each family in an 18px SVG box with
`currentColor`, round caps, round joins, and a 1.45 stroke. `identity` uses `/glyph-textures/circle.svg`: the approved centered 1.65× brain crop with a 1.25px circular outline, painting 18px inside a centered 20px surface. Its layout envelope
remains 18px. Control glyphs use the approved A coordinates directly in a 20px surface, with
an 18px maximum painted extent and a non-scaling 1.25px stroke. No runtime
bounding-box fitting or per-glyph CSS size corrections. `lib/portfolio-glyph-metrics.ts`
owns the control/node strokes, round caps/joins, and standard (20), inline (18),
compact (16), and small (14) control sizes. `portfolio-control-geometry.ts` is an
authoring/test utility only; it is not imported by the renderer.
The selected texture positions are independent of silhouette normalization.

Desktop toolbar marks and actions use centered 32px cells within 40px rows.
Mark grids explicitly use `minmax(0, 1fr)` tracks so a 20px artwork surface
cannot expand an 18px layout envelope and shift its center. The browser assertion
in `scripts/check-toolbar-geometry.mjs` measures actual artwork against each row,
including horizontal inset and action alignment; wrapper alignment alone is insufficient.

`PortfolioContactMark` draws identity-colour contact kinds.
`PortfolioControlGlyph` exposes the non-interactive artwork from
[`lib/portfolio-control-mark.ts`](../../lib/portfolio-control-mark.ts), including
the mobile-only sidebar frame. `PortfolioControlMark` wraps it in a button.
Map, Guide, and the connected-bust avatar use the approved patterned silhouettes with independent brain crops at 1.65 scale. Reader uses the same enlarged circle crop as identity nodes and the canvas map. Hidden avatar becomes a solid silhouette in muted ink; it remains clickable.

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
- **Generated textures must ship in `/glyph-textures/`.** Missing images leave patterned controls with only their outlines.

The `/design#marks` specimen includes all control, node, contact, and carousel social marks plus every named control size. Guide copy, suggestions, latest-reply, and send use the same renderer. Instagram uses the same source in Contact and carousel links; Spotify and Beatport retain their original brand geometry.

Panel controls share one 18px painted square frame, centered with the 18px-tall patterned marks. The mobile and desktop left-panel actions reuse the same artwork. This is the targeted alignment correction to A; its other control silhouettes and stroke weight remain intact.

Patterned control textures are generated SVG images in `public/glyph-textures/`. Crop, rotation, and silhouette clipping happen in SVG coordinates before rasterization, avoiding enlargement of a small CSS mask. Their internal clip IDs are isolated image resources and cannot collide when bars are cloned. Run `npm run glyphs:generate` after changing the canonical brain or control crops/outlines; the texture tests reject stale generated assets.
