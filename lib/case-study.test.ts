import { describe, expect, it } from "vitest";
import {
  caseStudySlugs,
  composeCaseStudy,
  getAdjacentProjects,
  getCaseStudy,
  groupProjectsByFacet,
} from "./case-study";
import { portfolioData } from "./portfolio-data";
import type {
  EntityRelation,
  PortfolioEntity,
  ProjectRecord,
  TripletBranch,
} from "./portfolio-model";

const entities: PortfolioEntity[] = [
  { id: "p:judgment", title: "Find the judgment", summary: "Locate the choice." },
  { id: "p:spec", title: "Example spec", summary: "Define the contract." },
  { id: "p:system", title: "Example system", summary: "Build the loop." },
  {
    id: "p:artifact",
    title: "Shipped tool",
    summary: "The visible output.",
    links: [
      { label: "View case study", href: "/work/example" },
      { label: "Spec document", href: "/docs/example-spec" },
    ],
  },
  {
    id: "p:evidence",
    title: "Run record",
    summary: "Not yet published.",
    facets: { evidenceStatus: ["needed"] },
  },
  {
    id: "p:loose-evidence",
    title: "Spare note",
    summary: "No relation points here.",
    facets: { evidenceStatus: ["partial"] },
  },
];

const relations: EntityRelation[] = [
  { id: "r:informed", fromEntityId: "p:judgment", toEntityId: "p:spec", type: "informed" },
  { id: "r:developed", fromEntityId: "p:spec", toEntityId: "p:system", type: "developed-into" },
  {
    id: "r:produced",
    fromEntityId: "p:system",
    toEntityId: "p:artifact",
    type: "produced",
    label: "shipped as",
  },
  { id: "r:supported", fromEntityId: "p:artifact", toEntityId: "p:evidence", type: "supported-by" },
  { id: "r:ghost", fromEntityId: "p:artifact", toEntityId: "p:missing", type: "supported-by" },
];

const branch: TripletBranch = {
  id: "p:branch",
  projectId: "example",
  steps: [
    {
      role: "instinct",
      title: "Instinct step",
      summary: "Where the work starts.",
      entityIds: ["p:judgment"],
    },
    {
      role: "approach",
      title: "Approach step",
      summary: "How the work is shaped.",
      entityIds: ["p:spec", "p:system"],
    },
    {
      role: "output",
      title: "Output step",
      summary: "What the work produced.",
      entityIds: ["p:artifact", "p:missing", "p:evidence", "p:loose-evidence"],
    },
  ],
  relationIds: [
    "r:informed",
    "r:developed",
    "r:produced",
    "r:supported",
    "r:ghost",
    "r:unknown",
  ],
};

const project: ProjectRecord = {
  id: "example",
  slug: "example",
  title: "Example project",
  summary: "An example case study.",
  entityIds: entities.map(({ id }) => id),
};

const resolveEntity = (id: string) => entities.find((entity) => entity.id === id);

const compose = () =>
  composeCaseStudy({ project, branch, relations, resolveEntity });

