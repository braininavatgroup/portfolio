import type { SpatialGraphNode } from "./spatial-graph";

export type NodeAction = "none" | "inspect";

export function nodeAction(node: SpatialGraphNode): NodeAction {
  if (node.role === "root" || !node.projectId || !node.href) return "none";
  return "inspect";
}
