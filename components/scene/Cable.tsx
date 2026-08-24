"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  deriveGraphEdgeStates,
} from "../../lib/graph-emphasis";
import type { DomainId } from "../../lib/portfolio";
import type { SpatialGraphNode } from "../../lib/spatial-graph";

type CurveRecord = {
  curve: THREE.QuadraticBezierCurve3;
  phase: number;
};

const roleColors = {
  domain: "#8da535",
  instinct: "#7fb8aa",
  approach: "#477d70",
  output: "#263f38",
} as const;

const roles = ["domain", "instinct", "approach", "output"] as const;

function appendCurveSegments(
  target: number[],
  curve: THREE.QuadraticBezierCurve3,
) {
  const points = curve.getPoints(12);
  for (let index = 0; index < points.length - 1; index += 1) {
    target.push(...points[index].toArray(), ...points[index + 1].toArray());
  }
}

export function CableNetwork({
  nodes,
  pulses,
  activeNodeId,
  selectedDomain,
}: {
  nodes: readonly SpatialGraphNode[];
  pulses: boolean;
  activeNodeId: string | null;
  selectedDomain: DomainId | null;
}) {
  const pulsePoints = useRef<THREE.Points>(null);
  const {
    rolePositions,
    dimmedPositions,
    activePositions,
    pulsePositions,
    curves,
  } = useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const edgeStates = deriveGraphEdgeStates(nodes, {
      activeNodeId,
      selectedDomain,
    });
    const edgeCurves: CurveRecord[] = [];
    const roleSegments: Record<(typeof roles)[number], number[]> = {
      domain: [],
      instinct: [],
      approach: [],
      output: [],
    };
    const dimmedSegments: number[] = [];
    const activeSegments: number[] = [];

    for (const edge of edgeStates) {
      const parent = byId.get(edge.parentId);
      const child = byId.get(edge.childId);
      if (!parent || !child || edge.role === "root") continue;

      const start = new THREE.Vector3(...parent.position);
      const end = new THREE.Vector3(...child.position);
      const middle = start.clone().lerp(end, 0.5);
      middle.y -= 0.14 + start.distanceTo(end) * 0.045;
      const curve = new THREE.QuadraticBezierCurve3(start, middle, end);

      appendCurveSegments(
        edge.dimmed ? dimmedSegments : roleSegments[edge.role],
        curve,
      );
      if (edge.active) appendCurveSegments(activeSegments, curve);
      if (!edge.dimmed) {
        edgeCurves.push({
          curve,
          phase: edgeCurves.length / Math.max(edgeStates.length, 1),
        });
      }
    }

    return {
      rolePositions: Object.fromEntries(
        roles.map((role) => [role, new Float32Array(roleSegments[role])]),
      ) as Record<(typeof roles)[number], Float32Array>,
      dimmedPositions: new Float32Array(dimmedSegments),
      activePositions: new Float32Array(activeSegments),
      pulsePositions: new Float32Array(edgeCurves.length * 3),
      curves: edgeCurves,
    };
  }, [activeNodeId, nodes, selectedDomain]);

  useFrame(({ clock }) => {
    if (!pulses || !pulsePoints.current) return;
    const attribute = pulsePoints.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    curves.forEach(({ curve, phase }, index) => {
      const point = curve.getPoint((clock.elapsedTime * 0.1 + phase) % 1);
      attribute.setXYZ(index, point.x, point.y, point.z);
    });
    attribute.needsUpdate = true;
  });

  const line = (
    positions: Float32Array,
    color: string,
    opacity: number,
    key: string,
  ) => (
    <lineSegments key={key}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );

  return (
    <group>
      {roles.map((role) =>
        line(
          rolePositions[role],
          roleColors[role],
          role === "output"
            ? 0.72
            : role === "domain"
              ? 0.68
              : role === "approach"
                ? 0.58
                : 0.44,
          role,
        ),
      )}
      {line(dimmedPositions, "#9aa7a2", 0.12, "dimmed")}
      {line(activePositions, "#9dc326", 0.96, "active")}
      {pulses ? (
        <points ref={pulsePoints}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[pulsePositions, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            color="#76951a"
            size={0.075}
            sizeAttenuation
            transparent
            opacity={0.82}
          />
        </points>
      ) : null}
    </group>
  );
}
