# AvatarDirectorConsole

Source: [`components/avatar/AvatarDirectorConsole.tsx`](../../../components/avatar/AvatarDirectorConsole.tsx) ·
Gallery: `/design#avatar` (behind the overlay's toggle) ·
Tests: `components/avatar/AvatarDirectorConsole.test.tsx`

A development-only control room. Four tabs — Scenes, Target, Movement,
Advanced — replay authored sequences, aim the avatar at any registered
`AvatarTargetId`, drive it manually, apply tone presets, and run site actions.
The Target tab draws a live stage map from the registry: every registered
target and obstacle scaled into the viewport, which is the fastest way to see
why the avatar walked somewhere unexpected.

## Props

`controller`, `director`, `registry`, `runner`, `siteActionExecutor` and
`onEnabledChange` required; `onExpandedPanelChange` and `reducedMotion`
optional — see
[`AvatarDirectorConsoleProps`](../../../components/avatar/AvatarDirectorConsole.tsx).

## Requires

The five avatar services, with targets actually registered — an empty registry
leaves the stage map and most of the Target tab inert. It is never mounted
directly in the app: [`AvatarOverlay`](./AvatarOverlay.md) lazily imports it,
and `PortfolioExperience` flips `debug` from Shift+A or `?avatarDebug=1`.

## Example

```tsx
import { AvatarDirectorConsole } from "components/avatar/AvatarDirectorConsole";
import { AvatarController } from "lib/avatar/controller";
import { AvatarDirector } from "lib/avatar/director";
import { AvatarSequenceRunner } from "lib/avatar/sequence-runner";
import { AvatarTargetRegistry } from "lib/avatar/target-registry";
import { useState } from "react";

export function AvatarDirectorConsoleExample() {
  const [services] = useState(() => {
    const registry = new AvatarTargetRegistry();
    const controller = new AvatarController(registry);
    const runner = new AvatarSequenceRunner((command, signal) =>
      controller.execute(command, signal),
    );
    const director = new AvatarDirector(controller, runner, registry);
    return { controller, director, registry, runner };
  });

  // In the composition this is reached through `AvatarOverlay`'s
  // `development` + `debug` props, never mounted directly.
  return (
    <AvatarDirectorConsole
      controller={services.controller}
      director={services.director}
      onEnabledChange={() => {}}
      registry={services.registry}
      runner={services.runner}
    />
  );
}
```

## Pitfalls

- **It does not exist in a production build.** The import is
  `import.meta.env.DEV ? lazy(…) : null`, so the toggle does nothing there.
  Intentional — do not "fix" the toggle.
- **Mounting it does not turn the avatar on.** `onEnabledChange` fires only
  from its own reset and visibility controls; the `enabled`/`snapshot.visible`
  sync lives in [`AvatarOverlay`](./AvatarOverlay.md), not here.
- **`onExpandedPanelChange` is how the avatar avoids the panel.** Skip it and
  the avatar paths straight through the console.
- **Reduced motion rewrites the commands it issues** via
  `adaptCommandsForReducedMotion`, so a replayed sequence is not the same
  sequence.
