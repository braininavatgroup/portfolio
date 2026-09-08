import { describe, expect, it } from "vitest";
import { parsePortfolioResponseEffects } from "./validation";

describe("avatar effects validation", () => {
  it("accepts a dedicated wave", () => {
    expect(parsePortfolioResponseEffects({ avatarAction: "wave" })).toEqual({ avatarAction: "wave", issues: [] });
  });

  it("accepts an explicit Brain Food game request", () => {
    expect(parsePortfolioResponseEffects({avatarAction: "brain_food"})).toEqual({avatarAction: "brain_food", issues: []});
  });

  it("accepts a requested full turn", () => {
    expect(parsePortfolioResponseEffects({ avatarAction: "turn" })).toEqual({ avatarAction: "turn", issues: [] });
  });

  it("accepts the one visitor-requested swim action", () => {
    expect(
      parsePortfolioResponseEffects({ avatarAction: "swim_lap" }),
    ).toEqual({ avatarAction: "swim_lap", issues: [] });
  });

  it("accepts the visitor-requested stroll and dance actions", () => {
    expect(
      parsePortfolioResponseEffects({ avatarAction: "stroll" }),
    ).toEqual({ avatarAction: "stroll", issues: [] });
    expect(
      parsePortfolioResponseEffects({ avatarAction: "dance" }),
    ).toEqual({ avatarAction: "dance", issues: [] });
  });

  it("treats an omitted or null action as no avatar request", () => {
    expect(parsePortfolioResponseEffects({})).toEqual({
      avatarAction: null,
      issues: [],
    });
    expect(parsePortfolioResponseEffects({ avatarAction: null })).toEqual({
      avatarAction: null,
      issues: [],
    });
  });

  it("drops an unknown action without throwing", () => {
    expect(
      parsePortfolioResponseEffects({ avatarAction: "walk_to_project" }),
    ).toEqual({
      avatarAction: null,
      issues: ["avatarAction must be swim_lap, stroll, dance, turn, wave, brain_food, or null"],
    });
  });

  it("rejects extra effect keys", () => {
    expect(
      parsePortfolioResponseEffects({ avatarAction: "swim_lap", speed: 999 }),
    ).toEqual({
      avatarAction: "swim_lap",
      issues: ["effects has unknown key: speed"],
    });
  });

  it("does not interpret the retired command, tone, or intent fields", () => {
    const parsed = parsePortfolioResponseEffects({
      avatarSequence: [{ action: "play", animation: "running" }],
      avatarTone: { energy: "high" },
      avatarIntent: "requested",
    });

    expect(parsed.avatarAction).toBeNull();
    expect(parsed.issues).toEqual([
      "effects has unknown key: avatarSequence",
      "effects has unknown key: avatarTone",
      "effects has unknown key: avatarIntent",
    ]);
  });

  it("contains malformed top-level input", () => {
    expect(parsePortfolioResponseEffects(null)).toEqual({
      avatarAction: null,
      issues: ["effects must be an object"],
    });
  });
});
