const instinctRays = [
  { position: [0, 0.29, 0] as const, rotation: [0, 0, 0] as const },
  { position: [0.29, 0, 0] as const, rotation: [0, 0, -Math.PI / 2] as const },
  { position: [0, -0.29, 0] as const, rotation: [0, 0, Math.PI] as const },
  { position: [-0.29, 0, 0] as const, rotation: [0, 0, Math.PI / 2] as const },
];

export function InstinctGlyph() {
  return (
    <group name="Instinct signal glyph" rotation={[0, 0, Math.PI / 4]}>
      <mesh>
        <dodecahedronGeometry args={[0.13, 0]} />
        <meshStandardMaterial
          color="#6fa394"
          emissive="#315f54"
          emissiveIntensity={0.42}
          roughness={0.34}
        />
      </mesh>
      {instinctRays.map(({ position, rotation }, index) => (
        <mesh key={index} position={position} rotation={rotation}>
          <coneGeometry args={[0.055, 0.2, 5]} />
          <meshStandardMaterial
            color="#8ac0b0"
            emissive="#315f54"
            emissiveIntensity={0.28}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

const approachSteps = [
  { color: "#6fa394", position: [-0.2, -0.11, 0] as const },
  { color: "#477c6e", position: [0, 0, 0] as const },
  { color: "#245f52", position: [0.2, 0.11, 0] as const },
];

export function ApproachGlyph() {
  return (
    <group name="Approach path glyph" rotation={[0, 0, -0.08]}>
      {approachSteps.map(({ color, position }) => (
        <mesh key={color} position={position}>
          <boxGeometry args={[0.18, 0.13, 0.2]} />
          <meshStandardMaterial
            color={color}
            emissive="#183e35"
            emissiveIntensity={0.18}
            roughness={0.48}
          />
        </mesh>
      ))}
      <mesh position={[0.39, 0.22, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.09, 0.18, 4]} />
        <meshStandardMaterial
          color="#d7ff6f"
          emissive="#76951a"
          emissiveIntensity={0.24}
          roughness={0.38}
        />
      </mesh>
    </group>
  );
}
