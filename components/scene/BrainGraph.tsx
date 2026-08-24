"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { nextGraphSpin } from "../../lib/graph-spin";
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
  const selectedProjectId = nodes.find(
    ({ id }) => id === selectedNodeId,
  )?.projectId;

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
    <group
      ref={group}
      position={brainWorldOrigin}
      scale={phase === "graph" ? 1 : 0.001}
    >
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
          dimmed={Boolean(
            selectedProjectId &&
              node.projectId &&
              node.projectId !== selectedProjectId,
          )}
          animated={quality.pulses}
          showLabel={phase === "graph"}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
