export function BrainShape({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[-0.22, 0, 0]} rotation={[0.25, 0.2, 0.4]}>
        <torusKnotGeometry args={[0.34, 0.115, 72, 8, 2, 3]} />
        <meshStandardMaterial
          color="#d8f58f"
          emissive="#8eb64b"
          emissiveIntensity={0.55}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[0.22, 0, 0]} rotation={[-0.2, -0.25, -0.4]}>
        <torusKnotGeometry args={[0.34, 0.115, 72, 8, 2, 3]} />
        <meshStandardMaterial
          color="#c4e56f"
          emissive="#718f36"
          emissiveIntensity={0.52}
          roughness={0.65}
        />
      </mesh>
    </group>
  );
}
