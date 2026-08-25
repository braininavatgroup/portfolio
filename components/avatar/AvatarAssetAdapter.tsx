"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { avatarAsset } from "../../lib/avatar/config";
import type { AllowedAnimation } from "../../lib/avatar/contracts";
import type { AvatarSnapshot } from "../../lib/avatar/controller";
import { ProceduralAvatar } from "./ProceduralAvatar";

type AvatarPoseProps = Pick<AvatarSnapshot, "animation" | "facing" | "pointing">;

type AvatarAssetAdapterProps = AvatarPoseProps & {
  onAvailableAnimationsChange?: (
    available: ReadonlySet<AllowedAnimation>,
  ) => void;
};

export function getAvailableAnimationAliases(
  animations: Record<AllowedAnimation, string>,
  clipNames: Iterable<string>,
) {
  const availableClips = new Set(clipNames);
  return new Set(
    (Object.entries(animations) as Array<[AllowedAnimation, string]>)
      .filter(([, clipName]) => availableClips.has(clipName))
      .map(([animation]) => animation),
  );
}

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
  onAvailableAnimationsChange,
}: AvatarPoseProps & {
  modelUrl: string;
  onAvailableAnimationsChange?: AvatarAssetAdapterProps["onAvailableAnimationsChange"];
}) {
  const root = useRef<THREE.Group>(null);
  const model = useGLTF(modelUrl);
  const { actions, mixer } = useAnimations(model.animations, root);

  useEffect(() => {
    onAvailableAnimationsChange?.(
      getAvailableAnimationAliases(
        avatarAsset.animations,
        model.animations.map((clip) => clip.name),
      ),
    );
  }, [model.animations, onAvailableAnimationsChange]);

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
    return () => {
      next.fadeOut(0.2);
    };
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
  const { onAvailableAnimationsChange, ...pose } = props;
  if (avatarAsset.kind === "procedural") {
    return <ProceduralAvatar {...pose} />;
  }

  const modelUrl = getGlbModelUrl(avatarAsset);
  return modelUrl ? (
    <GlbAvatar
      {...pose}
      modelUrl={modelUrl}
      onAvailableAnimationsChange={onAvailableAnimationsChange}
    />
  ) : null;
}
