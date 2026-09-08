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
  avatarDances,
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

export function getAvatarStageScale(stageScale = 1) {
  return stageScale;
}

export function getGlbFootOriginTranslation(
  groundOffset: number,
  rawMinimumY: number,
) {
  return -(groundOffset + rawMinimumY);
}

// The checked-in Bradley portrait GLB POSITION accessor has these raw Y bounds.
const bradleyRawMinimumY = 0;
const bradleyRawMaximumY = 1.667199730873108;

const swimClips: ReadonlySet<AvatarClip> = new Set<AvatarClip>([
  "swim_forward",
  "swim_idle",
  "swimming_to_edge",
]);

/** Locomotion clips whose Meshy root travel the stage controller owns. */
const inPlaceClips: ReadonlySet<AvatarClip> = new Set<AvatarClip>([
  "swim_forward",
  "swim_idle",
  "swimming_to_edge",
  "walking",
  "running",
  "back_left_run",
]);

const clipNameToId = new Map(
  (Object.entries(avatarClips) as Array<[AvatarClip, string]>).map(
    ([id, name]) => [name, id] as const,
  ),
);

/** Standing locomotion turns the figure fully into profile toward its travel. */
const profileClips: ReadonlySet<AvatarClip> = new Set<AvatarClip>([
  "walking",
  "running",
  "back_left_run",
]);

/** Prone swimming clips are centred in frame; everything else stands on its feet. */
export function isSwimClip(animation: AvatarClip) {
  return swimClips.has(animation);
}

export function isProfileClip(animation: AvatarClip) {
  return profileClips.has(animation);
}

export function isInPlaceClip(clipName: string) {
  const id = clipNameToId.get(clipName);
  return id !== undefined && inPlaceClips.has(id);
}

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

export function getGlbYaw(
  forwardAxis: typeof avatarAsset.forwardAxis,
  facing: AvatarFacing,
  animation: AvatarClip,
  swimHeadingRadians = 0,
) {
  if (isSwimClip(animation)) {
    return getAvatarYaw(forwardAxis, "front") + Math.PI / 2 + swimHeadingRadians;
  }
  if (isProfileClip(animation) && facing !== "front") {
    return getAvatarYaw(forwardAxis, "front") + (facing === "right" ? Math.PI / 2 : -Math.PI / 2);
  }
  return getAvatarYaw(forwardAxis, facing);
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
  if (!isSwimClip(animation)) {
    // Meshy's standing clips rest a few degrees back from the ankles; tip the
    // whole figure forward about its feet so it stands square to the visitor.
    return yaw.multiply(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        avatarAsset.standingPitchRadians,
      ),
    );
  }

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

/** Completed performances hold their final frame until the runtime returns to idle. */
export function isOneShotClip(animation: AvatarClip) {
  return animation === "swimming_to_edge" || animation === "wave" || animation === "full_turn_left" ||
    (avatarDances as readonly AvatarClip[]).includes(animation);
}

export function configureActionLoop(
  action: THREE.AnimationAction,
  animation: AvatarClip,
) {
  const oneShot = isOneShotClip(animation);
  action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, Number.POSITIVE_INFINITY);
  action.clampWhenFinished = oneShot;
  return action;
}

export function getAvatarTurnRate(animation: AvatarClip) {
  return isSwimClip(animation) ? 2.2 : 4.5;
}

export function cloneAvatarScene(scene: THREE.Group) {
  return cloneSkeleton(scene) as THREE.Group;
}

function GlbAvatar({
  anchor,
  animation,
  facing,
  modelUrl,
  onAvailableAnimationsChange,
  reducedMotion,
  swimHeadingRadians,
}: AvatarPoseProps & {
  anchor: "feet" | "center";
  modelUrl: string;
  onAvailableAnimationsChange?: AvatarAssetAdapterProps["onAvailableAnimationsChange"];
  swimHeadingRadians: number | null;
}) {
  const root = useRef<THREE.Group>(null);
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const model = useGLTF(modelUrl);
  const scene = useMemo(() => cloneAvatarScene(model.scene), [model.scene]);
  const animationClips = useMemo(
    () =>
      model.animations.map((clip) =>
        isInPlaceClip(clip.name) ? makeLocomotionClipInPlace(clip) : clip,
      ),
    [model.animations],
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
    configureActionLoop(next.reset(), animation)
      .setEffectiveTimeScale(playbackRate)
      .fadeIn(crossfadeSeconds)
      .play();
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
        onAvailableAnimationsChange={onAvailableAnimationsChange}
        swimHeadingRadians={swimHeadingRadians}
      />
    </group>
  );
}
