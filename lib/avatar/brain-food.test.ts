import { describe, expect, it } from "vitest";
import {
  BRAIN_FOOD_MAX_SPEED,
  collectBrainFoodNodes,
  findBrainFoodSpawn,
  integrateBrainFood,
  isBrainFoodComplete,
  type BrainFoodBody,
} from "./brain-food";

const bounds = { width: 800, height: 600, padding: 48 };
const body: BrainFoodBody = {
  position: { x: 400, y: 300 },
  velocity: { x: 0, y: 0 },
  heading: 0,
};

describe("Brain Food motion", () => {
  it("normalizes diagonal input and caps swimming speed", () => {
    let current = { ...body, position: { x: 5_000, y: 5_000 } };
    for (let frame = 0; frame < 300; frame += 1) {
      current = integrateBrainFood(
        current,
        { x: 1, y: 1 },
        1 / 60,
        { width: 10_000, height: 10_000, padding: 48 },
        false,
      );
    }

    expect(Math.hypot(current.velocity.x, current.velocity.y)).toBeCloseTo(
      BRAIN_FOOD_MAX_SPEED,
      4,
    );
    expect(current.velocity.x).toBeCloseTo(current.velocity.y, 4);
    expect(BRAIN_FOOD_MAX_SPEED).toBeLessThanOrEqual(240);
  });

  it("slows for a bounded in-water turn instead of swimming backward", () => {
    const movingRight = {
      ...body,
      velocity: { x: BRAIN_FOOD_MAX_SPEED, y: 0 },
    };

    const next = integrateBrainFood(
      movingRight,
      { x: -1, y: 0 },
      1 / 60,
      bounds,
      false,
    );

    expect(next.heading).toBeCloseTo(2.2 / 60);
    expect(next.velocity).toEqual({ x: 0, y: 0 });
    expect(next.position.x).toBe(movingRight.position.x);

    let turned = next;
    for (let frame = 0; frame < 60; frame += 1) {
      turned = integrateBrainFood(turned, { x: -1, y: 0 }, 1 / 60, bounds, false);
    }
    expect(turned.heading).toBeGreaterThan(Math.PI / 2);
    expect(turned.heading).toBeLessThan(Math.PI);
    expect(turned.velocity.x).toBeLessThan(0);
    expect(turned.position.x).toBeLessThan(movingRight.position.x);
  });

  it("coasts gently when the visitor releases the keys", () => {
    const moving = {
      ...body,
      velocity: { x: 100, y: 0 },
    };

    const next = integrateBrainFood(
      moving,
      { x: 0, y: 0 },
      0.1,
      bounds,
      false,
    );

    expect(next.velocity.x).toBeGreaterThan(80);
    expect(next.velocity.x).toBeLessThan(100);
    expect(next.position.x).toBeGreaterThan(moving.position.x);
  });

  it("uses bounded direct steps under reduced motion", () => {
    const next = integrateBrainFood(
      body,
      { x: -1, y: 0 },
      1,
      bounds,
      true,
    );

    expect(next.position).toEqual({ x: 388, y: 300 });
    expect(next.velocity).toEqual({ x: 0, y: 0 });
    expect(next.heading).toBeCloseTo(Math.PI);
  });

  it("maps vertical and diagonal steering onto the full screen plane", () => {
    let up = body;
    let downRight = body;
    for (let frame = 0; frame < 60; frame += 1) {
      up = integrateBrainFood(up, { x: 0, y: -1 }, 1 / 60, bounds, false);
      downRight = integrateBrainFood(
        downRight,
        { x: 1, y: 1 },
        1 / 60,
        bounds,
        false,
      );
    }

    expect(up.heading).toBeCloseTo(-Math.PI / 2);
    expect(downRight.heading).toBeCloseTo(Math.PI / 4);
  });

  it("stays inside the map play area", () => {
    const next = integrateBrainFood(
      { ...body, position: { x: 49, y: 49 } },
      { x: -1, y: -1 },
      1,
      bounds,
      true,
    );

    expect(next.position).toEqual({ x: 48, y: 48 });
  });
});

describe("Brain Food collection", () => {
  const nodes = [
    { id: "bradley", x: 100, y: 100, radius: 20 },
    { id: "dubs", x: 210, y: 200, radius: 22 },
    { id: "reporting", x: 500, y: 500, radius: 22 },
  ];

  it("chooses a bounded spawn whose whole swimmer radius is clear of nodes", () => {
    const spawn = findBrainFoodSpawn(
      [{ id: "center", x: 400, y: 300, radius: 30 }],
      bounds,
      78,
    );

    expect(spawn).not.toBeNull();
    expect(spawn!.x).toBeGreaterThanOrEqual(48);
    expect(spawn!.x).toBeLessThanOrEqual(752);
    expect(spawn!.y).toBeGreaterThanOrEqual(48);
    expect(spawn!.y).toBeLessThanOrEqual(552);
    expect(Math.hypot(spawn!.x - 400, spawn!.y - 300)).toBeGreaterThan(108);
  });

  it("eats a touched portfolio node once and never eats Bradley", () => {
    expect(
      collectBrainFoodNodes(nodes, new Set(), { x: 205, y: 200 }, 34),
    ).toEqual(["dubs"]);
    expect(
      collectBrainFoodNodes(nodes, new Set(["dubs"]), { x: 205, y: 200 }, 34),
    ).toEqual([]);
    expect(
      collectBrainFoodNodes(nodes, new Set(), { x: 100, y: 100 }, 34),
    ).toEqual([]);
  });

  it("eats nodes crossed between animation frames", () => {
    expect(
      collectBrainFoodNodes(
        nodes,
        new Set(),
        { x: 120, y: 200 },
        56,
        { x: 300, y: 200 },
      ),
    ).toEqual(["dubs"]);
  });

  it("uses a swimmer-sized hit area for visible body overlap", () => {
    expect(
      collectBrainFoodNodes(
        nodes,
        new Set(),
        { x: 130, y: 200 },
        60,
      ),
    ).toEqual(["dubs"]);
  });

  it("completes only after every non-Bradley node is eaten", () => {
    expect(isBrainFoodComplete(nodes, new Set(["dubs"]))).toBe(false);
    expect(
      isBrainFoodComplete(nodes, new Set(["dubs", "reporting"])),
    ).toBe(true);
  });
});
