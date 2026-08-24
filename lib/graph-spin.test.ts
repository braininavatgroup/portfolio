import { describe, expect, it } from "vitest";
import { ambientSpinStep, nextGraphSpin } from "./graph-spin";

const TAU = Math.PI * 2;

const distanceToCanonical = (angle: number) => {
  const normalized = ((angle % TAU) + TAU) % TAU;
  return Math.min(normalized, TAU - normalized);
};

describe("graph spin", () => {
  it("advances by the ambient step while spinning", () => {
    expect(nextGraphSpin(1, { spinning: true, aligning: false })).toBeCloseTo(
      1 + ambientSpinStep,
    );
  });

  it("wraps ambient spin into a single turn", () => {
    const next = nextGraphSpin(TAU - ambientSpinStep / 2, {
      spinning: true,
      aligning: false,
    });
    expect(next).toBeGreaterThanOrEqual(0);
    expect(next).toBeLessThan(TAU);
    expect(next).toBeCloseTo(ambientSpinStep / 2);
  });

  it("holds still when neither spinning nor aligning", () => {
    expect(nextGraphSpin(0.7, { spinning: false, aligning: false })).toBe(0.7);
  });

  it("eases a small angle back to canonical and snaps there", () => {
    let angle = 0.4;
    for (let frame = 0; frame < 200; frame += 1) {
      const next = nextGraphSpin(angle, { spinning: false, aligning: true });
      expect(distanceToCanonical(next)).toBeLessThanOrEqual(
        distanceToCanonical(angle),
      );
      angle = next;
    }
    expect(angle).toBe(0);
  });

  it("takes the short way around when past half a turn", () => {
    const angle = 6;
    const next = nextGraphSpin(angle, { spinning: false, aligning: true });
    expect(next).toBeGreaterThan(angle);
    expect(distanceToCanonical(next)).toBeLessThan(distanceToCanonical(angle));
  });

  it("prefers aligning over spinning", () => {
    const next = nextGraphSpin(0.4, { spinning: true, aligning: true });
    expect(next).toBeLessThan(0.4);
  });
});
