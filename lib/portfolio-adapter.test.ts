import { describe, expect, it } from "vitest";
import { adaptArtifactRecords } from "./portfolio-adapter";
import { MAIN_PROJECTION_ID, getBranch, getBranchEntities, getProject, portfolioData } from "./portfolio-data";
import { artifacts, type ArtifactRecord } from "./portfolio";
import { validatePortfolioData } from "./portfolio-model";

const record: ArtifactRecord = {
  slug: "example",
  title: "Example project",
  domain: "music",
  token: "spec",
  summary: "An example output.",
  principle: "Make the judgment explicit.",
  decision: "Write the contract first.",
  reason: "The system needs a durable boundary.",
  chain: [
    { layer: "judgment", title: "Find the judgment", detail: "Locate the choice." },
    { layer: "spec", title: "Example specification", detail: "Define the contract." },
    { layer: "system", title: "Example system", detail: "Build the system." },
    { layer: "artifact", title: "Example artifact", detail: "The visible output." },
    { layer: "operation", title: "Example operation", detail: "Run it repeatedly." },
  ],
  evidenceStatus: "partial",
  evidence: [
    { label: "Example brief", status: "partial", note: "The brief is available." },
    { label: "Example result", status: "needed", note: "The result is pending." },
  ],
};

describe("artifact record adapter", () => {
  // Catches an editorial mapping that loses an entity or changes its triplet grouping.
  it("groups each legacy record into the instinct, approach, and output steps", () => {
    const data = adaptArtifactRecords([record]);
    const branch = data.projections[0].branches[0];

    expect(branch.steps.map(({ role }) => role)).toEqual([
      "instinct",
      "approach",
      "output",
    ]);
    expect(branch.steps[0].entityIds).toEqual([
      "example:judgment",
      "example:principle",
      "example:decision",
    ]);
    expect(branch.steps[1].entityIds).toEqual([
      "example:spec",
      "example:system",
    ]);
    expect(branch.steps[2].entityIds).toEqual([
      "example:artifact",
      "example:operation",
      "example:evidence:0",
      "example:evidence:1",
    ]);
  });

  // Catches route, domain, and evidence metadata being lost during adaptation.
  it("preserves project facets and the current case-study route", () => {
    const data = adaptArtifactRecords([record]);

    expect(data.projects[0].facets).toEqual({
      domain: ["music"],
      evidenceStatus: ["partial"],
    });
    expect(data.entities.find(({ id }) => id === "example:artifact")?.links).toEqual([
      { label: "View case study", href: "/work/example" },
    ]);
  });

  // Catches live content that cannot be resolved or whose branch membership fails model validation.
  it("publishes every current record through validated project and branch lookups", () => {
    expect(validatePortfolioData(portfolioData)).toEqual([]);

    for (const artifact of artifacts) {
      const project = getProject(artifact.slug);
      const branch = project && getBranch(project.id, MAIN_PROJECTION_ID);

      expect(project).toBeDefined();
      expect(branch).toBeDefined();
      expect(getBranchEntities(branch!).map(({ id }) => id)).toEqual(
        project!.entityIds,
      );
    }
  });
});
