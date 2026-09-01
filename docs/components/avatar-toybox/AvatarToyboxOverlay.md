# AvatarToyboxOverlay

Source: [`components/avatar-toybox/AvatarToyboxOverlay.tsx`](../../../components/avatar-toybox/AvatarToyboxOverlay.tsx) ·
Gallery: `/design#toybox` · Tests: `components/avatar-toybox/AvatarToyboxOverlay.test.tsx`

The toybox's renderer, and nothing else: it takes an
[`AvatarToyboxSession`](./useAvatarToyboxSession.md) and paints it. A
full-screen `role="dialog"` section — HUD, chooser, collectible field, result —
is portalled into `#avatar-toybox-root` so it escapes the composition's
stacking and transform contexts, with the avatar drawn in a small
`@react-three/fiber` canvas over the DOM field. It holds no state; every
interaction calls back into the session.

## Props

One: `session`. Everything it needs is on that object.

## Requires

`#avatar-toybox-root` in the document — `app/layout.tsx` renders it. WebGL, for
the avatar canvas. A live session from the hook.

## Example

```tsx
import { AvatarToyboxBoundary } from "components/avatar-toybox/AvatarToyboxBoundary";
import { AvatarToyboxOverlay } from "components/avatar-toybox/AvatarToyboxOverlay";
import { useAvatarToyboxSession } from "components/avatar-toybox/useAvatarToyboxSession";

export function AvatarToyboxOverlayExample() {
  const session = useAvatarToyboxSession({
    canOpen: () => true,
    collectibles: [{ id: "dubs", label: "Dubs", tokenKind: "document" }],
    reducedMotion: false,
  });

  // Renders null until `session.isOpen`, then portals into
  // `#avatar-toybox-root`. The boundary closes the session if WebGL fails.
  return (
    <>
      <button onClick={session.open} type="button">
        Open the toybox
      </button>
      <AvatarToyboxBoundary onFailure={() => session.close("Renderer failed.")}>
        <AvatarToyboxOverlay session={session} />
      </AvatarToyboxBoundary>
    </>
  );
}
```

## Pitfalls

- **No portal host means no overlay.** With `#avatar-toybox-root` missing it
  returns `null` silently — the game "does not open", with nothing logged.
- **It portals out of its parent**, so a theme set on an ancestor does not
  reach it. The gallery mirrors `data-theme` onto the host element for exactly
  this reason.
- **Wrap it in [`AvatarToyboxBoundary`](./AvatarToyboxBoundary.md).** A
  renderer throw otherwise takes down the page instead of closing the session.
- **It returns `null` until `session.isOpen`**, so mounting it unconditionally
  is correct and cheap.
- **It measures its own hitbox** for the toss physics, falling back to 144×208
  where `getBoundingClientRect` returns zeros.