describe("case-study composition", () => {
  // Catches a composition that reorders or regroups the projection's steps.
  it("keeps grouped entities in the projection's declared step order", () => {
    const caseStudy = compose();

    expect(caseStudy.steps.map(({ role }) => role)).toEqual([
      "instinct",
      "approach",
      "output",
    ]);
    expect(caseStudy.steps.map(({ title }) => title)).toEqual([
      "Instinct step",
      "Approach step",
      "Output step",
    ]);
    expect(
      caseStudy.steps.map((step) => step.items.map(({ entity }) => entity.id)),
    ).toEqual([
      ["p:judgment"],
      ["p:spec", "p:system"],
      ["p:artifact", "p:loose-evidence"],
    ]);
  });

  // Catches relation phrasing regressions: explicit labels win, types read as words.
  it("phrases relations readably from data", () => {
    const [instinct, approach] = compose().steps;

    expect(instinct.items[0].leads).toEqual([
      { label: "informed", to: expect.objectContaining({ id: "p:spec" }) },
    ]);
    expect(approach.items[0].leads[0].label).toBe("developed into");
    expect(approach.items[1].leads[0].label).toBe("shipped as");
  });

  // Catches evidence merging into outputs or duplicating as standalone claims.
  it("attaches related evidence to the entity it supports and keeps both distinct", () => {
    const output = compose().steps[2];
    const artifact = output.items.find(({ entity }) => entity.id === "p:artifact");

    expect(artifact?.support).toEqual([
      {
        entity: expect.objectContaining({ id: "p:evidence" }),
        status: "needed",
        label: "supported by",
      },
    ]);
    expect(artifact?.leads).toEqual([]);
    expect(output.items.map(({ entity }) => entity.id)).not.toContain("p:evidence");
  });

  // Catches missing proof disappearing when nothing points at it.
  it("keeps unattached evidence visible with its status", () => {
    const output = compose().steps[2];
    const loose = output.items.find(
      ({ entity }) => entity.id === "p:loose-evidence",
    );

    expect(loose?.evidenceStatus).toBe("partial");
    expect(loose?.support).toEqual([]);
  });

  // Catches a crash or phantom content when data references entities that do not resolve.
  it("skips unresolvable entities and the relations that touch them", () => {
    const caseStudy = compose();
    const allItemIds = caseStudy.steps.flatMap((step) =>
      step.items.map(({ entity }) => entity.id),
    );
    const artifact = caseStudy.steps[2].items.find(
      ({ entity }) => entity.id === "p:artifact",
    );

    expect(allItemIds).not.toContain("p:missing");
    expect(artifact?.support).toHaveLength(1);
    expect(artifact?.leads).toEqual([]);
  });
});

describe("canonical case-study routes", () => {
  // Catches route generation drifting from the published project data.
  it("derives every route from the published projects", () => {
    expect(caseStudySlugs).toEqual(
      portfolioData.projects.map(({ slug }) => slug),
    );
    expect(new Set(caseStudySlugs).size).toBe(caseStudySlugs.length);
    expect(caseStudySlugs.length).toBeGreaterThan(0);

    for (const slug of caseStudySlugs) {
      const caseStudy = getCaseStudy(slug);
      expect(caseStudy).toBeDefined();
      expect(caseStudy?.project.slug).toBe(slug);
      expect(caseStudy?.steps.length).toBeGreaterThan(0);
      expect(
        caseStudy?.steps.every((step) => step.items.length > 0),
      ).toBe(true);
    }
  });

  it("returns nothing for a slug outside the data", () => {
    expect(getCaseStudy("not-a-project")).toBeUndefined();
    expect(getAdjacentProjects("not-a-project")).toBeUndefined();
  });

  it("wraps adjacent navigation around the project order", () => {
    const { projects } = portfolioData;
    const first = getAdjacentProjects(projects[0].slug);
    const last = getAdjacentProjects(projects[projects.length - 1].slug);

    expect(first?.previous.slug).toBe(projects[projects.length - 1].slug);
    expect(first?.next.slug).toBe(projects[1].slug);
    expect(last?.next.slug).toBe(projects[0].slug);
  });
});

describe("index grouping", () => {
  const groupedProjects: ProjectRecord[] = [
    { id: "a", slug: "a", title: "A", summary: "", entityIds: [], facets: { domain: ["music"] } },
    { id: "b", slug: "b", title: "B", summary: "", entityIds: [], facets: { domain: ["field-recording"] } },
    { id: "c", slug: "c", title: "C", summary: "", entityIds: [] },
    { id: "d", slug: "d", title: "D", summary: "", entityIds: [], facets: { domain: ["music"] } },
  ];
  const knownGroups = [
    { id: "consulting", label: "Consulting", description: "Consulting work." },
    { id: "music", label: "Music promotion", description: "Music work." },
  ];

  // Catches known-group ordering loss, dropped projects, or fabricated empty sections.
  it("orders known groups first, keeps unknown facets, and drops empty groups", () => {
    const groups = groupProjectsByFacet(groupedProjects, "domain", knownGroups);

    expect(groups.map(({ id }) => id)).toEqual([
      "music",
      "field-recording",
      "ungrouped",
    ]);
    expect(groups[0].label).toBe("Music promotion");
    expect(groups[0].projects.map(({ id }) => id)).toEqual(["a", "d"]);
    expect(groups[1].label).toBe("field-recording");
    expect(groups[2].projects.map(({ id }) => id)).toEqual(["c"]);
  });
});
