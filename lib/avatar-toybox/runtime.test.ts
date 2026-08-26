import { describe, expect, it } from "vitest";
import {
  advanceActiveTime,
  collectOverlaps,
  clampAvatarPosition,
  createCollectibleLayout,
  estimatePointerVelocity,
  integrateBrainFood,
  integrateToss,
  isToyboxViewportEligible,
  rebuildUneatenCollectibles,
  resetTossBody,
  type BrainFoodBody,
  type Collectible,
  type TossBody,
} from "./runtime";

const viewport = { width: 1200, height: 800, hudHeight: 96, padding: 24 };

describe("avatar toybox runtime", () => {
  it("uses one CSS-pixel viewport eligibility boundary", () => {
    expect(isToyboxViewportEligible({ width: 900, height: 600 })).toBe(true);
    expect(isToyboxViewportEligible({ width: 899, height: 600 })).toBe(false);
    expect(isToyboxViewportEligible({ width: 900, height: 599 })).toBe(false);
  });

  it("places a stable ordered roster below the HUD and within safe bounds", () => {
    const ids = ["alpha", "beta", "gamma", "delta"];
    const first = createCollectibleLayout(ids, viewport, 22);
    const second = createCollectibleLayout(ids, viewport, 22);

    expect(first).toEqual(second);
    expect(first.map(({ id }) => id)).toEqual(ids);
    for (const item of first) {
      expect(item.position.x).toBeGreaterThanOrEqual(46);
      expect(item.position.x).toBeLessThanOrEqual(1154);
      expect(item.position.y).toBeGreaterThanOrEqual(142);
      expect(item.position.y).toBeLessThanOrEqual(754);
    }
  });

  it("keeps the full avatar inside the field and slides along an edge", () => {
    const initial: BrainFoodBody = {
      position: { x: 1127, y: 400 },
      velocity: { x: 0, y: 0 },
      facing: "right",
      moving: false,
    };
    const moved = integrateBrainFood(
      initial,
      { x: 1, y: 1 },
      5,
      viewport,
      { width: 144, height: 208 },
      false,
    );

    expect(Math.hypot(moved.velocity.x, moved.velocity.y)).toBeLessThanOrEqual(420);
    expect(moved.position.x).toBe(1128);
    expect(moved.velocity.x).toBe(0);
    expect(moved.position.y).toBeGreaterThan(400);
    expect(moved.velocity.y).toBeGreaterThan(0);
    expect(moved.facing).toBe("right");
    expect(moved.moving).toBe(true);

    const damped = integrateBrainFood(
      moved,
      { x: 0, y: 0 },
      0.05,
      viewport,
      { width: 144, height: 208 },
      false,
    );
    expect(Math.abs(damped.velocity.y)).toBeLessThan(Math.abs(moved.velocity.y));
  });

  it("uses immediate bounded steps for reduced motion", () => {
    const initial: BrainFoodBody = {
      position: { x: 100, y: 200 },
      velocity: { x: 300, y: 40 },
      facing: "right",
      moving: true,
    };
    const moved = integrateBrainFood(
      initial,
      { x: -1, y: 1 },
      0.016,
      viewport,
      { width: 144, height: 208 },
      true,
    );

    expect(moved.velocity).toEqual({ x: 0, y: 0 });
    expect(moved.position.x).toBeCloseTo(83.03, 2);
    expect(moved.position.y).toBeCloseTo(216.97, 2);
    expect(moved.facing).toBe("left");
  });

  it("scores overlapping collectibles only once", () => {
    const collectibles: Collectible[] = [
      { id: "hit", position: { x: 100, y: 100 }, radius: 20, eaten: false },
      { id: "miss", position: { x: 300, y: 300 }, radius: 20, eaten: false },
    ];
    const first = collectOverlaps(collectibles, { x: 110, y: 100 }, 18);
    const second = collectOverlaps(first.collectibles, { x: 110, y: 100 }, 18);

    expect(first.collectedIds).toEqual(["hit"]);
    expect(first.collectibles[0]?.eaten).toBe(true);
    expect(second.collectedIds).toEqual([]);
  });

  it("counts only focused visible active time and expires at thirty seconds", () => {
    expect(advanceActiveTime(10, 1, { focused: false, visible: true })).toEqual({
      elapsed: 10,
      complete: false,
    });
    expect(advanceActiveTime(29.98, 5, { focused: true, visible: true })).toEqual({
      elapsed: 30,
      complete: true,
    });
  });

  it("estimates pointer velocity from recent distinct samples", () => {
    expect(
      estimatePointerVelocity([
        { position: { x: 0, y: 0 }, at: 0 },
        { position: { x: 10, y: 5 }, at: 0 },
        { position: { x: 100, y: 50 }, at: 100 },
      ]),
    ).toEqual({ x: 1000, y: 500 });
    expect(estimatePointerVelocity([{ position: { x: 2, y: 3 }, at: 5 }])).toEqual({
      x: 0,
      y: 0,
    });
    expect(
      Math.hypot(
        ...Object.values(estimatePointerVelocity([
          { position: { x: 0, y: 0 }, at: 0 },
          { position: { x: 10_000, y: 10_000 }, at: 10 },
        ])) as [number, number],
      ),
    ).toBeLessThanOrEqual(1800);
  });

  it("applies toss gravity and a bounded squash response", () => {
    const body: TossBody = {
      position: { x: 1180, y: 760 },
      velocity: { x: 600, y: 500 },
      rotation: 0,
      angularVelocity: 3,
      dragging: false,
      impact: 0,
    };
    const tossed = integrateToss(body, 0.05, viewport, { width: 144, height: 208 }, false);
    expect(tossed.position.x).toBeLessThanOrEqual(1128);
    expect(tossed.position.y).toBeLessThanOrEqual(696);
    expect(tossed.velocity.x).toBeLessThan(0);
    expect(tossed.velocity.y).toBeLessThan(0);
    expect(tossed.impact).toBeGreaterThan(0);

    const settled = integrateToss(body, 0.05, viewport, { width: 144, height: 208 }, true);
    expect(settled.velocity).toEqual({ x: 0, y: 0 });
    expect(settled.angularVelocity).toBe(0);
    expect(settled.impact).toBe(0);
  });

  it("sleeps on the floor and returns upright after its bounce energy is spent", () => {
    let body: TossBody = {
      position: { x: 600, y: 300 },
      velocity: { x: 900, y: -450 },
      rotation: 0,
      angularVelocity: 5,
      dragging: false,
      impact: 0,
    };

    for (let frame = 0; frame < 900; frame += 1) {
      body = integrateToss(body, 1 / 60, viewport, { width: 144, height: 208 }, false);
    }

    expect(body.position.y).toBe(696);
    expect(body.velocity).toEqual({ x: 0, y: 0 });
    expect(body.rotation).toBe(0);
    expect(body.angularVelocity).toBe(0);
    expect(body.impact).toBe(0);
  });

  it("clamps a dragged avatar center to the playable field", () => {
    expect(
      clampAvatarPosition({ x: -20, y: 900 }, viewport, { width: 144, height: 208 }),
    ).toEqual({ x: 72, y: 696 });
  });

  it("resets toss state and retains eaten IDs across layout rebuilds", () => {
    expect(resetTossBody(viewport)).toMatchObject({
      position: { x: 600, y: 448 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      dragging: false,
    });

    const original = createCollectibleLayout(["one", "two"], viewport).map((item) =>
      item.id === "one" ? { ...item, eaten: true } : item,
    );
    const resized = rebuildUneatenCollectibles(original, {
      ...viewport,
      width: 1000,
    });
    expect(resized.find(({ id }) => id === "one")?.eaten).toBe(true);
    expect(resized.find(({ id }) => id === "two")?.eaten).toBe(false);
  });
});
