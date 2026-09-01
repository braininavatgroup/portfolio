# AvatarDirectorConsole

Source: [`components/avatar/AvatarDirectorConsole.tsx`](../../../components/avatar/AvatarDirectorConsole.tsx) ·
Gallery: `/design#avatar` (behind the overlay's toggle) ·
Tests: `components/avatar/AvatarDirectorConsole.test.tsx`

A development-only control room for the avatar. Four tabs — Scenes, Target,
Movement, Advanced — let you replay authored sequences, aim the avatar at any
registered `AvatarTargetId`, drive it manually, apply tone presets, and run
site actions through the `SiteActionExecutor`. The Target tab draws a live
stage map from the registry: every registered target and obstacle, scaled into
the current viewport, which is the fastest way to see why the avatar walked
somewhere unexpected. Mounting it makes the avatar visible
(`onEnabledChange(true)`).

## Props

`controller`, `director`, `registry`, `runner`, `siteActionExecutor`, and
`onEnabledChange` are required; `onExpandedPanelChange` and `reducedMotion` are
optional. See
[`AvatarDirectorConsoleProps`](../../../components/avatar/AvatarDirectorConsole.tsx).

## Requires

The same five avatar services the composition builds, with targets actually
registered — an empty registry makes the stage map and most of the Target tab
inert. It is not mounted directly in the app: `AvatarOverlay` lazily imports it
behind `import.meta.env.DEV && development && debug`, and
`PortfolioExperience` flips `debug` from Shift+A or `?avatarDebug=1`.

## Example

Import: `import { AvatarDirectorConsole } from "./AvatarDirectorConsole";`

```tsx
export function AvatarDirectorConsoleExample() {
  const services = useAvatarServices();

  // In the composition this is reached through `AvatarOverlay`'s
  // `development` + `debug` props, never mounted directly.
  return (
    <AvatarDirectorConsole
      controller={services.controller}
      director={services.director}
      onEnabledChange={() => {}}
      registry={services.registry}
      runner={services.runner}
      siteActionExecutor={services.siteActionExecutor}
    />
  );
}
```

## Pitfalls

- **It does not exist in a production build.** The import is
  `import.meta.env.DEV ? lazy(...) : null`, so a production bundle has no
  console and the toggle does nothing. That is intentional — do not "fix" the
  toggle.
- **Mounting it turns the avatar on**, and it keeps `enabled` in step with
  `snapshot.visible` afterwards. It is not a passive inspector.
- **`onExpandedPanelChange` exists so the avatar can walk around the panel.**
  Skip it and the avatar will path straight through the console.
- **Reduced motion changes the commands it issues** via
  `adaptCommandsForReducedMotion`, so a sequence replayed under
  `prefers-reduced-motion` is not the same sequence.
