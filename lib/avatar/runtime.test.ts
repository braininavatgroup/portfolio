import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANSWER_REACTION_MS,
  BRAIN_FOOD_CELEBRATION_MS,
  AvatarRuntime,
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

  it("shows at the chat dock and hides without an exit performance", () => {
    const avatar = runtime();

    expect(avatar.getSnapshot().visible).toBe(false);
    avatar.show();
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "idle",
      animation: "idle_3",
      position: stage.dock,
      visible: true,
    });

    avatar.hide();
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "hidden",
      animation: "idle_3",
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

    await vi.runAllTimersAsync();
    await swim;
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "idle",
      animation: "idle_3",
      position: stage.dock,
      motion: null,
    });
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
      animation: "idle_3",
      motion: null,
    });
  });

  it("gives Brain Food direct position ownership and celebrates completion", async () => {
    const avatar = runtime();
    avatar.show();
    avatar.beginBrainFood({ x: 500, y: 400 });
    avatar.setBrainFoodPosition({ x: 420, y: 280 }, Math.PI);

    expect(avatar.getSnapshot()).toMatchObject({
      phase: "brain-food",
      animation: "swim_forward",
      position: { x: 420, y: 280 },
      swimHeading: Math.PI,
    });

    const completion = avatar.completeBrainFood();
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "celebrating",
      animation: "cheer_with_both_hands",
    });
    await vi.advanceTimersByTimeAsync(BRAIN_FOOD_CELEBRATION_MS);
    await completion;
    expect(avatar.getSnapshot()).toMatchObject({
      phase: "idle",
      animation: "idle_3",
      position: stage.dock,
    });
  });

  it("suppresses route travel under reduced motion", async () => {
    const avatar = runtime(true);
    avatar.show();

    await avatar.queueSwimLap();

    expect(avatar.getSnapshot()).toMatchObject({
      phase: "idle",
      animation: "idle_3",
      motion: null,
      position: stage.dock,
    });
  });

  it("contains missing-clip failure inside the avatar", () => {
    const avatar = runtime();
    avatar.show();
    avatar.setAvailableClips(new Set(["idle_3", "agree_gesture"]));

    expect(avatar.getSnapshot()).toMatchObject({ failed: true, visible: true });
  });
});
