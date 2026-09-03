# AvatarAssetAdapter

Source: [`components/avatar/AvatarAssetAdapter.tsx`](../../../components/avatar/AvatarAssetAdapter.tsx) ·
Gallery: `/design#avatar` · Tests: `components/avatar/AvatarAssetAdapter.test.ts`

The shipped avatar. It reads
[`lib/avatar/config.ts`](../../../lib/avatar/config.ts) and, for the current
`gltf` configuration, loads `/avatars/bradley-meshy-rigged.glb` plus the
separate motion library `/avatars/bradley-motion-library.glb`, merges the clip
sets, and drives the four supported clips through `useAnimations`. The Meshy
swim clip is converted to in-place locomotion when loaded: its Hips Y motion is
preserved, while Hips X/Z travel is removed so the controller is the sole owner
of stage position. The module also exports the pure helpers its test pins.

## Props

`animation`, `facing`, and `reducedMotion` are required; `anchor` (`"feet"`
default, or `"center"`), `swimHeadingRadians`, `stageScale`, and
`onAvailableAnimationsChange` are optional. A swim heading is measured in the
screen/map plane: right is `0`, down is `Math.PI / 2`, and left is `Math.PI`.
See [`AvatarAssetAdapterProps`](../../../components/avatar/AvatarAssetAdapter.tsx).

## Requires

An `@react-three/fiber` `<Canvas>` with its own lights, and a `<Suspense>`
boundary — `useGLTF` suspends while the two GLBs download. Both files must be
present in `public/avatars/`.

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
- **`anchor` moves the origin.** `"feet"` stands the model on the floor — right
  for standing; `"center"` centres it in frame and is required for swimming.
  Turning a prone model around a foot origin makes the whole body jump.
- **Do not restore Meshy's Hips X/Z travel while also moving the stage group.**
  Two translation owners make the body drift away from its hit area and snap
  backward whenever the five-second clip loops.
- **A missing required clip removes only the avatar.** In the live wiring,
  `onAvailableAnimationsChange` marks the runtime failed when any of the four
  supported clips is absent.
- **The scene is cloned per instance** (`cloneSkeleton`) while `useGLTF` caches
  the source: two adapters share the download, not the skeleton.
