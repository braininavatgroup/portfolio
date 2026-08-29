import type { ArtifactRecord, ChainEntry } from "./portfolio";
import type {
  EntityRelation,
  PortfolioEntity,
  PortfolioProjection,
  PortfolioStageData,
  ProjectRecord,
  TripletBranch,
} from "./portfolio-model";

export const MAIN_PROJECTION_ID = "instinct-approach-output/v1";

const rootEntity: PortfolioEntity = {
  id: "portfolio:brain",
  title: "Bradley Berkman",
  summary: "I find where judgment matters, then build the system around it.",
};

function findChainEntry(record: ArtifactRecord, layer: ChainEntry["layer"]) {
  const entry = record.chain.find((candidate) => candidate.layer === layer);
  if (!entry) {
    throw new Error(`Missing ${layer} entry for project: ${record.slug}`);
  }
  return entry;
}

export function adaptArtifactRecords(
  records: readonly ArtifactRecord[],
): PortfolioStageData {
  const projects: ProjectRecord[] = [];
  const entities: PortfolioEntity[] = [rootEntity];
  const relations: EntityRelation[] = [];
  const branches: TripletBranch[] = [];

  for (const record of records) {
    const judgment = findChainEntry(record, "judgment");
    const spec = findChainEntry(record, "spec");
    const system = findChainEntry(record, "system");
    const artifact = findChainEntry(record, "artifact");
    const operation = findChainEntry(record, "operation");
    const prefix = record.slug;

    const instinctIds: [string, ...string[]] = [
      `${prefix}:judgment`,
      `${prefix}:principle`,
      `${prefix}:decision`,
    ];
    const approachIds: [string, ...string[]] = [
      `${prefix}:spec`,
      `${prefix}:system`,
    ];
    const outputIds: [string, ...string[]] = [
      `${prefix}:artifact`,
      `${prefix}:operation`,
      ...record.evidence.map((_, index) => `${prefix}:evidence:${index}`),
    ];

    entities.push(
      {
        id: instinctIds[0],
        title: judgment.title,
        summary: judgment.detail,
        facets: { sourceLayer: [judgment.layer] },
      },
      {
        id: instinctIds[1],
        title: record.principle,
        summary: record.reason,
      },
      {
        id: instinctIds[2],
        title: record.decision,
        summary: record.reason,
      },
      {
        id: approachIds[0],
        title: spec.title,
        summary: spec.detail,
        facets: { sourceLayer: [spec.layer] },
      },
      {
        id: approachIds[1],
        title: system.title,
        summary: system.detail,
        facets: { sourceLayer: [system.layer] },
      },
      {
        id: outputIds[0],
        title: record.title,
        summary: record.summary,
        detail: artifact.detail,
        facets: { sourceLayer: [artifact.layer] },
        links: [{ label: "View record", href: `/index/${record.slug}` }],
      },
      {
        id: outputIds[1],
        title: operation.title,
        summary: operation.detail,
        facets: { sourceLayer: [operation.layer] },
      },
      ...record.evidence.map((item, index) => ({
        id: `${prefix}:evidence:${index}`,
        title: item.label,
        summary: item.note,
        facets: { evidenceStatus: [item.status] },
      })),
    );

    const branchRelations: EntityRelation[] = [
      {
        id: `${prefix}:relation:informed`,
        fromEntityId: instinctIds[0],
        toEntityId: approachIds[0],
        type: "informed",
      },
      {
        id: `${prefix}:relation:developed-into`,
        fromEntityId: approachIds[0],
        toEntityId: approachIds[1],
        type: "developed-into",
      },
      {
        id: `${prefix}:relation:produced`,
        fromEntityId: approachIds[1],
        toEntityId: outputIds[0],
        type: "produced",
      },
      {
        id: `${prefix}:relation:operated-as`,
        fromEntityId: outputIds[0],
        toEntityId: outputIds[1],
        type: "operated-as",
      },
      ...record.evidence.map((_, index) => ({
        id: `${prefix}:relation:supported-by:${index}`,
        fromEntityId: outputIds[0],
        toEntityId: `${prefix}:evidence:${index}`,
        type: "supported-by",
      })),
    ];
    relations.push(...branchRelations);

    const entityIds = [...instinctIds, ...approachIds, ...outputIds];
    projects.push({
      id: record.slug,
      slug: record.slug,
      title: record.title,
      summary: record.summary,
      entityIds,
      facets: {
        domain: [record.domain],
        evidenceStatus: [record.evidenceStatus],
      },
    });
    branches.push({
      id: `${prefix}:branch`,
      projectId: record.slug,
      steps: [
        {
          role: "instinct",
          title: judgment.title,
          summary: record.principle,
          entityIds: instinctIds,
        },
        {
          role: "approach",
          title: spec.title,
          summary: system.detail,
          entityIds: approachIds,
        },
        {
          role: "output",
          title: record.title,
          summary: record.summary,
          entityIds: outputIds,
        },
      ],
      relationIds: branchRelations.map(({ id }) => id),
    });
  }

  const projection: PortfolioProjection = {
    id: MAIN_PROJECTION_ID,
    shape: "instinct-approach-output/v1",
    title: "Instinct, approach, output",
    rootEntityId: rootEntity.id,
    branches,
    relationIds: relations.map(({ id }) => id),
  };

  return {
    version: "stage-graph-1",
    projects,
    entities,
    relations,
    projections: [projection],
  };
}
