import type { Rng } from "./portfolio-world-zones";

/**
 * The field: where the records outside a composition go. They disperse
 * evenly across the whole map, mixed in behind the composition — deeper
 * than it, and never under a lit label or on a lit line — so nothing dimmed
 * hides beneath something lit, and the map stays populated whatever window
 * it has.
 *
 * Screen space throughout; the caller lifts the targets to depth.
 */
export type Point = { x: number; y: number };

export type FieldLit = {
  point: Point;
  /** Half the width its label needs, in pixels. */
  halfWidth: number;
};

export type FieldDimmed = {
  id: string;
  /** Where the record rests on screen, so it moves the least from there. */
  rest: Point;
};

export type Segment = readonly [Point, Point];

export const FIELD = {
  /** Insets from the viewport edges, in pixels. */
  // Symmetric: nothing floats over a Reading Room slot's bottom edge, so the
  // field uses the same headroom above and below.
  inset: { x: 70, top: 60, bottom: 60 },
  /**
   * Room kept around a lit node: a gap beyond both labels sideways, and the
   * rows above and below its mark that a dimmed mark plus hanging label
   * would collide with.
   */
  clearance: { x: 16, above: 60, below: 72 },
  /** Room kept between a lit line and a dimmed record's mark and label. */
  lineClearance: 10,
  /** A dimmed record's own label: half its width and how far it hangs. */
  label: { halfWidth: 48, depth: 34 },
  /** How far a dimmed mark reaches above its centre. */
  markReach: 10,
  /** The least two seats may be apart, so their labels never stack. */
  spacing: 104,
  /** Margin around the composition's footprint the field may use, in pixels. */
  margin: 48,
  /** How much the region grows per step when the footprint lacks room. */
  growth: 40,
  /** Candidate cells per dimmed record; more means finer, more even seating. */
  density: 7,
  /** Jitter of a candidate within its cell, as a fraction of the cell. */
  jitter: 0.3,
  /** Depth the field sits at, so it reads behind the composition. */
  depth: 1300,
} as const;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function segmentDistance(point: Point, [a, b]: Segment): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
}

type Rect = { left: number; top: number; right: number; bottom: number };

const translateRect = (rect: Rect, x: number, y: number): Rect => ({
  left: rect.left + x,
  top: rect.top + y,
  right: rect.right + x,
  bottom: rect.bottom + y,
});

const insideRect = (point: Point, rect: Rect) =>
  point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

const orientation = (a: Point, b: Point, c: Point) =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));

const segmentsCross = (a: Segment, b: Segment) =>
  orientation(a[0], a[1], b[0]) !== orientation(a[0], a[1], b[1]) &&
  orientation(b[0], b[1], a[0]) !== orientation(b[0], b[1], a[1]);

/** Distance from a segment to a rectangle: zero when they touch or cross. */
export function segmentRectDistance(segment: Segment, rect: Rect): number {
  if (insideRect(segment[0], rect) || insideRect(segment[1], rect)) return 0;
  const corners: Point[] = [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom },
  ];
  const edges: Segment[] = corners.map((corner, index) => [corner, corners[(index + 1) % 4]]);
  if (edges.some((edge) => segmentsCross(segment, edge))) return 0;
  let closest = Infinity;
  for (const corner of corners) closest = Math.min(closest, segmentDistance(corner, segment));
  for (const end of segment) {
    const dx = Math.max(rect.left - end.x, 0, end.x - rect.right);
    const dy = Math.max(rect.top - end.y, 0, end.y - rect.bottom);
    closest = Math.min(closest, Math.hypot(dx, dy));
  }
  return closest;
}

/**
 * The smallest practical translation that gives a label room around a line.
 * Horizontal movement is preferred while it stays modest: map labels hang
 * below their marks, so a sideways nudge preserves their vertical rhythm and
 * fixes the common case where a sloping trunk brushes the first or last word.
 */
