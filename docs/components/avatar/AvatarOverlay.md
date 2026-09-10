# AvatarOverlay

Source: [`components/avatar/AvatarOverlay.tsx`](../../../components/avatar/AvatarOverlay.tsx) ·
Gallery: `/design#avatar` · Tests: `components/avatar/AvatarOverlay.test.tsx`

Mounts one orthographic Canvas and AvatarStageActor, subscribes to AvatarRuntime,
and exposes its phase through `data-avatar-state`. Renderer construction and
render failures mark the runtime failed while leaving the portfolio usable.

## Props

`runtime` is required. `reducedMotion` defaults to false. `createRenderer` is an
optional test seam; production constructs a transparent antialiased renderer.

## Requires

The runtime must have a stage reader and be shown by its owner. PortfolioExperience
owns visibility; useAvatarStage owns layout registration and dock updates.

## Example

```tsx
import { AvatarOverlay } from "components/avatar/AvatarOverlay";
import { AvatarRuntime } from "lib/avatar/runtime";
import { useState } from "react";

export function AvatarOverlayExample() {
  const [runtime] = useState(() => new AvatarRuntime(() => ({
    dock: { x: 210, y: 396 },
    obstacles: [],
    viewport: { width: 420, height: 420, floorY: 396 },
  })));
  runtime.show();

  return (
    <div className="portfolio-composition">
      <AvatarOverlay reducedMotion={false} runtime={runtime} />
    </div>
  );
}
```

## Pitfalls

- The Canvas mounts on first show and stays mounted while hidden. Unmounting
  during a resize can race the renderer's event reconnection.
- Hidden documents and hidden avatars stop the frame loop. Reduced motion uses
  demand rendering to retain a still figure without continuous idle animation.
- Hide/Show controls belong to the Guide, outside the pointer-transparent overlay.
- Render-phase errors use the boundary; asynchronous failures report to runtime.
- Successful asset validation marks the runtime ready. Suggestions wait for it.
