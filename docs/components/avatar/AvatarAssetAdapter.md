# AvatarAssetAdapter

Source: [`components/avatar/AvatarAssetAdapter.tsx`](../../../components/avatar/AvatarAssetAdapter.tsx) ·
Gallery: `/design#avatar` · Tests: `components/avatar/AvatarAssetAdapter.test.ts`

Loads the textured `/avatars/bradley-quiet-portrait.glb` using
[`lib/avatar/config.ts`](../../../lib/avatar/config.ts) and drives every clip
through `useAnimations`. Locomotion preserves Hips Y but removes X/Z travel;
the controller owns stage position. The climb-out `swimming_to_edge`, full
turns, the wave greeting, and all eight dances play once and hold until the animation changes.

## Props

`animation`, `facing`, and `reducedMotion` are required; `anchor` (`"feet"`
default, or `"center"`), `swimHeadingRadians`, `stageScale`, and
`onAvailableAnimationsChange` are optional. Swim heading uses screen radians
(right `0`, down `π/2`, left `π`) for yaw and ±90° pitch, never roll, on every
prone clip (`isSwimClip`). Standing locomotion (`isProfileClip`) turns a full
quarter into profile for `left` and `right`; gestures keep the slight turn. See
[`AvatarAssetAdapterProps`](../../../components/avatar/AvatarAssetAdapter.tsx).

## Requires

An `@react-three/fiber` `<Canvas>` with its own lights, and a `<Suspense>`
boundary — `useGLTF` suspends while the GLB downloads. The file is built by
`npm run build:avatar` (see `assets/avatar-sources/README.md`).

## Example

```tsx
import { Canvas } from "@react-three/fiber";
import { AvatarAssetAdapter } from "components/avatar/AvatarAssetAdapter";
import { Suspense } from "react";

export function AvatarAssetAdapterExample() {
  return (
    <Canvas camera={{ fov: 30, position: [0, 0, 4] }} gl={{ alpha: true }}>
      <ambientLight intensity={1.6} />
      <directionalLight intensity={1.7} position={[2, 4, 3]} />
      <Suspense fallback={null}>
        <AvatarAssetAdapter
          anchor="center"
          animation="swim_forward"
          facing="right"
          reducedMotion={false}
        />
      </Suspense>
    </Canvas>
  );
}
```

## Pitfalls

- **No `<Suspense>` means the whole canvas subtree suspends**, and with nothing
  to catch it the surrounding tree throws instead of showing a fallback.
- **`anchor` moves the origin.** `"feet"` stands the model on the floor;
  `"center"` centres it and is required for every swimming clip. Turning a
  prone model around a foot origin makes the whole body jump.
- **Orientation is chased, not snapped**: a swim clip swings in from the front.
- **Do not restore Meshy's Hips X/Z travel while also moving the stage group.**
  Two translation owners make the body drift and snap back on every loop.
- **A missing required clip removes only the avatar.** In the live wiring,
  `onAvailableAnimationsChange` marks the runtime failed when any is absent.
- **The scene is cloned per instance** (`cloneSkeleton`) while `useGLTF` caches
  the source: two adapters share the download, not the skeleton.
