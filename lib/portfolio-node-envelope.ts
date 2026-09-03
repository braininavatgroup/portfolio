// A node's envelope on screen: the tightest circle around its mark plus its
// label box. A relationship line stops outside the envelope, so it neither
// bleeds through an open mark nor runs across the label hanging beneath it.

export type ScreenPoint = { x: number; y: number };
export type LayoutBox = { x: number; y: number; width: number; height: number };

/**
 * How far along `direction` (a unit vector) a line must start from `center`
 * to clear the envelope. The mark's circle always applies; the label box
 * applies when the ray actually crosses it, in which case the line begins
 * past the box's far edge.
 */
export function envelopeInset(
  center: ScreenPoint,
  radius: number,
  label: LayoutBox | null,
  direction: ScreenPoint,
  clearance: number,
): number {
  let inset = radius;
  if (label) {
    let enter = Number.NEGATIVE_INFINITY;
    let exit = Number.POSITIVE_INFINITY;
    const axes: Array<[number, number, number, number]> = [
      [center.x, direction.x, label.x, label.x + label.width],
      [center.y, direction.y, label.y, label.y + label.height],
    ];
    let crosses = true;
    for (const [origin, delta, low, high] of axes) {
      if (Math.abs(delta) < 1e-9) {
        if (origin < low || origin > high) crosses = false;
        continue;
      }
      const a = (low - origin) / delta;
      const b = (high - origin) / delta;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
    if (crosses && enter <= exit && exit > 0) inset = Math.max(inset, exit);
  }
  return inset + clearance;
}
