import { AnimationClip, AnimationMixer, Euler, MathUtils, Object3D, Quaternion, Vector3 } from "three";

export type Limb = { upper: Object3D; lower: Object3D; end: Object3D };
export type PoseOffsets = Record<string, [number, number, number, number]>;
export type PoseDraft = {
  version: 1;
  sourceSha256: string;
  clip: "Idle";
  offsets: PoseOffsets;
};

const poseJoints = new Set([
  "Head", "neck", "Spine", "Spine01", "Spine02", "Hips",
  "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
  "RightShoulder", "RightArm", "RightForeArm", "RightHand",
  "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot",
]);

type PosturePoint = {
  label: string;
  labels: readonly [string, string, string];
  signs: readonly [number, number, number];
  limit: number;
};

// Meshy's hierarchy is Hips > Spine02 > Spine01 > Spine > neck > Head.
export const posturePoints: Record<string, PosturePoint> = {
  Head: { label: "Head", labels: ["Chin up / down", "Turn left / right", "Tilt left / right"], signs: [-1, 1, -1], limit: 45 },
  neck: { label: "Neck", labels: ["Look up / down", "Turn left / right", "Tilt left / right"], signs: [-1, 1, -1], limit: 25 },
  Spine: { label: "Chest / upper back", labels: ["Lean forward / back", "Turn left / right", "Lean left / right"], signs: [1, 1, -1], limit: 25 },
  Spine01: { label: "Middle back", labels: ["Lean forward / back", "Turn left / right", "Lean left / right"], signs: [1, 1, -1], limit: 20 },
  Spine02: { label: "Lower back", labels: ["Lean forward / back", "Turn left / right", "Lean left / right"], signs: [1, 1, -1], limit: 20 },
  LeftShoulder: { label: "Left shoulder", labels: ["Roll forward / back", "Sweep forward / back", "Raise / lower"], signs: [1, -1, 1], limit: 25 },
  RightShoulder: { label: "Right shoulder", labels: ["Roll forward / back", "Sweep forward / back", "Raise / lower"], signs: [1, 1, -1], limit: 25 },
  Hips: { label: "Pelvis", labels: ["Tilt forward / back", "Turn left / right", "Tilt left / right"], signs: [1, 1, -1], limit: 20 },
};

/** Convert body-axis adjustments into the selected joint parent's reference frame. */
export function postureOffset(angles: readonly number[], parentBasis: Quaternion, signs: readonly number[]) {
  const rotation = new Quaternion().setFromEuler(new Euler(
    MathUtils.degToRad(angles[0]! * signs[0]!),
    MathUtils.degToRad(angles[1]! * signs[1]!),
    MathUtils.degToRad(angles[2]! * signs[2]!), "YXZ",
  ));
  return parentBasis.clone().invert().multiply(rotation).multiply(parentBasis).normalize();
}

export function postureAngles(offset: Quaternion, parentBasis: Quaternion, signs: readonly number[]) {
  const rotation = parentBasis.clone().multiply(offset).multiply(parentBasis.clone().invert());
  const angles = new Euler().setFromQuaternion(rotation, "YXZ");
  return [angles.x, angles.y, angles.z].map((angle, index) => MathUtils.radToDeg(angle) * signs[index]!);
}

export function createPoseSampler(root: Object3D, clip: AnimationClip) {
  // Keep manual edits away from AnimationMixer's cached property values. The
  // sampling hierarchy is never rendered; its transforms are copied each time,
  // including tracks whose values did not change since the previous frame.
  const samplingRoot = root.clone(true);
  const pairs: Array<{ target: Object3D; source: Object3D }> = [];
  root.traverse(target => {
    if (!target.name) return;
    const source = samplingRoot.getObjectByName(target.name);
    if (source) pairs.push({ target, source });
  });
  const mixer = new AnimationMixer(samplingRoot);
  mixer.clipAction(clip).play();
  return (time: number) => {
    mixer.setTime(time);
    const rotations = new Map<string, Quaternion>();
    for (const { target, source } of pairs) {
      target.position.copy(source.position);
      target.quaternion.copy(source.quaternion);
      target.scale.copy(source.scale);
      rotations.set(target.name, source.quaternion.clone());
    }
    return rotations;
  };
}

function setWorldRotation(node: Object3D, rotation: Quaternion) {
  const parentRotation = node.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion();
  node.quaternion.copy(parentRotation.invert().multiply(rotation)).normalize();
  node.updateWorldMatrix(false, true);
}

function pointBone(node: Object3D, end: Object3D, target: Vector3) {
  const origin = node.getWorldPosition(new Vector3());
  const currentDirection = end.getWorldPosition(new Vector3()).sub(origin).normalize();
  const direction = target.clone().sub(origin).normalize();
  const delta = new Quaternion().setFromUnitVectors(currentDirection, direction);
  setWorldRotation(node, delta.multiply(node.getWorldQuaternion(new Quaternion())));
}

