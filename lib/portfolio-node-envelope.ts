// A node's envelope on screen: the tightest circle around its mark plus its
// label box. A relationship line stops outside the envelope, so it neither
// bleeds through an open mark nor runs across the label hanging beneath it.

export type ScreenPoint = { x: number; y: number };
export type LayoutBox = { x: number; y: number; width: number; height: number };

function segmentCrossesBox(from: ScreenPoint, to: ScreenPoint, box: LayoutBox) {
  let enter = 0;
  let exit = 1;
  const axes: Array<[number, number, number, number]> = [
    [from.x, to.x - from.x, box.x, box.x + box.width],
    [from.y, to.y - from.y, box.y, box.y + box.height],
  ];
  for (const [origin, delta, low, high] of axes) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < low || origin > high) return false;
      continue;
    }
    const a = (low - origin) / delta;
    const b = (high - origin) / delta;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return false;
  }
  return exit >= 0 && enter <= 1;
}

/**
 * Keep a straight relationship clear of a label below its origin while
 * preserving the related node's side and distance. A lower node remains
 * valid; only a ray that would cross the label is turned to pass just above
 * the nearest top corner.
 */
export function clearLabelRay(
  from: ScreenPoint,
  to: ScreenPoint,
  label: LayoutBox,
  clearance: number,
): ScreenPoint {
  const expanded = {
    x: label.x - clearance,
    y: label.y - clearance,
    width: label.width + clearance * 2,
    height: label.height + clearance * 2,
  };
  if (!segmentCrossesBox(from, to, expanded)) return to;

  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (!distance) return to;
  const corner = {
    x: to.x < from.x ? expanded.x : expanded.x + expanded.width,
    y: expanded.y,
  };
  const cornerDistance = Math.hypot(corner.x - from.x, corner.y - from.y);
  if (!cornerDistance) return to;
  return {
    x: from.x + ((corner.x - from.x) / cornerDistance) * distance,
    y: from.y + ((corner.y - from.y) / cornerDistance) * distance,
  };
}

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
