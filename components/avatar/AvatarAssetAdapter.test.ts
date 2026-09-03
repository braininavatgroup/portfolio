import { describe, expect, it } from "vitest";
import {
  applyBradleySolidMaterial,
  cloneAvatarScene,
  combineAnimationClips,
  getAvailableAnimationIds,
  getAvatarModelOriginY,
  getAvatarPlaybackRate,
  getBradleyGlbFootOriginTranslation,
  getGlbFootOriginTranslation,
  getGlbYaw,
  getAvatarStageScale,
  makeLocomotionClipInPlace,
} from "./AvatarAssetAdapter";
import {
  AnimationClip,
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  VectorKeyframeTrack,
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
  it("supports centered specimens while retaining foot anchoring on the stage", () => {
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

  it("reports only the four clips used by the shipped experience", () => {
    // Catches a retired behavior becoming a renderer requirement again.
    expect(
      getAvailableAnimationIds([
        "Idle_3",
        "Agree_Gesture",
        "Swim_Forward",
        "Cheer_with_Both_Hands",
        "Walking",
      ]),
    ).toEqual(
      new Set([
        "idle_3",
        "agree_gesture",
        "swim_forward",
        "cheer_with_both_hands",
      ]),
    );
  });

  it("plays breaststroke more slowly than conversational motion", () => {
    expect(getAvatarPlaybackRate("swim_forward")).toBeLessThan(
      getAvatarPlaybackRate("agree_gesture"),
    );
  });


  it("starts camera-facing and limits ordinary left and right turns", () => {
    // Catches startup or target-facing logic rotating the avatar's back toward the visitor.
    expect(getGlbYaw("z", "front", "idle_3")).toBe(0);
    expect(getGlbYaw("z", "left", "idle_3")).toBe(Math.PI / 8);
    expect(getGlbYaw("z", "right", "idle_3")).toBe(-Math.PI / 8);
    expect(getGlbYaw("-z", "front", "idle_3")).toBe(Math.PI);
    expect(getGlbYaw("z", "front", "swim_forward", 0)).toBe(Math.PI / 2);
    expect(getGlbYaw("z", "front", "swim_forward", Math.PI)).toBe(
      (Math.PI * 3) / 2,
    );
    expect(getGlbYaw("z", "front", "swim_forward", -Math.PI / 2)).toBe(0);
  });

  it("removes Meshy root travel from the swim clip so the controller owns position", () => {
    const source = new AnimationClip("Swim_Forward", 1, [
      new VectorKeyframeTrack(
        "Hips.position",
        [0, 0.5, 1],
        [1, 60, 5, 2, 62, 105, 3, 61, 205],
      ),
    ]);

    const prepared = makeLocomotionClipInPlace(source);
    const values = Array.from(prepared.tracks[0]!.values);

    expect(values).toEqual([1, 60, 5, 1, 62, 5, 1, 61, 5]);
    expect(Array.from(source.tracks[0]!.values)).toEqual([
      1, 60, 5, 2, 62, 105, 3, 61, 205,
    ]);
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
