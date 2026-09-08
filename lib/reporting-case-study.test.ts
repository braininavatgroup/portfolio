import { describe, expect, it } from "vitest";
import content from "../content/portfolio-content.json";
import { portfolioRecordStructures } from "./portfolio-structure";
import { isPortfolioVisualReady, portfolioWorldNodes } from "./portfolio-world";

describe("reporting case study", () => {
  it("publishes authored reporting copy in place of the draft placeholder", () => {
    const structure = portfolioRecordStructures.find(
      (record) => record.id === "reporting",
    );
    const record = portfolioWorldNodes.find((node) => node.id === "reporting");

    expect(structure?.summaryStatus).toBeUndefined();
    expect(structure?.body.map((block) => block.id)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "reporting-workflow",
      "p5",
      "reporting-email",
      "reporting-dashboard",
    ]);
    expect(record?.summary).toContain("checks what can be claimed");
    expect(record?.body.filter((block) => typeof block === "string")).toHaveLength(5);
    expect(
      record?.body.some(
        (block) =>
          typeof block !== "string" && block.type === "copy-placeholder",
      ),
    ).toBe(false);
    expect(content.records.reporting.placeholders).toEqual({});
  });

  it("makes the authentic reporting artifacts available to the Reader gallery", () => {
    const record = portfolioWorldNodes.find((node) => node.id === "reporting");
    const visual = record?.body.find(
      (block) =>
        typeof block !== "string" && block.id === "reporting-workflow",
    );

    expect(visual).toMatchObject({
      type: "visual",
      treatment: "sequence",
      sourceStatus: "exists",
      format: "gallery",
    });
    if (!visual || typeof visual === "string" || visual.type !== "visual") {
      throw new Error("Reporting visual is missing");
    }
    expect(isPortfolioVisualReady(visual)).toBe(true);
    expect(visual.slides?.flatMap((slide) => slide.assets)).toHaveLength(1);
    expect(record?.body).toContainEqual(expect.objectContaining({ id: "reporting-dashboard", format: "interactive", preview: "campaign-report" }));
    expect(record?.body.filter((block) => typeof block !== "string" && block.type === "visual")).toHaveLength(3);
  });
});
