export const TOYBOX_MIN_WIDTH = 900;
export const TOYBOX_MIN_HEIGHT = 600;
export const BRAIN_FOOD_DURATION_SECONDS = 30;
export const MAX_FRAME_DELTA_SECONDS = 0.05;

export type Vec2 = { x: number; y: number };

export type ViewportBounds = {
  width: number;
  height: number;
  hudHeight?: number;
  padding?: number;
};

export type HitboxSize = { width: number; height: number };

export type BrainFoodBody = {
  position: Vec2;
  velocity: Vec2;
  facing: "left" | "right";
  moving: boolean;
};

export type Collectible = {
  id: string;
  position: Vec2;
  radius: number;
  eaten: boolean;
};

export type PointerSample = { position: Vec2; at: number };

export type TossBody = {
  position: Vec2;
  velocity: Vec2;
  rotation: number;
  angularVelocity: number;
  dragging: boolean;
  impact: number;
};

const ACCELERATION = 1800;
const MAX_SPEED = 420;
const DAMPING_PER_SECOND = 7;
const REDUCED_STEP = 24;
const GRAVITY = 1450;
const TOSS_DAMPING_PER_SECOND = 1.15;
const ANGULAR_DAMPING_PER_SECOND = 2.1;
const IMPACT_DAMPING_PER_SECOND = 8;
const BOUNCE = 0.55;
const FLOOR_FRICTION = 0.82;
const MAX_THROW_SPEED = 1800;
const SLEEP_HORIZONTAL_SPEED = 30;
const SLEEP_VERTICAL_SPEED = 85;
const UPRIGHT_DAMPING_PER_SECOND = 7;

export function isToyboxViewportEligible({
  width,
  height,
}: Pick<ViewportBounds, "width" | "height">) {
  return width >= TOYBOX_MIN_WIDTH && height >= TOYBOX_MIN_HEIGHT;
}

export function clampFrameDelta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, MAX_FRAME_DELTA_SECONDS);
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function layoutArea(bounds: ViewportBounds, radius: number) {
  const padding = bounds.padding ?? 24;
  const hudHeight = bounds.hudHeight ?? 96;
  const inset = padding + radius;
  return {
    left: inset,
    right: Math.max(inset, bounds.width - inset),
    top: hudHeight + inset,
    bottom: Math.max(hudHeight + inset, bounds.height - inset),
  };
}

export function createCollectibleLayout(
  ids: readonly string[],
  bounds: ViewportBounds,
  radius = 22,
): Collectible[] {
  const area = layoutArea(bounds, radius);
  const width = Math.max(1, area.right - area.left);
  const height = Math.max(1, area.bottom - area.top);

  return ids.map((id, index) => {
    const hash = fnv1a(`${id}:${index}`);
    const xRatio = ((hash & 0xffff) + 0.5) / 65536;
    const yRatio = (((hash >>> 16) & 0xffff) + 0.5) / 65536;
    return {
      id,
      position: {
        x: area.left + xRatio * width,
        y: area.top + yRatio * height,
      },
      radius,
      eaten: false,
    };
  });
}

export function rebuildUneatenCollectibles(
  current: readonly Collectible[],
  bounds: ViewportBounds,
) {
  const eaten = new Set(current.filter(({ eaten: value }) => value).map(({ id }) => id));
  const radius = current[0]?.radius ?? 22;
  return createCollectibleLayout(
    current.map(({ id }) => id),
    bounds,
    radius,
  ).map((item) => ({ ...item, eaten: eaten.has(item.id) }));
}

function length(vector: Vec2) {
  return Math.hypot(vector.x, vector.y);
}

