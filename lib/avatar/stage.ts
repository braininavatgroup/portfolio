import type { AvatarFacing } from "./orientation";

export type AvatarStagePoint = { x: number; y: number };
export type AvatarLocomotion = "grounded" | "swimming";

export type AvatarStageMotion = {
  id: number;
  kind: "enter" | "walk" | "exit" | "swim";
  locomotion: AvatarLocomotion;
  points: readonly AvatarStagePoint[];
  durationMs: number;
  /** Fixed facing for the whole motion; otherwise facing follows travel. */
  facing?: AvatarFacing;
};

export type AvatarStageViewport = {
  width: number;
  height: number;
  floorY: number;
};

type StageBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  inViewport?: boolean;
};

type GroundedDockInput = {
  current: AvatarStagePoint;
  target: StageBounds;
  obstacles: readonly StageBounds[];
  viewport: AvatarStageViewport;
  actorHalfWidth: number;
  gap: number;
  inset?: number;
};

type SwimmingDocksInput = {
  target: StageBounds;
  viewport: Pick<AvatarStageViewport, "width" | "height">;
  inset: number;
  padding: number;
};

type SwimPathInput = {
  start: AvatarStagePoint;
  destinations: readonly AvatarStagePoint[];
  obstacles: readonly StageBounds[];
  viewport: Pick<AvatarStageViewport, "width" | "height">;
  viewportInset: number;
  obstaclePadding: number;
};

type SwimLapInput = {
  start: AvatarStagePoint;
  dock: AvatarStagePoint;
  obstacles: readonly StageBounds[];
  viewport: AvatarStageViewport;
  viewportInset: number;
  obstaclePadding: number;
};

type FloorStrollInput = {
  start: AvatarStagePoint;
  obstacles: readonly StageBounds[];
  viewport: AvatarStageViewport;
  viewportInset: number;
  actorHalfWidth: number;
  actorHeight: number;
  minimumDistance: number;
};

type RouteNode = {
  point: AvatarStagePoint;
  destination: boolean;
};

const geometryEpsilon = 1e-9;

export function groundedFloorY(
  viewportHeight: number,
  bottomInset: number,
  blockingTop?: number,
  blockingGap = 0,
) {
  const viewportFloor = viewportHeight - bottomInset;
  return typeof blockingTop === "number"
    ? Math.min(viewportFloor, blockingTop - blockingGap)
    : viewportFloor;
}

export function inflateStageBounds(
  bounds: StageBounds,
  padding: number,
) {
  const left = bounds.left - padding;
  const top = bounds.top - padding;
  const right = bounds.right + padding;
  const bottom = bounds.bottom + padding;

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    inViewport: bounds.inViewport,
  };
}

export function selectGroundedDock(input: GroundedDockInput): AvatarStagePoint | null {
  const padding = input.actorHalfWidth + input.gap;
  const inset = input.inset ?? input.actorHalfWidth + 8;
  const candidates = [
    { x: input.target.left - padding, y: input.viewport.floorY },
    { x: input.target.right + padding, y: input.viewport.floorY },
  ].map((point) => ({
    ...point,
    x: clampViewportPoint(point.x, input.viewport.width, inset),
  }));

  return candidates
    .map((point) => ({
      point,
      ...groundedDockScore(point, input),
    }))
    .sort(
      (left, right) =>
        left.overlapCount - right.overlapCount ||
        left.overlapArea - right.overlapArea ||
        left.distance - right.distance ||
        left.point.x - right.point.x,
    )[0]?.point ?? null;
}

export function targetSwimmingDocks(input: SwimmingDocksInput): AvatarStagePoint[] {
  const centerX = (input.target.left + input.target.right) / 2;
  const centerY = (input.target.top + input.target.bottom) / 2;
  return [
    { x: input.target.left - input.padding, y: centerY },
    { x: input.target.right + input.padding, y: centerY },
    { x: centerX, y: input.target.top - input.padding },
    { x: centerX, y: input.target.bottom + input.padding },
  ].map((point) => ({
    x: clampViewportPoint(point.x, input.viewport.width, input.inset),
    y: clampViewportPoint(point.y, input.viewport.height, input.inset),
  }));
}

