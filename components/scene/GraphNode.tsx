"use client";

import { Html } from "@react-three/drei";
import { useState } from "react";
import type { PortfolioNode } from "../../lib/portfolio";

const colors = {
  brain: "#d7ff6f",
  spec: "#8ec5b7",
  system: "#70a595",
  artifact: "#f1ead7",
  operation: "#817f9e",
} as const;

type GraphNodeProps = {
  node: PortfolioNode;
  showLabel: boolean;
  onSelect: (node: PortfolioNode) => void;
};

export function GraphNode({ node, showLabel, onSelect }: GraphNodeProps) {
  const [hovered, setHovered] = useState(false);
  const prominent = node.kind === "brain" || node.kind === "artifact";
  const radius = node.kind === "brain" ? 0.5 : node.kind === "artifact" ? 0.19 : 0.095;

  return (
    <group position={node.position}>
      <mesh
        scale={hovered ? 1.3 : 1}
        onClick={(event) => {
          event.stopPropagation();
          if (node.kind === "artifact" && node.href) {
            window.location.assign(node.href);
          } else {
            onSelect(node);
          }
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <sphereGeometry args={[radius, node.kind === "brain" ? 32 : 12, node.kind === "brain" ? 32 : 12]} />
        <meshStandardMaterial
          color={colors[node.kind]}
          emissive={colors[node.kind]}
          emissiveIntensity={prominent ? 0.42 : 0.12}
          roughness={node.kind === "artifact" ? 0.24 : 0.72}
        />
      </mesh>
      {prominent && showLabel ? (
        <Html center distanceFactor={11} zIndexRange={[10, 0]}>
          {node.kind === "artifact" && node.href ? (
            <a
              className={`graph-node-label graph-node-label-${node.kind}`}
              href={node.href}
            >
              {node.label}
            </a>
          ) : (
            <button
              className={`graph-node-label graph-node-label-${node.kind} graph-node-button`}
              type="button"
              onClick={() => onSelect(node)}
            >
              {node.label}
            </button>
          )}
        </Html>
      ) : null}
    </group>
  );
}
