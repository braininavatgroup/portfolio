import { describe, expect, it } from "vitest";
import {
  adaptCommandsForReducedMotion,
  resolveAvatarAnimation,
} from "./state";

describe("avatar animation state", () => {
  it("falls back from a missing tool-use clip to the configured thinking animation", () => {
    // Catches a missing clip that could flash or stop instead of falling back.
    expect(resolveAvatarAnimation("tool_use", new Set(["think", "idle"]))).toBe(
      "think",
    );
  });

  it("falls back from success to the configured presentation clip before idle", () => {
    // Catches a missing clip that could flash or stop instead of falling back.
    expect(resolveAvatarAnimation("success", new Set(["present", "idle"]))).toBe(
      "present",
    );
  });

  it("removes travel-heavy motion while preserving the final stable intent", () => {
    // Catches reduced motion that could remove essential site actions.
    expect(
      adaptCommandsForReducedMotion([
        { action: "enter", from: "left" },
        { action: "walkTo", target: "hero" },
        { action: "setState", state: "talking" },
      ]),
    ).toEqual([
      { action: "lookAt", target: "hero" },
      { action: "setState", state: "talking" },
    ]);
  });
});
