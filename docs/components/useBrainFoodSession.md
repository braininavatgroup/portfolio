# useBrainFoodSession

Source: [`components/useBrainFoodSession.ts`](../../components/useBrainFoodSession.ts) · Tests: `components/useBrainFoodSession.test.tsx`

Owns the visitor-triggered Brain Food session: chat `start()` and the exact Shift+G shortcut, Arrow/WASD movement, live-node collision state, completion celebration, Escape cancellation, and restoration of the avatar's prior visibility.
`gameMode` includes preparation: expand the Map, then spawn after two frames.
It restores keyboard focus and avatar visibility on cancel or completion;
collection starts only when the avatar moves.

## Arguments

`avatarRuntime`, `edibleNodeCount`, `enabled`, and `reducedMotion` are required.

## Requires

A browser and one live `.portfolio-world` surface. The map must call
`syncNodePositions` with current viewport-projected nodes before and during play.

## Example

```tsx
import { useBrainFoodSession } from "components/useBrainFoodSession";
import { AvatarRuntime } from "lib/avatar/runtime";
import { useState } from "react";

export function UseBrainFoodSessionExample() {
  const [runtime] = useState(() => new AvatarRuntime(() => ({
    dock: { x: 800, y: 700 },
    obstacles: [],
    viewport: { width: 900, height: 724, floorY: 700 },
  })));
  const session = useBrainFoodSession({
    avatarRuntime: runtime,
    edibleNodeCount: 16,
    enabled: true,
    reducedMotion: false,
  });

  return <p>{session.active ? `${session.remaining} left` : "Press Shift+G"}</p>;
}
```

## Pitfalls

- It refuses to start below 1020px, on coarse pointers, or with reduced motion. Losing enabled status or enabling reduced motion cancels active and preparing games.
- Bradley is never edible; `edibleNodeCount` must exclude that identity node.
- Escape restores the avatar visibility from before the game rather than assuming chat is open.
- Collection uses the swimmer-sized swept path between frames, not only the
  actor origin at the end of a frame. Keep node coordinates in viewport space
  so the visible model and collision model cannot drift apart.
