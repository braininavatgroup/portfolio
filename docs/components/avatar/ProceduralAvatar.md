# ProceduralAvatar

Source: [`components/avatar/ProceduralAvatar.tsx`](../../../components/avatar/ProceduralAvatar.tsx) ·
Gallery: `/design#avatar`

A capsule-and-icosahedron figure built from Three.js
primitives, with no downloaded model behind it. Each allowed animation id maps
to one of nine authored joint poses, and `useFrame` lerps the joints toward
that pose while adding stride, talk and ambient sway derived from the tone via
[`lib/avatar/render-motion.ts`](../../../lib/avatar/render-motion.ts). It is **not** a runtime fallback: the swappable-renderer switch it hung from
was deleted once nothing wired it to a load failure, so this renders only in
the `/design` gallery and in the cheat-sheet examples. Reinstating it as a
fallback means wiring it to `controller.markFailed()`, not restoring a config
flag.

## Props

All five required: `animation`, `facing`, `pointing`, `reducedMotion`, `tone`.
Types in [`lib/avatar/contracts.ts`](../../../lib/avatar/contracts.ts) and
[`lib/avatar/orientation.ts`](../../../lib/avatar/orientation.ts);
`defaultAvatarTone` is the neutral tone.

## Requires

An `@react-three/fiber` `<Canvas>` ancestor — it calls `useFrame` and returns
`<group>`, so it is not valid React DOM. It renders no lights of its own.

## Example

```tsx
import { Canvas } from "@react-three/fiber";
import { ProceduralAvatar } from "components/avatar/ProceduralAvatar";
import { defaultAvatarTone } from "lib/avatar/contracts";

export function ProceduralAvatarExample() {
  return (
    <Canvas camera={{ fov: 30, position: [0, 0, 4] }} gl={{ alpha: true }}>
      <ambientLight intensity={1.6} />
      <directionalLight intensity={1.7} position={[2, 4, 3]} />
      {/* The rig is about 1.85 units tall, ~1.71 of it above the origin, so
          drop it to centre that mass on the camera target. */}
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

- **It is about 1.85 units tall after its `0.82` scale**, roughly 1.71 of that
  above the origin, with the feet fractionally below y = 0. A default camera
  aimed at the origin puts the head out of frame, so offset the parent group.
- **`reducedMotion` removes the ambient sway entirely**, not damps it. The pose
  lerp and the stride still run; it is not a freeze.
- **`pointing` only affects `wave_one_hand`, and only leftward.** It is inert
  for every other animation, and `pointing: "right"` changes nothing anywhere.
- **Its materials are hard-coded hex**, deliberately: Three.js material is
  outside the CSS token system. Do not reach for `--world-*` here.
