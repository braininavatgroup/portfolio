import { describe, expect, it } from "vitest";
import {
  applyBradleySolidMaterial,
  cloneAvatarScene,
  combineAnimationClips,
  getAvailableAnimationIds,
  getAnimationMixerTime,
  getAvatarModelOriginY,
  getBradleyGlbFootOriginTranslation,
  getGlbFootOriginTranslation,
  getGlbModelUrl,
  getGlbYaw,
  getAvatarStageScale,
} from "./AvatarAssetAdapter";
import {
  AnimationClip,
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { avatarAsset } from "../../lib/avatar/config";

function rawBradleyGlbMinimumY() {
  const glb = readFileSync(
    resolve(process.cwd(), "public/avatars/bradley-meshy-rigged.glb"),
  );
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
  return Math.min(
    ...json.meshes.flatMap(
      (mesh: { primitives: Array<{ attributes: { POSITION: number } }> }) =>
        mesh.primitives.map(
          (primitive) => json.accessors[primitive.attributes.POSITION].min[1],
        ),
    ),
  );
}

describe("GLB avatar configuration", () => {
  it("centers toybox rendering while retaining foot anchoring on the full-page stage", () => {
    expect(getAvatarModelOriginY("feet", 0, 1.64)).toBe(0);
    expect(getAvatarModelOriginY("center", 0, 1.64)).toBe(-0.82);
  });

  it("creates distinct scene roots while retaining cache-owned resources", () => {
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial();
    const source = new Group();
    source.add(new Mesh(geometry, material));

    const first = cloneAvatarScene(source);
    const second = cloneAvatarScene(source);
    const firstMesh = first.children[0] as Mesh;
    const secondMesh = second.children[0] as Mesh;

    expect(first).not.toBe(source);
    expect(second).not.toBe(source);
    expect(first).not.toBe(second);
    expect(firstMesh).not.toBe(secondMesh);
    expect(firstMesh.geometry).toBe(geometry);
    expect(secondMesh.geometry).toBe(geometry);
    expect(firstMesh.material).toBe(material);
    expect(secondMesh.material).toBe(material);
  });

  it("uses one opaque base material across the whole visible body", () => {
    // Catches the loader's white default or a second material showing through
    // part of the otherwise single-color character.
    const scene = new Group();
    const firstOriginal = new MeshStandardMaterial({
      color: "#ffffff",
      opacity: 0.4,
      transparent: true,
      vertexColors: true,
    });
    const secondOriginal = new MeshStandardMaterial({ color: "#ff00ff" });
    const first = new Mesh(new BoxGeometry(), firstOriginal);
    const second = new Mesh(new BoxGeometry(), [secondOriginal]);
    scene.add(first, second);

    const restore = applyBradleySolidMaterial(scene, "#3a4954");
    const firstApplied = first.material as MeshStandardMaterial;
    const secondApplied = (second.material as MeshStandardMaterial[])[0]!;

    expect(firstApplied).toBe(secondApplied);
    expect(firstApplied.color.getHexString()).toBe("3a4954");
    expect(firstApplied.transparent).toBe(false);
    expect(firstApplied.opacity).toBe(1);
    expect(firstApplied.vertexColors).toBe(false);
    expect(firstApplied.side).toBe(DoubleSide);
    // Catches camera-facing detail disappearing when the avatar is rendered
    // over a dark surface or from a canvas with different light placement.
    expect(firstApplied.emissive.getHexString()).toBe("3a4954");
    expect(firstApplied.emissiveIntensity).toBeGreaterThanOrEqual(0.5);

    restore();
    expect(first.material).toBe(firstOriginal);
    expect(second.material).toEqual([secondOriginal]);
  });

  it("reports only first-class IDs whose exact clips loaded", () => {
    // Catches the adapter guessing semantic aliases for supplied clip names.
    expect(
      getAvailableAnimationIds(["Idle_3", "Walking", "Joyful_Dance_with_Hand_Sway"]),
    ).toEqual(new Set(["idle_3", "walking", "joyful_dance_with_hand_sway"]));
  });

  it("does not invent a model path when the GLB configuration has no URL", () => {
    // Catches a renderer fallback that bypasses the single avatar asset configuration.
    expect(getGlbModelUrl({ kind: "gltf", modelUrl: null })).toBeNull();
  });

  it("starts camera-facing and limits ordinary left and right turns", () => {
    // Catches startup or target-facing logic rotating the avatar's back toward the visitor.
    expect(getGlbYaw("z", "front")).toBe(0);
    expect(getGlbYaw("z", "left")).toBe(Math.PI / 8);
    expect(getGlbYaw("z", "right")).toBe(-Math.PI / 8);
    expect(getGlbYaw("-z", "front")).toBe(Math.PI);
    expect(Math.abs(getGlbYaw("z", "left"))).toBeLessThan(Math.PI / 2);
    expect(Math.abs(getGlbYaw("z", "right"))).toBeLessThan(Math.PI / 2);
  });

  it("steps configured animation playback to complete frame intervals", () => {
    // Catches a target-frame-rate config value that has no effect on mixer timing.
    expect(getAnimationMixerTime(0.049, 30)).toBe(1 / 30);
    expect(getAnimationMixerTime(0.05, 30)).toBe(1 / 30);
    expect(getAnimationMixerTime(0.05, null)).toBe(0.05);
  });

  it("keeps native Meshy clips and adds only missing external motions", () => {
    const nativeIdle = new AnimationClip("Idle_3", 1, []);
    const processedIdle = new AnimationClip("Idle_3", 2, []);
    const externalWave = new AnimationClip("Wave_One_Hand", 3, []);

    expect(
      combineAnimationClips([nativeIdle], [processedIdle, externalWave]),
    ).toEqual([nativeIdle, externalWave]);
  });

  it("keeps the stage scale independent from non-unit GLB normalization", () => {
    // Catches applying the GLB normalization both in the adapter wrapper and its existing root.
    const originalScale = avatarAsset.scale;
    avatarAsset.scale = 0.5;

    try {
      expect(getAvatarStageScale(104)).toBe(104);
    } finally {
      avatarAsset.scale = originalScale;
    }
  });

  it("maps the checked-in GLB raw lower edge onto the stage foot origin", () => {
    // Catches anchoring from a guessed model bound rather than the shipped POSITION accessor.
    const rawMinimumY = rawBradleyGlbMinimumY();
    const assetTranslation = getGlbFootOriginTranslation(
      avatarAsset.groundOffset,
      rawMinimumY,
    );

    expect(rawMinimumY).toBeCloseTo(0, 6);
    expect(rawMinimumY + avatarAsset.groundOffset + assetTranslation).toBe(0);
    expect(getBradleyGlbFootOriginTranslation()).toBe(0.9);
  });
});
