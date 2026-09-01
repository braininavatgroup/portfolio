# PortfolioExperience

Source: [`components/PortfolioExperience.tsx`](../../components/PortfolioExperience.tsx) ·
Gallery: `/design#composition` · Tests: `components/PortfolioExperience.test.tsx`

The whole accepted composition in one component: it renders the `<main
class="experience experience-graph portfolio-composition">` root and owns
everything under it — header, world, reader, chat, the avatar overlay, and the
toybox. It also owns all the shared state those pieces read: selection, active
thread, the open visual, mobile map mode, spotlight target, and the avatar
services (`AvatarTargetRegistry`, `AvatarController`, `AvatarSequenceRunner`,
`AvatarDirector`), each constructed once via lazy `useState`. Selection is
mirrored into the URL (`?view=graph#thread/<id>/<node>`) with `pushState`, and
`popstate` reads it back.

## Props

None. Everything is internal state. The pieces it composes take their props
from here — see the individual sheets for
[`PortfolioReader`](./PortfolioReader.md),
[`PortfolioWorld`](./PortfolioWorld.md), [`PortfolioChat`](./PortfolioChat.md),
and [`AvatarOverlay`](./avatar/AvatarOverlay.md).

## Requires

`#avatar-toybox-root` in the document — `app/layout.tsx` renders it, and the
toybox portals into it. `AvatarOverlay` and `AvatarToyboxOverlay` are lazily
imported, so Three.js is code-split out of the first paint. The class list on
its root is what defines the composition surface every token in
`docs/design-conventions.md` is scoped to.

## Example

Import: `import { PortfolioExperience } from "./PortfolioExperience";`

```tsx
export function PortfolioExperienceExample() {
  // Takes no props and owns all of its own state. It is the whole route body;
  // the only thing it needs from outside is `#avatar-toybox-root` in the
  // layout, which app/layout.tsx already renders.
  return <PortfolioExperience />;
}
```

## Pitfalls

- **It writes to `window.history`.** Mounting it inside another page (the
  gallery, a test harness) means selecting a node rewrites that page's URL.
- **Two instances fight.** Both push history and both register avatar targets;
  render exactly one.
- **Keyboard bindings are global**: Escape returns to overview, Shift+G opens
  the toybox once the avatar has mounted, and Shift+A toggles the Director
  console — the last one only in development builds
  (`import.meta.env.DEV`), so it is inert in production.
- **`?avatarDebug=1` opens the Director console** on load, again in
  development only.
- **The avatar can decline to mount.** `canOpenToybox` requires a mounted,
  non-failed controller, so the toybox is unreachable when WebGL is
  unavailable. That is intended, not a bug to route around.
