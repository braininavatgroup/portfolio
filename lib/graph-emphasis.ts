import type { DomainId } from "./portfolio";
import type { SpatialGraphNode, SpatialNodeRole } from "./spatial-graph";

export type GraphEdgeState = {
  parentId: string;
  childId: string;
  role: SpatialNodeRole;
  active: boolean;
  dimmed: boolean;
};

export function visibleGraphNodes(
  nodes: readonly SpatialGraphNode[],
  {
    selectedDomain,
    selectedProjectId,
  }: {
    selectedDomain: DomainId | null;
    selectedProjectId: string | null;
  },
): readonly SpatialGraphNode[] {
  const visibleNodes = nodes.filter((node) => {
    if (node.role === "root") return true;
    if (selectedDomain !== null && node.groupId !== selectedDomain) return false;
    if (node.role === "domain" || node.role === "output") return true;
    return node.projectId === selectedProjectId;
  });
  const visibleIds = new Set(visibleNodes.map(({ id }) => id));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return visibleNodes.map((node) => {
    let parentId = node.parentId;
    while (parentId && !visibleIds.has(parentId)) {
      parentId = nodesById.get(parentId)?.parentId;
    }
    return parentId === node.parentId ? node : { ...node, parentId };
  });
}

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
  const activeProjectId = activeNode?.projectId;

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
              (selectedDomain !== null && node.groupId !== selectedDomain) ||
              Boolean(
                activeProjectId &&
                  node.projectId &&
                  node.projectId !== activeProjectId,
              ),
          },
        ]
      : [],
  );
}
