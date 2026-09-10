import { svgPathBbox } from "svg-path-bbox";
import { describe, expect, it } from "vitest";
import {
  portfolioContactMarkKinds,
  portfolioContactMarkPrimitives,
} from "./portfolio-contact-mark";

const HALF_ENVELOPE = 9; // the 18-unit viewBox the node marks draw in

describe("contact marks", () => {
  it("draws every kind inside the node-mark envelope", () => {
    for (const kind of portfolioContactMarkKinds) {
      const primitives = portfolioContactMarkPrimitives(kind);
      expect(primitives.length).toBeGreaterThan(0);
      for (const primitive of primitives) {
        if (primitive.kind === "circle") {
          expect(Math.abs(primitive.x) + primitive.radius).toBeLessThanOrEqual(HALF_ENVELOPE);
          expect(Math.abs(primitive.y) + primitive.radius).toBeLessThanOrEqual(HALF_ENVELOPE);
        } else if (primitive.kind === "polyline") {
          for (const { x, y } of primitive.points) {
            expect(Math.abs(x)).toBeLessThanOrEqual(HALF_ENVELOPE);
            expect(Math.abs(y)).toBeLessThanOrEqual(HALF_ENVELOPE);
          }
        } else if (primitive.kind === "path") {
          for (const value of svgPathBbox(primitive.d)) {
            expect(Math.abs(value)).toBeLessThanOrEqual(HALF_ENVELOPE + 0.00001);
          }
        }
      }
    }
  });

  it("renders the brand marks as filled silhouettes and the rest as strokes", () => {
    for (const kind of ["github", "linkedin"] as const) {
      expect(
        portfolioContactMarkPrimitives(kind).every((p) => p.kind === "path" && p.fill),
      ).toBe(true);
    }
    for (const kind of ["email", "cv"] as const) {
      expect(
        portfolioContactMarkPrimitives(kind).every((p) => "fill" in p && !p.fill),
      ).toBe(true);
    }
  });
});