export function segmentRectClearanceShift(
  segment: Segment,
  rect: Rect,
  clearance: number,
): Point {
  if (segmentRectDistance(segment, rect) >= clearance) return { x: 0, y: 0 };

  const solve = (xDirection: number, yDirection: number) => {
    let high = 1;
    while (
      high < 4096 &&
      segmentRectDistance(
        segment,
        translateRect(rect, xDirection * high, yDirection * high),
      ) < clearance
    ) {
      high *= 2;
    }
    if (high >= 4096) return null;
    let low = 0;
    for (let step = 0; step < 24; step += 1) {
      const middle = (low + high) / 2;
      const distance = segmentRectDistance(
        segment,
        translateRect(rect, xDirection * middle, yDirection * middle),
      );
      if (distance >= clearance) high = middle;
      else low = middle;
    }
    return { x: xDirection * high, y: yDirection * high };
  };

  const candidates = [
    solve(-1, 0),
    solve(1, 0),
    solve(0, -1),
    solve(0, 1),
  ].filter((candidate): candidate is Point => candidate !== null);
  return candidates.reduce((best, candidate) => {
    const score = Math.hypot(candidate.x, candidate.y) * (candidate.x ? 0.45 : 1);
    const bestScore = Math.hypot(best.x, best.y) * (best.x ? 0.45 : 1);
    return score < bestScore ? candidate : best;
  });
}

/** The box a dimmed record occupies on screen: its mark and hanging label. */
export function dimmedBox(candidate: Point): Rect {
  const { halfWidth, depth } = FIELD.label;
  return {
    left: candidate.x - halfWidth,
    top: candidate.y - FIELD.markReach,
    right: candidate.x + halfWidth,
    bottom: candidate.y + depth,
  };
}

/**
 * Whether a candidate is blocked by a lit node's label room or a lit line.
 * A dimmed record's own mark and hanging label both have to clear the lines.
 */
export function isBlocked(candidate: Point, lit: readonly FieldLit[], lines: readonly Segment[]): boolean {
  const { halfWidth } = FIELD.label;
  for (const { point, halfWidth: litHalfWidth } of lit) {
    const withinX = Math.abs(candidate.x - point.x) <= litHalfWidth + halfWidth + FIELD.clearance.x;
    const withinY =
      candidate.y >= point.y - FIELD.clearance.above && candidate.y <= point.y + FIELD.clearance.below;
    if (withinX && withinY) return true;
  }
  const box = dimmedBox(candidate);
  return lines.some((line) => segmentRectDistance(line, box) < FIELD.lineClearance);
}

/** The closest any two seats come, in pixels. */
export function closestPair(points: readonly Point[]): number {
  let closest = Infinity;
  points.forEach((a, index) => {
    for (const b of points.slice(index + 1)) closest = Math.min(closest, distance(a, b));
  });
  return closest;
}

export type Region = { left: number; top: number; right: number; bottom: number };

/** The viewport inside the field's insets. */
export function fieldBounds(viewport: { width: number; height: number }): Region {
  return {
    left: FIELD.inset.x,
    top: FIELD.inset.top,
    right: viewport.width - FIELD.inset.x,
    bottom: viewport.height - FIELD.inset.bottom,
  };
}

/** The composition's footprint plus a margin, kept inside the bounds. */
export function compositionRegion(lit: readonly FieldLit[], bounds: Region, grow = 0): Region {
  if (lit.length === 0) return bounds;
  const xs = lit.map(({ point }) => point.x);
  const ys = lit.map(({ point }) => point.y);
  const margin = FIELD.margin + grow;
  return {
    left: Math.max(bounds.left, Math.min(...xs) - margin),
    top: Math.max(bounds.top, Math.min(...ys) - margin),
    right: Math.min(bounds.right, Math.max(...xs) + margin),
    bottom: Math.min(bounds.bottom, Math.max(...ys) + margin),
  };
}

