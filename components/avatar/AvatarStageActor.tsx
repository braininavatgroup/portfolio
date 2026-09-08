"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { AvatarClip, AvatarSnapshot } from "../../lib/avatar/runtime";
import type { AvatarFacing } from "../../lib/avatar/orientation";
import {
  sampleStagePath,
  screenPointToOrthographic,
  stagePathLength,
  type AvatarStageMotion,
  type AvatarStagePoint,
} from "../../lib/avatar/stage";
import { AvatarAssetAdapter, isSwimClip } from "./AvatarAssetAdapter";

type AvatarStageActorProps = {
  snapshot: AvatarSnapshot;
  reducedMotion: boolean;
  onAvailableAnimationsChange?: (available: ReadonlySet<AvatarClip>) => void;
};

const desktopAvatarStageScale = 104;
const mobileAvatarStageScale = 72;
const minimumAvatarStageScale = 40;
const mobileStageBreakpoint = 768;
const dockFitInset = 16;

/**
 * The normalized two-world-unit avatar remains about 13rem tall on desktop
 * (208px / 2) and 9rem on mobile (144px / 2) when one world unit is one CSS
 * pixel. A dock with a known height caps the figure so it stands inside that
 * area with a 16px headroom, never below an 80px figure.
 */
export function selectAvatarStageScale(
  viewportWidth: number,
  fitHeight: number | null = null,
) {
  const base = viewportWidth <= mobileStageBreakpoint
    ? mobileAvatarStageScale
    : desktopAvatarStageScale;
  if (fitHeight === null || !Number.isFinite(fitHeight) || fitHeight <= 0) return base;
  return Math.max(minimumAvatarStageScale, Math.min(base, (fitHeight - dockFitInset) / 2));
}

function motionPoint(motion: AvatarStageMotion, progress: number) {
  return sampleStagePath(motion.points, progress);
}

function motionFacing(
  motion: AvatarStageMotion,
  progress: number,
  fallback: AvatarFacing,
) {
  if (motion.facing) return motion.facing;
  const targetDistance = stagePathLength(motion.points) * progress;
  let travelled = 0;
  for (let index = 1; index < motion.points.length; index += 1) {
    const from = motion.points[index - 1]!;
    const to = motion.points[index]!;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (travelled + distance >= targetDistance) {
      if (to.x < from.x) return "left" as const;
      if (to.x > from.x) return "right" as const;
      return fallback;
    }
    travelled += distance;
  }
  return fallback;
}

function motionHeading(
  motion: AvatarStageMotion,
  progress: number,
  fallback: number,
) {
  const targetDistance = stagePathLength(motion.points) * progress;
  let travelled = 0;
  for (let index = 1; index < motion.points.length; index += 1) {
    const from = motion.points[index - 1]!;
    const to = motion.points[index]!;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (travelled + distance >= targetDistance) {
      return distance === 0 ? fallback : Math.atan2(to.y - from.y, to.x - from.x);
    }
    travelled += distance;
  }
  return fallback;
}

function visualState(
  snapshot: AvatarSnapshot,
  reducedMotion: boolean,
): { point: AvatarStagePoint; facing: AvatarFacing } {
  if (!snapshot.motion) {
    return { point: snapshot.position, facing: snapshot.facing };
  }
  const progress = reducedMotion ? 1 : 0;
  return {
    point: motionPoint(snapshot.motion, progress),
    facing: motionFacing(snapshot.motion, progress, snapshot.facing),
  };
}

