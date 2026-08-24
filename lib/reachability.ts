import type { ProjectRecord } from "./portfolio-model";
import type { SpatialGraphNode } from "./spatial-graph";

const routesForNodes = (nodes: readonly SpatialGraphNode[]) =>
  nodes
    .filter(
      (node): node is SpatialGraphNode & { href: string } =>
        typeof node.href === "string",
    )
    .map((node) => node.href);

export const graphNodeRoutes = (nodes: readonly SpatialGraphNode[]) =>
  routesForNodes(nodes);

export const keyboardNodeRoutes = (nodes: readonly SpatialGraphNode[]) =>
  routesForNodes(nodes);

export const projectRoutes = (projects: readonly ProjectRecord[]) =>
  projects.map(({ slug }) => `/index/${slug}`);
