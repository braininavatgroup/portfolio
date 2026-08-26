import { describe, expect, it } from "vitest";
import {
  adaptCommandsForReducedMotion,
  resolveAvatarAnimation,
} from "./state";

describe("avatar animation state", () => {
  it("maps lifecycle states directly without availability-based substitution", () => {
    // Catches fallback logic returning a different animation when a clip is absent.
    expect(resolveAvatarAnimation("tool_use")).toBe("indoor_play");
    expect(resolveAvatarAnimation("success")).toBe("cheer_with_both_hands");
    expect(resolveAvatarAnimation("error")).toBe(
      "groan_holding_stomach_in_sleep",
    );
  });

  it("removes travel-heavy motion while preserving the final stable intent", () => {
    // Catches reduced motion that could remove essential site actions.
    expect(
      adaptCommandsForReducedMotion([
        { action: "enter", from: "left" },
        { action: "walkTo", target: "hero" },
        { action: "swimTo", target: "portfolio:chat" },
        { action: "swimRoute", route: "lap" },
        { action: "play", animation: "orange_justice_cc0" },
        { action: "wait", durationMs: 1_600 },
        { action: "setState", state: "talking" },
        { action: "lookAt", target: "portfolio:index" },
        { action: "pointAt", target: "portfolio:chat" },
      ]),
    ).toEqual([
      { action: "lookAt", target: "hero" },
      { action: "lookAt", target: "portfolio:chat" },
      { action: "setState", state: "talking" },
      { action: "lookAt", target: "portfolio:index" },
      { action: "pointAt", target: "portfolio:chat" },
    ]);
  });
});
