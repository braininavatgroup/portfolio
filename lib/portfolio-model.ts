export type PortfolioStageData = {
  version: "stage-graph-1";
  projects: ProjectRecord[];
  entities: PortfolioEntity[];
  relations: EntityRelation[];
  projections: PortfolioProjection[];
};

export type ProjectRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  entityIds: string[];
  facets?: Record<string, readonly string[]>;
};

export type PortfolioEntity = {
  id: string;
  title: string;
  summary: string;
  detail?: string;
  facets?: Record<string, readonly string[]>;
  links?: { label: string; href: string }[];
};

export type EntityRelation = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  label?: string;
};

export type TripletRole = "instinct" | "approach" | "output";

export type TripletStep = {
  role: TripletRole;
  title: string;
  summary: string;
  entityIds: [string, ...string[]];
};

export type TripletBranch = {
  id: string;
  projectId: string;
  steps: [
    TripletStep & { role: "instinct" },
    TripletStep & { role: "approach" },
    TripletStep & { role: "output" },
  ];
  relationIds?: string[];
};

export type PortfolioProjection = {
  id: string;
  shape: "instinct-approach-output/v1";
  title: string;
  rootEntityId: string;
  branches: TripletBranch[];
  relationIds?: string[];
};

export type PortfolioModel = {
  data: PortfolioStageData;
  getProject(slug: string): ProjectRecord | undefined;
  getEntity(id: string): PortfolioEntity | undefined;
  getProjection(id: string): PortfolioProjection | undefined;
  getBranch(projectId: string, projectionId: string): TripletBranch | undefined;
  getBranchEntities(branch: TripletBranch): PortfolioEntity[];
};

export function validatePortfolioData(data: PortfolioStageData): string[] {
  const issues: string[] = [];
  const duplicateIds = (label: string, ids: readonly string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) issues.push(`${label} has duplicate id: ${id}`);
      seen.add(id);
    }
  };

  duplicateIds("projects", data.projects.map(({ id }) => id));
  duplicateIds("entities", data.entities.map(({ id }) => id));
  duplicateIds("relations", data.relations.map(({ id }) => id));
  duplicateIds("projections", data.projections.map(({ id }) => id));

  const projectIds = new Set(data.projects.map(({ id }) => id));
  const entityIds = new Set(data.entities.map(({ id }) => id));
  const relationIds = new Set(data.relations.map(({ id }) => id));
  const projectEntityIds = new Map(
    data.projects.map((project) => [
      project.id,
      new Set(project.entityIds),
    ]),
  );

  for (const project of data.projects) {
    for (const [index, entityId] of project.entityIds.entries()) {
      if (!entityIds.has(entityId)) {
        issues.push(
          `projects[${project.id}].entityIds[${index}] references missing entity: ${entityId}`,
        );
      }
    }
  }

  for (const relation of data.relations) {
    if (!entityIds.has(relation.fromEntityId)) {
      issues.push(
        `relations[${relation.id}].fromEntityId references missing entity: ${relation.fromEntityId}`,
      );
    }
    if (!entityIds.has(relation.toEntityId)) {
      issues.push(
        `relations[${relation.id}].toEntityId references missing entity: ${relation.toEntityId}`,
      );
    }
  }

  for (const projection of data.projections) {
    if (!entityIds.has(projection.rootEntityId)) {
      issues.push(
        `projections[${projection.id}].rootEntityId references missing entity: ${projection.rootEntityId}`,
      );
    }

    for (const [relationIndex, relationId] of (
      projection.relationIds ?? []
    ).entries()) {
      if (!relationIds.has(relationId)) {
        issues.push(
          `projections[${projection.id}].relationIds[${relationIndex}] references missing relation: ${relationId}`,
        );
      }
    }

    duplicateIds(
      `projections[${projection.id}].branches`,
      projection.branches.map(({ id }) => id),
    );

    for (const branch of projection.branches) {
      if (!projectIds.has(branch.projectId)) {
        issues.push(
          `projections[${projection.id}].branches[${branch.id}].projectId references missing project: ${branch.projectId}`,
        );
      }

      for (const [relationIndex, relationId] of (
        branch.relationIds ?? []
      ).entries()) {
        if (!relationIds.has(relationId)) {
          issues.push(
            `projections[${projection.id}].branches[${branch.id}].relationIds[${relationIndex}] references missing relation: ${relationId}`,
          );
        }
      }

      const branchProjectEntityIds = projectEntityIds.get(branch.projectId);

      for (const [stepIndex, step] of branch.steps.entries()) {
        if (step.entityIds.length === 0) {
          issues.push(
            `projections[${projection.id}].branches[${branch.id}].steps[${stepIndex}].entityIds must contain at least one entity`,
          );
        }

        for (const [entityIndex, entityId] of step.entityIds.entries()) {
          const path = `projections[${projection.id}].branches[${branch.id}].steps[${stepIndex}].entityIds[${entityIndex}]`;
          if (!entityIds.has(entityId)) {
            issues.push(`${path} references missing entity: ${entityId}`);
          }
          if (branchProjectEntityIds && !branchProjectEntityIds.has(entityId)) {
            issues.push(
              `${path} is not assigned to project: ${branch.projectId}`,
            );
          }
        }
      }
    }
  }

  return issues;
}

export function createPortfolioModel(data: PortfolioStageData): PortfolioModel {
  const issues = validatePortfolioData(data);
  if (issues.length > 0) {
    throw new Error(issues.join("\n"));
  }

  const projectsBySlug = new Map(
    data.projects.map((project) => [project.slug, project]),
  );
  const entitiesById = new Map(
    data.entities.map((entity) => [entity.id, entity]),
  );
  const projectionsById = new Map(
    data.projections.map((projection) => [projection.id, projection]),
  );

  return {
    data,
    getProject: (slug) => projectsBySlug.get(slug),
    getEntity: (id) => entitiesById.get(id),
    getProjection: (id) => projectionsById.get(id),
    getBranch: (projectId, projectionId) =>
      projectionsById
        .get(projectionId)
        ?.branches.find((branch) => branch.projectId === projectId),
    getBranchEntities: (branch) =>
      branch.steps.flatMap((step) =>
        step.entityIds.map((entityId) => entitiesById.get(entityId)!),
      ),
  };
}
