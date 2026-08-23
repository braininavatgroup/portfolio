import { domains } from "./portfolio";
import {
  getEntity,
  mainProjection,
  portfolioData,
} from "./portfolio-data";
import type {
  PortfolioEntity,
  PortfolioProjection,
  ProjectRecord,
  TripletRole,
} from "./portfolio-model";

export type SpatialNodeRole = "root" | TripletRole;

export type SpatialGraphNode = {
  id: string;
  label: string;
  detail: string;
  role: SpatialNodeRole;
  position: readonly [number, number, number];
  entityIds: readonly string[];
  parentId?: string;
  projectId?: string;
  projectSlug?: string;
  href?: string;
  groupId?: string;
};

export type SpatialGroup = { id: string; label: string; angle: number };

const radiusByRole: Record<TripletRole, number> = {
  instinct: 1.7,
  approach: 3.1,
  output: 4.6,
};

const unknownGroupId = (project: ProjectRecord) =>
  project.facets?.domain?.[0] ?? "ungrouped";

export function projectSpatialGraph(input: {
  projection: PortfolioProjection;
  projects: readonly ProjectRecord[];
  root: PortfolioEntity;
  groups: readonly SpatialGroup[];
}): SpatialGraphNode[] {
  const projectsById = new Map(
    input.projects.map((project) => [project.id, project]),
  );
  const groupsById = new Map(input.groups.map((group) => [group.id, group]));
  const branchesByGroup = new Map<string, typeof input.projection.branches>();
  const unknownGroups: string[] = [];

  for (const branch of input.projection.branches) {
    const project = projectsById.get(branch.projectId);
    if (!project) {
      throw new Error(`Missing project for branch: ${branch.projectId}`);
    }

    const groupId = unknownGroupId(project);
    if (!groupsById.has(groupId) && !unknownGroups.includes(groupId)) {
      unknownGroups.push(groupId);
    }
    const branches = branchesByGroup.get(groupId) ?? [];
    branches.push(branch);
    branchesByGroup.set(groupId, branches);
  }

  const unknownAngles = new Map(
    unknownGroups.map((groupId, index) => [
      groupId,
      (Math.PI * 2 * (input.groups.length + index)) /
        (input.groups.length + unknownGroups.length),
    ]),
  );

  const nodes: SpatialGraphNode[] = [
    {
      id: input.root.id,
      label: input.root.title,
      detail: input.root.summary,
      role: "root",
      position: [0, 0, 0],
      entityIds: [input.root.id],
      parentId: undefined,
      href: undefined,
    },
  ];

  for (const branch of input.projection.branches) {
    const project = projectsById.get(branch.projectId)!;
    const groupId = unknownGroupId(project);
    const branches = branchesByGroup.get(groupId)!;
    const branchIndex = branches.indexOf(branch);
    const angle =
      (groupsById.get(groupId)?.angle ?? unknownAngles.get(groupId)!) +
      (branchIndex - (branches.length - 1) / 2) * 0.24;
    let parentId = input.root.id;

    for (const step of branch.steps) {
      const radius = radiusByRole[step.role];
      const id = `${branch.id}:${step.role}`;
      nodes.push({
        id,
        label: step.title,
        detail: step.summary,
        role: step.role,
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
        entityIds: step.entityIds,
        parentId,
        projectId: project.id,
        projectSlug: project.slug,
        href: `/work/${project.slug}`,
        groupId,
      });
      parentId = id;
    }
  }

  return nodes;
}

export function terminalNodeIds(nodes: readonly SpatialGraphNode[]): string[] {
  const parentIds = new Set(
    nodes.flatMap(({ parentId }) => (parentId ? [parentId] : [])),
  );
  return nodes
    .filter(({ id, role }) => role !== "root" && !parentIds.has(id))
    .map(({ id }) => id);
}

const root = getEntity(mainProjection.rootEntityId);
if (!root) {
  throw new Error(`Missing root entity: ${mainProjection.rootEntityId}`);
}

export const portfolioNodes = projectSpatialGraph({
  projection: mainProjection,
  projects: portfolioData.projects,
  root,
  groups: domains,
});
