import type { PortfolioNode } from "./portfolio";

const routesForNodes = (nodes: PortfolioNode[]) =>
  nodes
    .filter(
      (node): node is PortfolioNode & { href: string } =>
        node.kind !== "brain" && typeof node.href === "string",
    )
    .map((node) => node.href);

export const graphNodeRoutes = (nodes: PortfolioNode[]) => routesForNodes(nodes);

export const keyboardNodeRoutes = (nodes: PortfolioNode[]) => routesForNodes(nodes);

export const flatIndexNodeRoutes = (nodes: PortfolioNode[]) => routesForNodes(nodes);
