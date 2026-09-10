import { describe, expect, it } from "vitest";
import {
  adductAtShoulder,
  retargetHipsTranslation,
  retargetRotation,
} from "./retarget-clips";

const quarterTurnY = [0, Math.SQRT1_2, 0, Math.SQRT1_2] as const;

describe("clip retargeting", () => {
  it("leaves rotations untouched when both rigs share a rest pose", () => {
    const values = new Float32Array([0.1, 0.2, 0.3, 0.927, 0, 0, 0, 1]);

    const output = retargetRotation(values, quarterTurnY, quarterTurnY);

    expect(Array.from(output).map((value) => +value.toFixed(6))).toEqual(
      Array.from(values).map((value) => +value.toFixed(6)),
    );
  });

  it("re-expresses a keyed rotation as the source's offset from rest", () => {
    // A key equal to the source rest pose is "no movement", so it must land
    // exactly on the target rest pose.
    const sourceRest = [0.1, 0.2, 0.3, Math.sqrt(1 - 0.14)] as const;
    const output = retargetRotation(new Float32Array(sourceRest), sourceRest, quarterTurnY);

    expect(Array.from(output).map((value) => +value.toFixed(6))).toEqual(
      Array.from(quarterTurnY).map((value) => +value.toFixed(6)),
    );
  });

  it("re-bases hip travel on the target rest and scales it by hip height", () => {
    const output = retargetHipsTranslation(
      new Float32Array([0, 100, 0, 0, 90, 10]),
      [0, 100, 0],
      [1, 110, 2],
    );

    expect(Array.from(output).map((value) => +value.toFixed(6))).toEqual([
      1, 110, 2, 1, 99, 13,
    ]);
  });

  it("folds each arm by the same angle about the stage forward axis", () => {
    const identity = new Float32Array([0, 0, 0, 1]);
    const left = adductAtShoulder(identity, [0, 0, 0, 1], -0.4);
    const right = adductAtShoulder(identity, [0, 0, 0, 1], 0.4);

    expect(left[2]).toBeCloseTo(-Math.sin(0.2), 6);
    expect(right[2]).toBeCloseTo(Math.sin(0.2), 6);
    expect(left[3]).toBeCloseTo(right[3]!, 6);
    // With the parent turned a quarter around Y, world Z is the parent's -X.
    const turned = adductAtShoulder(identity, quarterTurnY, 0.4);
    expect(turned[0]).toBeCloseTo(-Math.sin(0.2), 6);
    expect(Math.abs(turned[2]!)).toBeLessThan(1e-6);
  });
});
