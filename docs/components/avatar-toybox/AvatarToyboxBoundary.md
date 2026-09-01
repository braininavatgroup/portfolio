# AvatarToyboxBoundary

Source: [`components/avatar-toybox/AvatarToyboxBoundary.tsx`](../../../components/avatar-toybox/AvatarToyboxBoundary.tsx) ·
Gallery: `/design#toybox` (wraps the toybox fixture)

A three-line React error boundary, the only class component in `components/`.
It exists because the toybox mounts a WebGL canvas that can fail to construct
on a machine or context that cannot give it one, and a throw there would
otherwise take down the whole composition. On a caught error it renders nothing
in place of its children, logs in development only, and calls `onFailure` — in
practice `session.close(reason)`, which returns the page to normal instead of
leaving a dead modal.

## Props

`children` and `onFailure: () => void`, both required. See
[the source](../../../components/avatar-toybox/AvatarToyboxBoundary.tsx).

## Requires

Nothing. It is plain React with no context, tokens, or assets.

## Example

Import: `import { AvatarToyboxBoundary } from "./AvatarToyboxBoundary";`

```tsx
export function AvatarToyboxBoundaryExample() {
  const [failed, setFailed] = useState(false);

  // Catches a render-time throw from the subtree, renders nothing in its
  // place, and calls `onFailure` once. It does not catch async or WebGL
  // context-loss errors — those arrive through the session instead.
  return (
    <AvatarToyboxBoundary onFailure={() => setFailed(true)}>
      {failed ? null : <p>The toybox renderer.</p>}
    </AvatarToyboxBoundary>
  );
}
```

## Pitfalls

- **It only catches render-phase errors.** WebGL context loss, a rejected
  async load, or an event-handler throw never reaches it —
  [`AvatarOverlay`](../avatar/AvatarOverlay.md) handles the renderer-factory
  case separately, through `controller.markFailed()`.
- **It does not reset.** Once `failed`, the instance renders nothing forever;
  recovery means remounting it (closing and reopening the session does that).
- **`onFailure` must be idempotent-safe** — it is called from
  `componentDidCatch`, which React may invoke while the tree is already
  unwinding.
- **It renders no fallback UI.** If a user-visible failure message is wanted,
  the parent owns it.