function StageMotionFrame({
  actor,
  motion,
  onFacingChange,
  onHeadingChange,
  fallbackFacing,
  fallbackHeading,
  viewport,
}: {
  actor: React.RefObject<THREE.Group | null>;
  motion: AvatarStageMotion;
  onFacingChange: (facing: AvatarFacing) => void;
  onHeadingChange: (heading: number) => void;
  fallbackFacing: AvatarFacing;
  fallbackHeading: number;
  viewport: { width: number; height: number };
}) {
  const startedAt = useRef<number | null>(null);
  const facing = useRef(motionFacing(motion, 0, fallbackFacing));
  const heading = useRef(motionHeading(motion, 0, fallbackHeading));
  const currentPointRef = useRef(motionPoint(motion, 0));

  useLayoutEffect(() => {
    const position = screenPointToOrthographic(currentPointRef.current, {
      width: viewport.width,
      height: viewport.height,
      floorY: viewport.height,
    });
    actor.current?.position.set(...position);
  }, [actor, viewport.height, viewport.width]);

  useFrame(({ clock }) => {
    if (startedAt.current === null) startedAt.current = clock.elapsedTime;
    const progress = Math.min(
      1,
      Math.max(0, (clock.elapsedTime - startedAt.current) / (motion.durationMs / 1_000)),
    );
    const point = motionPoint(motion, progress);
    currentPointRef.current = point;
    const position = screenPointToOrthographic(point, {
      width: viewport.width,
      height: viewport.height,
      floorY: viewport.height,
    });
    actor.current?.position.set(...position);

    const nextFacing = motionFacing(motion, progress, fallbackFacing);
    if (nextFacing !== facing.current) {
      facing.current = nextFacing;
      onFacingChange(nextFacing);
    }
    const nextHeading = motionHeading(motion, progress, fallbackHeading);
    if (nextHeading !== heading.current) {
      heading.current = nextHeading;
      onHeadingChange(nextHeading);
    }
  });

  return null;
}

function AvatarStageVisual({
  snapshot,
  reducedMotion,
  onAvailableAnimationsChange,
}: AvatarStageActorProps) {
  const { camera, size } = useThree();
  const actor = useRef<THREE.Group>(null);
  const initialVisual = visualState(snapshot, reducedMotion);
  const [facing, setFacing] = useState(initialVisual.facing);
  const [motionSwimHeading, setMotionSwimHeading] = useState(() =>
    snapshot.motion
      ? motionHeading(snapshot.motion, reducedMotion ? 1 : 0, snapshot.swimHeading ?? 0)
      : snapshot.swimHeading ?? 0,
  );

  useLayoutEffect(() => {
    const orthographicCamera = camera as THREE.OrthographicCamera;
    // R3F owns this external camera instance; the viewport bounds must track CSS pixels.
    // eslint-disable-next-line react-hooks/immutability
    orthographicCamera.left = -size.width / 2;
    orthographicCamera.right = size.width / 2;
    orthographicCamera.top = size.height / 2;
    orthographicCamera.bottom = -size.height / 2;
    orthographicCamera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  useLayoutEffect(() => {
    if (snapshot.motion && !reducedMotion) return;
    const position = screenPointToOrthographic(initialVisual.point, {
      width: size.width,
      height: size.height,
      floorY: size.height,
    });
    actor.current?.position.set(...position);
  }, [initialVisual.point, reducedMotion, size.height, size.width, snapshot.motion]);

  return (
    <group ref={actor}>
      {!reducedMotion && snapshot.motion ? (
        <StageMotionFrame
          actor={actor}
          key={snapshot.motion.id}
          fallbackFacing={snapshot.facing}
          fallbackHeading={snapshot.swimHeading ?? 0}
          motion={snapshot.motion}
          onFacingChange={setFacing}
          onHeadingChange={setMotionSwimHeading}
          viewport={size}
        />
      ) : null}
      <AvatarAssetAdapter
        anchor={isSwimClip(snapshot.animation) ? "center" : "feet"}
        animation={snapshot.animation}
        facing={snapshot.motion && !reducedMotion ? facing : snapshot.facing}
        onAvailableAnimationsChange={onAvailableAnimationsChange}
        reducedMotion={reducedMotion}
        swimHeadingRadians={
          isSwimClip(snapshot.animation)
            ? snapshot.motion && !reducedMotion
              ? motionSwimHeading
              : snapshot.motion
                ? motionHeading(snapshot.motion, 1, snapshot.swimHeading ?? 0)
                : snapshot.swimHeading ?? 0
            : null
        }
        stageScale={selectAvatarStageScale(size.width, snapshot.fitHeight)}
      />
    </group>
  );
}

export function AvatarStageActor(props: AvatarStageActorProps) {
  const { reducedMotion, snapshot } = props;
  const visualKey = snapshot.motion
    ? `motion:${snapshot.motion.id}:${reducedMotion}`
    : `stable:${reducedMotion}`;

  return <AvatarStageVisual key={visualKey} {...props} />;
}
