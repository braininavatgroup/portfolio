# AvatarStageActor

Source: [`components/avatar/AvatarStageActor.tsx`](../../../components/avatar/AvatarStageActor.tsx) ·
Gallery: `/design#avatar` · Tests: `components/avatar/AvatarStageActor.test.tsx`

The bridge between the controller's screen-space model of the stage and the
3D scene. It takes an `AvatarSnapshot` — position in CSS pixels, facing,
animation, motion path — converts the point through
`screenPointToOrthographic`, and places an
[`AvatarAssetAdapter`](./AvatarAssetAdapter.md) there at a viewport-derived
scale (`selectAvatarStageScale`: 104 on desktop, 72 at 768px and below, both
exported for tests). While a `motion` path is present it samples the path each
frame and derives facing from the direction of travel, so a walk turns the
avatar without the controller having to say so.

## Props

`snapshot: AvatarSnapshot` and `reducedMotion` are required;
`onAvailableAnimationsChange` is optional and is normally
`controller.setAvailableAnimations`. See
[`AvatarSnapshot`](../../../lib/avatar/controller.ts) and
[`lib/avatar/stage.ts`](../../../lib/avatar/stage.ts).

## Requires

An **orthographic** `<Canvas>` at `zoom: 1` — the screen-pixel mapping assumes
it. The live configuration is `camera={{ far: 2500, position: [0, 0, 1000],
zoom: 1 }}`. Lights and a `<Suspense>` boundary come from the canvas, as for
the adapter.

## Example

Import: `import { AvatarStageActor } from "./AvatarStageActor";`

```tsx
export function AvatarStageActorExample() {
  // Screen-pixel positioning only works under an orthographic camera at zoom 1.
  const snapshot = galleryAvatarSnapshot({ position: { x: 210, y: 396 } });

  return (
    <Canvas
      camera={{ far: 2_500, position: [0, 0, 1_000], zoom: 1 }}
      gl={{ alpha: true }}
      orthographic
    >
      <ambientLight intensity={1.6} />
      <directionalLight intensity={1.7} position={[2, 4, 3]} />
      <Suspense fallback={null}>
        <AvatarStageActor reducedMotion={false} snapshot={snapshot} />
      </Suspense>
    </Canvas>
  );
}
```

## Pitfalls

- **A perspective camera silently mis-places it.** Nothing throws; the avatar
  simply lands somewhere else.
- **Snapshot positions are stage pixels, not canvas-local units.** The
  controller measures the registered stage element; a fixture that renders the
  canvas in a smaller box must supply coordinates in that box's terms (the
  gallery fixture measures itself with a `ResizeObserver` to do this).
- **`reducedMotion` jumps the path to its end** (`progress = 1`) instead of
  animating it. A test asserting an intermediate position will not see one.
- **Scale changes at the 768px breakpoint.** Screenshot comparisons across that
  boundary are not comparing the same thing.
