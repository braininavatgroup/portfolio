"use client";

import { Html } from "@react-three/drei";
import { useState } from "react";
import { nodeAction } from "../../lib/node-interaction";
import type { PortfolioNode } from "../../lib/portfolio";
import { BrainShape } from "./BrainShape";

const colors = {
  brain: "#d7ff6f",
  spec: "#8ec5b7",
  system: "#70a595",
  artifact: "#f1ead7",
  operation: "#817f9e",
} as const;

type GraphNodeProps = {
  node: PortfolioNode;
  selected: boolean;
  domainActive: boolean;
  focused: boolean;
  showLabel: boolean;
  onSelect: (node: PortfolioNode) => void;
};

export function GraphNode({
  node,
  selected,
  domainActive,
  focused,
  showLabel,
  onSelect,
}: GraphNodeProps) {
  const [hovered, setHovered] = useState(false);
  const action = nodeAction(node);
  const prominent = node.kind === "artifact";
  const radius = node.kind === "artifact" ? 0.19 : 0.095;
  const labelVisible = showLabel && (
    prominent || hovered || focused || selected || domainActive
  );

  if (node.kind === "brain") {
    return (
      <group position={node.position}>
        <BrainShape scale={1.35} />
        <pointLight color="#d7ff6f" intensity={2.6} distance={4.5} />
      </group>
    );
  }

  return (
    <group position={node.position}>
      <mesh
        scale={hovered || focused || selected ? 1.38 : 1}
        onClick={(event) => {
          event.stopPropagation();
          if (action === "inspect") onSelect(node);
        }}
        onPointerEnter={() => {
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[radius, 12, 12]} />
        <meshStandardMaterial
          color={colors[node.kind]}
          emissive={colors[node.kind]}
          emissiveIntensity={prominent ? 0.42 : 0.12}
          roughness={node.kind === "artifact" ? 0.24 : 0.72}
        />
      </mesh>
      {labelVisible ? (
        <Html center distanceFactor={11} zIndexRange={[10, 0]}>
          <button
            className={`graph-node-label graph-node-label-${node.kind} graph-node-button`}
            type="button"
            onClick={() => onSelect(node)}
          >
            {node.label}
          </button>
        </Html>
      ) : null}
    </group>
  );
}
