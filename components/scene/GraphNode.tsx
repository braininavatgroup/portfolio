"use client";

import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import { nodeAction } from "../../lib/node-interaction";
import type { SpatialGraphNode } from "../../lib/spatial-graph";
import { BrainShape } from "./BrainShape";
import { GraphNodeLabel } from "./GraphNodeLabel";
import { OutputToken } from "./OutputToken";
import { getOutputToken } from "./output-token-map";

const colors: Record<SpatialGraphNode["role"], string> = {
  root: "#d7ff6f",
  instinct: "#3f7569",
  approach: "#245f52",
  output: "#1d2925",
};

type GraphNodeProps = {
  node: SpatialGraphNode;
  selected: boolean;
  focused: boolean;
  showLabel: boolean;
  onSelect: (node: SpatialGraphNode) => void;
};

export function GraphNode({
  node,
  selected,
  focused,
  showLabel,
  onSelect,
}: GraphNodeProps) {
  const [hovered, setHovered] = useState(false);
  const interactive = nodeAction(node) === "inspect";
  const prominent = node.role === "output";
  const outputToken =
    prominent && node.projectSlug
      ? getOutputToken(node.projectSlug)
      : undefined;

  if (node.role === "root") {
    return (
      <group position={node.position}>
        <BrainShape scale={1.35} />
        <pointLight color={colors.root} intensity={2.6} distance={4.5} />
      </group>
    );
  }

  return (
    <group position={node.position}>
      <group
        scale={hovered || focused || selected ? 1.38 : 1}
        {...(interactive
          ? {
              onClick: (event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation();
                onSelect(node);
              },
              onPointerEnter: () => {
                setHovered(true);
                document.body.style.cursor = "pointer";
              },
              onPointerLeave: () => {
                setHovered(false);
                document.body.style.cursor = "";
              },
            }
          : {})}
      >
        {outputToken ? (
          <OutputToken kind={outputToken} />
        ) : (
          <mesh>
            <sphereGeometry args={[prominent ? 0.24 : 0.095, 12, 12]} />
            <meshStandardMaterial
              color={colors[node.role]}
              emissive={colors[node.role]}
              emissiveIntensity={0.04}
              roughness={0.72}
            />
          </mesh>
        )}
      </group>
      {showLabel ? (
        <Html
          center
          position={[0, prominent ? -0.48 : 0.2, 0]}
          zIndexRange={[10, 0]}
        >
          <GraphNodeLabel
            node={node}
            interactive={interactive}
            emphasized={hovered || focused || selected}
            onSelect={onSelect}
          />
        </Html>
      ) : null}
    </group>
  );
}
