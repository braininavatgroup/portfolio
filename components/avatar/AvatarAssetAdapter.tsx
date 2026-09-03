"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { avatarAsset } from "../../lib/avatar/config";
import { getAvatarYaw, type AvatarFacing } from "../../lib/avatar/orientation";
import {
  avatarClips,
  type AvatarClip,
} from "../../lib/avatar/runtime";

type AvatarPoseProps = {
  animation: AvatarClip;
  facing: AvatarFacing;
  reducedMotion: boolean;
};

type AvatarAssetAdapterProps = AvatarPoseProps & {
  anchor?: "feet" | "center";
  swimHeadingRadians?: number | null;
  stageScale?: number;
  onAvailableAnimationsChange?: (
    available: ReadonlySet<AvatarClip>,
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
    (Object.entries(avatarClips) as Array<[AvatarClip, string]>)
      .filter(([, clipName]) => availableClips.has(clipName))
      .map(([id]) => id),
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
  facing: AvatarFacing,
  animation: AvatarClip,
  swimHeadingRadians = 0,
) {
  return animation === "swim_forward"
    ? getAvatarYaw(forwardAxis, "front") + Math.PI / 2 + swimHeadingRadians
    : getAvatarYaw(forwardAxis, facing);
}

export function getGlbOrientation(
  forwardAxis: typeof avatarAsset.forwardAxis,
  facing: AvatarFacing,
  animation: AvatarClip,
  swimHeadingRadians = 0,
) {
  const yaw = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    getGlbYaw(forwardAxis, facing, animation, swimHeadingRadians),
  );
  if (animation !== "swim_forward") return yaw;

  // Decompose the screen heading into horizontal yaw and vertical pitch. The
  // arcsine folds pitch into [-90°, 90°], so down can point fully down while
  // left/right reversals still turn through yaw instead of somersaulting.
  const pitch = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    Math.asin(Math.sin(swimHeadingRadians)),
  );
  return yaw.multiply(pitch);
}

export function makeLocomotionClipInPlace(clip: THREE.AnimationClip) {
  const prepared = clip.clone();
  for (const track of prepared.tracks) {
    if (!/(^|[.\]/])Hips(?:\])?\.position$/.test(track.name)) continue;
    const values = track.values;
    const stride = track.getValueSize();
    if (stride < 3 || values.length < 3) continue;
    const originX = values[0]!;
    const originZ = values[2]!;
    for (let offset = 0; offset < values.length; offset += stride) {
      values[offset] = originX;
      values[offset + 2] = originZ;
    }
  }
  return prepared;
}

export function getAvatarPlaybackRate(animation: AvatarClip) {
  return animation === "swim_forward" ? 0.8 : avatarAsset.playbackRate;
}

export function getAvatarTurnRate(animation: AvatarClip) {
  return animation === "swim_forward" ? 2.2 : 4.5;
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
  swimHeadingRadians,
}: AvatarPoseProps & {
  anchor: "feet" | "center";
  modelUrl: string;
  motionUrl: string;
  onAvailableAnimationsChange?: AvatarAssetAdapterProps["onAvailableAnimationsChange"];
  swimHeadingRadians: number | null;
}) {
  const root = useRef<THREE.Group>(null);
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const model = useGLTF(modelUrl);
  const scene = useMemo(() => cloneAvatarScene(model.scene), [model.scene]);
  const motionLibrary = useGLTF(motionUrl);
  const animationClips = useMemo(
    () =>
      combineAnimationClips(model.animations, motionLibrary.animations).map(
        (clip) =>
          clip.name === avatarClips.swim_forward
            ? makeLocomotionClipInPlace(clip)
            : clip,
      ),
    [model.animations, motionLibrary.animations],
  );
  const { actions } = useAnimations(animationClips, root);
  const playbackRate = getAvatarPlaybackRate(animation);
  const turnRate = getAvatarTurnRate(animation);
  const targetQuaternion = useMemo(
    () =>
      getGlbOrientation(
        avatarAsset.forwardAxis,
        facing,
        animation,
        swimHeadingRadians ?? 0,
      ),
    [animation, facing, swimHeadingRadians],
  );
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

  useFrame((_, delta) => {
    if (root.current) {
      root.current.quaternion.rotateTowards(targetQuaternion, turnRate * delta);
    }
  });

  useEffect(() => {
    return applyBradleySolidMaterial(scene, bradleySolidColor);
  }, [scene]);

  useLayoutEffect(() => {
    const clipName = avatarClips[animation];
    const next = actions[clipName];
    if (!next) return;
    const crossfadeSeconds = reducedMotion ? 0 : 0.24;
    const previous = activeAction.current;
    if (previous === next) {
      next.setEffectiveTimeScale(playbackRate);
      return;
    }
    next.reset().setEffectiveTimeScale(playbackRate).fadeIn(crossfadeSeconds).play();
    if (previous) previous.fadeOut(crossfadeSeconds);
    else next.setEffectiveWeight(1);
    activeAction.current = next;
  }, [actions, animation, playbackRate, reducedMotion]);

  useEffect(
    () => () => {
      activeAction.current?.stop();
      activeAction.current = null;
    },
    [],
  );

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
    swimHeadingRadians = null,
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
        swimHeadingRadians={swimHeadingRadians}
      />
    </group>
  );
}
