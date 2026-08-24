"use client";

import type { ArtifactTokenKind } from "../../lib/portfolio";

const dark = "#183d33";
const mid = "#356a5b";
const accent = "#c8ff2e";
const paper = "#f4f1e8";

function TokenBody() {
  return (
    <mesh>
      <dodecahedronGeometry args={[0.34, 0]} />
      <meshStandardMaterial color={dark} roughness={0.48} metalness={0.08} />
    </mesh>
  );
}

function Box({
  position,
  scale,
  color = accent,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={0.42} />
    </mesh>
  );
}

function TokenGlyph({ kind }: { kind: ArtifactTokenKind }) {
  switch (kind) {
    case "intake":
      return (
        <group position={[0, 0, 0.3]}>
          <mesh position={[0, 0.08, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.17, 0.22, 5]} />
            <meshStandardMaterial color={accent} roughness={0.4} />
          </mesh>
          <Box position={[0, -0.14, 0]} scale={[0.12, 0.09, 0.07]} color={paper} />
        </group>
      );
    case "selection":
      return (
        <group position={[0, 0, 0.31]}>
          {([[-0.14, -0.06], [0, 0.13], [0.14, -0.06]] as const).map(([x, y]) => (
            <mesh key={`${x}:${y}`} position={[x, y, 0]}>
              <sphereGeometry args={[0.075, 10, 10]} />
              <meshStandardMaterial color={accent} roughness={0.36} />
            </mesh>
          ))}
          <Box position={[0, -0.16, 0]} scale={[0.3, 0.035, 0.05]} color={paper} />
        </group>
      );
    case "report":
      return (
        <group position={[0, -0.02, 0.31]}>
          <Box position={[-0.14, -0.08, 0]} scale={[0.07, 0.13, 0.06]} />
          <Box position={[0, 0, 0]} scale={[0.07, 0.29, 0.06]} />
          <Box position={[0.14, 0.08, 0]} scale={[0.07, 0.45, 0.06]} />
        </group>
      );
    case "tracker":
      return (
        <group position={[0, 0, 0.31]}>
          <Box position={[-0.1, 0.1, 0]} scale={[0.15, 0.15, 0.06]} />
          <Box position={[0.1, 0.1, 0]} scale={[0.15, 0.15, 0.06]} color={paper} />
          <Box position={[-0.1, -0.1, 0]} scale={[0.15, 0.15, 0.06]} color={paper} />
          <Box position={[0.1, -0.1, 0]} scale={[0.15, 0.15, 0.06]} />
        </group>
      );
    case "road-case":
      return (
        <group position={[0, 0, 0.3]}>
          <Box position={[0, 0, 0]} scale={[0.35, 0.27, 0.08]} color={mid} />
          <Box position={[0, 0.02, 0.05]} scale={[0.1, 0.07, 0.05]} />
          <Box position={[-0.14, 0, 0.04]} scale={[0.035, 0.27, 0.04]} color={paper} />
          <Box position={[0.14, 0, 0.04]} scale={[0.035, 0.27, 0.04]} color={paper} />
        </group>
      );
    case "audio":
      return (
        <group position={[0, 0, 0.31]}>
          <mesh>
            <torusGeometry args={[0.15, 0.035, 8, 20]} />
            <meshStandardMaterial color={accent} roughness={0.36} />
          </mesh>
          <mesh position={[-0.08, 0, 0.015]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial color={paper} roughness={0.42} />
          </mesh>
          <mesh position={[0.08, 0, 0.015]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial color={paper} roughness={0.42} />
          </mesh>
        </group>
      );
    case "maturity":
      return (
        <group position={[0, -0.02, 0.31]}>
          <Box position={[-0.14, -0.1, 0]} scale={[0.09, 0.1, 0.07]} color={paper} />
          <Box position={[0, -0.03, 0]} scale={[0.11, 0.23, 0.07]} color={mid} />
          <Box position={[0.15, 0.05, 0]} scale={[0.13, 0.39, 0.07]} />
        </group>
      );
    case "toolkit":
      return (
        <group position={[0, 0, 0.31]}>
          <mesh>
            <torusGeometry args={[0.14, 0.055, 8, 8]} />
            <meshStandardMaterial color={accent} roughness={0.42} />
          </mesh>
          <Box position={[0, 0, 0.01]} scale={[0.09, 0.09, 0.07]} color={paper} />
        </group>
      );
    case "spec":
      return (
        <group position={[0, 0, 0.29]} rotation={[0, 0, -0.08]}>
          <Box position={[-0.035, 0.025, 0]} scale={[0.24, 0.3, 0.045]} color={mid} />
          <Box position={[0.035, -0.025, 0.05]} scale={[0.24, 0.3, 0.045]} color={paper} />
          <Box position={[0.035, 0.03, 0.08]} scale={[0.14, 0.025, 0.02]} />
          <Box position={[0.01, -0.04, 0.08]} scale={[0.09, 0.025, 0.02]} />
        </group>
      );
  }
}

export function OutputToken({ kind }: { kind: ArtifactTokenKind }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.46, 0.012, 6, 36]} />
        <meshBasicMaterial color={accent} transparent opacity={0.42} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={1.18}>
        <torusGeometry args={[0.46, 0.006, 6, 36]} />
        <meshBasicMaterial color={mid} transparent opacity={0.28} />
      </mesh>
      <TokenBody />
      <TokenGlyph kind={kind} />
      <pointLight color={accent} intensity={0.65} distance={1.5} />
    </group>
  );
}