export function planSwimPath(input: SwimPathInput): AvatarStagePoint[] | null {
  const obstacles = input.obstacles
    .filter((obstacle) => obstacle.inViewport !== false)
    .map((obstacle) => inflateBounds(obstacle, input.obstaclePadding));
  const withinViewport = (point: AvatarStagePoint) =>
    point.x >= input.viewportInset &&
    point.x <= input.viewport.width - input.viewportInset &&
    point.y >= input.viewportInset &&
    point.y <= input.viewport.height - input.viewportInset;
  const isOpen = (point: AvatarStagePoint) =>
    withinViewport(point) && !obstacles.some((obstacle) => pointInsideBounds(point, obstacle));

  if (!isOpen(input.start)) return null;

  const nodes = sortAndDedupeNodes([
    { point: input.start, destination: false },
    ...input.destinations
      .filter(isOpen)
      .map((point) => ({ point, destination: true })),
    ...obstacles.flatMap((obstacle) => [
      { point: { x: obstacle.left, y: obstacle.top }, destination: false },
      { point: { x: obstacle.left, y: obstacle.bottom }, destination: false },
      { point: { x: obstacle.right, y: obstacle.top }, destination: false },
      { point: { x: obstacle.right, y: obstacle.bottom }, destination: false },
    ]),
  ]).filter((node) => isOpen(node.point));
  const start = nodes.findIndex((node) => pointsEqual(node.point, input.start));

  if (start === -1 || !nodes.some((node) => node.destination)) return null;

  const edges = nodes.map(() => [] as Array<{ node: number; distance: number }>);
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      if (obstacles.some((obstacle) => segmentEntersBounds(nodes[left]!.point, nodes[right]!.point, obstacle))) {
        continue;
      }
      const distance = pointDistance(nodes[left]!.point, nodes[right]!.point);
      edges[left]!.push({ node: right, distance });
      edges[right]!.push({ node: left, distance });
    }
  }

  const distances = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => -1);
  const visited = nodes.map(() => false);
  distances[start] = 0;

  for (let step = 0; step < nodes.length; step += 1) {
    let current = -1;
    for (let node = 0; node < nodes.length; node += 1) {
      if (
        !visited[node] &&
        (current === -1 || distances[node]! < distances[current]! - geometryEpsilon ||
          (Math.abs(distances[node]! - distances[current]!) <= geometryEpsilon && node < current))
      ) {
        current = node;
      }
    }
    if (current === -1 || !Number.isFinite(distances[current])) break;
    visited[current] = true;

    for (const edge of edges[current]!) {
      const nextDistance = distances[current]! + edge.distance;
      if (
        nextDistance < distances[edge.node]! - geometryEpsilon ||
        (Math.abs(nextDistance - distances[edge.node]!) <= geometryEpsilon && current < previous[edge.node]!)
      ) {
        distances[edge.node] = nextDistance;
        previous[edge.node] = current;
      }
    }
  }

  const destination = nodes.reduce<number>((chosen, node, index) => {
    if (!node.destination || !Number.isFinite(distances[index])) return chosen;
    if (chosen === -1 || distances[index]! < distances[chosen]! - geometryEpsilon ||
      (Math.abs(distances[index]! - distances[chosen]!) <= geometryEpsilon && index < chosen)) {
      return index;
    }
    return chosen;
  }, -1);

  if (destination === -1) return null;

  const route: AvatarStagePoint[] = [];
  for (let node = destination; node !== -1; node = previous[node]!) {
    route.push(nodes[node]!.point);
  }
  return route.reverse();
}

export function planSwimLap(input: SwimLapInput): AvatarStagePoint[] | null {
  const upperRight = {
    x: input.viewport.width - input.viewportInset,
    y: input.viewportInset,
  };
  const upperLeft = { x: input.viewportInset, y: input.viewportInset };
  const lowerLeft = {
    x: input.viewportInset,
    y: Math.min(
      input.viewport.height - input.viewportInset,
      input.viewport.floorY - input.viewportInset,
    ),
  };
  const stops = [upperRight, upperLeft, lowerLeft].map((stop) =>
    swimLapStopCandidates(
      stop,
      input.viewport,
      input.viewportInset,
      input.obstaclePadding,
    ),
  );
  const launch = selectSwimLaunch(input);
  if (!launch) return null;
  const route: AvatarStagePoint[] = pointsEqual(input.start, launch)
    ? [input.start]
    : [input.start, launch];
  let hasTourExcursion = false;

  for (const destinations of stops) {
    let leg: AvatarStagePoint[] | null = null;
    for (const destination of [...destinations, route.at(-1)!]) {
      leg = planSwimPath({
        start: route.at(-1)!,
        destinations: [destination],
        obstacles: input.obstacles,
        viewport: input.viewport,
        viewportInset: input.viewportInset,
        obstaclePadding: input.obstaclePadding,
      });
      if (leg) break;
    }
    if (!leg) return null;
    hasTourExcursion ||= stagePathLength(leg) > geometryEpsilon;
    route.push(...leg.slice(1));
  }

  if (!hasTourExcursion) return null;

  const dockLeg = planSwimPath({
    start: route.at(-1)!,
    destinations: [input.dock],
    obstacles: input.obstacles,
    viewport: input.viewport,
    viewportInset: input.viewportInset,
    obstaclePadding: input.obstaclePadding,
  });
  if (!dockLeg) return null;
  route.push(...dockLeg.slice(1));

  return route;
}

