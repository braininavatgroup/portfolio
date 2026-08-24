import {
  getBranch,
  getBranchEntities,
  getEntity,
  mainProjection,
  portfolioData,
} from "./portfolio-data";
import {
  audienceStatement,
  careerTimeline,
  domains,
  portfolioThroughline,
  type EvidenceStatus,
} from "./portfolio";
import type {
  PortfolioEntity,
  ProjectRecord,
  TripletRole,
} from "./portfolio-model";

export type PortfolioGroundingEvidence = {
  id: string;
  title: string;
  excerpt: string;
  href: string;
  evidenceStatus: EvidenceStatus;
  projectTitle: string;
  stageRole?: TripletRole;
};

export type PortfolioGrounding = {
  question: string;
  evidence: PortfolioGroundingEvidence[];
};

function evidenceStatus(
  record: Pick<ProjectRecord | PortfolioEntity, "facets">,
  fallback: EvidenceStatus = "needed",
): EvidenceStatus {
  const status = record.facets?.evidenceStatus?.[0];
  return status === "available" || status === "partial" || status === "needed"
    ? status
    : fallback;
}

function completeProjectEvidence(
  project: ProjectRecord,
): PortfolioGroundingEvidence {
  const branch = getBranch(project.id, mainProjection.id);
  const entities = branch ? getBranchEntities(branch) : [];
  const stageRoles = new Map(
    branch?.steps.flatMap((step) =>
      step.entityIds.map((entityId) => [entityId, step.role] as const),
    ),
  );
  const projectStatus = evidenceStatus(project);
  const lines = [
    `Summary: ${project.summary}`,
    ...(project.facets?.domain?.length
      ? [`Domain: ${project.facets.domain.join(", ")}`]
      : []),
    `Project evidence status: ${projectStatus}`,
    ...entities.map((entity) => {
      const role = stageRoles.get(entity.id);
      const status = evidenceStatus(entity, projectStatus);
      const detail = entity.detail ?? entity.summary;
      return `${role ? `${role}; ` : ""}evidence ${status}; ${entity.title}: ${detail}`;
    }),
  ];

  return {
    id: `project:${project.id}`,
    title: project.title,
    excerpt: lines.join("\n"),
    href: `/index/${project.slug}`,
    evidenceStatus: projectStatus,
    projectTitle: project.title,
  };
}

function completePortfolioEvidence() {
  const root = getEntity(mainProjection.rootEntityId);
  const portfolioExcerpt = root
    ? [
        root.detail ?? root.summary,
        `Throughline: ${portfolioThroughline}`,
        `Audience: ${audienceStatement}`,
        "Domains:",
        ...domains.map(({ label, description }) => `${label}: ${description}`),
        "Career:",
        ...careerTimeline.map(
          ({ period, title, detail }) => `${period}; ${title}: ${detail}`,
        ),
      ].join("\n")
    : "";
  return [
    ...(root
      ? [
          {
            id: `entity:${root.id}`,
            title: root.title,
            excerpt: portfolioExcerpt,
            href: "/",
            evidenceStatus: "available" as const,
            projectTitle: "Portfolio",
          },
        ]
      : []),
    ...portfolioData.projects.map(completeProjectEvidence),
  ];
}

export function groundPortfolioQuestion(
  question: string,
  limit = Number.POSITIVE_INFINITY,
): PortfolioGrounding {
  return {
    question,
    evidence: completePortfolioEvidence().slice(0, Math.max(0, limit)),
  };
}
