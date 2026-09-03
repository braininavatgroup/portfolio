# PortfolioExperience

Source: [`components/PortfolioExperience.tsx`](../../components/PortfolioExperience.tsx) ·
Gallery: `/design#composition` · Tests: `components/PortfolioExperience.test.tsx`

The whole accepted composition in one component. It renders the
`.experience.portfolio-composition` root and owns everything under it — world,
reader, chat, avatar overlay, and live-map Brain Food — plus the state
those read and the fixed avatar runtime.
Selection is mirrored into the URL (`?view=graph#thread/<id>/<node>`) with
`pushState`; `popstate` reads it back.

## Props

None. Everything is internal state. See
[`PortfolioReader`](./PortfolioReader.md),
[`PortfolioWorld`](./PortfolioWorld.md), [`PortfolioChat`](./PortfolioChat.md)
and [`AvatarOverlay`](./avatar/AvatarOverlay.md).

## Requires

`AvatarOverlay` is lazily imported, so Three.js stays out of the first paint.

## Example

```tsx
import { PortfolioExperience } from "components/PortfolioExperience";

export function PortfolioExperienceExample() {
  // Takes no props and owns all of its own state. It is the whole route body.
  return <PortfolioExperience />;
}
```

## Pitfalls

- **It writes to `window.history`.** Mounting it inside another page — the
  gallery, a test harness — means selecting a node rewrites that page's URL.
- **Two instances fight.** Both push history and install global game controls.
  Render exactly one.
- **Keyboard bindings are global**: Escape returns to overview and exact
  Shift+G starts Brain Food on desktop. During the game Escape cancels and
  restores the previous map selection.
