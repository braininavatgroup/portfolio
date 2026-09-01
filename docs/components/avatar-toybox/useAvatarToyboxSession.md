# useAvatarToyboxSession

Source: [`components/avatar-toybox/useAvatarToyboxSession.ts`](../../../components/avatar-toybox/useAvatarToyboxSession.ts) ·
Gallery: `/design#toybox` · Tests: `components/avatar-toybox/useAvatarToyboxSession.test.tsx`

All of the toybox's state and physics, with no rendering. It owns the status
machine (`closed → choosing → collecting | tossing → result`), the Brain Food
body and its collectible layout, the toss body with drag and throw
integration, the countdown, the score, the live-region announcement, and the
modal's focus trap. It installs the Shift+G shortcut itself, gated on the
`canOpen` predicate. The integration lives in
[`lib/avatar-toybox/runtime.ts`](../../../lib/avatar-toybox/runtime.ts), which
is where the pure physics is tested; this hook is the React lifetime around it.

## Props (hook argument)

`canOpen: () => boolean`, `collectibles: readonly ToyboxCollectible[]`, and
`reducedMotion` are required; `onOpen` is optional. It returns an
[`AvatarToyboxSession`](../../../components/avatar-toybox/useAvatarToyboxSession.ts)
— a plain snapshot plus event callbacks, designed to be passed whole to
[`AvatarToyboxOverlay`](./AvatarToyboxOverlay.md).

## Requires

A browser: it reads `window.innerWidth`/`innerHeight`, measures
`.portfolio-world` to bound the play field, and puts `#app-shell` under `inert`
while the modal is open. `#avatar-toybox-root` is needed by the overlay, not by
the hook.

## Example

Import: `import { useAvatarToyboxSession } from "./useAvatarToyboxSession";`

```tsx
export function UseAvatarToyboxSessionExample() {
  const session = useAvatarToyboxSession({
    canOpen: () => true,
    collectibles: [{ id: "dubs", label: "Dubs", tokenKind: "document" }],
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

- **`canOpen` is read at keypress time**, not at mount. In the composition it
  returns false until the avatar has mounted and not failed — so on a machine
  without WebGL the toybox is deliberately unreachable.
- **The session takes over the page while open**: `#app-shell` is made `inert`
  and `aria-hidden`, and focus is trapped in the dialog. Two sessions at once
  fight over that lease.
- **`collectibles` is re-read into a layout.** Passing a fresh array literal
  every render churns the field; memoize it, as `PortfolioExperience` does.
- **`reducedMotion` shortens or removes the animated phases** rather than
  disabling the game.
- **Shift+G is registered by the hook itself.** Calling the hook twice
  registers the shortcut twice.
