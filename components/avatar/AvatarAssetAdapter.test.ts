import { describe, expect, it } from "vitest";
import {
  cloneAvatarScene,
  configureActionLoop,
  getAvailableAnimationIds,
  getAvatarModelOriginY,
  getAvatarPlaybackRate,
  getBradleyGlbFootOriginTranslation,
  getGlbFootOriginTranslation,
  getGlbOrientation,
  getGlbYaw,
  getAvatarStageScale,
  getAvatarTurnRate,
  isInPlaceClip,
  isProfileClip,
  isSwimClip,
  makeLocomotionClipInPlace,
} from "./AvatarAssetAdapter";
import {
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  VectorKeyframeTrack,
  Vector3,
} from "three";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { avatarAsset } from "../../lib/avatar/config";

function rawBradleyGlbMinimumY() {
  const glb = readFileSync(
    resolve(process.cwd(), "public/avatars/bradley-quiet-portrait.glb"),
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
  it.each(["wave", "full_turn_left", "step_hip_hop_dance", "jazz_dance", "cardio_dance", "funny_dancing_02", "all_night_dance", "funny_dancing_03", "not_your_mom", "denim_pop_dance"] as const)("holds %s after one performance", (clip) => {
    const mixer = new AnimationMixer(new Group());
    const action = mixer.clipAction(new AnimationClip(clip, 1, []));
    configureActionLoop(action, clip);
    expect(action.loop).toBe(LoopOnce);
    expect(action.clampWhenFinished).toBe(true);
  });

  it("supports centered specimens while retaining foot anchoring on the stage", () => {
    expect(getAvatarModelOriginY("feet", 0, 1.6672)).toBe(0);
    expect(getAvatarModelOriginY("center", 0, 1.6672)).toBe(-0.8336);
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

  it("reports only registered clips, ignoring extra Meshy exports", () => {
    // Catches a retired behavior becoming a renderer requirement again.
    expect(
      getAvailableAnimationIds([
        "Idle",
        "Agree_Gesture",
        "Swim_Forward",
        "Jazz_Dance",
        "Walking",
        "Wave_One_Hand",
        "Big_Wave_Hello",
      ]),
    ).toEqual(
      new Set([
        "idle",
        "agree_gesture",
        "swim_forward",
        "jazz_dance",
        "walking",
        "wave",
      ]),
    );
  });

  it("centres every prone swimming clip and stands the rest on their feet", () => {
    expect(isSwimClip("swim_forward")).toBe(true);
    expect(isSwimClip("swim_idle")).toBe(true);
    expect(isSwimClip("swimming_to_edge")).toBe(true);
    expect(isSwimClip("walking")).toBe(false);
    expect(isSwimClip("idle")).toBe(false);
  });

  it("turns standing locomotion fully into profile toward its travel", () => {
    // Catches a walker sliding sideways while facing the visitor.
    expect(isProfileClip("walking")).toBe(true);
    expect(isProfileClip("running")).toBe(true);
    expect(isProfileClip("back_left_run")).toBe(true);
    expect(isProfileClip("agree_gesture")).toBe(false);
    expect(getGlbYaw("z", "right", "walking")).toBe(Math.PI / 2);
    expect(getGlbYaw("z", "left", "running")).toBe(-Math.PI / 2);
    expect(getGlbYaw("z", "front", "walking")).toBe(0);
  });

  it("removes root travel from every locomotion clip but leaves gestures alone", () => {
    expect(isInPlaceClip("Swim_Forward")).toBe(true);
    expect(isInPlaceClip("swimming_to_edge")).toBe(true);
    expect(isInPlaceClip("Walking")).toBe(true);
    expect(isInPlaceClip("BackLeft_run")).toBe(true);
    expect(isInPlaceClip("Agree_Gesture")).toBe(false);
    expect(isInPlaceClip("Idle")).toBe(false);
  });

  it("plays the climb-out once and holds its final frame", () => {
    const mixer = new AnimationMixer(new Group());
    const climb = mixer.clipAction(new AnimationClip("swimming_to_edge", 1, []));
    const swim = mixer.clipAction(new AnimationClip("Swim_Forward", 1, []));

    configureActionLoop(climb, "swimming_to_edge");
    configureActionLoop(swim, "swim_forward");

    expect(climb.loop).toBe(LoopOnce);
    expect(climb.clampWhenFinished).toBe(true);
    expect(swim.loop).toBe(LoopRepeat);
    expect(swim.clampWhenFinished).toBe(false);
  });

  it("plays breaststroke more slowly than conversational motion", () => {
    expect(getAvatarPlaybackRate("swim_forward")).toBeLessThan(
      getAvatarPlaybackRate("agree_gesture"),
    );
  });

  it("turns a swimming body more gradually than conversational poses", () => {
    expect(getAvatarTurnRate("swim_forward")).toBeCloseTo(2.2);
    expect(getAvatarTurnRate("swimming_to_edge")).toBeCloseTo(2.2);
    expect(getAvatarTurnRate("agree_gesture")).toBeGreaterThan(
      getAvatarTurnRate("swim_forward"),
    );
  });


  it("starts camera-facing and limits ordinary left and right turns", () => {
    // Catches startup or target-facing logic rotating the avatar's back toward the visitor.
    expect(getGlbYaw("z", "front", "idle")).toBe(0);
    expect(getGlbYaw("z", "left", "idle")).toBe(Math.PI / 8);
    expect(getGlbYaw("z", "right", "idle")).toBe(-Math.PI / 8);
    expect(getGlbYaw("-z", "front", "idle")).toBe(Math.PI);
    expect(getGlbYaw("z", "front", "swim_forward", 0)).toBe(Math.PI / 2);
    expect(getGlbYaw("z", "front", "swim_forward", Math.PI)).toBe(
      (Math.PI * 3) / 2,
    );
    expect(getGlbYaw("z", "front", "swim_forward", -Math.PI / 2)).toBe(0);
  });

  it("tips standing clips slightly forward about the feet, never swimming ones", () => {
    // Catches the rig's resting lean-back reaching the visitor.
    const standing = getGlbOrientation("z", "front", "idle");
    const up = new Vector3(0, 1, 0).applyQuaternion(standing);
    expect(up.z).toBeCloseTo(Math.sin(avatarAsset.standingPitchRadians), 6);
    expect(up.z).toBeGreaterThan(0);
    const swimming = getGlbOrientation("z", "front", "swim_forward", 0);
    expect(new Vector3(0, 0, 1).applyQuaternion(swimming).y).toBeCloseTo(0, 6);
  });

  it("points a swimming body fully up or down without rolling it", () => {
    // Catches limiting vertical steering to a cosmetic tilt, which leaves the
    // swimmer's head level with their hips while moving through the cube.
    const descend = getGlbOrientation(
      "z",
      "front",
      "swim_forward",
      Math.PI / 2,
    );
    const ascend = getGlbOrientation(
      "z",
      "front",
      "swim_forward",
      -Math.PI / 2,
    );
    const localForward = new Vector3(0, 0, 1);
    const localRight = new Vector3(1, 0, 0);

    expect(localForward.clone().applyQuaternion(descend).toArray()).toEqual([
      expect.closeTo(0, 6),
      expect.closeTo(-1, 6),
      expect.closeTo(0, 6),
    ]);
    expect(localForward.clone().applyQuaternion(ascend).toArray()).toEqual([
      expect.closeTo(0, 6),
      expect.closeTo(1, 6),
      expect.closeTo(0, 6),
    ]);
    expect(localRight.clone().applyQuaternion(descend).y).toBeCloseTo(0, 6);
    expect(localRight.clone().applyQuaternion(ascend).y).toBeCloseTo(0, 6);
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
