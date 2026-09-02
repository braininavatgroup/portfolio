# AvatarOverlay

Source: [`components/avatar/AvatarOverlay.tsx`](../../../components/avatar/AvatarOverlay.tsx) ·
Gallery: `/design#avatar` · Tests: `components/avatar/AvatarOverlay.test.tsx`

The avatar's mount point: a pointer-events-none layer holding one orthographic
`<Canvas>` with an [`AvatarStageActor`](./AvatarStageActor.md) inside. It
subscribes to the controller with `useSyncExternalStore`, publishes state as
`data-avatar-state`, drops `frameloop` to `"never"` and stops the director when
the document is hidden, and converts a renderer construction failure or a
render throw into `controller.markFailed()` rather than a blank crash.

## Props

`controller`, `enabled`, and `onEnabledChange` are required. `director`,
`registry`, `development`, `debug`, `reducedMotion`,
`onExpandedPanelChange`, and `createRenderer` are optional — see
[`AvatarOverlayProps`](../../../components/avatar/AvatarOverlay.tsx).

## Requires

Nothing mandatory beyond the controller. Registering a stage
(`registry.registerStage`) is a refinement, not a precondition: with none, the
registry falls back to the window, so the avatar stands on the viewport floor
at full width instead of on the intended element.

## Example

```tsx
import { AvatarOverlay } from "components/avatar/AvatarOverlay";
import { createAvatarStageServices } from "lib/avatar/stage-services";
import { useCallback, useState } from "react";

export function AvatarOverlayExample() {
  // The five services, built once, exactly as PortfolioExperience builds them.
  const [services] = useState(() => {
    return createAvatarStageServices();
  });
  const [enabled, setEnabled] = useState(true);
  const registerStage = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;
      services.registry.registerStage(element);
      services.controller.refreshStage(true);
    },
    [services],
  );

  return (
    <div className="portfolio-composition" ref={registerStage}>
      <AvatarOverlay
        controller={services.controller}
        director={services.director}
        enabled={enabled}
        onEnabledChange={setEnabled}
        reducedMotion={false}
        registry={services.registry}
      />
    </div>
  );
}
```

## Pitfalls

- **`enabled` is two-way.** The controller can clear `visible` itself — an
  `exit` command settling does this — and the overlay then calls
  `onEnabledChange(false)`. Treating `enabled` as write-only desyncs the
  parent. (A renderer failure sets `failed`, not `visible`.)
- **The Director console needs five conditions at once**: the lazy import
  existing (`import.meta.env.DEV`), then `development`, `debug`, `director`, and
  `registry`. It is compiled out of production entirely.
- **`pointer-events: none` is set inline**, deliberately, so the overlay never
  intercepts clicks meant for the composition beneath it.
- **`RendererBoundary` here catches render-phase throws only.** Async and
  context-loss failures arrive through the controller instead.
