import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANSWER_REACTION_MS,
  AvatarRuntime,
  BRAIN_FOOD_SWIM_IDLE_SPEED,
  SWIM_DOCKING_MS,
  WAVE_MS,
  avatarDanceDurationsMs,
  avatarClips,
  type AvatarClip,
  avatarDances,
  selectStrollReturn,
  type AvatarStageGeometry,
} from "./runtime";

const stage: AvatarStageGeometry = {
  dock: { x: 920, y: 760 },
  obstacles: [],
  viewport: { width: 1_000, height: 800, floorY: 776 },
};

function runtime(reducedMotion = false) {
  const value = new AvatarRuntime(() => stage);
  value.setReducedMotion(reducedMotion);
  return value;
}

describe("minimal avatar runtime", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reports loading until required clips are ready, and reports failed assets", () => {
    const avatar = runtime();
    expect(avatar.getSnapshot().ready).toBe(false);
    avatar.setAvailableClips(new Set(Object.keys(avatarClips) as AvatarClip[]));
    expect(avatar.getSnapshot().ready).toBe(true);
    avatar.markFailed();
    expect(avatar.getSnapshot()).toMatchObject({ ready: false, failed: true });
  });

  it("follows the shrinking dock through a gesture instead of standing over the answer", async () => {
    // Catches the reaction freezing the figure at the dock it had when the
    // answer started: the Guide's avatar area shrinks as the thread fills, and
    // a frozen figure ends up drawn on top of the reply it is reacting to.
    let current: AvatarStageGeometry = stage;
    const avatar = new AvatarRuntime(() => current);
    avatar.show();

    void avatar.react();
    expect(avatar.getSnapshot()).toMatchObject({ phase: "reacting" });

    current = {
      ...stage,
      dock: { x: 920, y: 420 },
      dockHeight: 96,
    };
    avatar.refreshDock();

    expect(avatar.getSnapshot()).toMatchObject({
      phase: "reacting",
      position: { x: 920, y: 420 },
      fitHeight: 96,
    });

    await vi.advanceTimersByTimeAsync(ANSWER_REACTION_MS);
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "idle",
      position: { x: 920, y: 420 },
      fitHeight: 96,
    });
  });

  it("leaves a travelling figure where it is when the dock moves", async () => {
    // The traversal phases own their own position; re-anchoring them mid-lap
    // would teleport the figure.
    let current: AvatarStageGeometry = stage;
    const avatar = new AvatarRuntime(() => current);
    avatar.show();

    void avatar.queueSwimLap();
    await vi.advanceTimersByTimeAsync(0);
    expect(avatar.getSnapshot().phase).toBe("swimming");
    const travelling = avatar.getSnapshot().position;

    current = { ...stage, dock: { x: 100, y: 100 } };
    avatar.refreshDock();

    expect(avatar.getSnapshot().position).toEqual(travelling);
  });

  it("queues a dedicated wave after the answer and restores the accepted idle", async () => {
    const avatar = runtime(); avatar.show();
    void avatar.react();
    const wave = avatar.queueWave();
    expect(avatar.getSnapshot().animation).toBe("agree_gesture");
    await vi.advanceTimersByTimeAsync(ANSWER_REACTION_MS);
    expect(avatar.getSnapshot()).toMatchObject({ phase: "waving", animation: "wave", motion: null, position: stage.dock });
    await vi.advanceTimersByTimeAsync(WAVE_MS - 1);
    expect(avatar.getSnapshot().phase).toBe("waving");
    await vi.advanceTimersByTimeAsync(1); await wave;
    expect(avatar.getSnapshot()).toMatchObject({ phase: "idle", animation: "idle", position: stage.dock });
  });

  it("cancels a wave without letting its timer interrupt a newer action", async () => {
    const avatar = runtime(); avatar.show();
    void avatar.queueWave(); await vi.advanceTimersByTimeAsync(0);
    avatar.cancel(); void avatar.queueSwimLap(); await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(WAVE_MS);
    expect(avatar.getSnapshot().phase).toBe("swimming");
    avatar.hide(); await vi.runAllTimersAsync();
    expect(avatar.getSnapshot()).toMatchObject({ phase: "hidden", visible: false });
  });

  it("queues a full turn after the answer reaction, then returns to idle", async () => {
    const avatar = runtime(); avatar.show();
    void avatar.react();
    const turn = avatar.queueTurn();
    expect(avatar.getSnapshot().animation).toBe("agree_gesture");
    await vi.advanceTimersByTimeAsync(ANSWER_REACTION_MS);
    expect(avatar.getSnapshot()).toMatchObject({ phase: "turning", animation: "full_turn_left", motion: null });
    await vi.advanceTimersByTimeAsync(8_834);
    await turn;
    expect(avatar.getSnapshot()).toMatchObject({ phase: "idle", animation: "idle", position: stage.dock });
  });

  it("cancels a turn without making a hidden avatar reappear", async () => {
    const avatar = runtime(); avatar.show();
    void avatar.queueTurn(); await vi.advanceTimersByTimeAsync(0);
    avatar.hide(); await vi.runAllTimersAsync();
    expect(avatar.getSnapshot()).toMatchObject({ phase: "hidden", visible: false });
  });

  it("cancels an active stroll when reduced motion is enabled", async () => {
    const avatar = runtime(); avatar.show();
    void avatar.queueStroll(); await vi.advanceTimersByTimeAsync(0);
    expect(avatar.getSnapshot().phase).toBe("strolling");
    avatar.setReducedMotion(true);
    expect(avatar.getSnapshot()).toMatchObject({ phase: "idle", animation: "idle", motion: null });
    await vi.runAllTimersAsync();
    expect(avatar.getSnapshot()).toMatchObject({ phase: "idle", position: stage.dock });
  });

  it("shows at the chat dock and hides without an exit performance", () => {
    const avatar = runtime();

    expect(avatar.getSnapshot().visible).toBe(false);
    avatar.show();
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "idle",
      animation: "idle",
      position: stage.dock,
      visible: true,
    });

    avatar.hide();
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "hidden",
      animation: "idle",
      motion: null,
      visible: false,
    });
  });

  it("plays one reaction before a queued leisurely swim lap", async () => {
    const avatar = runtime();
    avatar.show();

    const reaction = avatar.react();
    const swim = avatar.queueSwimLap();
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "reacting",
      animation: "agree_gesture",
    });

    await vi.advanceTimersByTimeAsync(ANSWER_REACTION_MS);
    await reaction;
    expect(avatar.getSnapshot().phase).toBe("swimming");
    expect(avatar.getSnapshot().animation).toBe("swim_forward");
    expect(avatar.getSnapshot().motion?.durationMs).toBeGreaterThanOrEqual(9_000);

    const lapDuration = avatar.getSnapshot().motion!.durationMs;
    await vi.advanceTimersByTimeAsync(lapDuration);
    // Back at the dock the swimmer climbs out before standing up.
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "docking",
      animation: "swimming_to_edge",
      position: stage.dock,
      motion: null,
      swimHeading: -Math.PI / 2,
    });
    await vi.advanceTimersByTimeAsync(SWIM_DOCKING_MS);
    await swim;
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "idle",
      animation: "idle",
      position: stage.dock,
      motion: null,
    });
  });

  it("strolls to the far end of the floor and backpedals home", async () => {
    const avatar = runtime();
    avatar.show();

    const stroll = avatar.queueStroll();
    await vi.advanceTimersByTimeAsync(0);
    const outbound = avatar.getSnapshot();
    expect(outbound).toMatchObject({
      phase: "strolling",
      animation: "walking",
      facing: "left",
      position: stage.dock,
    });
    expect(outbound.motion).toMatchObject({
      kind: "walk",
      locomotion: "grounded",
      points: [stage.dock, { x: 24, y: stage.dock.y }],
    });
    expect(outbound.motion!.facing).toBeUndefined();

    await vi.advanceTimersByTimeAsync(outbound.motion!.durationMs);
    const inbound = avatar.getSnapshot();
    // 896px home is a run; the runner faces its travel.
    expect(inbound).toMatchObject({
      phase: "strolling",
      animation: "running",
      facing: "right",
      position: { x: 24, y: stage.dock.y },
    });
    expect(inbound.motion).toMatchObject({
      kind: "walk",
      facing: "right",
      points: [{ x: 24, y: stage.dock.y }, stage.dock],
    });
    expect(inbound.motion!.durationMs).toBeLessThan(outbound.motion!.durationMs);

    await vi.advanceTimersByTimeAsync(inbound.motion!.durationMs);
    await stroll;
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "idle",
      animation: "idle",
      position: stage.dock,
      motion: null,
    });
  });

  it("dances the next routine once through at the dock", async () => {
    const avatar = runtime();
    avatar.show();

    const first = avatar.queueDance();
    await vi.advanceTimersByTimeAsync(0);
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "dancing",
      animation: avatarDances[0],
      position: stage.dock,
      facing: "front",
      motion: null,
    });
    await vi.advanceTimersByTimeAsync(avatarDanceDurationsMs[avatarDances[0]] - 1);
    expect(avatar.getSnapshot().phase).toBe("dancing");
    await vi.advanceTimersByTimeAsync(1);
    await first;
    expect(avatar.getSnapshot()).toMatchObject({ phase: "idle", animation: "idle" });

    // Each request takes the next routine in rotation.
    void avatar.queueDance();
    await vi.advanceTimersByTimeAsync(0);
    expect(avatar.getSnapshot().animation).toBe(avatarDances[1]);
    await vi.runAllTimersAsync();
  });

  it("backpedals short returns facing away from travel", () => {
    expect(selectStrollReturn(300)).toMatchObject({
      animation: "back_left_run",
      facesTravel: false,
    });
    expect(selectStrollReturn(900)).toMatchObject({
      animation: "running",
      facesTravel: true,
    });
  });

  it("keeps a stroll inside the pane the figure stands in", async () => {
    const pane = { left: 700, top: 200, right: 1_000, bottom: 776, inViewport: true };
    const avatar = new AvatarRuntime(() => ({
      ...stage,
      dock: { x: 850, y: 776 },
      obstacles: [pane],
    }));
    avatar.show();

    void avatar.queueStroll();
    await vi.advanceTimersByTimeAsync(0);
    const outbound = avatar.getSnapshot();
    expect(outbound.motion?.points).toEqual([
      { x: 850, y: 776 },
      { x: 736, y: 776 },
    ]);
    // A 114px return is a backpedal; the body keeps facing the far end.
    await vi.advanceTimersByTimeAsync(outbound.motion!.durationMs);
    expect(avatar.getSnapshot()).toMatchObject({
      animation: "back_left_run",
      facing: "left",
    });
    expect(avatar.getSnapshot().motion).toMatchObject({ facing: "left" });
    await vi.runAllTimersAsync();
  });

  it("skips a stroll when the floor offers no room", async () => {
    const avatar = new AvatarRuntime(() => ({
      ...stage,
      dock: { x: 60, y: 776 },
      viewport: { width: 120, height: 800, floorY: 776 },
    }));
    avatar.show();

    await avatar.queueStroll();

    expect(avatar.getSnapshot()).toMatchObject({ phase: "idle", motion: null });
  });

  it("cancels queued work when a new turn begins", async () => {
    const avatar = runtime();
    avatar.show();
    void avatar.react();
    void avatar.queueSwimLap();

    avatar.cancel();
    await vi.runAllTimersAsync();

    expect(avatar.getSnapshot()).toMatchObject({
      phase: "idle",
      animation: "idle",
      motion: null,
    });
  });

  it("gives Brain Food direct position ownership and celebrates completion", async () => {
    const avatar = runtime();
    avatar.show();
    avatar.beginBrainFood({ x: 500, y: 400 });
    // The swimmer treads water until it is really moving.
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "brain-food",
      animation: "swim_idle",
      position: { x: 500, y: 400 },
    });
    avatar.setBrainFoodPosition({ x: 420, y: 280 }, Math.PI, BRAIN_FOOD_SWIM_IDLE_SPEED);

    expect(avatar.getSnapshot()).toMatchObject({
      phase: "brain-food",
      animation: "swim_forward",
      position: { x: 420, y: 280 },
      swimHeading: Math.PI,
    });
    avatar.setBrainFoodPosition({ x: 420, y: 280 }, Math.PI, 3);
    expect(avatar.getSnapshot().animation).toBe("swim_idle");
    avatar.setBrainFoodPosition({ x: 410, y: 280 }, Math.PI);
    expect(avatar.getSnapshot().animation).toBe("swim_forward");

    const completion = avatar.completeBrainFood();
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "celebrating",
      animation: avatarDances[0],
    });
    await vi.advanceTimersByTimeAsync(2_999);
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "celebrating",
      animation: avatarDances[0],
    });
    await vi.advanceTimersByTimeAsync(1);
    await completion;
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "idle",
      animation: "idle",
      position: stage.dock,
    });
  });

  it("suppresses route travel under reduced motion", async () => {
    const avatar = runtime(true);
    avatar.show();

    await avatar.queueSwimLap();
    await avatar.queueStroll();

    expect(avatar.getSnapshot()).toMatchObject({
      phase: "idle",
      animation: "idle",
      motion: null,
      position: stage.dock,
    });
  });

  it("contains missing-clip failure inside the avatar", () => {
    const avatar = runtime();
    avatar.show();
    avatar.setAvailableClips(new Set(["idle", "agree_gesture", "swim_forward"]));

    expect(avatar.getSnapshot()).toMatchObject({ failed: true, visible: true });
  });
});