const sameRegion = (a: Region, b: Region) =>
  a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;

/** A jittered grid of candidate seats across a region. */
export function fieldCandidates(region: Region, count: number, rng: Rng): Point[] {
  const { left, top, right, bottom } = region;
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const cell = Math.sqrt((width * height) / Math.max(1, count * FIELD.density));
  const columns = Math.max(1, Math.round(width / cell));
  const rows = Math.max(1, Math.round(height / cell));
  const points: Point[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = left + ((column + 0.5) * width) / columns + (rng() * 2 - 1) * FIELD.jitter * (width / columns);
      const y = top + ((row + 0.5) * height) / rows + (rng() * 2 - 1) * FIELD.jitter * (height / rows);
      points.push({ x: Math.min(right, Math.max(left, x)), y: Math.min(bottom, Math.max(top, y)) });
    }
  }
  return points;
}

/**
 * Pick `count` seats that spread as evenly as possible across the free
 * candidates: the first is the seeded pick, each next is the candidate
 * farthest from every seat taken. Lit nodes do not repel seats — the field
 * mixes in behind the composition; blocking alone keeps it out from under
 * a lit label.
 */
export function spreadSeats(candidates: readonly Point[], count: number, rng: Rng = () => 0.5): Point[] {
  const seats: Point[] = [];
  const pool = [...candidates];
  if (pool.length === 0 || count === 0) return seats;
  seats.push(...pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1));
  while (seats.length < count && pool.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    pool.forEach((candidate, index) => {
      let nearest = Infinity;
      for (const seat of seats) nearest = Math.min(nearest, distance(candidate, seat));
      if (nearest > bestScore) {
        bestScore = nearest;
        bestIndex = index;
      }
    });
    seats.push(pool[bestIndex]);
    pool.splice(bestIndex, 1);
  }
  return seats;
}

/**
 * Seat the dimmed records in the empty space of the composition's own
 * footprint — so the whole map stays compact and every record fits without
 * scaling — growing the region outward only when that footprint has too
 * little clear room. Seats are chosen for an even spread; each record then
 * takes the free seat nearest where it rests. Blocked seats are used only
 * as a last resort, never dropping a record.
 */
export function fieldScreenTargets(
  dimmed: readonly FieldDimmed[],
  lit: readonly FieldLit[],
  lines: readonly Segment[],
  viewport: { width: number; height: number },
  rng: Rng = () => 0.5,
): Map<string, Point> {
  const count = dimmed.length;
  if (count === 0) return new Map();
  const bounds = fieldBounds(viewport);
  // Grow the region from the composition's footprint until the seats are
  // both clear and far enough apart for their labels, or the map runs out.
  let grow = 0;
  let seats: Point[] = [];
  for (;;) {
    const region = compositionRegion(lit, bounds, grow);
    const candidates = fieldCandidates(region, count, rng);
    const clear = candidates.filter((candidate) => !isBlocked(candidate, lit, lines));
    seats = spreadSeats(clear.length >= count ? clear : candidates, count, rng);
    const fits = clear.length >= count && closestPair(seats) >= FIELD.spacing;
    if (fits || sameRegion(region, bounds)) break;
    grow += FIELD.growth;
  }
  // Pair records with seats closest-first, so each moves the least from
  // where it rests and the map's left-to-right order mostly survives.
  const pairs: { id: string; index: number; distance: number }[] = [];
  dimmed.forEach(({ id, rest }) => {
    seats.forEach((seat, index) => pairs.push({ id, index, distance: distance(rest, seat) }));
  });
  pairs.sort((a, b) => a.distance - b.distance);
  const targets = new Map<string, Point>();
  const taken = new Set<number>();
  for (const { id, index } of pairs) {
    if (targets.has(id) || taken.has(index)) continue;
    targets.set(id, seats[index]);
    taken.add(index);
  }
  return targets;
}
