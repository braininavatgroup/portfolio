import type { AvatarFacing } from "./orientation";
import {
  planFloorStroll,
  planSwimLap,
  stagePathLength,
  type AvatarStageMotion,
  type AvatarStagePoint,
  type AvatarStageViewport,
} from "./stage";

export const avatarClips = {
  idle: "Idle",
  agree_gesture: "Agree_Gesture",
  wave: "Wave_One_Hand",
  full_turn_left: "Full_Turn_Left",
  swim_forward: "Swim_Forward",
  swim_idle: "Swim_Idle",
  swimming_to_edge: "swimming_to_edge",
  walking: "Walking",
  running: "Running",
  back_left_run: "BackLeft_run",
  all_night_dance: "All_Night_Dance",
  cardio_dance: "Cardio_Dance",
  denim_pop_dance: "Denim_Pop_Dance",
  funny_dancing_02: "Funny_Dancing_02",
  funny_dancing_03: "Funny_Dancing_03",
  not_your_mom: "Not_Your_Mom",
  step_hip_hop_dance: "Step_Hip_Hop_Dance",
  jazz_dance: "Jazz_Dance",
} as const;

export type AvatarClip = keyof typeof avatarClips;

/** Dances in rotation order; each request takes the next one. */
export const avatarDances = [
  "step_hip_hop_dance",
  "jazz_dance",
  "cardio_dance",
  "funny_dancing_02",
  "all_night_dance",
  "funny_dancing_03",
  "not_your_mom",
  "denim_pop_dance",
] as const satisfies readonly AvatarClip[];

export type AvatarDance = (typeof avatarDances)[number];

/**
 * Shipped dance clip lengths, pinned against the built GLB by the config
 * test. A requested dance plays once through and returns to the dock.
 */
export const avatarDanceDurationsMs: Record<AvatarDance, number> = {
  step_hip_hop_dance: 2_633,
  jazz_dance: 2_800,
  cardio_dance: 4_333,
  funny_dancing_02: 7_533,
  all_night_dance: 8_200,
  funny_dancing_03: 8_067,
  not_your_mom: 10_900,
  denim_pop_dance: 16_033,
};
export type AvatarPhase =
  | "hidden"
  | "idle"
  | "reacting"
  | "swimming"
  | "docking"
  | "strolling"
  | "dancing"
  | "waving"
  | "turning"
  | "brain-food"
  | "celebrating";

/**
 * Phases where the figure stands on the dock and only gestures. These have to
 * follow the dock as it moves: the Guide's avatar area shrinks as the thread
 * fills, and a gesture that ignored the change left the figure standing over
 * the answer it was reacting to. Traversal phases own their own position.
 */
const dockedPhases = new Set<AvatarPhase>([
  "idle",
  "reacting",
  "waving",
  "turning",
  "dancing",
]);

export type AvatarStageObstacle = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  inViewport?: boolean;
};

export type AvatarStageGeometry = {
  dock: AvatarStagePoint;
  /** Height available above the dock for the standing figure, when the dock
   *  is a real layout area; null or absent lets the viewport scale decide. */
  dockHeight?: number | null;
  obstacles: readonly AvatarStageObstacle[];
  /** Swimming may cross its own empty dock area; walking still uses its floor. */
  swimObstacles?: readonly AvatarStageObstacle[];
  viewport: AvatarStageViewport;
};

export type AvatarSnapshot = {
  phase: AvatarPhase;
  animation: AvatarClip;
  position: AvatarStagePoint;
  motion: AvatarStageMotion | null;
  facing: AvatarFacing;
  swimHeading: number | null;
  visible: boolean;
  failed: boolean;
  ready: boolean;
  /** The dock area's height the actor must fit inside, or null. */
  fitHeight: number | null;
};

export const ANSWER_REACTION_MS = 1_600;
export const BRAIN_FOOD_CELEBRATION_MS = 3_000;
/** The swimming-to-edge clip's climb-out, played once the lap reaches the dock. */
export const SWIM_DOCKING_MS = 5_034;
export const FULL_TURN_MS = 8_834;
export const WAVE_MS = 4_100;
/** Below this stage speed the Brain Food swimmer treads water instead of stroking. */
export const BRAIN_FOOD_SWIM_IDLE_SPEED = 16;
const swimViewportInset = 24;
const swimObstaclePadding = 88;
const minimumSwimDurationMs = 9_000;
const maximumSwimDurationMs = 18_000;
const leisurelySwimPixelsPerSecond = 140;
const strollViewportInset = 24;
const strollActorHalfWidth = 36;
const strollActorHeight = 208;
const minimumStrollDistance = 96;
const walkPixelsPerSecond = 120;
const runPixelsPerSecond = 330;
const backpedalPixelsPerSecond = 220;
/** Returns shorter than this backpedal to the dock; longer ones run. */
const backpedalMaximumDistance = 480;
const minimumLegDurationMs = 700;
const maximumLegDurationMs = 6_000;

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

