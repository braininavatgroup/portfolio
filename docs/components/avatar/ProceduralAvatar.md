# ProceduralAvatar

Source: [`components/avatar/ProceduralAvatar.tsx`](../../../components/avatar/ProceduralAvatar.tsx) ·
Gallery: `/design#avatar`

The fallback rig: a capsule-and-icosahedron figure built from Three.js
primitives, with no downloaded model behind it. Each of the twenty allowed
animation ids maps to one of nine authored joint poses, and `useFrame` lerps
the joints toward that pose while adding stride, talk, and ambient sway derived
from the tone via
[`lib/avatar/render-motion.ts`](../../../lib/avatar/render-motion.ts). It
exists so the avatar can appear before — or instead of — the GLB, and it is
what `AvatarAssetAdapter` renders when `avatarAsset.kind` is `"procedural"`.

## Props

All five are required: `animation` (`AllowedAnimation`), `facing`
(`AvatarFacing`), `pointing` (`"left" | "right" | null`), `reducedMotion`, and
`tone` (`AvatarTone`). Types in
[`lib/avatar/contracts.ts`](../../../lib/avatar/contracts.ts) and
[`lib/avatar/orientation.ts`](../../../lib/avatar/orientation.ts);
`defaultAvatarTone` is the neutral tone.

## Requires

An `@react-three/fiber` `<Canvas>` ancestor — it calls `useFrame` and returns
`<group>`, so it is not valid React DOM. It renders no lights of its own; the
canvas must provide them.

## Example

Import: `import { ProceduralAvatar } from "./ProceduralAvatar";`

```tsx
export function ProceduralAvatarExample() {
  return (
    <Canvas camera={{ fov: 30, position: [0, 0, 4] }} gl={{ alpha: true }}>
      <ambientLight intensity={1.6} />
      <directionalLight intensity={1.7} position={[2, 4, 3]} />
      {/* The rig stands on y=0 and is about 1.5 units tall, so drop it by half
          its height to centre it on the camera target. */}
      <group position={[0, -0.76, 0]}>
        <ProceduralAvatar
          animation="idle_3"
          facing="front"
          pointing={null}
          reducedMotion={false}
          tone={defaultAvatarTone}
        />
      </group>
    </Canvas>
  );
}
```

## Pitfalls

- **It stands on `y = 0` and is about 1.5 units tall after its `0.82` scale.**
  A default R3F camera aims at the origin, so a rig placed at the origin is
  framed from the feet up and the head leaves frame. Offset the parent group.
- **`reducedMotion` only damps the ambient sway.** The pose lerp and the stride
  still run; it is not a freeze.
- **Its materials are hard-coded hex colors**, deliberately: this is Three.js
  material, not CSS, and it is outside the token system. Do not "fix" it by
  reaching for `--world-*` here.
- **`pointing` overrides `facing` for the wave gesture only.** Elsewhere it is
  inert.
- **Client-only.** No SSR — mount it under a lazily imported canvas.
