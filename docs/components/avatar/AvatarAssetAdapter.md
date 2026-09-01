# AvatarAssetAdapter

Source: [`components/avatar/AvatarAssetAdapter.tsx`](../../../components/avatar/AvatarAssetAdapter.tsx) ·
Gallery: `/design#avatar` · Tests: `components/avatar/AvatarAssetAdapter.test.ts`

The shipped avatar. It reads
[`lib/avatar/config.ts`](../../../lib/avatar/config.ts) and, for the current
`gltf` configuration, loads `/avatars/bradley-meshy-rigged.glb` plus the
separate motion library `/avatars/bradley-motion-library.glb`, merges the clip
sets, and drives them through `useAnimations` with a tone-derived playback rate
and crossfade. When the config says `procedural` it renders
[`ProceduralAvatar`](./ProceduralAvatar.md) instead — the seam that keeps the
fallback real. The module also exports the pure helpers its test pins.

## Props

The four pose fields (`animation`, `facing`, `pointing`, `tone`) plus
`reducedMotion` required; `anchor` (`"feet"` default, or `"center"`),
`stageScale` and `onAvailableAnimationsChange` optional. See
[`AvatarAssetAdapterProps`](../../../components/avatar/AvatarAssetAdapter.tsx).

## Requires

An `@react-three/fiber` `<Canvas>` with its own lights, and a `<Suspense>`
boundary — `useGLTF` suspends while the two GLBs download. Both files must be
present in `public/avatars/`.

## Example

```tsx
import { Canvas } from "@react-three/fiber";
import { AvatarAssetAdapter } from "components/avatar/AvatarAssetAdapter";
import { defaultAvatarTone } from "lib/avatar/contracts";
import { Suspense } from "react";

export function AvatarAssetAdapterExample() {
  return (
    <Canvas camera={{ fov: 30, position: [0, 0, 4] }} gl={{ alpha: true }}>
      <ambientLight intensity={1.6} />
      <directionalLight intensity={1.7} position={[2, 4, 3]} />
      <Suspense fallback={null}>
        <AvatarAssetAdapter
          anchor="center"
          animation="walking"
          facing="right"
          pointing={null}
          reducedMotion={false}
          tone={defaultAvatarTone}
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
  for the stage actor; `"center"` centres it in frame — right for a specimen
  card. The wrong one looks like a broken camera.
- **A missing clip tears the avatar down, loudly.** The previous effect's
  cleanup has already faded the old clip out, so nothing holds the pose; and in
  the live wiring `onAvailableAnimationsChange` is
  `controller.setAvailableAnimations`, which sets `failed` when any allowed
  animation is absent — stopping the avatar rendering and blocking the toybox.
- **The scene is cloned per instance** (`cloneSkeleton`) while `useGLTF` caches
  the source: two adapters share the download, not the skeleton.
- **`glasses` is `null` in the current config**, so `attachBradleyGlasses` is a
  no-op today.
