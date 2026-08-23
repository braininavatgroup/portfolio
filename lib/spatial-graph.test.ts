import { describe, expect, it } from "vitest";
import type {
  PortfolioEntity,
  PortfolioProjection,
  ProjectRecord,
  TripletBranch,
} from "./portfolio-model";
import {
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
