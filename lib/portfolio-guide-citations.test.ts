import { describe, expect, it } from "vitest";
import type { PortfolioGroundingEvidence } from "./portfolio-grounding";
import {
  parseGuideAnswerSegments,
  resolveGuideEvidenceTarget,
} from "./portfolio-guide-citations";

const evidence: PortfolioGroundingEvidence[] = [
  {
    id: "node:pitching",
    title: "Music promo campaign pitching",
    excerpt: "A weekly curator workflow.",
    href: "/?view=graph#pitching",
  },
  {
    id: "thread:making-work-playable",
    title: "Making Work Playable",
    excerpt: "A thread through the portfolio.",
    href: "/?view=graph#thread/making-work-playable",
  },
  {
    id: "entity:portfolio:brain",
    title: "Bradley Berkman",
    excerpt: "The portfolio home record.",
    href: "/",
  },
];

describe("Guide citation segments", () => {
  it("uses the original phrase as link text and keeps adjacent punctuation in prose", () => {
    expect(parseGuideAnswerSegments("His [pitching workflow][E1], with human approval.", evidence)).toEqual([
      { type: "text", text: "His " },
      { type: "citation", text: "pitching workflow", label: 1, evidence: evidence[0], target: { type: "node", id: "pitching" } },
      { type: "text", text: ", with human approval." },
    ]);
  });

  it("turns only canonical in-range evidence labels into citation segments", () => {
    // Catches malformed and unknown labels becoming misleading navigation actions.
    expect(
      parseGuideAnswerSegments(
        "Valid [E1]; malformed [E01] [E0] [E-1] [Efoo]; unknown [E4].",
        evidence,
      ),
    ).toEqual([
      { type: "text", text: "Valid " },
      {
        type: "citation",
        text: "[E1]",
        label: 1,
        evidence: evidence[0],
        target: { type: "node", id: "pitching" },
      },
      {
        type: "text",
        text: "; malformed [E01] [E0] [E-1] [Efoo]; unknown [E4].",
      },
    ]);
  });

  it("preserves repeated and adjacent citations in answer order", () => {
    // Catches a Set-based parser dropping repeats or gluing adjacent actions together.
    expect(parseGuideAnswerSegments("[E1][E2] then [E1]", evidence)).toEqual([
      {
        type: "citation",
        text: "[E1]",
        label: 1,
        evidence: evidence[0],
        target: { type: "node", id: "pitching" },
      },
      {
        type: "citation",
        text: "[E2]",
        label: 2,
        evidence: evidence[1],
        target: { type: "thread", id: "making-work-playable" },
      },
      { type: "text", text: " then " },
      {
        type: "citation",
        text: "[E1]",
        label: 1,
        evidence: evidence[0],
        target: { type: "node", id: "pitching" },
      },
    ]);
  });

  it("keeps incomplete labels as plain answer text", () => {
    // Catches the parser eating prose when a provider response includes a literal bracket.
    expect(parseGuideAnswerSegments("Look at [E1 and [e2].", evidence)).toEqual([
      { type: "text", text: "Look at [E1 and [e2]." },
    ]);
  });
});

describe("Guide evidence navigation", () => {
  it.each([
    [evidence[0], { type: "node", id: "pitching" }],
    [evidence[1], { type: "thread", id: "making-work-playable" }],
    [evidence[2], { type: "home" }],
  ] as const)("resolves %s to its Reading Room target", (item, target) => {
    // Catches citations reopening legacy href navigation instead of Reader/Map state.
    expect(resolveGuideEvidenceTarget(item)).toEqual(target);
  });
});
