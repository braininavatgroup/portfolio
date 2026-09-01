import { describe, expect, it } from "vitest";
import { parsePortfolioResponseEffects } from "./validation";

describe("avatar effects validation", () => {
  it("accepts only semantic swimming commands", () => {
    const parsed = parsePortfolioResponseEffects({
      avatarSequence: [
        { action: "swimTo", target: "portfolio:chat" },
        { action: "swimRoute", route: "lap" },
      ],
    });

    expect(parsed.avatarSequence).toEqual([
      { action: "swimTo", target: "portfolio:chat" },
      { action: "swimRoute", route: "lap" },
    ]);
    expect(parsed.issues).toEqual([]);
  });

  it.each([
    { action: "swimTo", target: "portfolio:chat", x: 12 },
    { action: "swimTo", target: "missing" },
    { action: "swimRoute", route: "custom" },
    { action: "swimRoute", route: "lap", points: [{ x: 1, y: 2 }] },
  ])("rejects unsafe swimming input %#", (command) => {
    const parsed = parsePortfolioResponseEffects({
      avatarSequence: [command],
    });
    expect(parsed.avatarSequence).toEqual([]);
    expect(parsed.issues).not.toEqual([]);
  });

  it("accepts only the bounded performance intent and tone vocabulary", () => {
    // Catches arbitrary model-authored numbers or renderer values crossing the safe effect boundary.
    expect(
      parsePortfolioResponseEffects({
        avatarSequence: [],
        avatarIntent: "expressive",
        avatarTone: {
          energy: "high",
          warmth: "warm",
          confidence: "assured",
          mischief: "playful",
        },
      }),
    ).toEqual({
      avatarSequence: [],
      avatarIntent: "expressive",
      avatarTone: {
        energy: "high",
        warmth: "warm",
        confidence: "assured",
        mischief: "playful",
      },
      issues: [],
    });
  });

  it("accepts a bounded tone command inside a safe sequence", () => {
    // Catches tone support existing only in provider metadata instead of the shared command grammar.
    const tone = {
      energy: "low" as const,
      warmth: "reserved" as const,
      confidence: "assured" as const,
      mischief: "none" as const,
    };
    expect(
      parsePortfolioResponseEffects({
        avatarSequence: [{ action: "setTone", tone }],
      }).avatarSequence,
    ).toEqual([{ action: "setTone", tone }]);
  });

  it("drops an unsafe tone without disturbing a valid intent or sequence", () => {
    // Catches partial tone parsing that could leak unknown renderer controls.
    expect(
      parsePortfolioResponseEffects({
        avatarSequence: [{ action: "play", animation: "shrug" }],
        avatarIntent: "requested",
        avatarTone: {
          energy: 100,
          warmth: "warm",
          confidence: "neutral",
          mischief: "none",
          css: "rotate(90deg)",
        },
      }),
    ).toEqual({
      avatarSequence: [{ action: "play", animation: "shrug" }],
      avatarIntent: "requested",
      issues: ["avatarTone has unknown key: css"],
    });
  });

  it("accepts exact first-class behavior IDs and rejects removed aliases", () => {
    // Catches the protocol drifting back to the old guessed dance alias.
    expect(
      parsePortfolioResponseEffects({
        avatarSequence: [
          { action: "play", animation: "joyful_dance_with_hand_sway" },
          { action: "play", animation: "dance" },
        ],
      }),
    ).toEqual({
      avatarSequence: [
        { action: "play", animation: "joyful_dance_with_hand_sway" },
      ],
      issues: [
        "avatarSequence[1].animation must be an allowed animation",
      ],
    });
  });




});
