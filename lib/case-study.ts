import {
  MAIN_PROJECTION_ID,
  getBranch,
  getEntity,
  getProject,
  portfolioData,
} from "./portfolio-data";
import type {
  EntityRelation,
  PortfolioEntity,
  ProjectRecord,
  TripletBranch,
} from "./portfolio-model";

export type CaseStudySupport = {
  entity: PortfolioEntity;
  status: string;
  label: string;
};

export type CaseStudyLead = {
  label: string;
  to: PortfolioEntity;
};

export type CaseStudyItem = {
  entity: PortfolioEntity;
  evidenceStatus?: string;
  support: CaseStudySupport[];
  leads: CaseStudyLead[];
};

export type CaseStudyStep = {
  role: string;
  title: string;
  summary: string;
  items: CaseStudyItem[];
};

export type CaseStudy = {
  project: ProjectRecord;
  steps: CaseStudyStep[];
};

const relationLabel = (relation: EntityRelation) =>
  relation.label ?? relation.type.replaceAll("-", " ");

const evidenceStatusOf = (entity: PortfolioEntity) =>
  entity.facets?.evidenceStatus?.[0];

export function composeCaseStudy(input: {
  project: ProjectRecord;
  branch: TripletBranch;
  relations: readonly EntityRelation[];
  resolveEntity: (id: string) => PortfolioEntity | undefined;
}): CaseStudy {
  const relationsById = new Map(
    input.relations.map((relation) => [relation.id, relation]),
  );
  const resolved = new Map<string, PortfolioEntity>();
  for (const step of input.branch.steps) {
    for (const entityId of step.entityIds) {
      const entity = input.resolveEntity(entityId);
      if (entity) resolved.set(entityId, entity);
    }
  }

  const branchRelations = (input.branch.relationIds ?? []).flatMap(
    (relationId) => {
      const relation = relationsById.get(relationId);
      const from = relation && resolved.get(relation.fromEntityId);
      const to = relation && resolved.get(relation.toEntityId);
      return relation && from && to ? [{ relation, from, to }] : [];
    },
  );

  // A related entity carrying an evidence facet reads as supporting material
  // for the entity that points at it, not as a claim of its own.
  const attachedEvidenceIds = new Set<string>();
  const supportByEntityId = new Map<string, CaseStudySupport[]>();
  for (const { relation, from, to } of branchRelations) {
    const status = evidenceStatusOf(to);
    if (status === undefined) continue;
    const support = supportByEntityId.get(from.id) ?? [];
    support.push({ entity: to, status, label: relationLabel(relation) });
    supportByEntityId.set(from.id, support);
    attachedEvidenceIds.add(to.id);
  }

  const leadsByEntityId = new Map<string, CaseStudyLead[]>();
  for (const { relation, from, to } of branchRelations) {
    if (attachedEvidenceIds.has(to.id)) continue;
    const leads = leadsByEntityId.get(from.id) ?? [];
    leads.push({ label: relationLabel(relation), to });
    leadsByEntityId.set(from.id, leads);
  }

  const steps = input.branch.steps.map((step) => ({
    role: step.role,
    title: step.title,
    summary: step.summary,
    items: step.entityIds.flatMap((entityId) => {
      const entity = resolved.get(entityId);
      if (!entity || attachedEvidenceIds.has(entity.id)) return [];
      return [
        {
          entity,
          evidenceStatus: evidenceStatusOf(entity),
          support: supportByEntityId.get(entity.id) ?? [],
          leads: leadsByEntityId.get(entity.id) ?? [],
        },
      ];
    }),
  }));

  return { project: input.project, steps };
}

export const caseStudySlugs = portfolioData.projects.map(({ slug }) => slug);

export function getCaseStudy(slug: string): CaseStudy | undefined {
  const project = getProject(slug);
  const branch = project && getBranch(project.id, MAIN_PROJECTION_ID);
  if (!project || !branch) return undefined;
  return composeCaseStudy({
    project,
    branch,
    relations: portfolioData.relations,
    resolveEntity: getEntity,
  });
}

export function getAdjacentProjects(
  slug: string,
): { previous: ProjectRecord; next: ProjectRecord } | undefined {
  const { projects } = portfolioData;
  const index = projects.findIndex((project) => project.slug === slug);
  if (index < 0) return undefined;
  return {
    previous: projects[(index - 1 + projects.length) % projects.length],
    next: projects[(index + 1) % projects.length],
  };
}

export type ProjectGroup = {
  id: string;
  label: string;
  description?: string;
  projects: ProjectRecord[];
};

export function groupProjectsByFacet(
  projects: readonly ProjectRecord[],
  facetKey: string,
  knownGroups: readonly { id: string; label: string; description?: string }[],
): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>(
    knownGroups.map(({ id, label, description }) => [
      id,
      { id, label, description, projects: [] },
    ]),
  );
  for (const project of projects) {
    const facetId = project.facets?.[facetKey]?.[0] ?? "ungrouped";
    const group = groups.get(facetId) ?? {
      id: facetId,
      label: facetId,
      projects: [],
    };
    group.projects.push(project);
    groups.set(facetId, group);
  }
  return [...groups.values()].filter((group) => group.projects.length > 0);
}
