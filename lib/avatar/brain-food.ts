import type { AvatarStagePoint } from "./stage";

export const BRAIN_FOOD_MAX_SPEED = 220;
export const BRAIN_FOOD_TURN_RADIANS_PER_SECOND = 2.2;
const coastingDampingPerSecond = 1.4;
const reducedMotionStep = 12;
const maximumFrameDeltaSeconds = 0.05;

export type BrainFoodBounds = {
  left?: number;
  top?: number;
  width: number;
  height: number;
  padding: number;
};

export type BrainFoodBody = {
  position: AvatarStagePoint;
  velocity: AvatarStagePoint;
  /** Screen-plane radians: right = 0, down = PI / 2, left = PI. */
  heading: number;
};

export type BrainFoodNodePosition = {
  id: string;
  x: number;
  y: number;
  radius: number;
};

function magnitude(point: AvatarStagePoint) {
  return Math.hypot(point.x, point.y);
}

function normalized(point: AvatarStagePoint) {
  const length = magnitude(point);
  return length === 0
    ? { x: 0, y: 0 }
    : { x: point.x / length, y: point.y / length };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function signedAngleDifference(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function turnToward(from: number, to: number, maximumTurn: number) {
  const difference = signedAngleDifference(from, to);
  return Math.abs(difference) <= maximumTurn
    ? to
    : from + Math.sign(difference) * maximumTurn;
}

function boundedPoint(
  point: AvatarStagePoint,
  bounds: BrainFoodBounds,
): AvatarStagePoint {
  const left = bounds.left ?? 0;
  const top = bounds.top ?? 0;
  return {
    x: clamp(point.x, left + bounds.padding, left + bounds.width - bounds.padding),
    y: clamp(point.y, top + bounds.padding, top + bounds.height - bounds.padding),
  };
}

export function findBrainFoodSpawn(
  nodes: readonly BrainFoodNodePosition[],
  bounds: BrainFoodBounds,
  avatarRadius: number,
): AvatarStagePoint | null {
  const left = (bounds.left ?? 0) + bounds.padding;
  const right = (bounds.left ?? 0) + bounds.width - bounds.padding;
  const top = (bounds.top ?? 0) + bounds.padding;
  const bottom = (bounds.top ?? 0) + bounds.height - bounds.padding;
  if (right < left || bottom < top) return null;

  const center = { x: (left + right) / 2, y: (top + bottom) / 2 };
  if (nodes.length === 0) return center;

  const axisSamples = (minimum: number, maximum: number) => {
    const values = [minimum];
    for (let value = minimum + 24; value < maximum; value += 24) {
      values.push(value);
    }
    if (maximum !== minimum) values.push(maximum);
    return values;
  };
  const candidates = [
    center,
    ...axisSamples(top, bottom).flatMap((y) =>
      axisSamples(left, right).map((x) => ({ x, y })),
    ),
  ];
  let best: AvatarStagePoint | null = null;
  let bestClearance = -Infinity;
  for (const candidate of candidates) {
    const clearance = Math.min(
      ...nodes.map(
        (node) =>
          Math.hypot(candidate.x - node.x, candidate.y - node.y) -
          node.radius -
          avatarRadius,
      ),
    );
    if (clearance > bestClearance) {
      best = candidate;
      bestClearance = clearance;
    }
  }
  return bestClearance > 0 ? best : null;
}

export function integrateBrainFood(
  body: BrainFoodBody,
  direction: AvatarStagePoint,
  elapsedSeconds: number,
  bounds: BrainFoodBounds,
  reducedMotion: boolean,
): BrainFoodBody {
  const input = normalized(direction);
  const hasInput = magnitude(input) > 0;
  const requestedHeading = hasInput
    ? Math.atan2(input.y, input.x)
    : body.heading;

  if (reducedMotion) {
    return {
      position: boundedPoint(
        {
          x: body.position.x + input.x * reducedMotionStep,
          y: body.position.y + input.y * reducedMotionStep,
        },
        bounds,
      ),
      velocity: { x: 0, y: 0 },
      heading: requestedHeading,
    };
  }

  const delta = Math.min(
    maximumFrameDeltaSeconds,
    Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0),
  );
  const heading = hasInput
    ? turnToward(
        body.heading,
        requestedHeading,
        BRAIN_FOOD_TURN_RADIANS_PER_SECOND * delta,
      )
    : body.heading;
  const remainingTurn = Math.abs(
    signedAngleDifference(heading, requestedHeading),
  );
  const alignedSpeed =
    BRAIN_FOOD_MAX_SPEED * Math.max(0, Math.cos(remainingTurn));
  let velocity = hasInput
    ? alignedSpeed === 0
      ? { x: 0, y: 0 }
      : {
          x: input.x * alignedSpeed,
          y: input.y * alignedSpeed,
        }
    : { ...body.velocity };
  if (!hasInput) {
    const damping = Math.exp(-coastingDampingPerSecond * delta);
    velocity = { x: velocity.x * damping, y: velocity.y * damping };
  }
  const speed = magnitude(velocity);
  if (speed > BRAIN_FOOD_MAX_SPEED) {
    velocity = {
      x: (velocity.x / speed) * BRAIN_FOOD_MAX_SPEED,
      y: (velocity.y / speed) * BRAIN_FOOD_MAX_SPEED,
    };
  }

  const candidate = {
    x: body.position.x + velocity.x * delta,
    y: body.position.y + velocity.y * delta,
  };
  const position = boundedPoint(candidate, bounds);
  if (position.x !== candidate.x) velocity.x = 0;
  if (position.y !== candidate.y) velocity.y = 0;

  return { position, velocity, heading };
}

export function collectBrainFoodNodes(
  nodes: readonly BrainFoodNodePosition[],
  eatenIds: ReadonlySet<string>,
  avatarPosition: AvatarStagePoint,
  avatarRadius: number,
  previousAvatarPosition = avatarPosition,
) {
  return nodes.flatMap((node) => {
    if (node.id === "bradley" || eatenIds.has(node.id)) return [];
    const segmentX = avatarPosition.x - previousAvatarPosition.x;
    const segmentY = avatarPosition.y - previousAvatarPosition.y;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    const progress =
      segmentLengthSquared === 0
        ? 0
        : clamp(
            ((node.x - previousAvatarPosition.x) * segmentX +
              (node.y - previousAvatarPosition.y) * segmentY) /
              segmentLengthSquared,
            0,
            1,
          );
    const nearest = {
      x: previousAvatarPosition.x + segmentX * progress,
      y: previousAvatarPosition.y + segmentY * progress,
    };
    const distance = Math.hypot(node.x - nearest.x, node.y - nearest.y);
    return distance <= node.radius + avatarRadius ? [node.id] : [];
  });
}

export function isBrainFoodComplete(
  nodes: readonly BrainFoodNodePosition[],
  eatenIds: ReadonlySet<string>,
) {
  const edible = nodes.filter(({ id }) => id !== "bradley");
  return edible.length > 0 && edible.every(({ id }) => eatenIds.has(id));
}
