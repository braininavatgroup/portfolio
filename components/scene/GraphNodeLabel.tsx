"use client";

import type { SpatialGraphNode } from "../../lib/spatial-graph";

type GraphNodeLabelProps = {
  node: SpatialGraphNode;
  interactive: boolean;
  onSelect: (node: SpatialGraphNode) => void;
};

const roleLabel = (role: SpatialGraphNode["role"]) =>
  `${role.slice(0, 1).toUpperCase()}${role.slice(1)}`;

function LabelContent({ node }: { node: SpatialGraphNode }) {
  return (
    <>
      <span className="graph-node-label-role">{roleLabel(node.role)}</span>
      <strong>{node.label}</strong>
    </>
  );
}

export function GraphNodeLabel({
  node,
  interactive,
  onSelect,
}: GraphNodeLabelProps) {
  if (!interactive) {
    return (
      <span className="graph-node-label">
        <LabelContent node={node} />
      </span>
    );
  }

  return (
    <button
      aria-label={`${roleLabel(node.role)} ${node.label}`}
      className="graph-node-label graph-node-button"
      onClick={() => onSelect(node)}
      type="button"
    >
      <LabelContent node={node} />
    </button>
  );
}
