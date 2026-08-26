import { describe, expect, it } from "vitest";
import {
  allowedAvatarAnimations,
  avatarBehaviors,
  expandAvatarSequence,
  formatAvatarBehaviorCatalog,
} from "./behaviors";

const expectedIds = [
  "agree_gesture",
  "alert",
  "angry_to_tantrum_sit",
  "big_wave_hello",
  "cheer_with_both_hands_1",
  "cheer_with_both_hands",
  "formal_bow",
  "groan_holding_stomach_in_sleep",
  "idle_3",
  "indoor_play",
  "joyful_dance_with_hand_sway",
  "prone_reach_help",
  "running",
  "shrug",
  "sneaky_walk",
  "swim_forward",
  "wake_up_and_look_up",
  "walking",
  "wave_one_hand",
  "swimming_to_edge",
  "orange_justice_cc0",
] as const;

const expectedClipNames = [
  "Agree_Gesture",
  "Alert",
  "Angry_To_Tantrum_Sit",
  "Big_Wave_Hello",
  "Cheer_with_Both_Hands_1",
  "Cheer_with_Both_Hands",
  "Formal_Bow",
  "Groan_Holding_Stomach_in_Sleep",
  "Idle_3",
  "Indoor_Play",
  "Joyful_Dance_with_Hand_Sway",
  "Prone_Reach_Help",
  "Running",
  "Shrug",
  "Sneaky_Walk",
  "Swim_Forward",
  "Wake_Up_and_Look_Up",
  "Walking",
  "Wave_One_Hand",
  "swimming_to_edge",
  "Orange_Justice_CC0",
] as const;

describe("avatar behavior registry", () => {
  it("represents every supplied clip exactly once", () => {
    // Catches a supplied animation becoming hidden, aliased, or duplicated.
    expect(avatarBehaviors.map(({ id }) => id)).toEqual(expectedIds);
    expect(allowedAvatarAnimations).toEqual(expectedIds);
    expect(avatarBehaviors.map(({ clipName }) => clipName)).toEqual(
      expectedClipNames,
    );
    expect(new Set(expectedIds).size).toBe(21);
    expect(new Set(expectedClipNames).size).toBe(21);
  });

  it("describes every allowed behavior to the portfolio agent", () => {
    // Catches the structured enum and agent guidance drifting apart.
    const catalog = formatAvatarBehaviorCatalog();

    for (const behavior of avatarBehaviors) {
      expect(catalog).toContain(`${behavior.id}: ${behavior.guidance}`);
    }
  });

  it("supplies bounded tone metadata without throttling selected performances", () => {
    // Catches a newly registered clip bypassing renderer tone mappings.
    expect(
      avatarBehaviors.filter(({ ambientEligible }) => ambientEligible).map(({ id }) => id),
    ).toEqual(["idle_3"]);
    expect(avatarBehaviors[0].tone).toEqual({
      energy: "medium",
      warmth: "warm",
      confidence: "assured",
      mischief: "none",
    });
  });

  it("expands a multi-behavior performance with registry-owned timing", () => {
    // Catches any selected clip being replaced before its visible hold completes.
    expect(
      expandAvatarSequence(["wave_one_hand", "orange_justice_cc0"]),
    ).toEqual([
      { action: "play", animation: "wave_one_hand" },
      { action: "wait", durationMs: 1_600 },
      { action: "play", animation: "orange_justice_cc0" },
      { action: "wait", durationMs: 2_800 },
    ]);
  });

  it("holds a single selected behavior before turn cleanup", () => {
    expect(expandAvatarSequence(["big_wave_hello"])).toEqual([
      { action: "play", animation: "big_wave_hello" },
      { action: "wait", durationMs: 2_200 },
    ]);
  });
});
