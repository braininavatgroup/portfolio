# AvatarToyboxBoundary

Source: [`components/avatar-toybox/AvatarToyboxBoundary.tsx`](../../../components/avatar-toybox/AvatarToyboxBoundary.tsx) ·
Gallery: `/design#toybox` (wraps the toybox fixture)

A small React error boundary. It exists because the toybox mounts a WebGL
canvas that can fail to construct, and a throw there would otherwise take down
the composition around it. On a caught error it renders nothing in place of its
children, logs in development only, and calls `onFailure` — in practice
`session.close(reason)`, which returns the page to normal rather than leaving a
dead modal.

## Props

`children` and `onFailure`, both required. See
[the source](../../../components/avatar-toybox/AvatarToyboxBoundary.tsx).

## Requires

Nothing. Plain React, no context, tokens or assets.

## Example

```tsx
import { AvatarToyboxBoundary } from "components/avatar-toybox/AvatarToyboxBoundary";
import { useState } from "react";

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

- **Render-phase errors only.** WebGL context loss, a rejected async load or an
  event-handler throw never reach it. `AvatarOverlay` handles the
  renderer-factory case separately through `controller.markFailed()`.
- **It never resets.** Once failed, the instance renders nothing for good;
  recovery means remounting, which closing and reopening the session does.
- **It renders no fallback UI.** If a user-visible message is wanted, the
  parent owns it.
- **It is not the only error boundary here.** `RendererBoundary`, inside
  [`AvatarOverlay`](../avatar/AvatarOverlay.md), does the same job for the
  avatar canvas.
