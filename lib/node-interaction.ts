import type { SpatialGraphNode } from "./spatial-graph";

export type NodeAction = "none" | "index" | "inspect";

export function nodeAction(node: SpatialGraphNode): NodeAction {
  if (node.role === "root") return "index";
  if (!node.projectId || !node.href) return "none";
  return "inspect";
}