function legDuration(distance: number, pixelsPerSecond: number) {
  return Math.round(
    Math.min(
      maximumLegDurationMs,
      Math.max(minimumLegDurationMs, (distance / pixelsPerSecond) * 1_000),
    ),
  );
}

function oppositeFacing(facing: AvatarFacing): AvatarFacing {
  return facing === "left" ? "right" : facing === "right" ? "left" : "front";
}

/** The return leg of a stroll: a short backpedal, or a run when the dock is far. */
export function selectStrollReturn(distance: number): {
  animation: AvatarClip;
  pixelsPerSecond: number;
  facesTravel: boolean;
} {
  return distance <= backpedalMaximumDistance
    ? { animation: "back_left_run", pixelsPerSecond: backpedalPixelsPerSecond, facesTravel: false }
    : { animation: "running", pixelsPerSecond: runPixelsPerSecond, facesTravel: true };
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
  #danceIndex = 0;
  #queue: Promise<void> = Promise.resolve();
  #snapshot: AvatarSnapshot;

  constructor(readStage: () => AvatarStageGeometry) {
    this.#readStage = readStage;
    const stage = readStage();
    this.#snapshot = {
      phase: "hidden",
      animation: "idle",
      position: stage.dock,
      motion: null,
      facing: "front",
      swimHeading: null,
      visible: false,
      failed: false,
      ready: false,
      fitHeight: stage.dockHeight ?? null,
    };
  }

  getSnapshot = () => this.#snapshot;

  subscribe = (listener: Listener) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  setStageReader(readStage: () => AvatarStageGeometry) {
    this.#readStage = readStage;
  }

  setReducedMotion(reducedMotion: boolean) {
    this.#reducedMotion = reducedMotion;
    if (reducedMotion && ["swimming", "docking", "strolling", "turning", "dancing", "waving"].includes(this.#snapshot.phase)) this.cancel();
  }

  setAvailableClips = (available: ReadonlySet<AvatarClip>) => {
    const failed = (Object.keys(avatarClips) as AvatarClip[]).some(
      (clip) => !available.has(clip),
    );
    if (failed !== this.#snapshot.failed || !this.#snapshot.ready) this.#update({ failed, ready: !failed });
  };

  markFailed = () => {
    this.#update({ failed: true, ready: false });
  };

  show() {
    const { dock, dockHeight } = this.#readStage();
    this.#update({
      phase: "idle",
      animation: "idle",
      position: dock,
      fitHeight: dockHeight ?? null,
      motion: null,
      facing: "front",
      swimHeading: null,
      visible: true,
    });
  }

  refreshDock() {
    if (!dockedPhases.has(this.#snapshot.phase)) return;
    const stage = this.#readStage();
    this.#update({ position: stage.dock, fitHeight: stage.dockHeight ?? null });
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
        obstacles: stage.swimObstacles ?? stage.obstacles,
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
        fitHeight: stage.dockHeight ?? null,
        motion,
        facing: facingForPath(points),
        swimHeading: null,
      });
      await wait(motion.durationMs);
      if (!this.#isCurrent(generation)) return;
      // Arrive facing straight up the dock and climb out before standing.
      this.#update({
        phase: "docking",
        animation: "swimming_to_edge",
        position: stage.dock,
        motion: null,
        facing: facingForPath(points.slice(-2)),
        swimHeading: -Math.PI / 2,
      });
      await wait(SWIM_DOCKING_MS);
      if (!this.#isCurrent(generation)) return;
      this.#idleAtDock();
    });
  }

  /**
   * Walks to the far end of the floor the figure stands on, then comes back
   * to the dock: a short backpedal when the dock is close, a run when it is
   * far. The stage owns the path; both legs play in-place clips.
   */
  queueStroll() {
    return this.#enqueue(async (generation) => {
      if (!this.#canPerform() || this.#reducedMotion) return;
      const stage = this.#readStage();
      const destination = planFloorStroll({
        start: stage.dock,
        obstacles: stage.obstacles,
        viewport: stage.viewport,
        viewportInset: strollViewportInset,
        actorHalfWidth: strollActorHalfWidth,
        actorHeight: strollActorHeight,
        minimumDistance: minimumStrollDistance,
      });
      if (!destination) return;
      const outbound = [stage.dock, destination];
      const distance = stagePathLength(outbound);
      const walk: AvatarStageMotion = {
        id: ++this.#motionId,
        kind: "walk",
        locomotion: "grounded",
        points: outbound,
        durationMs: legDuration(distance, walkPixelsPerSecond),
      };
      this.#update({
        phase: "strolling",
        animation: "walking",
        position: stage.dock,
        fitHeight: stage.dockHeight ?? null,
        motion: walk,
        facing: facingForPath(outbound),
        swimHeading: null,
      });
      await wait(walk.durationMs);
      if (!this.#isCurrent(generation)) return;

      const inbound = [destination, stage.dock];
      const travelFacing = facingForPath(inbound);
      const back = selectStrollReturn(distance);
      const ret: AvatarStageMotion = {
        id: ++this.#motionId,
        kind: "walk",
        locomotion: "grounded",
        points: inbound,
        durationMs: legDuration(distance, back.pixelsPerSecond),
        facing: back.facesTravel ? travelFacing : oppositeFacing(travelFacing),
      };
      this.#update({
        phase: "strolling",
        animation: back.animation,
        position: destination,
        motion: ret,
        facing: ret.facing,
        swimHeading: null,
      });
      await wait(ret.durationMs);
      if (!this.#isCurrent(generation)) return;
      this.#idleAtDock();
    });
  }

  /** Plays the full turn once at the dock when a visitor asks to turn around. */
  queueTurn() {
    return this.#enqueue(async (generation) => {
      if (!this.#canPerform() || this.#reducedMotion) return;
      const stage = this.#readStage();
      this.#update({
        phase: "turning", animation: "full_turn_left", position: stage.dock,
        fitHeight: stage.dockHeight ?? null, motion: null, facing: "front", swimHeading: null,
      });
      await wait(FULL_TURN_MS);
      if (this.#isCurrent(generation)) this.#idleAtDock();
    });
  }

  /** Plays the dedicated greeting once, then returns to the accepted idle pose. */
  queueWave() {
    return this.#enqueue(async (generation) => {
      if (!this.#canPerform()) return;
      const stage = this.#readStage();
      this.#update({
        phase: "waving", animation: "wave", position: stage.dock,
        fitHeight: stage.dockHeight ?? null, motion: null, facing: "front", swimHeading: null,
      });
      await wait(WAVE_MS);
      if (this.#isCurrent(generation)) this.#idleAtDock();
    });
  }

  /** Plays the next dance in rotation once through at the dock. */
  queueDance() {
    return this.#enqueue(async (generation) => {
      if (!this.#canPerform()) return;
      const dance = this.#nextDance();
      const stage = this.#readStage();
      this.#update({
        phase: "dancing",
        animation: dance,
        position: stage.dock,
        fitHeight: stage.dockHeight ?? null,
        motion: null,
        facing: "front",
        swimHeading: null,
      });
      await wait(avatarDanceDurationsMs[dance]);
      if (!this.#isCurrent(generation)) return;
      this.#idleAtDock();
    });
  }

  beginBrainFood(position: AvatarStagePoint) {
    this.#resetQueue();
    this.#update({
      phase: "brain-food",
      animation: "swim_idle",
      position,
      motion: null,
      facing: "right",
      swimHeading: 0,
      visible: true,
    });
  }

  /** Brain Food owns the body; it treads water until it is really moving. */
  setBrainFoodPosition(
    position: AvatarStagePoint,
    swimHeading: number,
    speed = Number.POSITIVE_INFINITY,
  ) {
    if (this.#snapshot.phase !== "brain-food") return;
    this.#update({
      position,
      swimHeading,
      animation: speed >= BRAIN_FOOD_SWIM_IDLE_SPEED ? "swim_forward" : "swim_idle",
    });
  }

  completeBrainFood() {
    this.#resetQueue();
    const generation = this.#generation;
    this.#update({
      phase: "celebrating",
      animation: this.#nextDance(),
      motion: null,
      facing: "front",
      swimHeading: null,
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
    const stage = this.#readStage();
    this.#update({
      phase: "idle",
      animation: "idle",
      position: stage.dock,
      fitHeight: stage.dockHeight ?? null,
      motion: null,
      facing: "front",
      swimHeading: null,
    });
  }

  #nextDance(): AvatarDance {
    const dance = avatarDances[this.#danceIndex % avatarDances.length]!;
    this.#danceIndex += 1;
    return dance;
  }

  #resetQueue() {
    this.#generation += 1;
    this.#queue = Promise.resolve();
  }

  #stop(phase: "hidden" | "idle", visible: boolean) {
    this.#resetQueue();
    const stage = this.#readStage();
    this.#update({
      phase,
      animation: "idle",
      position: stage.dock,
      fitHeight: stage.dockHeight ?? null,
      motion: null,
      facing: "front",
      swimHeading: null,
      visible,
    });
  }

  #update(update: Partial<AvatarSnapshot>) {
    this.#snapshot = { ...this.#snapshot, ...update };
    for (const listener of this.#listeners) listener();
  }
}
