"use client";

import type { SpatialGraphNode } from "../../lib/spatial-graph";

type GraphNodeLabelProps = {
  node: SpatialGraphNode;
  interactive: boolean;
  emphasized: boolean;
  selected?: boolean;
  dimmed?: boolean;
  onSelect: (node: SpatialGraphNode) => void;
};

const roleLabel = (role: SpatialGraphNode["role"]) =>
  `${role.slice(0, 1).toUpperCase()}${role.slice(1)}`;

function LabelContent({ node }: { node: SpatialGraphNode }) {
  return (
    <>
      {node.role === "output" ? (
        <span className="graph-node-label-role">Output</span>
      ) : null}
      <strong>{node.label}</strong>
    </>
  );
}

export function GraphNodeLabel({
  node,
  interactive,
  emphasized,
  selected = false,
  dimmed = false,
  onSelect,
}: GraphNodeLabelProps) {
  if (!interactive) {
    return (
      <span
        className="graph-node-label"
        data-emphasized={emphasized ? "true" : "false"}
        data-dimmed={dimmed ? "true" : "false"}
        data-role={node.role}
      >
        <LabelContent node={node} />
      </span>
    );
  }

  return (
    <button
      aria-label={`${roleLabel(node.role)} ${node.label}`}
      aria-pressed={selected}
      className="graph-node-label graph-node-button"
      data-emphasized={emphasized ? "true" : "false"}
      data-dimmed={dimmed ? "true" : "false"}
      data-role={node.role}
      onClick={() => onSelect(node)}
      type="button"
    >
      <LabelContent node={node} />
    </button>
  );
}
