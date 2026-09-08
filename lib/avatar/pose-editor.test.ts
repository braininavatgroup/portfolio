import { describe, expect, it } from "vitest";
import { AnimationClip, Object3D, Quaternion, QuaternionKeyframeTrack, Vector3 } from "three";
import { solveLimb, parsePoseDraft, makePoseDraft, applyPoseOffsets, createPoseSampler, getWristAngles, setWristAngles, straightenWrist, postureOffset, postureAngles, posturePoints } from "./pose-editor";

function arm() {
  const root = new Object3D();
  root.rotation.set(0.2, 0.7, -0.1);
  root.scale.setScalar(0.01);
  const upper = new Object3D();
  upper.name = "LeftArm";
  const lower = new Object3D();
  lower.name = "LeftForeArm";
  lower.position.y = -25;
  const end = new Object3D();
  end.name = "LeftHand";
  end.position.y = -24;
  root.add(upper); upper.add(lower); lower.add(end);
  root.updateMatrixWorld(true);
  return { root, upper, lower, end };
}
const world = (node: Object3D) => node.getWorldPosition(new Vector3());
const digest = "a".repeat(64);

describe("local pose editor IK", () => {
  it("restores the animated pose on repeated samples after manual edits, including constant tracks", () => {
    const chain = arm();
    const idle = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.4);
    const sample = createPoseSampler(chain.root, new AnimationClip("Idle", 1, [
      new QuaternionKeyframeTrack("LeftArm.quaternion", [0, 1], [...idle.toArray(), ...idle.toArray()]),
    ]));
    for (const time of [0, 0, 0.2, 0.2, 0.7, 0]) {
      sample(time);
      expect(chain.upper.quaternion.angleTo(idle)).toBeLessThan(1e-6);
      chain.upper.quaternion.identity();
    }
  });

  it("reaches a hand target through rotated, centimetre-scale parents without stretching", () => {
    const chain = arm();
    const target = new Vector3(0.18, -0.28, 0.12);
    const wristRotation = chain.end.getWorldQuaternion(new Quaternion());
    const translations = [chain.upper, chain.lower, chain.end].map(n => n.position.toArray());
    solveLimb(chain, target, new Vector3(0.4, -0.1, -0.3));
    expect(world(chain.end).distanceTo(target)).toBeLessThan(1e-6);
    expect(world(chain.upper).distanceTo(world(chain.lower))).toBeCloseTo(0.25, 6);
    expect(world(chain.lower).distanceTo(world(chain.end))).toBeCloseTo(0.24, 6);
    expect(chain.end.getWorldQuaternion(new Quaternion()).angleTo(wristRotation)).toBeLessThan(1e-6);
    expect([chain.upper, chain.lower, chain.end].map(n => n.position.toArray())).toEqual(translations);
  });

  it("clamps an unreachable target and stays finite at the shoulder", () => {
    for (const target of [new Vector3(4, -4, 0), new Vector3()]) {
      const chain = arm();
      solveLimb(chain, target, new Vector3(0, 0, 1));
      expect(world(chain.end).length()).toBeLessThanOrEqual(0.49);
      for (const joint of [chain.upper, chain.lower, chain.end]) {
        expect(joint.quaternion.toArray().every(Number.isFinite)).toBe(true);
        expect(joint.quaternion.length()).toBeCloseTo(1, 6);
      }
    }
  });

  it("lets a manually rotated wrist follow its forearm when dragging a hand", () => {
    const chain = arm();
    chain.end.rotation.set(0.12, -0.2, 0.1);
    const wristLocal = chain.end.quaternion.clone();
    const wristWorld = chain.end.getWorldQuaternion(new Quaternion());
    const target = new Vector3(0.18, -0.28, 0.12);
    solveLimb(chain, target, new Vector3(0.4, -0.1, -0.3), "local");
    expect(chain.end.quaternion.angleTo(wristLocal)).toBeLessThan(1e-6);
    expect(chain.end.getWorldQuaternion(new Quaternion()).angleTo(wristWorld)).toBeGreaterThan(0.1);
    expect(world(chain.end).distanceTo(target)).toBeLessThan(1e-6);
  });

  it("rotates and straightens a wrist without moving the arm or the wrist position", () => {
    const chain = arm();
    const wristPosition = world(chain.end);
    const upperRotation = chain.upper.quaternion.clone();
    const lowerRotation = chain.lower.quaternion.clone();
    setWristAngles(chain.end, { bend: 20, side: -15, twist: 40 });
    const angles = getWristAngles(chain.end);
    expect(angles.bend).toBeCloseTo(20, 6);
    expect(angles.side).toBeCloseTo(-15, 6);
    expect(angles.twist).toBeCloseTo(40, 6);
    straightenWrist(chain.end);
    const straight = getWristAngles(chain.end);
    expect(straight.bend).toBeCloseTo(0, 6);
    expect(straight.side).toBeCloseTo(0, 6);
    expect(straight.twist).toBeCloseTo(40, 6);
    // Meshy's hand and forearm point along local +Y; axial twist preserves it.
    expect(new Vector3(0, 1, 0).applyQuaternion(chain.end.quaternion).distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-6);
    expect(world(chain.end).distanceTo(wristPosition)).toBeLessThan(1e-6);
    expect(chain.upper.quaternion.toArray()).toEqual(upperRotation.toArray());
    expect(chain.lower.quaternion.toArray()).toEqual(lowerRotation.toArray());
  });

  it("lets an elbow handle change the bend while keeping the hand fixed", () => {
    const chain = arm();
    const target = new Vector3(0, -0.35, 0);
    solveLimb(chain, target, new Vector3(0, 0, 1));
    expect(world(chain.lower).z).toBeGreaterThan(0.1);
    solveLimb(chain, target, new Vector3(0, 0, -1));
    expect(world(chain.lower).z).toBeLessThan(-0.1);
    expect(world(chain.end).distanceTo(target)).toBeLessThan(1e-6);
  });

  it("applies saved offsets over fresh animation frames without accumulating drift", () => {
    const chain = arm();
    const base = chain.upper.quaternion.clone();
    const offset = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.2);
    const offsets = { LeftArm: offset.toArray() };
    for (let i = 0; i < 10; i++) {
      chain.upper.quaternion.copy(base);
      applyPoseOffsets(chain.root, offsets);
      expect(chain.upper.quaternion.angleTo(offset)).toBeLessThan(1e-6);
    }
    expect(chain.lower.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });
});

