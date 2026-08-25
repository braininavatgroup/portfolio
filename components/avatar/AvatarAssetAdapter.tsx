"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { avatarAsset } from "../../lib/avatar/config";
import type { AvatarSnapshot } from "../../lib/avatar/controller";
import { ProceduralAvatar } from "./ProceduralAvatar";

type AvatarAssetAdapterProps = Pick<AvatarSnapshot, "animation" | "facing" | "pointing">;

function GlbAvatar({ animation, facing }: AvatarAssetAdapterProps) {
  const root = useRef<THREE.Group>(null);
  const model = useGLTF(avatarAsset.modelUrl ?? "/avatar.glb");
  const { actions } = useAnimations(model.animations, root);

  useEffect(() => {
    model.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          if (avatarAsset.nearestTexture) {
            material.map.magFilter = THREE.NearestFilter;
            material.map.minFilter = THREE.NearestFilter;
          }
          material.map.needsUpdate = true;
        }
        material.flatShading = avatarAsset.flatShading;
        material.needsUpdate = true;
      }
    });
  }, [model.scene]);

  useEffect(() => {
    const clipName = avatarAsset.animations[animation];
    const next = actions[clipName];
    if (!next) return;
    next.reset().setEffectiveTimeScale(avatarAsset.playbackRate).fadeIn(0.2).play();
    return () => next.fadeOut(0.2);
  }, [actions, animation]);

  return (
    <group
      ref={root}
      position={[0, avatarAsset.groundOffset, 0]}
      rotation={[0, facing === "left" ? Math.PI : avatarAsset.forwardAxis === "-z" ? Math.PI : 0, 0]}
      scale={avatarAsset.scale}
    >
      <primitive object={model.scene} />
    </group>
  );
}

export function AvatarAssetAdapter(props: AvatarAssetAdapterProps) {
  if (avatarAsset.kind === "procedural") {
    return <ProceduralAvatar {...props} />;
  }

  return <GlbAvatar {...props} />;
}
