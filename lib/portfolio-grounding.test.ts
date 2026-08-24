import { describe, expect, it } from "vitest";
import { groundPortfolioQuestion } from "./portfolio-grounding";

describe("portfolio chat grounding", () => {
  it("selects exact merged portfolio evidence for a matching question", () => {
    const grounding = groundPortfolioQuestion(
      "How does the pitching system preserve human approval and taste?",
    );

    expect(grounding.evidence[0]).toEqual({
      id: "project:pitching",
      title: "Pitching system",
      excerpt:
        "Research, curator selection, matching, and outreach arranged around a human approval step.",
      href: "/index/pitching",
      evidenceStatus: "needed",
      projectTitle: "Pitching system",
    });
    expect(grounding.evidence).toContainEqual({
      id: "entity:pitching:principle",
      title: "Taste is encodable. The approval step stays human.",
      excerpt:
        "A useful system should increase the quality of attention without pretending uncertainty has disappeared.",
      href: "/index/pitching",
      evidenceStatus: "needed",
      projectTitle: "Pitching system",
      stageRole: "instinct",
    });
  });

  it("returns no supporting evidence when the portfolio has no matching facts", () => {
    expect(
      groundPortfolioQuestion("What quantum-computing patents did Bradley file?")
        .evidence,
    ).toEqual([]);
  });

  it("limits attribution to the strongest distinct portfolio records", () => {
    const grounding = groundPortfolioQuestion(
      "Which work involves reporting, reports, and client evidence?",
      3,
    );

    expect(grounding.evidence).toHaveLength(3);
    expect(new Set(grounding.evidence.map(({ id }) => id)).size).toBe(3);
    expect(grounding.evidence[0]?.href).toBe("/index/reporting");
  });

  it("uses the evidence item's own status and only scores published excerpts", () => {
    const grounding = groundPortfolioQuestion("screenshots published");
    const matchingEvidence = grounding.evidence.find(({ id }) =>
      id.includes(":evidence:"),
    );

    expect(matchingEvidence?.evidenceStatus).toBe("needed");
    expect(grounding.evidence[0]?.id).toContain(":evidence:");
  });

  it("does not rank an entity from summary text omitted from its excerpt", () => {
    const grounding = groundPortfolioQuestion("payment sequencing");

    expect(grounding.evidence.map(({ id }) => id)).not.toContain(
      "entity:kickoff-intake:artifact",
    );
  });

  it.each([
    ["preserve taste", "entity:pitching:judgment", "instinct"],
    ["selection workflow", "entity:pitching:system", "approach"],
    ["human-approved operation", "entity:pitching:operation", "output"],
  ] as const)(
    "labels %s evidence with its merged projection role",
    (question, entityId, stageRole) => {
      const grounding = groundPortfolioQuestion(question);

      expect(grounding.evidence).toContainEqual(
        expect.objectContaining({ id: entityId, stageRole }),
      );
    },
  );

  it("does not assign a projection role to project-level evidence", () => {
    const grounding = groundPortfolioQuestion("pitching system");

    expect(grounding.evidence[0]).toEqual(
      expect.objectContaining({ id: "project:pitching" }),
    );
    expect(grounding.evidence[0]).not.toHaveProperty("stageRole");
  });
});
