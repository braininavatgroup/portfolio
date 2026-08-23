import type { PortfolioNode } from "./portfolio";

export type NodeAction = "none" | "inspect";

export function nodeAction(node: PortfolioNode): NodeAction {
  if (node.kind === "brain") return "none";
  return "inspect";
}
