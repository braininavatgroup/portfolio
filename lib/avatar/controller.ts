import type {
  AllowedAnimation,
  AvatarCommand,
  AvatarState,
  AvatarTargetId,
  AvatarTone,
} from "./contracts";
import { allowedAvatarAnimations, defaultAvatarTone } from "./contracts";
import { getAvatarBehavior } from "./behaviors";
import { resolveAvatarAnimation } from "./state";
import {
  AvatarTargetRegistry,
  type AvatarStageMap,
  type AvatarTargetBounds,
} from "./target-registry";
import type { AvatarFacing } from "./orientation";
import {
  groundedFloorY,
  planSwimLap,
  planSwimPath,
  selectGroundedDock,
  stagePathLength,
  stageTravelDuration,
  targetSwimmingDocks,
  type AvatarLocomotion,
  type AvatarStageMotion,
  type AvatarStagePoint,
  type AvatarStageViewport,
} from "./stage";

export type AvatarSnapshot = {
  state: AvatarState;
  animation: AllowedAnimation;
  currentCommand: AvatarCommand | null;
  target: AvatarTargetId | null;
  position: AvatarStagePoint;
  locomotion: AvatarLocomotion;
  motion: AvatarStageMotion | null;
  facing: AvatarFacing;
  pointing: "left" | "right" | null;
  tone: AvatarTone;
  visible: boolean;
  failed: boolean;
};

export type AvatarHomeDock =
  | { target: AvatarTargetId; side: "left" | "right" }
  | { target: AvatarTargetId; placement: "top" };

type AvatarListener = () => void;

const homeInset = 80;
const avatarWidth = 144;
const actorHalfWidth = avatarWidth / 2;
const targetGap = 16;
const floorBottomInset = 24;
const consoleFootGap = 16;
const swimViewportInset = 24;
const swimObstaclePadding = actorHalfWidth + targetGap;
const defaultViewportWidth = homeInset * 2;
const defaultViewportHeight = homeInset * 2;

function homeX(viewportWidth: number) {
  const minimum = Math.min(homeInset, viewportWidth / 2);
  const maximum = Math.max(minimum, viewportWidth - homeInset);
  return Math.min(maximum, Math.max(minimum, viewportWidth - homeInset));
}

function targetDockX(
  target: AvatarTargetBounds,
  side: "left" | "right",
  viewportWidth: number,
) {
  const minimum = Math.min(actorHalfWidth, viewportWidth / 2);
  const maximum = Math.max(minimum, viewportWidth - actorHalfWidth);
  const x =
    side === "left"
      ? target.left - targetGap - actorHalfWidth
      : target.right + targetGap + actorHalfWidth;
  return Math.min(maximum, Math.max(minimum, x));
}

function createInitialSnapshot(viewport: AvatarStageViewport): AvatarSnapshot {
  return {
    state: "idle",
    animation: "idle_3",
    currentCommand: null,
    target: null,
    position: { x: homeX(viewport.width), y: viewport.floorY },
    locomotion: "grounded",
    motion: null,
    facing: "front",
    pointing: null,
    tone: defaultAvatarTone,
    visible: true,
    failed: false,
  };
}

function facingForSegment(points: readonly AvatarStagePoint[]): AvatarFacing {
  const first = points[0];
  const next = points.find((point, index) =>
    index > 0 && point.x !== first?.x,
  );
  if (!first || !next) return "front";
  return next.x < first.x ? "left" : "right";
}

function facingToward(targetX: number, positionX: number): AvatarFacing {
  if (targetX < positionX) return "left";
  if (targetX > positionX) return "right";
  return "front";
}

function activeSwimmingAnimation(animation: AllowedAnimation): AllowedAnimation {
  return animation === "swim_forward" || animation === "swimming_to_edge"
    ? animation
    : "swim_forward";
}

