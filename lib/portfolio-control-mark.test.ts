import { describe, expect, it } from "vitest";
import {
  portfolioControlMarkKinds,
  portfolioControlMarkPrimitives,
} from "./portfolio-control-mark";

describe("portfolioControlMarkPrimitives", () => {
  it("keeps every control inside the 15-unit node envelope", () => {
    for (const kind of portfolioControlMarkKinds) {
      for (const primitive of portfolioControlMarkPrimitives(kind)) {
        if (primitive.kind === "path") {
          const coordinates = primitive.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
          expect(Math.max(...coordinates.map(Math.abs))).toBeLessThanOrEqual(7.5);
        }
        if (primitive.kind === "circle") {
          expect(Math.abs(primitive.x) + primitive.radius).toBeLessThanOrEqual(7.5);
        }
      }
    }
  });

  it("draws the chat control as three filled dots and the map as the brain symbol", () => {
    expect(portfolioControlMarkPrimitives("chat")).toEqual([
      { kind: "circle", x: -5.4, y: 0, radius: 1.6, fill: true },
      { kind: "circle", x: 0, y: 0, radius: 1.6, fill: true },
      { kind: "circle", x: 5.4, y: 0, radius: 1.6, fill: true },
    ]);
    expect(portfolioControlMarkPrimitives("map")).toEqual([{ kind: "brain" }]);
  });

  it("mirrors previous and next across the vertical axis", () => {
    expect(portfolioControlMarkPrimitives("previous")).toEqual([
      { kind: "path", d: "M3.5 -7L-3.5 0L3.5 7", fill: false },
    ]);
    expect(portfolioControlMarkPrimitives("next")).toEqual([
      { kind: "path", d: "M-3.5 -7L3.5 0L-3.5 7", fill: false },
    ]);
  });
});
