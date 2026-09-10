# AvatarStageActor

Source: [`components/avatar/AvatarStageActor.tsx`](../../../components/avatar/AvatarStageActor.tsx) ·
Gallery: `/design#avatar` · Tests: `components/avatar/AvatarStageActor.test.tsx`

The bridge between the runtime's screen-space model of the stage and the 3D
scene. It takes an `AvatarSnapshot` — position in CSS pixels, facing, swim
heading, animation, motion path — converts the point through `screenPointToOrthographic`
and places an [`AvatarAssetAdapter`](./AvatarAssetAdapter.md) there at a
scale from `selectAvatarStageScale` (104 desktop, 72 at 768px and below,
capped to `snapshot.fitHeight` with 16px headroom, floor 40, so a short dock
shrinks the figure). While a `motion` path is present it samples the path
each frame and derives heading from direction of travel. Swim heading rotates
the rig through its horizontal pool plane and adds full pitch for vertical
travel; straight, diagonal, and reverse paths never roll the swimmer.

## Props

`snapshot` and `reducedMotion` required; `onAvailableAnimationsChange`
optional, normally `runtime.setAvailableClips`. See `AvatarSnapshot` in
[`lib/avatar/runtime.ts`](../../../lib/avatar/runtime.ts).

## Requires

An **orthographic** `<Canvas>` at `zoom: 1` — the screen-pixel mapping assumes
it. Lights and a `<Suspense>` boundary come from the canvas, as for the
adapter.

## Example

```tsx
import { Canvas } from "@react-three/fiber";
import { galleryAvatarSnapshot } from "app/design/fixtures";
import { AvatarStageActor } from "components/avatar/AvatarStageActor";
import { Suspense } from "react";

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

- **A perspective camera silently mis-places it** without throwing.
- **Snapshot positions are stage pixels, not canvas-local units.** A fixture
  rendering the canvas in a smaller box must supply coordinates in that box's
  terms — the gallery fixture measures itself with a `ResizeObserver` to do it.
- **`reducedMotion` jumps the path to its end** (`progress = 1`) rather than
  animating, so no intermediate position is observable.
- **Scale changes at 768px.** Screenshots either side are not comparable. The
  two scale constants are module-private; only `selectAvatarStageScale` is
  exported.
- **Stable movement must not remount the asset.** Brain Food updates position
  every frame; the actor keeps one animated GLB mounted and moves only its
  outer group.
- **Swimming is center-anchored.** A standing pivot makes prone turns jump.