function normalize(vector: Vec2) {
  const magnitude = length(vector);
  return magnitude > 0
    ? { x: vector.x / magnitude, y: vector.y / magnitude }
    : { x: 0, y: 0 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampAvatarPosition(
  position: Vec2,
  bounds: ViewportBounds,
  hitbox: HitboxSize,
) {
  const halfWidth = hitbox.width / 2;
  const halfHeight = hitbox.height / 2;
  const minY = (bounds.hudHeight ?? 96) + halfHeight;
  return {
    x: clamp(position.x, halfWidth, Math.max(halfWidth, bounds.width - halfWidth)),
    y: clamp(position.y, minY, Math.max(minY, bounds.height - halfHeight)),
  };
}

export function integrateBrainFood(
  body: BrainFoodBody,
  direction: Vec2,
  elapsedSeconds: number,
  bounds: ViewportBounds,
  hitbox: HitboxSize,
  reducedMotion: boolean,
): BrainFoodBody {
  const halfWidth = hitbox.width / 2;
  const halfHeight = hitbox.height / 2;
  const normalized = normalize(direction);
  const moving = length(normalized) > 0;
  const facing = normalized.x < 0 ? "left" : normalized.x > 0 ? "right" : body.facing;

  if (reducedMotion) {
    return {
      position: {
        x: clamp(body.position.x + normalized.x * REDUCED_STEP, halfWidth, bounds.width - halfWidth),
        y: clamp(
          body.position.y + normalized.y * REDUCED_STEP,
          (bounds.hudHeight ?? 96) + halfHeight,
          bounds.height - halfHeight,
        ),
      },
      velocity: { x: 0, y: 0 },
      facing,
      moving,
    };
  }

  const delta = clampFrameDelta(elapsedSeconds);
  let velocity = {
    x: body.velocity.x + normalized.x * ACCELERATION * delta,
    y: body.velocity.y + normalized.y * ACCELERATION * delta,
  };
  if (!moving) {
    const damping = Math.exp(-DAMPING_PER_SECOND * delta);
    velocity = { x: velocity.x * damping, y: velocity.y * damping };
  }
  const speed = length(velocity);
  if (speed > MAX_SPEED) {
    velocity = { x: (velocity.x / speed) * MAX_SPEED, y: (velocity.y / speed) * MAX_SPEED };
  }

  const minX = halfWidth;
  const maxX = Math.max(minX, bounds.width - halfWidth);
  const minY = (bounds.hudHeight ?? 96) + halfHeight;
  const maxY = Math.max(minY, bounds.height - halfHeight);
  const candidate = {
    x: body.position.x + velocity.x * delta,
    y: body.position.y + velocity.y * delta,
  };
  const position = {
    x: clamp(candidate.x, minX, maxX),
    y: clamp(candidate.y, minY, maxY),
  };
  if (position.x !== candidate.x) velocity.x = 0;
  if (position.y !== candidate.y) velocity.y = 0;
  return {
    position,
    velocity,
    facing,
    moving: length(velocity) > 8,
  };
}

export function collectOverlaps(
  collectibles: readonly Collectible[],
  avatarCenter: Vec2,
  avatarRadius: number,
) {
  const collectedIds: string[] = [];
  const next = collectibles.map((item) => {
    if (item.eaten) return item;
    const distance = Math.hypot(
      item.position.x - avatarCenter.x,
      item.position.y - avatarCenter.y,
    );
    if (distance > item.radius + avatarRadius) return item;
    collectedIds.push(item.id);
    return { ...item, eaten: true };
  });
  return { collectibles: next, collectedIds };
}

export function advanceActiveTime(
  elapsed: number,
  deltaSeconds: number,
  activity: { focused: boolean; visible: boolean },
) {
  const next = activity.focused && activity.visible
    ? Math.min(BRAIN_FOOD_DURATION_SECONDS, elapsed + clampFrameDelta(deltaSeconds))
    : elapsed;
  return { elapsed: next, complete: next >= BRAIN_FOOD_DURATION_SECONDS };
}

export function estimatePointerVelocity(samples: readonly PointerSample[]): Vec2 {
  if (samples.length < 2) return { x: 0, y: 0 };
  const last = samples.at(-1);
  if (!last) return { x: 0, y: 0 };
  const first = samples.find((sample) => sample.at < last.at && last.at - sample.at <= 160);
  if (!first) return { x: 0, y: 0 };
  const seconds = (last.at - first.at) / 1000;
  const velocity = {
    x: (last.position.x - first.position.x) / seconds,
    y: (last.position.y - first.position.y) / seconds,
  };
  const speed = length(velocity);
  return speed > MAX_THROW_SPEED
    ? { x: velocity.x / speed * MAX_THROW_SPEED, y: velocity.y / speed * MAX_THROW_SPEED }
    : velocity;
}

export function resetTossBody(bounds: ViewportBounds): TossBody {
  const minY = bounds.hudHeight ?? 96;
  return {
    position: { x: bounds.width / 2, y: minY + (bounds.height - minY) / 2 },
    velocity: { x: 0, y: 0 },
    rotation: 0,
    angularVelocity: 0,
    dragging: false,
    impact: 0,
  };
}

function normalizedRotation(rotation: number) {
  return Math.atan2(Math.sin(rotation), Math.cos(rotation));
}

function easeUpright(rotation: number, delta: number) {
  const next = normalizedRotation(rotation) * Math.exp(-UPRIGHT_DAMPING_PER_SECOND * delta);
  return Math.abs(next) < 0.01 ? 0 : next;
}

export function integrateToss(
  body: TossBody,
  elapsedSeconds: number,
  bounds: ViewportBounds,
  hitbox: HitboxSize,
  reducedMotion: boolean,
): TossBody {
  if (body.dragging) return body;
  const halfWidth = hitbox.width / 2;
  const halfHeight = hitbox.height / 2;
  const minX = halfWidth;
  const maxX = Math.max(minX, bounds.width - halfWidth);
  const minY = (bounds.hudHeight ?? 96) + halfHeight;
  const maxY = Math.max(minY, bounds.height - halfHeight);
  if (reducedMotion) {
    return {
      ...body,
      position: clampAvatarPosition(body.position, bounds, hitbox),
      velocity: { x: 0, y: 0 },
      rotation: 0,
      angularVelocity: 0,
      impact: 0,
    };
  }

  const delta = clampFrameDelta(elapsedSeconds);
  const onFloor = body.position.y >= maxY - 0.5;
  const canSleep = onFloor
    && Math.abs(body.velocity.x) < SLEEP_HORIZONTAL_SPEED
    && Math.abs(body.velocity.y) < SLEEP_VERTICAL_SPEED;
  if (canSleep) {
    const rotation = easeUpright(body.rotation, delta);
    return {
      ...body,
      position: { x: clamp(body.position.x, minX, maxX), y: maxY },
      velocity: { x: 0, y: 0 },
      rotation,
      angularVelocity: 0,
      impact: rotation === 0 ? 0 : body.impact * Math.exp(-IMPACT_DAMPING_PER_SECOND * delta),
    };
  }
  const linearDamping = Math.exp(-TOSS_DAMPING_PER_SECOND * delta);
  const angularDamping = Math.exp(-ANGULAR_DAMPING_PER_SECOND * delta);
  let impact = body.impact * Math.exp(-IMPACT_DAMPING_PER_SECOND * delta);
  let velocity = {
    x: body.velocity.x * linearDamping,
    y: (body.velocity.y + GRAVITY * delta) * linearDamping,
  };
  let x = body.position.x + velocity.x * delta;
  let y = body.position.y + velocity.y * delta;
  if (x < minX || x > maxX) {
    impact = Math.max(impact, Math.min(1, Math.abs(velocity.x) / 900));
    x = clamp(x, minX, maxX);
    velocity = { ...velocity, x: -velocity.x * BOUNCE };
  }
  if (y < minY || y > maxY) {
    const hitFloor = y > maxY;
    impact = Math.max(impact, Math.min(1, Math.abs(velocity.y) / 900));
    y = clamp(y, minY, maxY);
    velocity = {
      x: hitFloor ? velocity.x * FLOOR_FRICTION : velocity.x,
      y: -velocity.y * BOUNCE,
    };
  }
  return {
    ...body,
    position: { x, y },
    velocity,
    rotation: body.rotation + body.angularVelocity * delta,
    angularVelocity: body.angularVelocity * angularDamping,
    impact,
  };
}