export class AvatarController {
  #registry: AvatarTargetRegistry;
  #listeners = new Set<AvatarListener>();
  #snapshot: AvatarSnapshot;
  #availableAnimations = new Set<AllowedAnimation>(allowedAvatarAnimations);
  #motionId = 0;
  #homeDock?: AvatarHomeDock;

  constructor(registry: AvatarTargetRegistry) {
    this.#registry = registry;
    this.#snapshot = createInitialSnapshot(this.#stageViewport(this.#registry.resolveStageMap()));
  }

  getSnapshot = () => this.#snapshot;

  subscribe = (listener: AvatarListener) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  setAvailableAnimations = (available: ReadonlySet<AllowedAnimation>) => {
    this.#availableAnimations = new Set(available);
    const failed = allowedAvatarAnimations.some(
      (animation) => !this.#availableAnimations.has(animation),
    );
    if (failed !== this.#snapshot.failed) this.#update({ failed });
  };

  setVisible(visible: boolean) {
    if (!visible) {
      this.#invalidateMotion();
      this.#update({ visible: false, motion: null, locomotion: "grounded" });
      return;
    }
    this.#update({ visible: true });
  }

  markFailed() {
    this.#update({ failed: true });
  }

  reset() {
    this.#invalidateMotion();
    this.#replace(createInitialSnapshot(this.#stageViewport(this.#registry.resolveStageMap())));
  }

  refreshStage(
    rehome = false,
    homeDock?: AvatarHomeDock,
  ) {
    if (homeDock) this.#homeDock = homeDock;
    const stage = this.#registry.resolveStageMap();
    const viewport = this.#stageViewport(stage);
    const minimum = Math.min(actorHalfWidth, viewport.width / 2);
    const maximum = Math.max(minimum, viewport.width - actorHalfWidth);
    const activeHomeDock = homeDock ?? this.#homeDock;
    const dockTarget = activeHomeDock
      ? this.#target(stage, activeHomeDock.target)
      : undefined;
    const x = rehome
      ? dockTarget
        ? "placement" in activeHomeDock!
          ? Math.min(maximum, Math.max(minimum, dockTarget.centerX))
          : targetDockX(dockTarget, activeHomeDock!.side, viewport.width)
        : homeX(viewport.width)
      : Math.min(maximum, Math.max(minimum, this.#snapshot.position.x));
    const stageChanged = rehome || x !== this.#snapshot.position.x;
    const canceledMotion = stageChanged && this.#snapshot.motion !== null;
    const settledState =
      this.#snapshot.state === "entering" || this.#snapshot.state === "exiting"
        ? "idle"
        : this.#snapshot.state;
    if (stageChanged) this.#invalidateMotion();
    this.#update({
      position: { x, y: viewport.floorY },
      ...(dockTarget && stageChanged
        ? {
            ...(canceledMotion
              ? {
                  animation: resolveAvatarAnimation(settledState),
                  state: settledState,
                }
              : {}),
            motion: null,
            locomotion: "grounded" as const,
          }
        : stageChanged
        ? {
            animation: resolveAvatarAnimation("idle"),
            state: "idle" as const,
            motion: null,
            locomotion: "grounded" as const,
            facing: "front" as const,
            pointing: null,
            target: null,
          }
        : {}),
    });
  }

  dispose() {
    this.stopMotion();
  }

  stopMotion() {
    const wasMoving = this.#snapshot.motion !== null;
    this.#invalidateMotion();
    this.#update({
      ...(wasMoving
        ? { state: "idle" as const, animation: resolveAvatarAnimation("idle") }
        : {}),
      motion: null,
      locomotion: "grounded",
    });
  }

  canSwimLap() {
    const stage = this.#registry.resolveStageMap();
    const viewport = this.#stageViewport(stage);
    return this.#planSwimLap(stage, viewport) !== null;
  }

  execute(
    command: Exclude<AvatarCommand, { action: "wait" }>,
    signal?: AbortSignal,
  ): void | Promise<void> {
    switch (command.action) {
      case "setState": {
        const stateAnimation = resolveAvatarAnimation(command.state);
        this.#invalidateMotion();
        this.#update({
          state: command.state,
          animation: stateAnimation,
          currentCommand: command,
          motion: null,
          locomotion: "grounded",
          pointing: null,
          tone: getAvatarBehavior(stateAnimation).tone,
          failed: this.#snapshot.failed || !this.#availableAnimations.has(stateAnimation),
        });
        return;
      }
      case "setTone":
        this.#update({ tone: command.tone, currentCommand: command });
        return;
      case "play":
        this.#invalidateMotion();
        if (!this.#availableAnimations.has(command.animation)) {
          this.#update({ motion: null, locomotion: "grounded", failed: true });
          return;
        }
        this.#update({
          animation: command.animation,
          currentCommand: command,
          motion: null,
          locomotion: "grounded",
          tone: getAvatarBehavior(command.animation).tone,
        });
        return;
      case "enter": {
        const viewport = this.#stageViewport(this.#registry.resolveStageMap());
        const destination = { x: homeX(viewport.width), y: viewport.floorY };
        const start = {
          x: command.from === "left" ? -actorHalfWidth : viewport.width + actorHalfWidth,
          y: destination.y,
        };
        const motion = this.#createMotion("enter", "grounded", [start, destination]);
        this.#update({
          state: "entering",
          animation: resolveAvatarAnimation("entering"),
          currentCommand: command,
          position: destination,
          locomotion: "grounded",
          motion,
          facing: command.from === "left" ? "right" : "left",
          pointing: null,
          visible: true,
        });
        return this.#settleMotion(motion, signal, {
          state: "idle",
          animation: resolveAvatarAnimation("idle"),
          locomotion: "grounded",
          motion: null,
          facing: "front",
        });
      }
      case "exit": {
        const viewport = this.#stageViewport(this.#registry.resolveStageMap());
        const start = this.#groundedPosition(viewport);
        const destination = {
          x: command.to === "left" ? -actorHalfWidth : viewport.width + actorHalfWidth,
          y: start.y,
        };
        const motion = this.#createMotion("exit", "grounded", [start, destination]);
        this.#update({
          state: "exiting",
          animation: resolveAvatarAnimation("exiting"),
          currentCommand: command,
          position: destination,
          locomotion: "grounded",
          motion,
          facing: command.to,
          pointing: null,
        });
        return this.#settleMotion(motion, signal, {
          state: "hidden",
          animation: resolveAvatarAnimation("hidden"),
          locomotion: "grounded",
          motion: null,
          visible: false,
        });
      }
      case "walkTo": {
        const stage = this.#registry.resolveStageMap();
        const target = this.#target(stage, command.target);
        if (!target) return;
        const viewport = this.#stageViewport(stage);
        const start = this.#groundedPosition(viewport);
        const destination = selectGroundedDock({
          current: start,
          target,
          obstacles: this.#stageObstacles(stage, command.target),
          viewport,
          actorHalfWidth,
          gap: targetGap,
        });
        if (!destination) return;
        const motion = this.#createMotion("walk", "grounded", [start, destination]);
        this.#update({
          animation: "walking",
          currentCommand: command,
          target: command.target,
          position: destination,
          locomotion: "grounded",
          motion,
          facing: facingForSegment(motion.points),
          pointing: null,
        });
        return this.#settleMotion(motion, signal, {
          state: "idle",
          animation: resolveAvatarAnimation("idle"),
          locomotion: "grounded",
          motion: null,
          facing: facingToward(target.centerX, destination.x),
        });
      }
      case "swimTo": {
        const stage = this.#registry.resolveStageMap();
        const target = this.#target(stage, command.target);
        if (!target) return;
        const viewport = this.#stageViewport(stage);
        const points = this.#planSwimTo(stage, target, command.target, viewport);
        if (!points) return;
        const motion = this.#createMotion("swim", "swimming", points);
        const destination = motion.points.at(-1)!;
        this.#update({
          state: "idle",
          animation: activeSwimmingAnimation(this.#snapshot.animation),
          currentCommand: command,
          target: command.target,
          position: destination,
          locomotion: "swimming",
          motion,
          facing: facingForSegment(motion.points),
          pointing: null,
        });
        return this.#settleMotion(motion, signal, {
          state: "idle",
          animation: resolveAvatarAnimation("idle"),
          locomotion: "grounded",
          motion: null,
          facing: facingToward(target.centerX, destination.x),
        });
      }
      case "swimRoute": {
        const stage = this.#registry.resolveStageMap();
        const viewport = this.#stageViewport(stage);
        const points = this.#planSwimLap(stage, viewport);
        if (!points) return;
        const motion = this.#createMotion("swim", "swimming", points);
        const destination = motion.points.at(-1)!;
        this.#update({
          state: "idle",
          animation: activeSwimmingAnimation(this.#snapshot.animation),
          currentCommand: command,
          position: destination,
          locomotion: "swimming",
          motion,
          facing: facingForSegment(motion.points),
          pointing: null,
        });
        return this.#settleMotion(motion, signal, {
          state: "idle",
          animation: resolveAvatarAnimation("idle"),
          locomotion: "grounded",
          motion: null,
          facing: "front",
        });
      }
      case "lookAt":
        this.#applyTargetCommand(command, { pointing: null, anchor: false });
        return;
      case "pointAt":
        this.#applyTargetCommand(command, { animation: "wave_one_hand", point: true, anchor: false });
        return;
    }
  }

  #stageViewport(stage: AvatarStageMap): AvatarStageViewport {
    const width = Number.isFinite(stage.viewport.width)
      ? stage.viewport.width
      : defaultViewportWidth;
    const height = Number.isFinite(stage.viewport.height)
      ? stage.viewport.height
      : defaultViewportHeight;
    const consoleTop = stage.obstacles.find(
      ({ obstacle, bounds }) => obstacle === "avatar:director-console" && bounds.inViewport,
    )?.bounds.top;
    const defaultFloorY = groundedFloorY(
      height,
      floorBottomInset,
      consoleTop,
      consoleFootGap,
    );
    const shelfTarget =
      this.#homeDock && "placement" in this.#homeDock
        ? this.#target(stage, this.#homeDock.target)
        : undefined;
    return {
      width,
      height,
      floorY:
        shelfTarget?.inViewport === true
          ? Math.min(defaultFloorY, Math.max(0, shelfTarget.top))
          : defaultFloorY,
    };
  }

  #groundedPosition(viewport: AvatarStageViewport): AvatarStagePoint {
    return { x: this.#snapshot.position.x, y: viewport.floorY };
  }

  #target(stage: AvatarStageMap, target: AvatarTargetId) {
    return stage.targets.find((entry) => entry.target === target)?.bounds;
  }

  #stageObstacles(stage: AvatarStageMap, excludedTarget?: AvatarTargetId) {
    return [
      ...stage.targets
        .filter(({ target }) => target !== excludedTarget)
        .map(({ bounds }) => bounds),
      ...stage.obstacles.map(({ bounds }) => bounds),
    ];
  }

  #planSwimTo(
    stage: AvatarStageMap,
    target: AvatarTargetBounds,
    targetId: AvatarTargetId,
    viewport: AvatarStageViewport,
  ): AvatarStagePoint[] | null {
    const start = this.#groundedPosition(viewport);
    const obstacles = [target, ...this.#stageObstacles(stage, targetId)];
    const dock = selectGroundedDock({
      current: start,
      target,
      obstacles: this.#stageObstacles(stage, targetId),
      viewport,
      actorHalfWidth,
      gap: targetGap,
    });
    if (!dock) return null;

    const approach = planSwimPath({
      start,
      destinations: targetSwimmingDocks({
        target,
        viewport,
        inset: swimViewportInset,
        padding: swimObstaclePadding,
      }),
      obstacles,
      viewport,
      viewportInset: swimViewportInset,
      obstaclePadding: swimObstaclePadding,
    });
    if (!approach) return null;

    const landing = planSwimPath({
      start: approach.at(-1)!,
      destinations: [dock],
      obstacles,
      viewport,
      viewportInset: swimViewportInset,
      obstaclePadding: swimObstaclePadding,
    });
    if (!landing) return null;
    return [...approach, ...landing.slice(1)];
  }

  #planSwimLap(
    stage: AvatarStageMap,
    viewport: AvatarStageViewport,
  ) {
    const dockTarget = this.#homeDock
      ? this.#target(stage, this.#homeDock.target)
      : undefined;
    const minimum = Math.min(actorHalfWidth, viewport.width / 2);
    const maximum = Math.max(minimum, viewport.width - actorHalfWidth);
    const dockX = dockTarget
      ? "placement" in this.#homeDock!
        ? Math.min(maximum, Math.max(minimum, dockTarget.centerX))
        : targetDockX(dockTarget, this.#homeDock!.side, viewport.width)
      : homeX(viewport.width);
    const shelfTarget =
      this.#homeDock && "placement" in this.#homeDock
        ? this.#homeDock.target
        : undefined;
    return planSwimLap({
      start: this.#groundedPosition(viewport),
      dock: { x: dockX, y: viewport.floorY },
      obstacles: this.#stageObstacles(stage, shelfTarget),
      viewport,
      viewportInset: swimViewportInset,
      obstaclePadding: swimObstaclePadding,
    });
  }

  #applyTargetCommand(
    command: Extract<AvatarCommand, { action: "lookAt" | "pointAt" }>,
    options: { animation?: AllowedAnimation; pointing?: null; point?: true; anchor: false },
  ) {
    const bounds = this.#registry.resolve(command.target);
    if (!bounds) return;

    const direction = facingToward(bounds.centerX, this.#snapshot.position.x);
    this.#update({
      currentCommand: command,
      target: command.target,
      ...(options.animation && this.#availableAnimations.has(options.animation)
        ? { animation: options.animation }
        : {}),
      facing: direction,
      pointing: options.point ? direction === "front" ? null : direction : options.pointing ?? null,
    });
  }

  #createMotion(
    kind: AvatarStageMotion["kind"],
    locomotion: AvatarLocomotion,
    points: readonly AvatarStagePoint[],
  ): AvatarStageMotion {
    return {
      id: ++this.#motionId,
      kind,
      locomotion,
      points,
      durationMs: stageTravelDuration(
        stagePathLength(points),
        this.#snapshot.tone.energy,
        locomotion,
      ),
    };
  }

  async #settleMotion(
    motion: AvatarStageMotion,
    signal: AbortSignal | undefined,
    update: Partial<AvatarSnapshot>,
  ) {
    await waitForMotion(motion.durationMs, signal);
    if (this.#snapshot.motion?.id !== motion.id) return;
    if (signal?.aborted) {
      this.#update({
        state: "idle",
        animation: resolveAvatarAnimation("idle"),
        locomotion: "grounded",
        motion: null,
      });
      return;
    }
    this.#update(update);
  }

  #invalidateMotion() {
    this.#motionId += 1;
  }

  #update(update: Partial<AvatarSnapshot>) {
    this.#replace({ ...this.#snapshot, ...update });
  }

  #replace(snapshot: AvatarSnapshot) {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener();
  }
}

function waitForMotion(durationMs: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeoutId = setTimeout(finish, durationMs);
    function finish() {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", finish);
      resolve();
    }
    signal?.addEventListener("abort", finish, { once: true });
  });
}
