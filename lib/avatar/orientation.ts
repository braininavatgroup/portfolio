export type AvatarFacing = "front" | "left" | "right";

const ordinaryTurnRadians = Math.PI / 8;

export function getAvatarYaw(
  forwardAxis: "z" | "-z",
  facing: AvatarFacing,
) {
  const axisCorrection = forwardAxis === "-z" ? Math.PI : 0;
  const turn =
    facing === "front"
      ? 0
      : facing === "left"
        ? ordinaryTurnRadians
        : -ordinaryTurnRadians;
  return axisCorrection + turn;
}
