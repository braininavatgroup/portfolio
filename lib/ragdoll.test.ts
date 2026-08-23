import { describe, expect, it } from "vitest";
import { getRagdollTargets, settleDrag } from "./ragdoll";

describe("ragdoll targets", () => {
  it("moves connected joints in different directions during a diagonal drag", () => {
    const pose = getRagdollTargets({ x: 0.8, y: -0.6 });

    expect(pose.torso.y).toBeGreaterThan(0);
    expect(pose.head.y).toBeGreaterThan(pose.torso.y);
    expect(pose.leftArm.z).toBeGreaterThan(0);
    expect(pose.rightArm.z).toBeLessThan(0);
    expect(pose.leftForearm.z).not.toBe(pose.leftArm.z);
    expect(pose.rightForearm.z).not.toBe(pose.rightArm.z);
    expect(pose.leftLeg.z).toBeLessThan(0);
    expect(pose.rightLeg.z).toBeGreaterThan(0);
  });

  it("caps joint rotation when the pointer leaves the model", () => {
    const pose = getRagdollTargets({ x: 20, y: -20 });

    for (const rotation of Object.values(pose)) {
      expect(Math.abs(rotation.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(rotation.y)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(rotation.z)).toBeLessThanOrEqual(1.1);
    }
  });

  it("returns released drag input toward rest without snapping", () => {
    const next = settleDrag({ x: 0.8, y: -0.6 }, false);

    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(0.8);
    expect(next.y).toBeLessThan(0);
    expect(next.y).toBeGreaterThan(-0.6);
  });
});
