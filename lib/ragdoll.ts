export type DragPoint = { x: number; y: number };
export type JointRotation = { x: number; y: number; z: number };

export type RagdollTargets = {
  torso: JointRotation;
  head: JointRotation;
  leftArm: JointRotation;
  leftForearm: JointRotation;
  rightArm: JointRotation;
  rightForearm: JointRotation;
  leftLeg: JointRotation;
  leftShin: JointRotation;
  rightLeg: JointRotation;
  rightShin: JointRotation;
};

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function getRagdollTargets(point: DragPoint): RagdollTargets {
  const x = clamp(point.x);
  const y = clamp(point.y);

  return {
    torso: { x: y * -0.18, y: x * 0.24, z: x * -0.1 },
    head: { x: y * -0.34, y: x * 0.46, z: x * -0.16 },
    leftArm: { x: y * 0.18, y: x * 0.1, z: 0.28 + x * 0.48 - y * 0.12 },
    leftForearm: { x: y * -0.22, y: x * -0.08, z: 0.2 + x * 0.7 + y * 0.16 },
    rightArm: { x: y * -0.18, y: x * 0.1, z: -0.28 - x * 0.48 + y * 0.12 },
    rightForearm: { x: y * 0.22, y: x * -0.08, z: -0.2 - x * 0.7 - y * 0.16 },
    leftLeg: { x: y * -0.12, y: x * 0.05, z: -0.06 - x * 0.22 },
    leftShin: { x: Math.max(0, -y) * 0.34, y: 0, z: x * 0.12 },
    rightLeg: { x: y * 0.12, y: x * 0.05, z: 0.06 + x * 0.22 },
    rightShin: { x: Math.max(0, y) * 0.34, y: 0, z: x * -0.12 },
  };
}

export function settleDrag(point: DragPoint, dragging: boolean): DragPoint {
  if (dragging) return { x: clamp(point.x), y: clamp(point.y) };
  const x = Math.abs(point.x) < 0.002 ? 0 : point.x * 0.86;
  const y = Math.abs(point.y) < 0.002 ? 0 : point.y * 0.86;
  return { x, y };
}
