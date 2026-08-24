import { describe, expect, it } from "vitest";
import type {
  PortfolioEntity,
  PortfolioProjection,
  ProjectRecord,
  TripletBranch,
} from "./portfolio-model";
import {
  portfolioNodes,
  projectSpatialGraph,
  terminalNodeIds,
  type SpatialGroup,
} from "./spatial-graph";

const groups: SpatialGroup[] = [
  { id: "music", label: "Music", angle: 0 },
  { id: "consulting", label: "Consulting", angle: Math.PI },
];

const project = (id: string, domain: string): ProjectRecord => ({
  id,
  slug: id,
  title: `${id} project`,
  summary: `${id} summary`,
  entityIds: [`${id}:instinct`, `${id}:approach`, `${id}:output`],
  facets: { domain: [domain] },
});

const branch = (projectId: string): TripletBranch => ({
  id: `${projectId}:branch`,
  projectId,
  steps: [
    {
      role: "instinct",
      title: `${projectId} instinct`,
      summary: "An instinct summary",
      entityIds: [`${projectId}:instinct`],
    },
    {
      role: "approach",
      title: `${projectId} approach`,
      summary: "An approach summary",
      entityIds: [`${projectId}:approach`],
    },
    {
      role: "output",
      title: `${projectId} output`,
      summary: "An output summary",
      entityIds: [`${projectId}:output`],
    },
  ],
});

const projects = [
  project("music-one", "music"),
  project("consulting-one", "consulting"),
  project("music-two", "music"),
];
const projection: PortfolioProjection = {
  id: "test-projection",
  shape: "instinct-approach-output/v1",
  title: "Test projection",
  rootEntityId: "portfolio:brain",
  branches: projects.map(({ id }) => branch(id)),
};
const root: PortfolioEntity = {
  id: "portfolio:brain",
  title: "Judgment",
  summary: "The root summary",
};

describe("spatial graph projection", () => {
  it("centers the live portfolio on Bradley Berkman", () => {
    expect(portfolioNodes[0]).toMatchObject({
      role: "root",
      label: "Bradley Berkman",
    });
  });

  it("projects ordered branches into rooted, canonical project routes", () => {
    const nodes = projectSpatialGraph({ projection, projects, root, groups });

    expect(nodes[0]).toMatchObject({
      id: "portfolio:brain",
      role: "root",
      parentId: undefined,
      href: undefined,
    });

    for (const branch of projection.branches) {
      const project = projects.find(({ id }) => id === branch.projectId)!;
      const branchNodes = nodes.filter(
        ({ projectId }) => projectId === branch.projectId,
      );

      expect(branchNodes.map(({ role }) => role)).toEqual([
        "instinct",
        "approach",
        "output",
      ]);
      expect(branchNodes.map(({ href }) => href)).toEqual([
        `/work/${project.slug}`,
        `/work/${project.slug}`,
        `/work/${project.slug}`,
      ]);
      expect(branchNodes[0].parentId).toBe("portfolio:brain");
      expect(branchNodes[1].parentId).toBe(branchNodes[0].id);
      expect(branchNodes[2].parentId).toBe(branchNodes[1].id);
      expect(branchNodes.map(({ entityIds }) => entityIds)).toEqual(
        branch.steps.map(({ entityIds }) => entityIds),
      );
    }

    expect(terminalNodeIds(nodes)).toEqual(
      projection.branches.map(({ id }) => `${id}:output`),
    );
  });

  it("derives finite, distinct positions from the supplied branches and groups", () => {
    const nodes = projectSpatialGraph({ projection, projects, root, groups });
    const stepNodes = nodes.filter(({ role }) => role !== "root");
    const musicInstincts = nodes.filter(
      ({ id }) => id === "music-one:branch:instinct" || id === "music-two:branch:instinct",
    );

    expect(nodes.every(({ position }) => position.every(Number.isFinite))).toBe(
      true,
    );
    expect(new Set(stepNodes.map(({ position }) => position.join(","))).size).toBe(
      stepNodes.length,
    );
    expect(musicInstincts[0].position).not.toEqual(musicInstincts[1].position);
  });

  it("places each branch role progressively farther from the root", () => {
    const nodes = projectSpatialGraph({ projection, projects, root, groups });
    const branchNodes = nodes.filter(
      ({ projectId }) => projectId === "music-one",
    );
    const radialDistance = ({ position }: (typeof branchNodes)[number]) =>
      Math.hypot(position[0], position[2]);

    expect(radialDistance(branchNodes[0])).toBeLessThan(
      radialDistance(branchNodes[1]),
    );
    expect(radialDistance(branchNodes[1])).toBeLessThan(
      radialDistance(branchNodes[2]),
    );
  });

  it("fans branches across a meaningful share of the space between groups", () => {
    const crowdedProjects = [
      project("music-one", "music"),
      project("music-two", "music"),
      project("music-three", "music"),
      project("consulting-one", "consulting"),
    ];
    const nodes = projectSpatialGraph({
      projection: {
        ...projection,
        branches: crowdedProjects.map(({ id }) => branch(id)),
      },
      projects: crowdedProjects,
      root,
      groups,
    });
    const musicAngles = nodes
      .filter(
        ({ groupId, role }) => groupId === "music" && role === "instinct",
      )
      .map(({ position }) => Math.atan2(position[2], position[0]));
    const fanWidth = Math.max(...musicAngles) - Math.min(...musicAngles);
    const groupSeparation = Math.PI;

    expect(fanWidth).toBeGreaterThan(groupSeparation / 4);
  });

  it("vertically staggers crowded branches around their group plane", () => {
    const crowdedProjects = [
      project("music-one", "music"),
      project("music-two", "music"),
      project("music-three", "music"),
      project("music-four", "music"),
      project("consulting-one", "consulting"),
    ];
    const nodes = projectSpatialGraph({
      projection: {
        ...projection,
        branches: crowdedProjects.map(({ id }) => branch(id)),
      },
      projects: crowdedProjects,
      root,
      groups,
    });
    const musicHeights = nodes
      .filter(
        ({ groupId, role }) => groupId === "music" && role === "instinct",
      )
      .map(({ position }) => position[1]);

    expect(new Set(musicHeights).size).toBe(musicHeights.length);
    expect(Math.min(...musicHeights)).toBeLessThan(0);
    expect(Math.max(...musicHeights)).toBeGreaterThan(0);
  });

  it("distributes projects without a known group instead of collapsing them", () => {
    const unknownProject = project("unknown", "unclassified");
    const nodes = projectSpatialGraph({
      projection: {
        ...projection,
        branches: [...projection.branches, branch(unknownProject.id)],
      },
      projects: [...projects, unknownProject],
      root,
      groups,
    });

    expect(nodes.find(({ id }) => id === "unknown:branch:output")?.position).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    );
    expect(new Set(nodes.map(({ position }) => position.join(","))).size).toBe(
      nodes.length,
    );
  });
});
