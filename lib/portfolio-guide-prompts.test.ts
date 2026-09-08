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
      "What kind of work does Bradley do?",
      "Which project best shows how Bradley thinks?",
      "Wave hello",
      "Can you dance?",
      "Go for a swim",
      "Play Brain Food",
    ]);
    expect(getGuideInitialPrompts(1).map(({ text }) => text)).toEqual([
      "Which projects can I try today?",
      "What could Bradley help my team with?",
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
      { text: "What problem does INFAMOUS PR solve?", evidenceId: "node:infamous" },
      { text: "How does this connect to Bradley's other work?", evidenceId: "node:infamous" },
      { text: "Wave hello", evidenceId: undefined },
      { text: "Can you dance?", evidenceId: undefined },
      { text: "Go for a swim", evidenceId: undefined },
      { text: "Play Brain Food", evidenceId: undefined },
    ]);
  });
});

describe("Guide follow-up prompts", () => {
  it("does not suggest a question already asked in this conversation", () => {
    const prompts = getGuideFollowUpPrompts([{ id: "node:dubs", title: "Dubs", excerpt: "", href: "/?view=graph#dubs" }], ["What problem does Dubs solve?", "How does this connect to Bradley's other work?", "What problem does Dubs solve?", "What changed because of Dubs?"]);
    expect(prompts.filter(prompt => prompt.tone === "serious")).toHaveLength(2);
    expect(prompts.some(prompt => ["What problem does Dubs solve?", "How does this connect to Bradley's other work?", "What problem does Dubs solve?", "What changed because of Dubs?"].includes(prompt.text))).toBe(false);
  });

  it("keys follow-ups to the first cited evidence and has a stable fallback", () => {
    // Catches follow-ups drifting with array order or inventing a subject without evidence.
    const cited: PortfolioGroundingEvidence[] = [{
      id: "node:dubs",
      title: "Dubs",
      excerpt: "A spoken document.",
      href: "/?view=graph#dubs",
    }];

    expect(getGuideFollowUpPrompts(cited).map(({ text }) => text)).toEqual([
      "What problem does Dubs solve?",
      "What changed because of Dubs?",
      "Wave hello",
      "Can you dance?",
      "Go for a swim",
      "Play Brain Food",
    ]);
    expect(getGuideFollowUpPrompts([]).map(({ text }) => text)).toEqual([
      "What kind of work does Bradley do?",
      "Which projects can I try today?",
      "Wave hello",
      "Can you dance?",
      "Go for a swim",
      "Play Brain Food",
    ]);
    expect(getGuideFollowUpPrompts([])).toEqual(getGuideFollowUpPrompts([]));
  });
});
