import type { SpatialGraphNode } from "./spatial-graph";

export type NodeAction = "none" | "index" | "focus" | "inspect";

export function nodeAction(node: SpatialGraphNode): NodeAction {
  if (node.role === "root") return "index";
  if (node.role === "domain" && node.groupId) return "focus";
  if (!node.projectId || !node.href) return "none";
  return "inspect";
}
