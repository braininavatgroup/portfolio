"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { getRagdollTargets, settleDrag } from "../../lib/ragdoll";
import type { SceneQuality } from "../../lib/scene-budget";
import { BrainShape } from "./BrainShape";

export type PoseState =
  | "idle"
  | "listening"
  | "music"
  | "systems"
  | "building"
  | "thinking";

type BodySceneProps = {
  visible: boolean;
  pose: PoseState;
  quality: SceneQuality;
  onEnter: () => void;
};

const poseLean: Record<PoseState, [number, number]> = {
  idle: [0, 0],
  listening: [-0.04, 0.06],
  music: [0.08, -0.08],
  systems: [0, 0.1],
  building: [-0.06, -0.05],
  thinking: [0.06, 0.12],
};

export function BodyScene({ visible, pose, quality, onEnter }: BodySceneProps) {
  const rig = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const leftForearm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const rightForearm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const leftShin = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const rightShin = useRef<THREE.Group>(null);
  const dragTarget = useRef(new THREE.Vector2());
  const dragStart = useRef(new THREE.Vector2());
  const dragging = useRef(false);
  const dragMoved = useRef(false);

  useFrame(({ clock }) => {
    if (
      !rig.current || !head.current || !leftArm.current || !leftForearm.current ||
      !rightArm.current || !rightForearm.current || !leftLeg.current ||
      !leftShin.current || !rightLeg.current || !rightShin.current
    ) return;

    const settled = settleDrag(dragTarget.current, dragging.current);
    dragTarget.current.set(settled.x, settled.y);
    const target = getRagdollTargets(settled);
    const [poseX, poseY] = poseLean[pose];
    const drift = quality.pulses ? Math.sin(clock.elapsedTime * 0.72) * 0.018 : 0;
    rig.current.rotation.x = THREE.MathUtils.lerp(
      rig.current.rotation.x,
      poseX + target.torso.x,
      0.07,
    );
    rig.current.rotation.y = THREE.MathUtils.lerp(
      rig.current.rotation.y,
      poseY + target.torso.y + drift,
      0.07,
    );

    const apply = (joint: THREE.Group, rotation: { x: number; y: number; z: number }) => {
      joint.rotation.x = THREE.MathUtils.lerp(joint.rotation.x, rotation.x, 0.09);
      joint.rotation.y = THREE.MathUtils.lerp(joint.rotation.y, rotation.y, 0.09);
      joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, rotation.z, 0.09);
    };

    apply(head.current, target.head);
    apply(leftArm.current, target.leftArm);
    apply(leftForearm.current, target.leftForearm);
    apply(rightArm.current, target.rightArm);
    apply(rightForearm.current, target.rightForearm);
    apply(leftLeg.current, target.leftLeg);
    apply(leftShin.current, target.leftShin);
    apply(rightLeg.current, target.rightLeg);
    apply(rightShin.current, target.rightShin);
  });

  if (!visible) return null;

  return (
    <group
      ref={rig}
      position={[0, -1.65, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        dragging.current = true;
        dragMoved.current = false;
        dragStart.current.set(event.pointer.x, event.pointer.y);
        event.target.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        event.target.releasePointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        if (dragStart.current.distanceTo(event.pointer) > 0.04) dragMoved.current = true;
        dragTarget.current.set(event.pointer.x, event.pointer.y);
      }}
    >
      <mesh position={[0, 1.6, 0]}>
        <capsuleGeometry args={[0.72, 1.75, 8, 16]} />
        <meshStandardMaterial color="#172824" roughness={0.86} />
      </mesh>

      <group ref={leftArm} position={[-0.88, 2.15, 0]} rotation={[0, 0, 0.28]}>
        <mesh position={[0, -0.55, 0]}>
          <capsuleGeometry args={[0.18, 0.78, 6, 12]} />
          <meshStandardMaterial color="#1d312c" roughness={0.84} />
        </mesh>
        <group ref={leftForearm} position={[0, -1.02, 0]} rotation={[0, 0, 0.2]}>
          <mesh position={[0, -0.48, 0]}>
            <capsuleGeometry args={[0.15, 0.68, 6, 12]} />
            <meshStandardMaterial color="#182b26" roughness={0.86} />
          </mesh>
        </group>
      </group>
      <group ref={rightArm} position={[0.88, 2.15, 0]} rotation={[0, 0, -0.28]}>
        <mesh position={[0, -0.55, 0]}>
          <capsuleGeometry args={[0.18, 0.78, 6, 12]} />
          <meshStandardMaterial color="#1d312c" roughness={0.84} />
        </mesh>
        <group ref={rightForearm} position={[0, -1.02, 0]} rotation={[0, 0, -0.2]}>
          <mesh position={[0, -0.48, 0]}>
            <capsuleGeometry args={[0.15, 0.68, 6, 12]} />
            <meshStandardMaterial color="#182b26" roughness={0.86} />
          </mesh>
        </group>
      </group>

      <group ref={leftLeg} position={[-0.38, 0.72, 0]} rotation={[0, 0, -0.06]}>
        <mesh position={[0, -0.58, 0]}>
          <capsuleGeometry args={[0.23, 0.82, 6, 12]} />
          <meshStandardMaterial color="#13231f" roughness={0.9} />
        </mesh>
        <group ref={leftShin} position={[0, -1.08, 0]}>
          <mesh position={[0, -0.52, 0]}>
            <capsuleGeometry args={[0.2, 0.72, 6, 12]} />
            <meshStandardMaterial color="#10201c" roughness={0.92} />
          </mesh>
        </group>
      </group>
      <group ref={rightLeg} position={[0.38, 0.72, 0]} rotation={[0, 0, 0.06]}>
        <mesh position={[0, -0.58, 0]}>
          <capsuleGeometry args={[0.23, 0.82, 6, 12]} />
          <meshStandardMaterial color="#13231f" roughness={0.9} />
        </mesh>
        <group ref={rightShin} position={[0, -1.08, 0]}>
          <mesh position={[0, -0.52, 0]}>
            <capsuleGeometry args={[0.2, 0.72, 6, 12]} />
            <meshStandardMaterial color="#10201c" roughness={0.92} />
          </mesh>
        </group>
      </group>

      <group
        ref={head}
        position={[0, 3.42, 0]}
        onClick={(event) => {
          event.stopPropagation();
          if (!dragMoved.current) onEnter();
        }}
      >
        <mesh>
          <sphereGeometry
            args={[0.86, quality.sphereSegments, quality.sphereSegments]}
          />
          {quality.glass ? (
            <meshPhysicalMaterial
              color="#c9fff0"
              roughness={0.08}
              transmission={0.86}
              thickness={0.42}
              transparent
              opacity={0.56}
              ior={1.22}
            />
          ) : (
            <meshStandardMaterial
              color="#84baaa"
              transparent
              opacity={0.24}
              roughness={0.2}
            />
          )}
        </mesh>
        <BrainShape scale={0.82} />
        <pointLight color="#d7ff6f" intensity={2.4} distance={4} />
      </group>
    </group>
  );
}
