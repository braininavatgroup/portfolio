import { describe, expect, it } from "vitest";
import { getPortfolioDossier } from "./portfolio-dossier";
import { portfolioNodes } from "./spatial-graph";

describe("portfolio dossier selection", () => {
  it("derives the complete Dubs project while preserving the selected role", () => {
    const node = portfolioNodes.find(
      ({ projectSlug, role }) =>
        projectSlug === "dubs" && role === "approach",
    );
    if (!node) throw new Error("Missing Dubs approach node");

    const dossier = getPortfolioDossier(node);

    expect(dossier?.project.slug).toBe("dubs");
    expect(dossier?.selectedRole).toBe("approach");
    expect(dossier?.steps.map(({ role }) => role)).toEqual([
      "instinct",
      "approach",
      "output",
    ]);
  });

  it("does not create a project dossier for the portfolio root", () => {
    expect(getPortfolioDossier(portfolioNodes[0])).toBeUndefined();
  });

  it("rejects a stale project slug instead of returning partial content", () => {
    expect(
      getPortfolioDossier({
        ...portfolioNodes[1],
        projectSlug: "missing-project",
      }),
    ).toBeUndefined();
  });
});