/**
 * Picks the far end of the walkway the figure stands on. Standing inside a
 * pane (the Guide dock) keeps the stroll inside that pane; on the open floor
 * the walkway runs to the viewport inset or the nearest pane that reaches down
 * into the figure's height band. Returns null when neither direction offers a
 * stroll worth taking.
 */
export function planFloorStroll(input: FloorStrollInput): AvatarStagePoint | null {
  const visible = input.obstacles.filter((obstacle) => obstacle.inViewport !== false);
  const bandTop = input.start.y - input.actorHeight;
  const container = visible.find(
    (obstacle) =>
      input.start.x >= obstacle.left &&
      input.start.x <= obstacle.right &&
      obstacle.bottom >= input.start.y - input.actorHeight &&
      obstacle.top <= input.start.y,
  );
  let left = input.viewportInset;
  let right = input.viewport.width - input.viewportInset;
  if (container) {
    left = container.left + input.actorHalfWidth;
    right = container.right - input.actorHalfWidth;
  } else {
    for (const obstacle of visible) {
      if (obstacle.bottom < bandTop || obstacle.top > input.start.y) continue;
      if (obstacle.right <= input.start.x) {
        left = Math.max(left, obstacle.right + input.actorHalfWidth);
      } else if (obstacle.left >= input.start.x) {
        right = Math.min(right, obstacle.left - input.actorHalfWidth);
      }
    }
  }
  const candidates = [left, right]
    .map((x) => ({ x, y: input.start.y }))
    .filter((point) => point.x >= input.viewportInset && point.x <= input.viewport.width - input.viewportInset)
    .map((point) => ({ point, distance: Math.abs(point.x - input.start.x) }))
    .filter(({ distance }) => distance >= input.minimumDistance)
    .sort((a, b) => b.distance - a.distance || a.point.x - b.point.x);
  return candidates[0]?.point ?? null;
}

export function stagePathLength(points: readonly AvatarStagePoint[]) {
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    distance += pointDistance(points[index - 1]!, points[index]!);
  }
  return distance;
}

export function sampleStagePath(
  points: readonly AvatarStagePoint[],
  progress: number,
): AvatarStagePoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (progress <= 0) return points[0]!;
  if (progress >= 1) return points.at(-1)!;

  const destinationDistance = stagePathLength(points) * progress;
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const length = pointDistance(from, to);
    if (travelled + length >= destinationDistance) {
      const segmentProgress = length === 0 ? 0 : (destinationDistance - travelled) / length;
      return {
        x: from.x + (to.x - from.x) * segmentProgress,
        y: from.y + (to.y - from.y) * segmentProgress,
      };
    }
    travelled += length;
  }
  return points.at(-1)!;
}

export function stageTravelDuration(
  distance: number,
  energy: "low" | "medium" | "high",
  locomotion: AvatarLocomotion = "grounded",
) {
  const pixelsPerSecond = locomotion === "swimming"
    ? energy === "high" ? 640 : energy === "low" ? 300 : 440
    : energy === "high" ? 760 : energy === "low" ? 360 : 520;
  return Math.round(
    Math.min(1_800, Math.max(280, (Math.abs(distance) / pixelsPerSecond) * 1_000)),
  );
}

export function screenPointToOrthographic(
  point: AvatarStagePoint,
  viewport: AvatarStageViewport,
): [number, number, number] {
  return [point.x - viewport.width / 2, viewport.height / 2 - point.y, 0];
}

function groundedDockScore(point: AvatarStagePoint, input: GroundedDockInput) {
  const actor = {
    left: point.x - input.actorHalfWidth,
    top: point.y - input.actorHalfWidth * 2,
    right: point.x + input.actorHalfWidth,
    bottom: point.y,
  };
  const overlaps = [input.target, ...input.obstacles]
    .filter((obstacle) => obstacle.inViewport)
    .map((obstacle) => overlapArea(actor, obstacle))
    .filter((area) => area > 0);

  return {
    overlapCount: overlaps.length,
    overlapArea: overlaps.reduce((total, area) => total + area, 0),
    distance: pointDistance(point, input.current),
  };
}

function inflateBounds(bounds: StageBounds, padding: number): StageBounds {
  return {
    left: bounds.left - padding,
    top: bounds.top - padding,
    right: bounds.right + padding,
    bottom: bounds.bottom + padding,
  };
}

