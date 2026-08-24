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
import { ApproachGlyph, InstinctGlyph } from "./RoleGlyph";
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
  const interactive = nodeAction(node) !== "none";
  const prominent = node.role === "output";
  const outputToken =
    prominent && node.projectSlug
      ? getOutputToken(node.projectSlug)
      : undefined;
  const emphasized = hovered || focused || selected;

  useFrame(({ camera, clock }) => {
    if (!tokenGroup.current) return;
    if (!prominent) {
      tokenGroup.current.quaternion.copy(camera.quaternion);
      return;
    }
    if (!animated) return;
    tokenGroup.current.rotation.y = Math.sin(clock.elapsedTime * 0.55) * 0.12;
    tokenGroup.current.rotation.z = Math.sin(clock.elapsedTime * 0.34) * 0.025;
  });

  if (node.role === "root") {
    return (
      <group position={node.position}>
        <group
          scale={emphasized ? 1.08 : 1}
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
          <BrainShape scale={0.78} />
        </group>
        <pointLight color={colors.root} intensity={1.4} distance={3.2} />
        {showLabel ? (
          <Html
            center
            position={[0, -0.72, 0]}
            zIndexRange={[5, 0]}
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
            {node.role === "instinct" ? <InstinctGlyph /> : <ApproachGlyph />}
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
