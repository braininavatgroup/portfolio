# useAvatarToyboxSession

Source: [`components/avatar-toybox/useAvatarToyboxSession.ts`](../../../components/avatar-toybox/useAvatarToyboxSession.ts) ·
Gallery: `/design#toybox` · Tests: `components/avatar-toybox/useAvatarToyboxSession.test.tsx`

All of the toybox's state and physics, with no rendering. It owns the status
machine (`closed → choosing → collecting | tossing → result`), the Brain Food
body and collectible layout, the toss body with drag and throw integration, the
countdown, the score, the live-region announcement and the modal focus trap,
and it installs the Shift+G shortcut itself. The pure physics lives in
[`lib/avatar-toybox/runtime.ts`](../../../lib/avatar-toybox/runtime.ts); this
hook is the React lifetime around it.

## Props (hook argument)

`canOpen`, `collectibles` and `reducedMotion` required; `onOpen` optional. It
returns an
[`AvatarToyboxSession`](../../../components/avatar-toybox/useAvatarToyboxSession.ts)
— a plain snapshot plus callbacks, designed to be passed whole to
[`AvatarToyboxOverlay`](./AvatarToyboxOverlay.md).

## Requires

`#app-shell` in the document — `openChooser` silently bails without it, because
it takes an `inert` lease on that element. A viewport of at least **720×600**;
below that it refuses to open and auto-closes on resize.

## Example

```tsx
import { useAvatarToyboxSession } from "components/avatar-toybox/useAvatarToyboxSession";

export function UseAvatarToyboxSessionExample() {
  const session = useAvatarToyboxSession({
    canOpen: () => true,
    collectibles: [{ id: "dubs", label: "Dubs" }],
    reducedMotion: false,
  });

  // Shift+G opens it too, once `canOpen()` returns true.
  return (
    <button onClick={session.open} type="button">
      Open the toybox ({session.status})
    </button>
  );
}
```

## Pitfalls

- **`canOpen` does not gate on WebGL.** In the composition it reads an
  `avatarMounted` flag set by an unconditional `setTimeout(…, 0)` plus
  `!snapshot.failed`, and `failed` can only become true once the avatar canvas
  has mounted — which needs the chat open. On a machine without WebGL the
  toybox still opens; [`AvatarToyboxBoundary`](./AvatarToyboxBoundary.md) is
  what catches the result.
- **It takes over the page while open**: `#app-shell` goes `inert` and
  `aria-hidden`, focus is trapped. Two sessions fight over that lease.
- **A fresh `collectibles` array identity re-registers the modal's key
  listeners**, because it re-creates `startCollecting`. It does not re-lay-out
  an in-progress field. Memoize it anyway, as `PortfolioExperience` does.
- **Shift+G is registered by the hook.** Calling it twice binds it twice.
