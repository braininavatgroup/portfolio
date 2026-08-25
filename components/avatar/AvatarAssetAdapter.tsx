"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { avatarAsset } from "../../lib/avatar/config";
import type { AvatarSnapshot } from "../../lib/avatar/controller";
import { ProceduralAvatar } from "./ProceduralAvatar";

type AvatarAssetAdapterProps = Pick<AvatarSnapshot, "animation" | "facing" | "pointing">;

export function getGlbModelUrl(asset: Pick<typeof avatarAsset, "kind" | "modelUrl">) {
  return asset.kind === "gltf" ? asset.modelUrl : null;
}

export function getGlbYaw(
  forwardAxis: typeof avatarAsset.forwardAxis,
  facing: "left" | "right",
) {
  const axisCorrection = forwardAxis === "-z" ? Math.PI : 0;
  const facingRotation = facing === "left" ? Math.PI : 0;
  return axisCorrection + facingRotation;
}

export function getAnimationMixerTime(
  elapsedSeconds: number,
  targetFrameRate: typeof avatarAsset.targetFrameRate,
) {
  if (targetFrameRate === null) return elapsedSeconds;
  const frameDuration = 1 / targetFrameRate;
  return Math.floor(elapsedSeconds / frameDuration) * frameDuration;
}

function GlbAvatar({
  animation,
  facing,
  modelUrl,
}: AvatarAssetAdapterProps & { modelUrl: string }) {
  const root = useRef<THREE.Group>(null);
  const model = useGLTF(modelUrl);
  const { actions, mixer } = useAnimations(model.animations, root);

  useFrame(({ clock }) => {
    if (avatarAsset.targetFrameRate === null) return;
    mixer.setTime(
      getAnimationMixerTime(clock.elapsedTime, avatarAsset.targetFrameRate) *
        avatarAsset.playbackRate,
    );
  });

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
      rotation={[0, getGlbYaw(avatarAsset.forwardAxis, facing), 0]}
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

  const modelUrl = getGlbModelUrl(avatarAsset);
  return modelUrl ? <GlbAvatar {...props} modelUrl={modelUrl} /> : null;
}
