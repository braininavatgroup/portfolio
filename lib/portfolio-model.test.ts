import { describe, expect, it } from "vitest";
import {
  createPortfolioModel,
  validatePortfolioData,
  type PortfolioStageData,
} from "./portfolio-model";

const fixture: PortfolioStageData = {
  version: "stage-graph-1",
  projects: [
    {
      id: "project:example",
      slug: "example",
      title: "Example project",
      summary: "A compact graph fixture.",
      entityIds: [
        "example:instinct",
        "example:spec",
        "example:system",
        "example:output",
      ],
      facets: {
        domain: ["music"],
        experimentalFacet: ["kept-verbatim"],
      },
    },
  ],
  entities: [
    { id: "example:instinct", title: "Instinct", summary: "The judgment." },
    { id: "example:spec", title: "Spec", summary: "The specification." },
    { id: "example:system", title: "System", summary: "The system." },
    { id: "example:output", title: "Output", summary: "The output." },
  ],
  relations: [
    {
      id: "relation:example",
      fromEntityId: "example:system",
      toEntityId: "example:output",
      type: "supports-in-a-way-not-yet-taxonomized",
    },
  ],
  projections: [
    {
      id: "projection:main",
      shape: "instinct-approach-output/v1",
      title: "Main projection",
      rootEntityId: "example:instinct",
      branches: [
        {
          id: "branch:example",
          projectId: "project:example",
          steps: [
            {
              role: "instinct",
              title: "Instinct",
              summary: "The judgment.",
              entityIds: ["example:instinct"],
            },
            {
              role: "approach",
              title: "Approach",
              summary: "The method.",
              entityIds: ["example:spec", "example:system"],
            },
            {
              role: "output",
              title: "Output",
              summary: "The result.",
              entityIds: ["example:output"],
            },
          ],
          relationIds: ["relation:example"],
        },
      ],
      relationIds: ["relation:example"],
    },
  ],
};

const invalidFixtures = [
  {
    name: "duplicate IDs",
    mutate: (data: PortfolioStageData) => {
      data.entities.push({ ...data.entities[0] });
    },
    issue: "entities has duplicate id: example:instinct",
  },
  {
    name: "missing projection root",
    mutate: (data: PortfolioStageData) => {
      data.projections[0].rootEntityId = "example:missing-root";
    },
    issue: "projections[projection:main].rootEntityId references missing entity: example:missing-root",
  },
  {
    name: "missing branch project reference",
    mutate: (data: PortfolioStageData) => {
      data.projections[0].branches[0].projectId = "project:missing";
    },
    issue: "projections[projection:main].branches[branch:example].projectId references missing project: project:missing",
  },
  {
    name: "missing project entity reference",
    mutate: (data: PortfolioStageData) => {
      data.projects[0].entityIds[0] = "example:missing-project-entity";
    },
    issue: "projects[project:example].entityIds[0] references missing entity: example:missing-project-entity",
  },
  {
    name: "missing relation entity reference",
    mutate: (data: PortfolioStageData) => {
      data.relations[0].toEntityId = "example:missing-relation-entity";
    },
    issue: "relations[relation:example].toEntityId references missing entity: example:missing-relation-entity",
  },
  {
    name: "missing projection relation reference",
    mutate: (data: PortfolioStageData) => {
      data.projections[0].relationIds = ["relation:missing"];
    },
    issue: "projections[projection:main].relationIds[0] references missing relation: relation:missing",
  },
  {
    name: "empty step entity list",
    mutate: (data: PortfolioStageData) => {
      data.projections[0].branches[0].steps[1].entityIds = [] as unknown as [
        string,
        ...string[],
      ];
    },
    issue: "projections[projection:main].branches[branch:example].steps[1].entityIds must contain at least one entity",
  },
  {
    name: "branch entity absent from its project",
    mutate: (data: PortfolioStageData) => {
      data.projects[0].entityIds = data.projects[0].entityIds.filter(
        (id) => id !== "example:output",
      );
      data.projections[0].branches[0].steps[0].entityIds = ["example:output"];
    },
    issue: "projections[projection:main].branches[branch:example].steps[0].entityIds[0] is not assigned to project: project:example",
  },
];

const cloneFixture = (): PortfolioStageData => structuredClone(fixture);

describe("portfolio stage model", () => {
  // Catches mutations that normalize open metadata or lose grouped step ordering.
  it("preserves open metadata and flattens branch entities in step order", () => {
    const model = createPortfolioModel(fixture);

    expect(model.getProject("example")?.facets).toEqual({
      domain: ["music"],
      experimentalFacet: ["kept-verbatim"],
    });
    expect(
      model
        .getBranchEntities(fixture.projections[0].branches[0])
        .map(({ id }) => id),
    ).toEqual([
      "example:instinct",
      "example:spec",
      "example:system",
      "example:output",
    ]);
    expect(model.data.relations[0].type).toBe(
      "supports-in-a-way-not-yet-taxonomized",
    );
  });

  // Catches mutations that omit structural reference and membership validation.
  it.each(invalidFixtures)("reports $name with a stable path", ({ mutate, issue }) => {
    const data = cloneFixture();
    mutate(data);

    expect(validatePortfolioData(data)).toContain(issue);
    expect(() => createPortfolioModel(data)).toThrow(issue);
  });
});
