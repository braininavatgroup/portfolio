"use client";

import { Html } from "@react-three/drei";
import { useState } from "react";
import { nodeAction } from "../../lib/node-interaction";
import type { PortfolioNode } from "../../lib/portfolio";
import { ArtifactToken } from "./ArtifactToken";
import { BrainShape } from "./BrainShape";

const colors = {
  brain: "#d7ff6f",
  spec: "#3f7569",
  system: "#245f52",
  artifact: "#1d2925",
} as const;

type GraphNodeProps = {
  node: PortfolioNode;
  selected: boolean;
  focused: boolean;
  showLabel: boolean;
  onSelect: (node: PortfolioNode) => void;
};

export function GraphNode({
  node,
  selected,
  focused,
  showLabel,
  onSelect,
}: GraphNodeProps) {
  const [hovered, setHovered] = useState(false);
  const action = nodeAction(node);
  const prominent = node.kind === "artifact";
  const labelVisible = showLabel;

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
      <group
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
        {node.kind === "artifact" && node.token ? (
          <ArtifactToken kind={node.token} />
        ) : (
          <mesh>
            <sphereGeometry args={[0.095, 12, 12]} />
            <meshStandardMaterial
              color={colors[node.kind]}
              emissive={colors[node.kind]}
              emissiveIntensity={0.04}
              roughness={0.72}
            />
          </mesh>
        )}
      </group>
      {labelVisible ? (
        <Html
          center
          distanceFactor={11}
          position={[0, prominent ? -0.48 : 0.2, 0]}
          zIndexRange={[10, 0]}
        >
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
