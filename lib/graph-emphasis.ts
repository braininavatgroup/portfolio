import type { DomainId } from "./portfolio";
import type { SpatialGraphNode, SpatialNodeRole } from "./spatial-graph";

export type GraphEdgeState = {
  parentId: string;
  childId: string;
  role: SpatialNodeRole;
  active: boolean;
  dimmed: boolean;
};

export function deriveGraphEdgeStates(
  nodes: readonly SpatialGraphNode[],
  {
    activeNodeId,
    selectedDomain,
  }: {
    activeNodeId: string | null;
    selectedDomain: DomainId | null;
  },
): GraphEdgeState[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const activeChildren = new Set<string>();
  let activeNode = activeNodeId ? nodesById.get(activeNodeId) : undefined;

  while (activeNode?.parentId) {
    activeChildren.add(activeNode.id);
    activeNode = nodesById.get(activeNode.parentId);
  }

  return nodes.flatMap((node) =>
    node.parentId
      ? [
          {
            parentId: node.parentId,
            childId: node.id,
            role: node.role,
            active: activeChildren.has(node.id),
            dimmed:
              selectedDomain !== null && node.groupId !== selectedDomain,
          },
        ]
      : [],
  );
}
