import { describe, expect, it } from "vitest";
import { clearLabelRay, envelopeInset } from "./portfolio-node-envelope";

describe("envelopeInset", () => {
  const center = { x: 0, y: 0 };
  const radius = 8;
  // A desktop label: 60 wide, two lines, hanging 18 below the mark.
  const label = { x: -30, y: 18, width: 60, height: 30 };

  it("clears only the mark when the line does not cross the label", () => {
    expect(envelopeInset(center, radius, label, { x: 1, y: 0 }, 2)).toBe(10);
    expect(envelopeInset(center, radius, label, { x: 0, y: -1 }, 2)).toBe(10);
    expect(envelopeInset(center, radius, null, { x: 0, y: 1 }, 2)).toBe(10);
  });

  it("starts past the label's far edge when the line runs through it", () => {
    // Straight down: out of the bottom of the label.
    expect(envelopeInset(center, radius, label, { x: 0, y: 1 }, 2)).toBe(50);
    // Steeply down-right: out of the label's right edge, on the way through.
    const diagonal = envelopeInset(center, radius, label, { x: 0.6, y: 0.8 }, 2);
    expect(diagonal).toBeGreaterThan(18 / 0.8);
    expect(diagonal).toBeCloseTo(30 / 0.6 + 2, 5);
  });

  it("misses a label the ray only passes beside", () => {
    // Shallow down-right: reaches the label's height only after passing it.
    expect(envelopeInset(center, radius, label, { x: 0.95, y: 0.31 }, 2)).toBe(10);
  });
});

describe("clearLabelRay", () => {
  const center = { x: 0, y: 0 };
  const label = { x: -30, y: 18, width: 60, height: 30 };

  it.each([
    ["right", { x: 150, y: 110 }, 1],
    ["left", { x: -150, y: 110 }, -1],
  ])("keeps a lower node on the %s while moving its connector above the label", (_side, target, sign) => {
    const cleared = clearLabelRay(center, target, label, 2);
    const distance = Math.hypot(target.x, target.y);
    const clearedDistance = Math.hypot(cleared.x, cleared.y);
    const direction = {
      x: cleared.x / clearedDistance,
      y: cleared.y / clearedDistance,
    };

    expect(Math.sign(cleared.x)).toBe(sign);
    expect(cleared.y, "the related node may remain below the selected record").toBeGreaterThan(0);
    expect(clearedDistance).toBeCloseTo(distance, 5);
    expect(envelopeInset(center, 8, label, direction, 2)).toBe(10);
  });

  it("does not move a lower node whose shallow connector already clears the label", () => {
    const target = { x: 180, y: 40 };
    expect(clearLabelRay(center, target, label, 2)).toEqual(target);
  });
});
