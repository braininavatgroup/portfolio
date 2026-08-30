import { describe, expect, it } from "vitest";
import { parsePortfolioResponseEffects } from "./validation";

describe("avatar effects validation", () => {
  it("accepts only semantic swimming commands", () => {
    const parsed = parsePortfolioResponseEffects({
      siteActions: [],
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
      siteActions: [],
      avatarSequence: [command],
    });
    expect(parsed.avatarSequence).toEqual([]);
    expect(parsed.issues).not.toEqual([]);
  });

  it("accepts only the bounded performance intent and tone vocabulary", () => {
    // Catches arbitrary model-authored numbers or renderer values crossing the safe effect boundary.
    expect(
      parsePortfolioResponseEffects({
        siteActions: [],
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
      siteActions: [],
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
      siteActions: [],
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
      siteActions: [],
      avatarSequence: [
        { action: "play", animation: "joyful_dance_with_hand_sway" },
      ],
      issues: [
        "avatarSequence[1].animation must be an allowed animation",
      ],
    });
  });

  it("sanitizes valid effects and clamps waits to the safe ceiling", () => {
    // Catches a permissive parser that lets model output reach an unknown target, animation, action, selector, URL, bone, or transform.
    expect(
      parsePortfolioResponseEffects({
        siteActions: [{ type: "openProject", target: "project:dubs" }],
        avatarSequence: [
          { action: "setState", state: "thinking" },
          { action: "wait", durationMs: 25_000 },
        ],
      }),
    ).toEqual({
      siteActions: [{ type: "openProject", target: "project:dubs" }],
      avatarSequence: [
        { action: "setState", state: "thinking" },
        { action: "wait", durationMs: 10_000 },
      ],
      issues: [],
    });
  });

  it("drops unsafe siblings while preserving independently safe array items", () => {
    // Catches a permissive parser that lets model output reach an unknown target, animation, action, selector, URL, bone, or transform.
    const parsed = parsePortfolioResponseEffects({
      siteActions: [
        { type: "scrollTo", selector: "body", target: "hero" },
        { type: "spotlight", target: "hero" },
        { type: "openProject", target: "project:dubs", url: "https://example.com" },
      ],
      avatarSequence: [
        { action: "play", animation: "eval(location.hash)" },
        { action: "setState", state: "talking" },
        { action: "lookAt", target: "hero", bone: "spine" },
      ],
    });

    expect(parsed.siteActions).toEqual([{ type: "spotlight", target: "hero" }]);
    expect(parsed.avatarSequence).toEqual([
      { action: "setState", state: "talking" },
    ]);
    expect(parsed.issues.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects unknown project slugs and tabs while clamping negative waits", () => {
    // Catches a permissive parser that lets model output reach an unknown target, animation, action, selector, URL, bone, or transform.
    const parsed = parsePortfolioResponseEffects({
      siteActions: [
        { type: "openProject", target: "project:not-a-project" },
        { type: "activateTab", tab: "unknown" },
        { type: "activateTab", tab: "output" },
      ],
      avatarSequence: [
        { action: "wait", durationMs: -250 },
        { action: "walkTo", target: "project:not-a-project" },
      ],
    });

    expect(parsed.siteActions).toEqual([{ type: "activateTab", tab: "output" }]);
    expect(parsed.avatarSequence).toEqual([{ action: "wait", durationMs: 0 }]);
    expect(parsed.issues.length).toBeGreaterThanOrEqual(1);
  });

  it("drops a non-array sequence without disturbing valid safe actions", () => {
    // Catches a permissive parser that lets model output reach an unknown target, animation, action, selector, URL, bone, or transform.
    expect(
      parsePortfolioResponseEffects({
        siteActions: [{ type: "clearSpotlight" }],
        avatarSequence: { action: "setState", state: "thinking" },
      }),
    ).toEqual({
      siteActions: [{ type: "clearSpotlight" }],
      avatarSequence: [],
      issues: ["avatarSequence must be an array when provided"],
    });
  });
});
