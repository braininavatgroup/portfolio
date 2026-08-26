import * as THREE from "three";
import type { AvatarAssetConfig } from "../../lib/avatar/config";

const glassesName = "BradleyGlasses";

export function attachBradleyGlasses(
  scene: THREE.Object3D,
  config: AvatarAssetConfig["glasses"],
) {
  if (!config) return () => undefined;
  const head = scene.getObjectByName(config.headBoneName);
  if (!head || head.getObjectByName(glassesName)) return () => undefined;

  const glasses = new THREE.Group();
  glasses.name = glassesName;
  glasses.position.set(...config.position);
  glasses.rotation.set(...config.rotation);

  const material = new THREE.MeshStandardMaterial({
    color: config.frameColor,
    flatShading: true,
    metalness: 0,
    roughness: 0.88,
  });
  const geometries: THREE.BufferGeometry[] = [];
  const addMesh = (
    geometry: THREE.BufferGeometry,
    position: readonly [number, number, number],
  ) => {
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    glasses.add(mesh);
    return mesh;
  };

  for (const x of [-3.2, 3.2]) {
    const lens = addMesh(new THREE.RingGeometry(2.15, 2.75, 8), [x, 0, 0]);
    lens.scale.y = 0.76;
  }
  addMesh(new THREE.BoxGeometry(1.2, 0.45, 0.45), [0, 0.1, -0.05]);
  for (const x of [-6.05, 6.05]) {
    addMesh(new THREE.BoxGeometry(0.4, 0.4, 5.4), [x, 0, -2.6]);
  }

  head.add(glasses);
  return () => {
    head.remove(glasses);
    geometries.forEach((geometry) => geometry.dispose());
    material.dispose();
  };
}
