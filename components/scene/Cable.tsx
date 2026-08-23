"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { PortfolioNode } from "../../lib/portfolio";

type CurveRecord = {
  curve: THREE.QuadraticBezierCurve3;
  phase: number;
};

export function CableNetwork({
  nodes,
  pulses,
}: {
  nodes: PortfolioNode[];
  pulses: boolean;
}) {
  const pulsePoints = useRef<THREE.Points>(null);
  const { segmentPositions, pulsePositions, curves } = useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const edgeCurves: CurveRecord[] = [];
    const segments: number[] = [];

    for (const node of nodes) {
      if (!node.parentId) continue;
      const parent = byId.get(node.parentId);
      if (!parent) continue;
      const start = new THREE.Vector3(...parent.position);
      const end = new THREE.Vector3(...node.position);
      const middle = start.clone().lerp(end, 0.5);
      middle.y -= 0.18 + start.distanceTo(end) * 0.06;
      const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
      edgeCurves.push({ curve, phase: edgeCurves.length / Math.max(nodes.length, 1) });
      const points = curve.getPoints(8);
      for (let index = 0; index < points.length - 1; index += 1) {
        segments.push(...points[index].toArray(), ...points[index + 1].toArray());
      }
    }

    return {
      segmentPositions: new Float32Array(segments),
      pulsePositions: new Float32Array(edgeCurves.length * 3),
      curves: edgeCurves,
    };
  }, [nodes]);

  useFrame(({ clock }) => {
    if (!pulses || !pulsePoints.current) return;
    const attribute = pulsePoints.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    curves.forEach(({ curve, phase }, index) => {
      const point = curve.getPoint((clock.elapsedTime * 0.12 + phase) % 1);
      attribute.setXYZ(index, point.x, point.y, point.z);
    });
    attribute.needsUpdate = true;
  });

  return (
    <group>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[segmentPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#3f675d" transparent opacity={0.58} />
      </lineSegments>
      {pulses ? (
        <points ref={pulsePoints}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[pulsePositions, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#76951a" size={0.085} sizeAttenuation transparent opacity={0.92} />
        </points>
      ) : null}
    </group>
  );
}
