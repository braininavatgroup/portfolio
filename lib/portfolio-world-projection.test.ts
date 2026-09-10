import { describe, expect, it } from "vitest";
import { projectWorldPoint, worldPointAtDepth } from "./portfolio-world-projection";

describe("worldPointAtDepth", () => {
  it("is the exact inverse of projectWorldPoint at that depth", () => {
    const position = { x: 0, y: 35, z: -760 };
    const target = { x: 0, y: 0, z: 760 };
    for (const screen of [{ x: 84, y: 770 }, { x: 446, y: 450 }, { x: 809, y: 710 }]) {
      const point = worldPointAtDepth(screen, 1300, position, target, 605, 893, 900);
      const back = projectWorldPoint(point, position, target, 605, 893, 900)!;
      expect(back.x).toBeCloseTo(screen.x, 6);
      expect(back.y).toBeCloseTo(screen.y, 6);
      expect(back.depth).toBeCloseTo(1300, 6);
    }
  });
});