describe("local pose drafts", () => {
  it("raises the gaze in body space even when the parent joint frame is rotated", () => {
    const basis = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    const signs = posturePoints.Head!.signs;
    const offset = postureOffset([15, 0, 0], basis, signs);
    const bodyRotation = basis.clone().multiply(offset).multiply(basis.clone().invert());
    const gaze = new Vector3(0, 0, 1).applyQuaternion(bodyRotation);
    expect(gaze.y).toBeGreaterThan(0.25);
    postureAngles(offset, basis, signs).forEach((value, i) => expect(value).toBeCloseTo([15, 0, 0][i]!, 6));
  });

  it("raises both shoulders with the same positive control and preserves arm offsets", () => {
    const offsets: Record<string, [number, number, number, number]> = { LeftArm: [0, 0, 0, 1], RightHand: [0, 0, 0, 1] };
    const original = structuredClone(offsets);
    for (const [name, x] of [["LeftShoulder", 1], ["RightShoulder", -1]] as const) {
      const rotation = postureOffset([0, 0, 10], new Quaternion(), posturePoints[name]!.signs);
      expect(new Vector3(x, 0, 0).applyQuaternion(rotation).y).toBeGreaterThan(0.15);
      offsets[name] = rotation.toArray();
    }
    expect(offsets.LeftArm).toEqual(original.LeftArm);
    expect(offsets.RightHand).toEqual(original.RightHand);
    const draft = makePoseDraft(digest, offsets);
    expect(parsePoseDraft(JSON.stringify(draft), digest)).toEqual(draft);
  });

  it("round trips posture points alongside the existing limb settings", () => {
    const offsets = Object.fromEntries([
      "Head", "neck", "Spine", "Spine01", "Spine02", "Hips", "LeftShoulder", "RightShoulder", "LeftArm", "RightHand",
    ].map(name => [name, new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.1).toArray()]));
    const draft = makePoseDraft(digest, offsets);
    expect(parsePoseDraft(JSON.stringify(draft), digest)).toEqual(draft);
  });

  it("round trips a draft bound to this exact avatar and idle clip", () => {
    const draft = makePoseDraft(digest, { LeftArm: [0, 0, 0, 1] });
    expect(parsePoseDraft(JSON.stringify(draft), digest)).toEqual(draft);
  });

  it("rejects stale models, other clips, invalid rotations and unknown joints", () => {
    const draft = makePoseDraft(digest, {});
    for (const invalid of [
      { ...draft, version: 2 },
      { ...draft, sourceSha256: "b".repeat(64) },
      { ...draft, clip: "Walking" },
      { ...draft, offsets: { LeftArm: [0, 0, 0, 0] } },
      { ...draft, offsets: { LeftArm: [0, 0, 0, 10] } },
      { ...draft, offsets: { LeftArm: [0, null, 0, 1] } },
      { ...draft, offsets: { NotABone: [0, 0, 0, 1] } },
      { ...draft, offsets: [] },
    ]) expect(() => parsePoseDraft(JSON.stringify(invalid), digest)).toThrow();
    expect(() => parsePoseDraft("not json", digest)).toThrow();
  });
});
