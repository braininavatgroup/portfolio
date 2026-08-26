import { describe, expect, it } from "vitest";
import type { AvatarTone } from "./contracts";
import {
  avatarAmbientAmplitude,
  avatarCrossfadeSeconds,
  avatarPlaybackRate,
} from "./render-motion";

const mediumTone: AvatarTone = {
  energy: "medium",
  warmth: "warm",
  confidence: "neutral",
  mischief: "none",
};

describe("avatar render motion", () => {
  it("maps bounded energy to modest playback and crossfade changes", () => {
    // Catches tone values producing a new animation system or extreme playback speeds.
    expect(avatarPlaybackRate({ ...mediumTone, energy: "low" }, 0.9)).toBeCloseTo(0.792);
    expect(avatarPlaybackRate(mediumTone, 0.9)).toBeCloseTo(0.9);
    expect(avatarPlaybackRate({ ...mediumTone, energy: "high" }, 0.9)).toBeCloseTo(1.035);

    expect(avatarCrossfadeSeconds({ ...mediumTone, energy: "low" })).toBe(0.28);
    expect(avatarCrossfadeSeconds(mediumTone)).toBe(0.2);
    expect(avatarCrossfadeSeconds({ ...mediumTone, energy: "high" })).toBe(0.12);
  });

  it("keeps ambient motion bounded and honors reduced motion", () => {
    // Catches ambient personality becoming a distracting full-body performance.
    expect(avatarAmbientAmplitude(mediumTone, false)).toBe(0.009);
    expect(
      avatarAmbientAmplitude({ ...mediumTone, energy: "low" }, false),
    ).toBe(0.004);
    expect(
      avatarAmbientAmplitude({ ...mediumTone, mischief: "playful" }, false),
    ).toBe(0.018);
    expect(
      avatarAmbientAmplitude({ ...mediumTone, mischief: "playful" }, true),
    ).toBe(0);
  });
});
