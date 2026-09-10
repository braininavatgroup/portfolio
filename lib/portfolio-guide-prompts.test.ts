import { describe, expect, it } from "vitest";
import type { PortfolioGroundingEvidence } from "./portfolio-grounding";
import {
  getGuideFollowUpPrompts,
  getGuideInitialPrompts,
} from "./portfolio-guide-prompts";

describe("Guide initial prompts", () => {
  it("rotates a shorter set of work questions with one game entry", () => {
    // Catches every visit returning the same handoff starter set.
    expect(getGuideInitialPrompts(0).map(({ text }) => text)).toEqual([
      "What kind of work does Bradley do?",
      "What could Bradley help my team with?",
      "Play Brain Food",
    ]);
    expect(getGuideInitialPrompts(1).map(({ text }) => text)).toEqual([
      "Which projects can I try today?",
      "How does Bradley decide what to automate?",
      "Play Brain Food",
    ]);
    expect(getGuideInitialPrompts(3)).toEqual(getGuideInitialPrompts(1));
  });

  it.each([0, 1, 2, 11])("returns two work prompts and one game action for seed %i", (seed) => {
    // Catches a rotation that loses the intended work prompts and always-available actions.
    expect(getGuideInitialPrompts(seed).map(({ tone }) => tone)).toEqual([
      "serious",
      "serious",
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
      { text: "Tell me about INFAMOUS PR.", evidenceId: "node:infamous" },
      { text: "How does this connect to Bradley's other work?", evidenceId: "node:infamous" },
      { text: "Play Brain Food", evidenceId: undefined },
    ]);
  });

  it.each(["node:bradley", "entity:portfolio:brain"])("asks about Bradley as a person for %s", (id) => {
    const subject = { id, title: "Bradley Berkman" };
    for (const prompts of [
      getGuideInitialPrompts(0, subject),
      getGuideFollowUpPrompts([{ ...subject, excerpt: "", href: "/" }]),
    ]) {
      expect(prompts.map(prompt => prompt.text)).toEqual([
        "What kind of work does Bradley do?",
        "What could Bradley help my team with?",
        "Play Brain Food",
      ]);
      expect(prompts.some(prompt => prompt.text.includes("Berkman"))).toBe(false);
    }
  });
});

describe("Guide follow-up prompts", () => {
  it("does not suggest a question already asked in this conversation", () => {
    const asked = ["Tell me about Dubs.", "How does this connect to Bradley's other work?"];
    const prompts = getGuideFollowUpPrompts([
      { id: "node:dubs", title: "Dubs", excerpt: "", href: "/?view=graph#dubs" },
    ], asked);
    expect(prompts.filter(prompt => prompt.tone === "serious")).toHaveLength(2);
    expect(prompts.some(prompt => asked.includes(prompt.text))).toBe(false);
  });

  it("does not repeat a person-specific question when filling the next suggestion", () => {
    const prompts = getGuideFollowUpPrompts([
      { id: "node:bradley", title: "Bradley Berkman", excerpt: "", href: "/" },
    ], [" What could Bradley help my team with? "]);
    expect(prompts.map(prompt => prompt.text)).toEqual([
      "What kind of work does Bradley do?",
      "Which projects can I try today?",
      "Play Brain Food",
    ]);
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
      "Tell me about Dubs.",
      "How does this connect to Bradley's other work?",
      "Play Brain Food",
    ]);
    expect(getGuideFollowUpPrompts([]).map(({ text }) => text)).toEqual([
      "What kind of work does Bradley do?",
      "Which projects can I try today?",
      "Play Brain Food",
    ]);
    expect(getGuideFollowUpPrompts([])).toEqual(getGuideFollowUpPrompts([]));
  });
});
