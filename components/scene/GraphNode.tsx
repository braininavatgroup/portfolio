"use client";

import { Html } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
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
  dimmed: boolean;
  animated: boolean;
  showLabel: boolean;
  onSelect: (node: SpatialGraphNode) => void;
};

export function GraphNode({
  node,
  selected,
  focused,
  dimmed,
  animated,
  showLabel,
  onSelect,
}: GraphNodeProps) {
  const [hovered, setHovered] = useState(false);
  const tokenGroup = useRef<THREE.Group>(null);
  const interactive = nodeAction(node) === "inspect";
  const prominent = node.role === "output";
  const outputToken =
    prominent && node.projectSlug
      ? getOutputToken(node.projectSlug)
      : undefined;
  const emphasized = hovered || focused || selected;

  useFrame(({ clock }) => {
    if (!tokenGroup.current || !prominent || !animated) return;
    tokenGroup.current.rotation.y = Math.sin(clock.elapsedTime * 0.55) * 0.12;
    tokenGroup.current.rotation.z = Math.sin(clock.elapsedTime * 0.34) * 0.025;
  });

  if (node.role === "root") {
    return (
      <group position={node.position}>
        <BrainShape scale={0.78} />
        <pointLight color={colors.root} intensity={1.4} distance={3.2} />
      </group>
    );
  }

  return (
    <group position={node.position}>
      <group
        ref={tokenGroup}
        scale={
          emphasized
            ? prominent
              ? 1.72
              : 1.42
            : dimmed
              ? 0.68
              : prominent
                ? 1.34
                : 1
        }
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
          <group>
            {node.role === "instinct" ? (
              <>
                <mesh>
                  <sphereGeometry args={[0.13, 16, 16]} />
                  <meshStandardMaterial
                    color={colors.instinct}
                    emissive={colors.instinct}
                    emissiveIntensity={0.12}
                    roughness={0.52}
                  />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.22, 0.014, 6, 24]} />
                  <meshBasicMaterial color="#7bb6a7" transparent opacity={0.72} />
                </mesh>
              </>
            ) : (
              <>
                <mesh rotation={[0, 0, Math.PI / 4]}>
                  <octahedronGeometry args={[0.19, 0]} />
                  <meshStandardMaterial
                    color={colors.approach}
                    emissive={colors.approach}
                    emissiveIntensity={0.08}
                    roughness={0.62}
                  />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.29, 0.01, 6, 28]} />
                  <meshBasicMaterial color="#315f54" transparent opacity={0.48} />
                </mesh>
              </>
            )}
          </group>
        )}
      </group>
      {showLabel ? (
        <Html
          center
          position={[
            0,
            prominent ? -0.66 : node.role === "approach" ? 0.46 : 0.38,
            0,
          ]}
          zIndexRange={[4, 0]}
        >
          <GraphNodeLabel
            node={node}
            interactive={interactive}
            emphasized={emphasized}
            selected={selected}
            dimmed={dimmed}
            onSelect={onSelect}
          />
        </Html>
      ) : null}
    </group>
  );
}
