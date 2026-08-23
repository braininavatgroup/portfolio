import { describe, expect, it } from "vitest";
import {
  getRagdollTargets,
  settleRagdollPoint,
  updateRagdollPoint,
} from "./ragdoll";

describe("ragdoll targets", () => {
  it("moves connected joints in different directions across a diagonal pointer position", () => {
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

  it("returns inactive pointer input toward rest without snapping", () => {
    const next = settleRagdollPoint({ x: 0.8, y: -0.6 });

    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(0.8);
    expect(next.y).toBeLessThan(0);
    expect(next.y).toBeGreaterThan(-0.6);
  });

  it("follows the current pointer whenever the landing scene is active", () => {
    const next = updateRagdollPoint(
      { x: -0.2, y: 0.1 },
      { x: 0.72, y: -0.41 },
      true,
    );

    expect(next).toEqual({ x: 0.72, y: -0.41 });
  });

  it("settles toward rest when the landing scene is inactive", () => {
    const next = updateRagdollPoint(
      { x: 0.8, y: -0.6 },
      { x: -0.5, y: 0.5 },
      false,
    );

    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(0.8);
    expect(next.y).toBeLessThan(0);
    expect(next.y).toBeGreaterThan(-0.6);
  });
});
