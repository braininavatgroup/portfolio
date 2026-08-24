import { getCaseStudy, type CaseStudy } from "./case-study";
import type { TripletRole } from "./portfolio-model";
import type { SpatialGraphNode } from "./spatial-graph";

export type PortfolioDossierRecord = CaseStudy & {
  selectedRole: TripletRole;
};

export function getPortfolioDossier(
  node: SpatialGraphNode,
): PortfolioDossierRecord | undefined {
  if (node.role === "root" || node.role === "domain" || !node.projectSlug) {
    return undefined;
  }
  const caseStudy = getCaseStudy(node.projectSlug);
  return caseStudy ? { ...caseStudy, selectedRole: node.role } : undefined;
}
