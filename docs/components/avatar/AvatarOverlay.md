# AvatarOverlay

Source: [`components/avatar/AvatarOverlay.tsx`](../../../components/avatar/AvatarOverlay.tsx) ·
Gallery: `/design#avatar` · Tests: `components/avatar/AvatarOverlay.test.tsx`

The avatar's mount point on the live page: a pointer-events-none
`.avatar-overlay` layer holding one orthographic `<Canvas>` with an
[`AvatarStageActor`](./AvatarStageActor.md) inside it. It subscribes to the
controller with `useSyncExternalStore`, publishes the state as
`data-avatar-state`, and manages the renderer's lifecycle: it switches
`frameloop` to `"never"` and stops the director when the document is hidden,
and it wraps both the renderer factory and the canvas subtree so a WebGL
failure becomes `controller.markFailed()` rather than an unhandled rejection or
a blank crash. In development it can also mount the lazily imported
[`AvatarDirectorConsole`](./AvatarDirectorConsole.md).

## Props

`controller`, `enabled`, and `onEnabledChange` are required. `director`,
`runner`, `registry`, and `siteActionExecutor` are optional but the Director
console needs all four; `development`, `debug`, `reducedMotion`,
`onExpandedPanelChange`, and `createRenderer` are optional. See
[`AvatarOverlayProps`](../../../components/avatar/AvatarOverlay.tsx).

## Requires

An element registered as the avatar stage (`registry.registerStage`) — the
controller measures it to know where the floor is. In the composition this is
the world section; in the gallery fixture it is the stage box. The services are
constructed once by the owner (see
[`PortfolioExperience`](../PortfolioExperience.md)) and disposed by it.

## Example

Import: `import { AvatarOverlay } from "./AvatarOverlay";`

```tsx
export function AvatarOverlayExample() {
  const services = useAvatarServices();
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
        runner={services.runner}
        siteActionExecutor={services.siteActionExecutor}
      />
    </div>
  );
}
```

## Pitfalls

- **`enabled` is a two-way prop.** The controller can turn itself off (a
  renderer failure does exactly that), and the overlay then calls
  `onEnabledChange(false)`. Treating `enabled` as write-only leaves the parent
  out of sync.
- **The Director console needs five things at once**: `AvatarDirectorConsole`
  compiled in (`import.meta.env.DEV`), `development`, `debug`, `director`,
  `runner`, `registry`, and `siteActionExecutor`. Missing one and the toggle
  looks broken. It is compiled out of production builds entirely.
- **Without a registered stage the avatar has no floor** and positions itself
  against a zero-sized box.
- **The controller is not disposed here.** Whoever created it must call
  `controller.dispose()` on unmount, or the resize and animation listeners
  leak.
- **`pointer-events: none` is deliberate** — the overlay never intercepts
  clicks meant for the composition beneath it.