function selectSwimLaunch(input: SwimLapInput): AvatarStagePoint | null {
  const obstacles = input.obstacles.filter((obstacle) => obstacle.inViewport !== false);
  const padded = obstacles.map((obstacle) => inflateBounds(obstacle, input.obstaclePadding));
  const containing = padded
    .map((obstacle, index) => ({ obstacle, raw: obstacles[index]! }))
    .filter(({ obstacle }) => pointInsideBounds(input.start, obstacle));
  if (containing.length === 0) return input.start;
  if (obstacles.some((obstacle) => pointInsideBounds(input.start, obstacle))) return null;

  return containing
    .map(({ obstacle, raw }) => swimLaunchCandidate(input.start, raw, obstacle))
    .filter((candidate): candidate is AvatarStagePoint => candidate !== null)
    .map((candidate) => ({
      x: clampViewportPoint(candidate.x, input.viewport.width, input.viewportInset),
      y: clampViewportPoint(candidate.y, input.viewport.height, input.viewportInset),
    }))
    .filter((candidate) =>
      !padded.some((obstacle) => pointInsideBounds(candidate, obstacle)) &&
      !obstacles.some((obstacle) => segmentEntersBounds(input.start, candidate, obstacle)),
    )
    .sort((left, right) => pointDistance(input.start, left) - pointDistance(input.start, right))[0] ?? null;
}

function swimLaunchCandidate(
  start: AvatarStagePoint,
  raw: StageBounds,
  padded: StageBounds,
): AvatarStagePoint | null {
  const x = start.x <= raw.left
    ? padded.left
    : start.x >= raw.right
      ? padded.right
      : start.x;
  const y = start.y <= raw.top
    ? padded.top
    : start.y >= raw.bottom
      ? padded.bottom
      : start.y;

  return x === start.x && y === start.y ? null : { x, y };
}

function swimLapStopCandidates(
  stop: AvatarStagePoint,
  viewport: AvatarStageViewport,
  inset: number,
  obstaclePadding: number,
) {
  const candidateStep = Math.max(64, obstaclePadding);
  const offsets = [candidateStep, candidateStep * 2, candidateStep * 3];
  const xDirection = stop.x <= inset ? 1 : -1;
  const yDirection = stop.y <= inset ? 1 : -1;
  return [
    stop,
    ...offsets.flatMap((xOffset) => offsets.map((yOffset) => ({
      x: clampViewportPoint(stop.x + xDirection * xOffset, viewport.width, inset),
      y: clampViewportPoint(stop.y + yDirection * yOffset, viewport.height, inset),
    }))),
  ];
}

function sortAndDedupeNodes(nodes: readonly RouteNode[]) {
  const sorted = [...nodes].sort(
    (left, right) => left.point.x - right.point.x || left.point.y - right.point.y,
  );
  const deduped: RouteNode[] = [];
  for (const node of sorted) {
    const previous = deduped.at(-1);
    if (previous && pointsEqual(previous.point, node.point)) {
      previous.destination ||= node.destination;
    } else {
      deduped.push({ point: node.point, destination: node.destination });
    }
  }
  return deduped;
}

function segmentEntersBounds(
  from: AvatarStagePoint,
  to: AvatarStagePoint,
  bounds: StageBounds,
) {
  const xInterval = openCoordinateInterval(from.x, to.x - from.x, bounds.left, bounds.right);
  const yInterval = openCoordinateInterval(from.y, to.y - from.y, bounds.top, bounds.bottom);
  if (!xInterval || !yInterval) return false;
  return Math.max(xInterval[0], yInterval[0], 0) < Math.min(xInterval[1], yInterval[1], 1) - geometryEpsilon;
}

function openCoordinateInterval(value: number, delta: number, minimum: number, maximum: number) {
  if (Math.abs(delta) <= geometryEpsilon) {
    return value > minimum + geometryEpsilon && value < maximum - geometryEpsilon
      ? [-Infinity, Infinity] as const
      : null;
  }
  const first = (minimum - value) / delta;
  const second = (maximum - value) / delta;
  return [Math.min(first, second), Math.max(first, second)] as const;
}

function pointInsideBounds(point: AvatarStagePoint, bounds: StageBounds) {
  return point.x > bounds.left + geometryEpsilon && point.x < bounds.right - geometryEpsilon &&
    point.y > bounds.top + geometryEpsilon && point.y < bounds.bottom - geometryEpsilon;
}

function overlapArea(left: StageBounds, right: StageBounds) {
  return Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left)) *
    Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
}

function pointDistance(left: AvatarStagePoint, right: AvatarStagePoint) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function pointsEqual(left: AvatarStagePoint, right: AvatarStagePoint) {
  return Math.abs(left.x - right.x) <= geometryEpsilon && Math.abs(left.y - right.y) <= geometryEpsilon;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(minimum, maximum), Math.max(minimum, Math.min(maximum, value)));
}

function clampViewportPoint(value: number, length: number, inset: number) {
  const minimum = Math.min(inset, length / 2);
  const maximum = Math.max(minimum, length - inset);
  return clamp(value, minimum, maximum);
}
