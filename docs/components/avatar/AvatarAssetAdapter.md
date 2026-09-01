# AvatarAssetAdapter

Source: [`components/avatar/AvatarAssetAdapter.tsx`](../../../components/avatar/AvatarAssetAdapter.tsx) ·
Gallery: `/design#avatar` · Tests: `components/avatar/AvatarAssetAdapter.test.ts`

The shipped avatar. It reads
[`lib/avatar/config.ts`](../../../lib/avatar/config.ts) and, for the current
`gltf` configuration, loads `/avatars/bradley-meshy-rigged.glb` plus the
separate motion library `/avatars/bradley-motion-library.glb`, merges the two
clip sets, and drives them through `useAnimations` with a tone-derived playback
rate and crossfade. When the config says `procedural` it renders
[`ProceduralAvatar`](./ProceduralAvatar.md) instead, which is the seam that
keeps the fallback real. The module also exports the pure helpers the tests
pin: `combineAnimationClips`, `getAvailableAnimationIds`,
`getGlbFootOriginTranslation`, `getGlbYaw`, `getAnimationMixerTime`,
`cloneAvatarScene`, `applyBradleySolidMaterial`.

## Props

The four pose fields (`animation`, `facing`, `pointing`, `tone`) plus
`reducedMotion` are required; `anchor` (`"feet"` default, or `"center"`),
`stageScale`, and `onAvailableAnimationsChange` are optional. See
[`AvatarAssetAdapterProps`](../../../components/avatar/AvatarAssetAdapter.tsx).

## Requires

An `@react-three/fiber` `<Canvas>` with its own lights, and a `<Suspense>`
boundary — `useGLTF` suspends while the two GLBs download. Both files must be
present in `public/avatars/`.

## Example

Import: `import { AvatarAssetAdapter } from "./AvatarAssetAdapter";`

```tsx
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

- **No `<Suspense>` means the whole canvas subtree suspends.** With nothing to
  catch it, the surrounding tree throws rather than showing a fallback.
- **`anchor` changes where the origin sits.** `"feet"` puts the model on the
  floor — right for the stage actor; `"center"` centres it in frame — right for
  a specimen card. Picking the wrong one looks like a broken camera.
- **An animation whose clip is missing from the library is a silent no-op.**
  The effect returns early rather than falling back, so the avatar holds its
  previous pose. `onAvailableAnimationsChange` is how the controller learns
  which ids actually exist.
- **The scene is cloned per instance** (`cloneSkeleton`), but `useGLTF` caches
  the source. Two adapters share the download and not the skeleton.
- **`glasses` is `null` in the current config**, so `attachBradleyGlasses` is a
  no-op today. The rigged model already has them.
