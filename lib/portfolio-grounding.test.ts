import { describe, expect, it } from "vitest";
import { portfolioData } from "./portfolio-data";
import {
  audienceStatement,
  careerTimeline,
  domains,
  portfolioThroughline,
} from "./portfolio";
import { groundPortfolioQuestion } from "./portfolio-grounding";

describe("portfolio chat grounding", () => {
  // Owner: portfolio chat grounding. Retire only when a replacement context
  // provider proves that ordinary questions still reach the agent with every
  // published project and unsupported questions remain safely refused.
  it.each([
    "Tell me about yourself.",
    "What do you do?",
    "What kind of work do you do?",
    "What quantum-computing patents did Bradley file?",
  ])("loads the complete published portfolio for %s", (question) => {
    const grounding = groundPortfolioQuestion(question);

    expect(grounding.evidence).toHaveLength(portfolioData.projects.length + 1);
    expect(grounding.evidence[0]).toMatchObject({
      id: "entity:portfolio:brain",
      title: "Bradley Berkman",
      href: "/",
    });
    expect(
      grounding.evidence.filter(({ id }) => id.startsWith("project:")),
    ).toHaveLength(portfolioData.projects.length);

    const portfolio = grounding.evidence[0];
    expect(portfolio.excerpt).toContain(portfolioThroughline);
    expect(portfolio.excerpt).toContain(audienceStatement);
    for (const domain of domains) {
      expect(portfolio.excerpt).toContain(
        `${domain.label}: ${domain.description}`,
      );
    }
    for (const milestone of careerTimeline) {
      expect(portfolio.excerpt).toContain(
        `${milestone.period}; ${milestone.title}: ${milestone.detail}`,
      );
    }
  });

  // Owner: portfolio chat grounding. Retire with complete-project context.
  it("groups every published field for a project into one citable source", () => {
    const pitching = groundPortfolioQuestion("Any question").evidence.find(
      ({ id }) => id === "project:pitching",
    );

    expect(pitching).toMatchObject({
      title: "Pitching system",
      href: "/index/pitching",
      evidenceStatus: "needed",
      projectTitle: "Pitching system",
    });
    expect(pitching?.excerpt).toContain(
      "Research, curator selection, matching, and outreach",
    );
    expect(pitching?.excerpt).toContain(
      "Taste is encodable. The approval step stays human.",
    );
    expect(pitching?.excerpt).toContain("Curator taxonomy and matching model");
    expect(pitching?.excerpt).toContain("Outcome evidence");
  });

  it("retains an explicit caller limit without selecting by question words", () => {
    const grounding = groundPortfolioQuestion("reporting", 3);

    expect(grounding.evidence).toHaveLength(3);
    expect(grounding.evidence.map(({ id }) => id)).toEqual([
      "entity:portfolio:brain",
      "project:kickoff-intake",
      "project:pitching",
    ]);
  });
});