/** Two-bone IK in world units. Joint translations and scales stay untouched. */
export function solveLimb(
  { upper, lower, end }: Limb,
  target: Vector3,
  pole: Vector3,
  endOrientation: "world" | "local" = "world",
) {
  upper.updateWorldMatrix(true, true);
  const a = upper.getWorldPosition(new Vector3());
  const b = lower.getWorldPosition(new Vector3());
  const c = end.getWorldPosition(new Vector3());
  const endRotation = end.getWorldQuaternion(new Quaternion());
  const firstLength = a.distanceTo(b);
  const secondLength = b.distanceTo(c);
  if (firstLength < 1e-8 || secondLength < 1e-8) throw new Error("Cannot pose a zero-length limb.");

  const direction = target.clone().sub(a);
  const requestedDistance = direction.length();
  if (requestedDistance < 1e-8) direction.copy(c).sub(a);
  if (direction.lengthSq() < 1e-12) direction.set(0, -1, 0);
  direction.normalize();
  const epsilon = Math.min(firstLength, secondLength) * 1e-5;
  const distance = Math.max(Math.abs(firstLength - secondLength) + epsilon,
    Math.min(firstLength + secondLength - epsilon, requestedDistance));
  const bend = pole.clone().sub(a);
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < 1e-10) {
    bend.copy(b).sub(a).addScaledVector(direction, -b.clone().sub(a).dot(direction));
  }
  if (bend.lengthSq() < 1e-10) {
    bend.set(Math.abs(direction.x) < 0.9 ? 1 : 0, Math.abs(direction.x) < 0.9 ? 0 : 1, 0);
    bend.addScaledVector(direction, -bend.dot(direction));
  }
  bend.normalize();
  const along = (firstLength ** 2 - secondLength ** 2 + distance ** 2) / (2 * distance);
  const outward = Math.sqrt(Math.max(0, firstLength ** 2 - along ** 2));
  const elbow = a.clone().addScaledVector(direction, along).addScaledVector(bend, outward);
  const reached = a.clone().addScaledVector(direction, distance);
  pointBone(upper, lower, elbow);
  pointBone(lower, end, reached);
  // Feet keep their ground-facing orientation. Hands follow the forearm,
  // preserving the wrist angle the user chose instead of counter-rotating it.
  if (endOrientation === "world") setWorldRotation(end, endRotation);
  return end.getWorldPosition(new Vector3());
}

export type WristAngles = { bend: number; side: number; twist: number };

export function getWristAngles(hand: Object3D): WristAngles {
  const angles = new Euler().setFromQuaternion(hand.quaternion, "YXZ");
  return { bend: MathUtils.radToDeg(angles.x), side: MathUtils.radToDeg(angles.z), twist: MathUtils.radToDeg(angles.y) };
}

export function setWristAngles(hand: Object3D, angles: WristAngles) {
  hand.quaternion.setFromEuler(new Euler(
    MathUtils.degToRad(angles.bend), MathUtils.degToRad(angles.twist), MathUtils.degToRad(angles.side), "YXZ",
  ));
  hand.updateWorldMatrix(true, true);
}

/** Meshy's hand axis is +Y. Clear its bend and side angle, keeping palm twist. */
export function straightenWrist(hand: Object3D) {
  setWristAngles(hand, { bend: 0, side: 0, twist: getWristAngles(hand).twist });
}

export function applyPoseOffsets(root: Object3D, offsets: PoseOffsets) {
  for (const [name, rotation] of Object.entries(offsets)) {
    const node = root.getObjectByName(name);
    if (node) node.quaternion.premultiply(new Quaternion(...rotation)).normalize();
  }
  root.updateWorldMatrix(true, true);
}

export function makePoseDraft(sourceSha256: string, offsets: PoseOffsets): PoseDraft {
  return { version: 1, sourceSha256, clip: "Idle", offsets: structuredClone(offsets) };
}

/** A pose is meaningful only against the exact file on which it was authored. */
export function parsePoseDraft(text: string, sourceSha256: string): PoseDraft {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This is not a pose file.");
  const draft = value as Partial<PoseDraft>;
  if (draft.version !== 1 || draft.clip !== "Idle") throw new Error("This editor accepts version 1 idle poses.");
  if (!/^[a-f0-9]{64}$/.test(draft.sourceSha256 ?? "") || draft.sourceSha256 !== sourceSha256) {
    throw new Error("This pose belongs to a different avatar file. Start a new draft for this model.");
  }
  if (!draft.offsets || typeof draft.offsets !== "object" || Array.isArray(draft.offsets)) throw new Error("The pose has no valid joint settings.");
  for (const [name, rotation] of Object.entries(draft.offsets)) {
    if (!poseJoints.has(name) || !Array.isArray(rotation) || rotation.length !== 4 ||
      !rotation.every(n => typeof n === "number" && Number.isFinite(n)) ||
      Math.abs(Math.hypot(...rotation) - 1) > 0.001) {
      throw new Error(`Invalid rotation for ${name}.`);
    }
  }
  return makePoseDraft(sourceSha256, draft.offsets);
}
