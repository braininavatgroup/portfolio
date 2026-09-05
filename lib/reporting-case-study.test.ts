import { describe, expect, it } from "vitest";
import content from "../content/portfolio-content.json";
import { portfolioRecordStructures } from "./portfolio-structure";
import { portfolioWorldNodes } from "./portfolio-world";

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
      "reporting-pipeline",
      "p5",
      "p6",
      "p7",
    ]);
    expect(record?.summary).toContain("hosted reporting system");
    expect(record?.body.filter((block) => typeof block === "string")).toHaveLength(7);
    expect(
      record?.body.some(
        (block) =>
          typeof block !== "string" && block.type === "copy-placeholder",
      ),
    ).toBe(false);
    expect(content.records.reporting.placeholders).toEqual({});
  });

  it("keeps the approved demo sequence explicit while its capture is pending", () => {
    const record = portfolioWorldNodes.find((node) => node.id === "reporting");
    const visual = record?.body.find(
      (block) =>
        typeof block !== "string" && block.id === "reporting-pipeline",
    );

    expect(visual).toMatchObject({
      type: "visual",
      status: "planned",
      treatment: "sequence",
      sourceStatus: "recreate",
    });
    expect(content.records.reporting.visuals["reporting-pipeline"].purpose).toBe(
      "Trace source evidence through model interpretation, deterministic verification, the auto-pitchable gate, refreshed client dashboards, and drafted client emails.",
    );
  });
});
