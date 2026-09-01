# PortfolioHeader

Source: [`components/PortfolioHeader.tsx`](../../components/PortfolioHeader.tsx) ·
Gallery: `/design#header` · Tests: `components/PortfolioHeader.test.tsx`

The wordmark plus one nav control ("Map"). Whichever view is active renders as
plain text with `aria-current="page"` instead of a link, so the header never
links to where you already are. Both links are real `next/link` anchors that
navigate normally on modifier-click or middle-click; a plain left click is
intercepted and handed to `onBradleySelect` / `onMapSelect` when those are
supplied, which is how the composition changes view without a page load.

## Props

`activeView` (`"bradley" | "map" | "index"`), `overlay`, `obstacleRef`,
`onBradleySelect`, `onMapSelect` — all optional. See
[`PortfolioHeaderProps`](../../components/PortfolioHeader.tsx).

## Requires

Nothing beyond `next/link`. `overlay` adds `.portfolio-header-overlay`;
`obstacleRef` hands the element to the avatar target registry so the avatar
walks around it.

## Example

Import: `import { PortfolioHeader } from "./PortfolioHeader";`

```tsx
export function PortfolioHeaderExample() {
  // Flow layout, as on /index. `overlay` instead gives the absolutely
  // positioned variant the composition uses.
  return (
    <div className="flat-index">
      <PortfolioHeader activeView="map" />
    </div>
  );
}
```

## Pitfalls

- **`.portfolio-composition > .portfolio-header` is `display: none`.**
  `PortfolioExperience` renders the overlay variant and globals.css hides it,
  so the composition shows no header today. Nesting it one level deeper is what
  makes the variant reviewable at all — that is why the gallery's header
  specimen does.
- **The flow-layout variant belongs to `/index`**, inside `.flat-index`. It has
  no styling of its own inside the composition.
- **Omitting `onMapSelect` is not a no-op** — the link then performs a real
  navigation to `/?view=graph`.
