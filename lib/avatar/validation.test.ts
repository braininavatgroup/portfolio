import { describe, expect, it } from "vitest";
import { parsePortfolioResponseEffects } from "./validation";

describe("avatar effects validation", () => {
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
