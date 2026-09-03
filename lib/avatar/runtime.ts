import type { AvatarFacing } from "./orientation";
import {
  planSwimLap,
  stagePathLength,
  type AvatarStageMotion,
  type AvatarStagePoint,
  type AvatarStageViewport,
} from "./stage";

export const avatarClips = {
  idle_3: "Idle_3",
  agree_gesture: "Agree_Gesture",
  swim_forward: "Swim_Forward",
  cheer_with_both_hands: "Cheer_with_Both_Hands",
} as const;

export type AvatarClip = keyof typeof avatarClips;
export type AvatarPhase =
  | "hidden"
  | "idle"
  | "reacting"
  | "swimming"
  | "brain-food"
  | "celebrating";

export type AvatarStageObstacle = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  inViewport?: boolean;
};

export type AvatarStageGeometry = {
  dock: AvatarStagePoint;
  obstacles: readonly AvatarStageObstacle[];
  viewport: AvatarStageViewport;
};

export type AvatarSnapshot = {
  phase: AvatarPhase;
  animation: AvatarClip;
  position: AvatarStagePoint;
  motion: AvatarStageMotion | null;
  facing: AvatarFacing;
  visible: boolean;
  failed: boolean;
};

export const ANSWER_REACTION_MS = 1_600;
export const BRAIN_FOOD_CELEBRATION_MS = 1_600;
const swimViewportInset = 24;
const swimObstaclePadding = 88;
const minimumSwimDurationMs = 9_000;
const maximumSwimDurationMs = 18_000;
const leisurelySwimPixelsPerSecond = 140;

type Listener = () => void;

function wait(durationMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, durationMs));
}

function facingForPath(points: readonly AvatarStagePoint[]): AvatarFacing {
  const first = points[0];
  const next = points.find(
    (point, index) => index > 0 && point.x !== first?.x,
  );
  if (!first || !next) return "front";
  return next.x < first.x ? "left" : "right";
}

function swimDuration(points: readonly AvatarStagePoint[]) {
  const duration =
    (stagePathLength(points) / leisurelySwimPixelsPerSecond) * 1_000;
  return Math.round(
    Math.min(maximumSwimDurationMs, Math.max(minimumSwimDurationMs, duration)),
  );
}

export class AvatarRuntime {
  #listeners = new Set<Listener>();
  #readStage: () => AvatarStageGeometry;
  #reducedMotion = false;
  #generation = 0;
  #motionId = 0;
  #queue: Promise<void> = Promise.resolve();
  #snapshot: AvatarSnapshot;

  constructor(readStage: () => AvatarStageGeometry) {
    this.#readStage = readStage;
    this.#snapshot = {
      phase: "hidden",
      animation: "idle_3",
      position: readStage().dock,
      motion: null,
      facing: "front",
      visible: false,
      failed: false,
    };
  }

  getSnapshot = () => this.#snapshot;

  subscribe = (listener: Listener) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  setReducedMotion(reducedMotion: boolean) {
    this.#reducedMotion = reducedMotion;
    if (reducedMotion && this.#snapshot.phase === "swimming") this.cancel();
  }

  setAvailableClips(available: ReadonlySet<AvatarClip>) {
    const failed = (Object.keys(avatarClips) as AvatarClip[]).some(
      (clip) => !available.has(clip),
    );
    if (failed !== this.#snapshot.failed) this.#update({ failed });
  }

  markFailed() {
    this.#update({ failed: true });
  }

  show() {
    const { dock } = this.#readStage();
    this.#update({
      phase: "idle",
      animation: "idle_3",
      position: dock,
      motion: null,
      facing: "front",
      visible: true,
    });
  }

  refreshDock() {
    if (this.#snapshot.phase !== "idle") return;
    this.#update({ position: this.#readStage().dock });
  }

  hide() {
    this.#stop("hidden", false);
  }

  cancel() {
    this.#stop(this.#snapshot.visible ? "idle" : "hidden", this.#snapshot.visible);
  }

  react() {
    if (!this.#canPerform()) return Promise.resolve();
    const generation = this.#generation;
    this.#update({
      phase: "reacting",
      animation: "agree_gesture",
      motion: null,
    });
    const reaction = wait(ANSWER_REACTION_MS).then(() => {
      if (this.#isCurrent(generation)) this.#idleAtDock();
    });
    this.#queue = reaction.catch(() => {});
    return reaction;
  }

  queueSwimLap() {
    return this.#enqueue(async (generation) => {
      if (!this.#canPerform() || this.#reducedMotion) return;
      const stage = this.#readStage();
      const points = planSwimLap({
        start: this.#snapshot.position,
        dock: stage.dock,
        obstacles: stage.obstacles,
        viewport: stage.viewport,
        viewportInset: swimViewportInset,
        obstaclePadding: swimObstaclePadding,
      });
      if (!points) return;
      const motion: AvatarStageMotion = {
        id: ++this.#motionId,
        kind: "swim",
        locomotion: "swimming",
        points,
        durationMs: swimDuration(points),
      };
      this.#update({
        phase: "swimming",
        animation: "swim_forward",
        position: stage.dock,
        motion,
        facing: facingForPath(points),
      });
      await wait(motion.durationMs);
      if (!this.#isCurrent(generation)) return;
      this.#idleAtDock();
    });
  }

  beginBrainFood(position: AvatarStagePoint) {
    this.#resetQueue();
    this.#update({
      phase: "brain-food",
      animation: "swim_forward",
      position,
      motion: null,
      facing: "right",
      visible: true,
    });
  }

  setBrainFoodPosition(position: AvatarStagePoint, facing: AvatarFacing) {
    if (this.#snapshot.phase !== "brain-food") return;
    this.#update({ position, facing });
  }

  completeBrainFood() {
    this.#resetQueue();
    const generation = this.#generation;
    this.#update({
      phase: "celebrating",
      animation: "cheer_with_both_hands",
      motion: null,
    });
    return wait(BRAIN_FOOD_CELEBRATION_MS).then(() => {
      if (this.#isCurrent(generation)) this.#idleAtDock();
    });
  }

  #enqueue(work: (generation: number) => Promise<void>) {
    const generation = this.#generation;
    const run = () =>
      this.#isCurrent(generation) ? work(generation) : Promise.resolve();
    const queued = this.#queue.then(run, run);
    this.#queue = queued.catch(() => {});
    return queued;
  }

  #canPerform() {
    return this.#snapshot.visible && !this.#snapshot.failed;
  }

  #isCurrent(generation: number) {
    return generation === this.#generation;
  }

  #idleAtDock() {
    this.#update({
      phase: "idle",
      animation: "idle_3",
      position: this.#readStage().dock,
      motion: null,
      facing: "front",
    });
  }

  #resetQueue() {
    this.#generation += 1;
    this.#queue = Promise.resolve();
  }

  #stop(phase: "hidden" | "idle", visible: boolean) {
    this.#resetQueue();
    this.#update({
      phase,
      animation: "idle_3",
      position: this.#readStage().dock,
      motion: null,
      facing: "front",
      visible,
    });
  }

  #update(update: Partial<AvatarSnapshot>) {
    this.#snapshot = { ...this.#snapshot, ...update };
    for (const listener of this.#listeners) listener();
  }
}
