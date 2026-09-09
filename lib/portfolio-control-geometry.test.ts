import { describe, expect, it } from "vitest";
import { portfolioControlMarkKinds, portfolioControlMarkPrimitives } from "./portfolio-control-mark";
import { controlGeometry, CONTROL_INK_SIZE, CONTROL_STROKE } from "./portfolio-control-geometry";

describe("control artwork normalization", () => {
  it.each(portfolioControlMarkKinds)("centers %s and contains its painted extent", kind => {
    const g = controlGeometry(portfolioControlMarkPrimitives(kind));
    const [left, top, right, bottom] = g.bounds;
    expect((left + right) * g.scale / 2 + g.x).toBeCloseTo(0, 8);
    expect((top + bottom) * g.scale / 2 + g.y).toBeCloseTo(0, 8);
    expect(Math.max(right - left, bottom - top) * g.scale + CONTROL_STROKE).toBeCloseTo(CONTROL_INK_SIZE, 8);
    expect(Math.max(right - left, bottom - top) * g.scale / 2 + CONTROL_STROKE / 2).toBeLessThanOrEqual(9.000001);
  });

  it("serializes symmetric arc centers without engine-specific floating-point noise", () => {
    const g = controlGeometry(portfolioControlMarkPrimitives("avatarShown"));
    expect(g.transform).toMatch(/ 0 0\)$/);
    expect(g.transform).not.toMatch(/e[+-]\d/);
  });

  it("derives the same visible geometry when a source is translated or rescaled", () => {
    const a = controlGeometry([{kind:"path",d:"M0 0H10V20H0Z",fill:false}]);
    const b = controlGeometry([{kind:"path",d:"M100 200H120V240H100Z",fill:false}]);
    expect(a.scale).toBeCloseTo(b.scale * 2, 8);
    expect(a.bounds[0] * a.scale + a.x).toBeCloseTo(b.bounds[0] * b.scale + b.x, 8);
  });

  it("measures curve extrema rather than treating control points as painted bounds", () => {
    const g = controlGeometry([{kind:"path",d:"M0 0Q100 100 0 200",fill:false}]);
    expect(g.bounds).toEqual([0, 0, 50, 200]);
  });
});
