"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { AllowedAnimation } from "../../lib/avatar/contracts";

type ProceduralAvatarProps = {
  animation: AllowedAnimation;
  facing: "left" | "right";
  pointing: "left" | "right" | null;
};

type JointPose = {
  torso: [number, number, number];
  head: [number, number, number];
  leftArm: [number, number, number];
  rightArm: [number, number, number];
  leftLeg: [number, number, number];
  rightLeg: [number, number, number];
};

const authoredPoses: Record<AllowedAnimation, JointPose> = {
  idle: {
    torso: [0, 0, 0], head: [0, 0, 0], leftArm: [0, 0, 0.12], rightArm: [0, 0, -0.12], leftLeg: [0, 0, 0], rightLeg: [0, 0, 0],
  },
  walk: {
    torso: [0.05, 0, 0], head: [-0.03, 0, 0], leftArm: [0.38, 0, 0.08], rightArm: [-0.38, 0, -0.08], leftLeg: [-0.34, 0, 0], rightLeg: [0.34, 0, 0],
  },
  think: {
    torso: [0.14, 0, 0], head: [0.16, 0.24, 0], leftArm: [-0.72, 0, 0.45], rightArm: [-1.05, 0.12, -0.42], leftLeg: [0, 0, 0], rightLeg: [0, 0, 0],
  },
  talk: {
    torso: [0, 0, 0], head: [0.02, 0, 0], leftArm: [-0.32, 0, 0.34], rightArm: [-0.28, 0, -0.34], leftLeg: [0, 0, 0], rightLeg: [0, 0, 0],
  },
  point: {
    torso: [0, 0, 0], head: [0, 0.2, 0], leftArm: [-0.16, 0, 0.18], rightArm: [-1.2, 0, -0.08], leftLeg: [0, 0, 0], rightLeg: [0, 0, 0],
  },
  present: {
    torso: [0, 0, 0], head: [0, 0, 0], leftArm: [-0.7, 0, 0.82], rightArm: [-0.7, 0, -0.82], leftLeg: [0, 0, 0], rightLeg: [0, 0, 0],
  },
  celebrate: {
    torso: [-0.08, 0, 0], head: [-0.12, 0, 0], leftArm: [-2.1, 0, 0.25], rightArm: [-2.1, 0, -0.25], leftLeg: [0, 0, 0], rightLeg: [0, 0, 0],
  },
  confused: {
    torso: [0, 0, 0], head: [0.1, 0.42, 0], leftArm: [-0.46, 0, 0.46], rightArm: [-0.18, 0, -0.42], leftLeg: [0, 0, 0], rightLeg: [0, 0, 0],
  },
};

function applyPose(joint: THREE.Group | null, pose: [number, number, number]) {
  if (!joint) return;
  joint.rotation.x = THREE.MathUtils.lerp(joint.rotation.x, pose[0], 0.14);
  joint.rotation.y = THREE.MathUtils.lerp(joint.rotation.y, pose[1], 0.14);
  joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, pose[2], 0.14);
}

export function ProceduralAvatar({
  animation,
  facing,
  pointing,
}: ProceduralAvatarProps) {
  const rig = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const pose = authoredPoses[animation];
    const stride = animation === "walk" ? Math.sin(clock.elapsedTime * 8) * 0.18 : 0;
    const talk = animation === "talk" ? Math.sin(clock.elapsedTime * 6) * 0.1 : 0;
    const pointDirection = pointing ?? facing;

    if (rig.current) {
      rig.current.rotation.y = THREE.MathUtils.lerp(
        rig.current.rotation.y,
        facing === "left" ? Math.PI : 0,
        0.15,
      );
      rig.current.position.y = animation === "walk" ? Math.abs(stride) * 0.12 : 0;
    }
    applyPose(torso.current, pose.torso);
    applyPose(head.current, [pose.head[0] + talk, pose.head[1], pose.head[2]]);
    applyPose(leftArm.current, [pose.leftArm[0] - stride, pose.leftArm[1], pose.leftArm[2]]);
    applyPose(rightArm.current, [pose.rightArm[0] + stride, pose.rightArm[1], pose.rightArm[2] + (animation === "point" && pointDirection === "left" ? 0.4 : 0)]);
    applyPose(leftLeg.current, [pose.leftLeg[0] + stride, pose.leftLeg[1], pose.leftLeg[2]]);
    applyPose(rightLeg.current, [pose.rightLeg[0] - stride, pose.rightLeg[1], pose.rightLeg[2]]);
  });

  return (
    <group ref={rig} scale={0.82}>
      <group ref={torso} position={[0, 1.05, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.34, 0.72, 5, 8]} />
          <meshStandardMaterial color="#18352f" flatShading roughness={0.9} />
        </mesh>
        <group ref={head} position={[0, 0.67, 0]}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.36, 1]} />
            <meshStandardMaterial color="#e7b28d" flatShading roughness={0.88} />
          </mesh>
          <mesh position={[0, 0.13, 0.3]}>
            <boxGeometry args={[0.5, 0.1, 0.08]} />
            <meshStandardMaterial color="#14211f" flatShading />
          </mesh>
        </group>
        <group ref={leftArm} position={[-0.42, 0.3, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.46, 4, 6]} />
            <meshStandardMaterial color="#1b3a33" flatShading />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.42, 0.3, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.46, 4, 6]} />
            <meshStandardMaterial color="#1b3a33" flatShading />
          </mesh>
        </group>
      </group>
      <group ref={leftLeg} position={[-0.17, 0.58, 0]}>
        <mesh position={[0, -0.36, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.52, 4, 6]} />
          <meshStandardMaterial color="#102a25" flatShading />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.17, 0.58, 0]}>
        <mesh position={[0, -0.36, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.52, 4, 6]} />
          <meshStandardMaterial color="#102a25" flatShading />
        </mesh>
      </group>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <circleGeometry args={[0.48, 12]} />
        <meshBasicMaterial color="#11251f" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}
