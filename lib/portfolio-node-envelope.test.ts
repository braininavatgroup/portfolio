import { describe, expect, it } from "vitest";
import { envelopeInset } from "./portfolio-node-envelope";

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
