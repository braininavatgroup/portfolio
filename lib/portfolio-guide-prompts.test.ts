import { describe, expect, it } from "vitest";
import type { PortfolioGroundingEvidence } from "./portfolio-grounding";
import {
  getGuideFollowUpPrompts,
  getGuideInitialPrompts,
} from "./portfolio-guide-prompts";

describe("Guide initial prompts", () => {
  it("rotates deterministic starter sets with a permanent game entry from the visit seed", () => {
    // Catches every visit returning the same handoff starter set.
    expect(getGuideInitialPrompts(0).map(({ text }) => text)).toEqual([
      "Where should I start?",
      "What does Brain in a Vat do?",
      "Wave hello",
      "Can you dance?",
      "Go for a swim",
      "Play Brain Food",
    ]);
    expect(getGuideInitialPrompts(1).map(({ text }) => text)).toEqual([
      "Which projects are in production?",
      "How did the agency lead to consulting?",
      "Wave hello",
      "Can you dance?",
      "Go for a swim",
      "Play Brain Food",
    ]);
    expect(getGuideInitialPrompts(4)).toEqual(getGuideInitialPrompts(1));
  });

  it.each([0, 1, 2, 11])("returns two serious prompts and all avatar/game actions for seed %i", (seed) => {
    // Catches a rotation that loses the intended work prompts and always-available actions.
    expect(getGuideInitialPrompts(seed).map(({ tone }) => tone)).toEqual([
      "serious",
      "serious",
      "playful",
      "playful",
      "playful",
      "playful",
    ]);
  });

  it("uses record-aware questions while retaining the visit's playful prompt", () => {
    // Catches selected-record starters asking generic questions that ignore useful context.
    expect(
      getGuideInitialPrompts(2, {
        id: "node:infamous",
        title: "INFAMOUS PR",
      }).map(({ text, evidenceId }) => ({ text, evidenceId })),
    ).toEqual([
      { text: "Summarise INFAMOUS PR", evidenceId: "node:infamous" },
      { text: "What is related to this?", evidenceId: "node:infamous" },
      { text: "Wave hello", evidenceId: undefined },
      { text: "Can you dance?", evidenceId: undefined },
      { text: "Go for a swim", evidenceId: undefined },
      { text: "Play Brain Food", evidenceId: undefined },
    ]);
  });
});

describe("Guide follow-up prompts", () => {
  it("keys follow-ups to the first cited evidence and has a stable fallback", () => {
    // Catches follow-ups drifting with array order or inventing a subject without evidence.
    const cited: PortfolioGroundingEvidence[] = [{
      id: "node:dubs",
      title: "Dubs",
      excerpt: "A spoken document.",
      href: "/?view=graph#dubs",
    }];

    expect(getGuideFollowUpPrompts(cited).map(({ text }) => text)).toEqual([
      "Summarise Dubs",
      "What is related to this?",
      "Wave hello",
      "Can you dance?",
      "Go for a swim",
      "Play Brain Food",
    ]);
    expect(getGuideFollowUpPrompts([]).map(({ text }) => text)).toEqual([
      "Where should Bradley's story start?",
      "Which projects are in production?",
      "Wave hello",
      "Can you dance?",
      "Go for a swim",
      "Play Brain Food",
    ]);
    expect(getGuideFollowUpPrompts([])).toEqual(getGuideFollowUpPrompts([]));
  });
});
