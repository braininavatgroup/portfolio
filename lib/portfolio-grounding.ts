import {
  getBranch,
  getBranchEntities,
  mainProjection,
  portfolioData,
} from "./portfolio-data";
import type { EvidenceStatus } from "./portfolio";
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

type ScoredEvidence = PortfolioGroundingEvidence & {
  score: number;
  order: number;
};

function stripScore(candidate: ScoredEvidence): PortfolioGroundingEvidence {
  return {
    id: candidate.id,
    title: candidate.title,
    excerpt: candidate.excerpt,
    href: candidate.href,
    evidenceStatus: candidate.evidenceStatus,
    projectTitle: candidate.projectTitle,
    ...(candidate.stageRole ? { stageRole: candidate.stageRole } : {}),
  };
}

const ignoredWords = new Set([
  "about",
  "and",
  "bradley",
  "did",
  "does",
  "for",
  "from",
  "have",
  "how",
  "portfolio",
  "that",
  "the",
  "this",
  "what",
  "which",
  "with",
  "work",
]);

function words(value: string) {
  return new Set(
    value
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((word) => word.length >= 3 && !ignoredWords.has(word)) ?? [],
  );
}

function evidenceStatus(
  record: Pick<ProjectRecord | PortfolioEntity, "facets">,
  fallback: EvidenceStatus = "needed",
): EvidenceStatus {
  const status = record.facets?.evidenceStatus?.[0];
  return status === "available" || status === "partial" || status === "needed"
    ? status
    : fallback;
}

function scoreText(queryWords: ReadonlySet<string>, values: readonly string[]) {
  const candidateWords = words(values.join(" "));
  let score = 0;
  for (const word of queryWords) {
    if (candidateWords.has(word)) score += 1;
  }
  return score;
}

function entityEvidence(
  entity: PortfolioEntity,
  project: ProjectRecord,
  order: number,
  stageRole: TripletRole,
): ScoredEvidence {
  const excerpt = entity.detail ?? entity.summary;
  return {
    id: `entity:${entity.id}`,
    title: entity.title,
    excerpt,
    href: `/index/${project.slug}`,
    evidenceStatus: evidenceStatus(entity, evidenceStatus(project)),
    projectTitle: project.title,
    stageRole,
    score: 0,
    order,
  };
}

export function groundPortfolioQuestion(
  question: string,
  limit = 6,
): PortfolioGrounding {
  const queryWords = words(question);
  if (queryWords.size === 0 || limit <= 0) {
    return { question, evidence: [] };
  }

  const candidates: ScoredEvidence[] = [];
  let order = 0;

  for (const project of portfolioData.projects) {
    const branch = getBranch(project.id, mainProjection.id);
    const entities = branch ? getBranchEntities(branch) : [];
    const stageRoles = new Map(
      branch?.steps.flatMap((step) =>
        step.entityIds.map((entityId) => [entityId, step.role] as const),
      ),
    );
    const projectScore = scoreText(queryWords, [project.title, project.summary]);

    candidates.push({
      id: `project:${project.id}`,
      title: project.title,
      excerpt: project.summary,
      href: `/index/${project.slug}`,
      evidenceStatus: evidenceStatus(project),
      projectTitle: project.title,
      score: projectScore + (projectScore > 0 ? 1 : 0),
      order: order++,
    });

    for (const entity of entities) {
      const stageRole = stageRoles.get(entity.id);
      if (!stageRole) continue;
      const evidence = entityEvidence(entity, project, order++, stageRole);
      evidence.score = scoreText(queryWords, [evidence.title, evidence.excerpt]);
      candidates.push(evidence);
    }
  }

  return {
    question,
    evidence: candidates
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || left.order - right.order)
      .slice(0, limit)
      .map(stripScore),
  };
}
