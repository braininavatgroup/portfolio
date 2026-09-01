"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { avatarBehaviors, getAvatarBehavior } from "../../lib/avatar/behaviors";
import { avatarAsset } from "../../lib/avatar/config";
import type { AllowedAnimation } from "../../lib/avatar/contracts";
import type { AvatarSnapshot } from "../../lib/avatar/controller";
import { getAvatarYaw } from "../../lib/avatar/orientation";
import {
  avatarAmbientAmplitude,
  avatarCrossfadeSeconds,
  avatarPlaybackRate,
} from "../../lib/avatar/render-motion";

type AvatarPoseProps = Pick<
  AvatarSnapshot,
  "animation" | "facing" | "pointing" | "tone"
> & {
  reducedMotion: boolean;
};

type AvatarAssetAdapterProps = AvatarPoseProps & {
  anchor?: "feet" | "center";
  stageScale?: number;
  onAvailableAnimationsChange?: (
    available: ReadonlySet<AllowedAnimation>,
  ) => void;
};

const bradleySolidColor = "#3a4954";

export function applyBradleySolidMaterial(
  scene: THREE.Object3D,
  color: THREE.ColorRepresentation,
) {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.55,
    metalness: 0,
    opacity: 1,
    roughness: 1,
    side: THREE.DoubleSide,
    transparent: false,
    vertexColors: false,
  });
  const originals: Array<{
    mesh: THREE.Mesh;
    material: THREE.Material | THREE.Material[];
  }> = [];

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    originals.push({ mesh: object, material: object.material });
    object.material = Array.isArray(object.material)
      ? object.material.map(() => material)
      : material;
  });

  return () => {
    for (const original of originals) {
      original.mesh.material = original.material;
    }
    material.dispose();
  };
}

export function getAvatarStageScale(stageScale = 1) {
  return stageScale;
}

export function getGlbFootOriginTranslation(
  groundOffset: number,
  rawMinimumY: number,
) {
  return -(groundOffset + rawMinimumY);
}

// The checked-in Bradley GLB POSITION accessor has these raw Y bounds.
const bradleyRawMinimumY = 0;
const bradleyRawMaximumY = 1.6399997472763062;

export function getAvatarModelOriginY(
  anchor: "feet" | "center",
  rawMinimumY: number,
  rawMaximumY: number,
) {
  return anchor === "center"
    ? -(rawMinimumY + rawMaximumY) / 2
    : rawMinimumY === 0
      ? 0
      : -rawMinimumY;
}

export function getBradleyGlbFootOriginTranslation() {
  return getGlbFootOriginTranslation(
    avatarAsset.groundOffset,
    bradleyRawMinimumY,
  );
}

export function getAvailableAnimationIds(clipNames: Iterable<string>) {
  const availableClips = new Set(clipNames);
  return new Set(
    avatarBehaviors
      .filter(({ clipName }) => availableClips.has(clipName))
      .map(({ id }) => id),
  );
}

export function combineAnimationClips(
  nativeClips: readonly THREE.AnimationClip[],
  externalClips: readonly THREE.AnimationClip[],
) {
  const nativeNames = new Set(nativeClips.map((clip) => clip.name));
  return [
    ...nativeClips,
    ...externalClips.filter((clip) => !nativeNames.has(clip.name)),
  ];
}

export function getGlbYaw(
  forwardAxis: typeof avatarAsset.forwardAxis,
  facing: AvatarSnapshot["facing"],
) {
  return getAvatarYaw(forwardAxis, facing);
}

export function cloneAvatarScene(scene: THREE.Group) {
  return cloneSkeleton(scene) as THREE.Group;
}

function GlbAvatar({
  anchor,
  animation,
  facing,
  modelUrl,
  motionUrl,
  onAvailableAnimationsChange,
  reducedMotion,
  tone,
}: AvatarPoseProps & {
  anchor: "feet" | "center";
  modelUrl: string;
  motionUrl: string;
  onAvailableAnimationsChange?: AvatarAssetAdapterProps["onAvailableAnimationsChange"];
}) {
  const root = useRef<THREE.Group>(null);
  const model = useGLTF(modelUrl);
  const scene = useMemo(() => cloneAvatarScene(model.scene), [model.scene]);
  const motionLibrary = useGLTF(motionUrl);
  const animationClips = useMemo(
    () => combineAnimationClips(model.animations, motionLibrary.animations),
    [model.animations, motionLibrary.animations],
  );
  const { actions } = useAnimations(animationClips, root);
  const playbackRate = avatarPlaybackRate(tone, avatarAsset.playbackRate);
  const ambientAmplitude = avatarAmbientAmplitude(tone, reducedMotion);
  const modelOriginY = getAvatarModelOriginY(
    anchor,
    bradleyRawMinimumY,
    bradleyRawMaximumY,
  );

  useEffect(() => {
    onAvailableAnimationsChange?.(
      getAvailableAnimationIds(animationClips.map((clip) => clip.name)),
    );
  }, [animationClips, onAvailableAnimationsChange]);

  useFrame(({ clock }, delta) => {
    if (root.current) {
      root.current.rotation.y = THREE.MathUtils.damp(
        root.current.rotation.y,
        getGlbYaw(avatarAsset.forwardAxis, facing),
        9,
        delta,
      );
      root.current.rotation.z =
        Math.sin(clock.elapsedTime * 1.35) * ambientAmplitude;
      root.current.position.y =
        modelOriginY +
        Math.sin(clock.elapsedTime * 1.7) * ambientAmplitude * 0.45;
    }
  });

  useEffect(() => {
    return applyBradleySolidMaterial(scene, bradleySolidColor);
  }, [scene]);

  useEffect(() => {
    const clipName = getAvatarBehavior(animation).clipName;
    const next = actions[clipName];
    if (!next) return;
    const crossfadeSeconds = avatarCrossfadeSeconds(tone);
    next.reset().setEffectiveTimeScale(playbackRate).fadeIn(crossfadeSeconds).play();
    return () => {
      next.fadeOut(crossfadeSeconds);
    };
  }, [actions, animation, playbackRate, tone]);

  return (
    <group
      ref={root}
      position={[0, modelOriginY, 0]}
      rotation={[0, 0, 0]}
      scale={avatarAsset.scale}
    >
      <primitive dispose={null} object={scene} />
    </group>
  );
}

export function AvatarAssetAdapter(props: AvatarAssetAdapterProps) {
  const {
    anchor = "feet",
    onAvailableAnimationsChange,
    stageScale,
    ...pose
  } = props;
  return (
    <group scale={getAvatarStageScale(stageScale)}>
      <GlbAvatar
        {...pose}
        anchor={anchor}
        modelUrl={avatarAsset.modelUrl}
        motionUrl={avatarAsset.motionUrl}
        onAvailableAnimationsChange={onAvailableAnimationsChange}
      />
    </group>
  );
}
