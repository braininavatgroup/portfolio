"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { nextGraphSpin } from "../../lib/graph-spin";
import { domains } from "../../lib/portfolio";
import type { DomainId } from "../../lib/portfolio";
import type { SceneQuality } from "../../lib/scene-budget";
import { brainWorldOrigin } from "../../lib/scene-origin";
import type { SpatialGraphNode } from "../../lib/spatial-graph";
import type { TransitionPhase } from "../../lib/transition";
import { CableNetwork } from "./Cable";
import { GraphNode } from "./GraphNode";

type BrainGraphProps = {
  phase: TransitionPhase;
  nodes: readonly SpatialGraphNode[];
  focusedNodeId: string | null;
  selectedNodeId: string | null;
  selectedDomain: DomainId | null;
  quality: SceneQuality;
  onSelect: (node: SpatialGraphNode) => void;
};

export function BrainGraph({
  phase,
  nodes,
  focusedNodeId,
  selectedNodeId,
  selectedDomain,
  quality,
  onSelect,
}: BrainGraphProps) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!group.current) return;
    const target = phase === "body" ? 0.001 : phase === "entering" ? 0.38 : 1;
    const current = group.current.scale.x;
    const next = THREE.MathUtils.lerp(current, target, phase === "graph" ? 0.07 : 0.04);
    group.current.scale.setScalar(next);
    group.current.rotation.y = nextGraphSpin(group.current.rotation.y, {
      spinning: quality.pulses && phase === "graph",
      aligning: phase === "graph" && selectedDomain !== null,
    });
  });

  return (
    <group ref={group} position={brainWorldOrigin} scale={0.001}>
      <CableNetwork
        nodes={nodes}
        pulses={quality.pulses}
        activeNodeId={focusedNodeId ?? selectedNodeId}
        selectedDomain={selectedDomain}
      />
      {nodes.map((node) => (
        <GraphNode
          key={node.id}
          node={node}
          selected={node.id === selectedNodeId}
          focused={node.id === focusedNodeId}
          dimmed={
            selectedDomain !== null &&
            node.role !== "root" &&
            node.groupId !== selectedDomain
          }
          animated={quality.pulses}
          showLabel={phase === "graph"}
          onSelect={onSelect}
        />
      ))}
      {phase === "graph" && selectedDomain === null ? domains.map((domain) => (
        <Html
          center
          key={domain.id}
          position={[
            Math.cos(domain.angle) * 8.45,
            0.9,
            Math.sin(domain.angle) * 8.45,
          ]}
          distanceFactor={12}
          zIndexRange={[3, 0]}
        >
          <span className="domain-space-label">{domain.label}</span>
        </Html>
      )) : null}
    </group>
  );
}
