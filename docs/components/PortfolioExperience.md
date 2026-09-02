# PortfolioExperience

Source: [`components/PortfolioExperience.tsx`](../../components/PortfolioExperience.tsx) ·
Gallery: `/design#composition` · Tests: `components/PortfolioExperience.test.tsx`

The whole accepted composition in one component. It renders the
`.experience.portfolio-composition` root and owns everything under it — world,
reader, chat, avatar overlay, toybox — plus the state
those read, and the four avatar services, each built once via lazy `useState`.
Selection is mirrored into the URL (`?view=graph#thread/<id>/<node>`) with
`pushState`; `popstate` reads it back.

## Props

None. Everything is internal state. See
[`PortfolioReader`](./PortfolioReader.md),
[`PortfolioWorld`](./PortfolioWorld.md), [`PortfolioChat`](./PortfolioChat.md)
and [`AvatarOverlay`](./avatar/AvatarOverlay.md).

## Requires

`#avatar-toybox-root` in the document — `app/layout.tsx` renders it.
`AvatarOverlay` and `AvatarToyboxOverlay` are lazily imported, so Three.js
stays out of the first paint.

## Example

```tsx
import { PortfolioExperience } from "components/PortfolioExperience";

export function PortfolioExperienceExample() {
  // Takes no props and owns all of its own state. It is the whole route body;
  // the only thing it needs from outside is `#avatar-toybox-root` in the
  // layout, which app/layout.tsx already renders.
  return <PortfolioExperience />;
}
```

## Pitfalls

- **It writes to `window.history`.** Mounting it inside another page — the
  gallery, a test harness — means selecting a node rewrites that page's URL.
- **Two instances fight.** Both push history and both register avatar targets.
  Render exactly one.
- **Keyboard bindings are global**: Escape returns to overview, Shift+G opens
  the toybox, Shift+A toggles the Director console (development only, as is
  `?avatarDebug=1`).
- **`canOpenToybox` is not a WebGL check.** `avatarMounted` comes from an
  unconditional `setTimeout(…, 0)`, and `snapshot.failed` only becomes true
  after the avatar canvas has mounted — which needs the chat open. The toybox
  opens on machines that cannot render it; the boundary handles the fallout.
- **`controller.dispose()` is never called** — only the director is disposed.
  Nothing leaks today (the controller registers no window listeners), but the
  asymmetry is worth knowing rather than copying.
