import { describe, expect, it } from "vitest";
import {
  getAvailableAnimationAliases,
  getAnimationMixerTime,
  getGlbModelUrl,
  getGlbYaw,
} from "./AvatarAssetAdapter";

describe("GLB avatar configuration", () => {
  it("derives safe aliases from the clips actually loaded by the model", () => {
    // Catches an adapter that tells the controller a missing preferred clip is available.
    expect(
      getAvailableAnimationAliases(
        {
          idle: "Idle",
          walk: "Walk",
          think: "Think",
          talk: "Talk",
          point: "Point",
          present: "Present",
          celebrate: "Celebrate",
          confused: "Confused",
        },
        ["Idle", "Walk", "Present"],
      ),
    ).toEqual(new Set(["idle", "walk", "present"]));
  });

  it("does not invent a model path when the GLB configuration has no URL", () => {
    // Catches a renderer fallback that bypasses the single avatar asset configuration.
    expect(getGlbModelUrl({ kind: "gltf", modelUrl: null })).toBeNull();
  });

  it("composes model forward-axis correction with left and right facing", () => {
    // Catches an axis correction that makes left and right indistinguishable for -Z models.
    expect(getGlbYaw("z", "right")).toBe(0);
    expect(getGlbYaw("z", "left")).toBe(Math.PI);
    expect(getGlbYaw("-z", "right")).toBe(Math.PI);
    expect(getGlbYaw("-z", "left")).toBe(Math.PI * 2);
  });

  it("steps configured animation playback to complete frame intervals", () => {
    // Catches a target-frame-rate config value that has no effect on mixer timing.
    expect(getAnimationMixerTime(0.049, 30)).toBe(1 / 30);
    expect(getAnimationMixerTime(0.05, 30)).toBe(1 / 30);
    expect(getAnimationMixerTime(0.05, null)).toBe(0.05);
  });
});
