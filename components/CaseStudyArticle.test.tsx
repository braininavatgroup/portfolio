// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CaseStudy } from "../lib/case-study";
import { CaseStudyArticle } from "./CaseStudyArticle";

afterEach(cleanup);

const caseStudy: CaseStudy = {
  project: {
    id: "example",
    slug: "example",
    title: "Example project",
    summary: "An example case study.",
    entityIds: [],
    facets: { domain: ["music"], evidenceStatus: ["partial"] },
  },
  steps: [
    {
      role: "instinct",
      title: "Instinct step",
      summary: "Where the work starts.",
      items: [
        {
          entity: {
            id: "p:judgment",
            title: "Find the judgment",
            summary: "Locate the choice.",
          },
          support: [],
          leads: [
            {
              label: "informed",
              to: { id: "p:spec", title: "Example spec", summary: "" },
            },
          ],
        },
      ],
    },
    {
      role: "approach",
      title: "Approach step",
      summary: "How the work is shaped.",
      items: [
        {
          entity: {
            id: "p:spec",
            title: "Example spec",
            summary: "Define the contract.",
          },
          support: [],
          leads: [],
        },
      ],
    },
    {
      role: "output",
      title: "Output step",
      summary: "What the work produced.",
      items: [
        {
          entity: {
            id: "p:artifact",
            title: "Shipped tool",
            summary: "The visible output.",
            links: [
              { label: "View case study", href: "/work/example" },
              { label: "Spec document", href: "/docs/example-spec" },
            ],
          },
          support: [
            {
              entity: {
                id: "p:evidence",
                title: "Run record",
                summary: "Not yet published.",
              },
              status: "needed",
              label: "supported by",
            },
          ],
          leads: [],
        },
        {
          entity: {
            id: "p:loose-evidence",
            title: "Spare note",
            summary: "Standalone material.",
          },
          evidenceStatus: "partial",
          support: [],
          leads: [],
        },
      ],
    },
  ],
};

describe("CaseStudyArticle", () => {
  // Catches the page falling back to legacy five-section rendering or reordering steps.
  it("renders grouped steps in projection order with role framing", () => {
    render(<CaseStudyArticle caseStudy={caseStudy} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Example project" }),
    ).toBeDefined();
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(["Instinct step", "Approach step", "Output step"]);

    const article = screen.getByRole("list", { name: "Case study steps" });
    expect(article.textContent).toContain("Instinct");
    expect(article.textContent).toContain("Approach");
    expect(article.textContent).toContain("Output");
    for (const legacyLabel of ["Spec or model", "Other minds"]) {
      expect(screen.queryByText(legacyLabel)).toBeNull();
    }
  });

  // Catches grouped entities or their relation phrasing dropping out of a step.
  it("renders each step's entities with readable relations", () => {
    render(<CaseStudyArticle caseStudy={caseStudy} />);

    const instinct = screen.getByRole("list", { name: "Instinct details" });
    expect(
      within(instinct).getByRole("heading", { level: 3, name: "Find the judgment" }),
    ).toBeDefined();
    expect(within(instinct).getByText(/informed/).textContent).toContain(
      "Example spec",
    );
  });

  // Catches evidence merging into the output card or losing its missing-proof status.
  it("keeps supporting evidence related to but distinct from the output", () => {
    render(<CaseStudyArticle caseStudy={caseStudy} />);

    const support = screen.getByRole("list", {
      name: "Supporting material for Shipped tool",
    });
    expect(within(support).getByText("Run record")).toBeDefined();
    expect(
      screen.queryByRole("heading", { level: 3, name: "Run record" }),
    ).toBeNull();
    expect(screen.getByText("Spare note")).toBeDefined();
    expect(screen.getAllByText("Evidence partial").length).toBeGreaterThan(0);
  });

  // Catches a self-referencing canonical link while preserving outbound links.
  it("filters the page's own canonical route from entity links", () => {
    render(<CaseStudyArticle caseStudy={caseStudy} />);

    expect(screen.queryByRole("link", { name: "View case study" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Spec document" }).getAttribute("href"),
    ).toBe("/docs/example-spec");
  });
});
