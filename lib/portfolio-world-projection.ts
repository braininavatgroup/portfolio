// The world's shallow projection, as pure maths.
//
// These lived in components/PortfolioWorld.tsx and were exported from it solely
// so PortfolioWorld.test.tsx could import them — the export list was the
// diagnosis that they belonged in lib/.

export type Point3 = { x: number; y: number; z: number };

export type ProjectedPoint = {
  x: number;
  y: number;
  depth: number;
  scale: number;
};

export function clonePoint(point: Point3): Point3 {
  return { x: point.x, y: point.y, z: point.z };
}

function normalize(point: Point3): Point3 {
  const length = Math.hypot(point.x, point.y, point.z) || 1;
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}

function cross(a: Point3, b: Point3): Point3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Point3, b: Point3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cameraBasis(position: Point3, target: Point3) {
  const forward = normalize({
    x: target.x - position.x,
    y: target.y - position.y,
    z: target.z - position.z,
  });
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = normalize(cross(right, forward));
  return { forward, right, up };
}

export function projectWorldPoint(
  point: Point3,
  position: Point3,
  target: Point3,
  fov: number,
  width: number,
  height: number,
): (ProjectedPoint & { right: Point3; up: Point3 }) | null {
  const { forward, right, up } = cameraBasis(position, target);
  const delta = {
    x: point.x - position.x,
    y: point.y - position.y,
    z: point.z - position.z,
  };
  const depth = dot(delta, forward);
  if (depth < 30) return null;
  const scale = fov / depth;
  return {
    x: width / 2 + dot(delta, right) * scale,
    y: height / 2 - dot(delta, up) * scale,
    depth,
    scale,
    right,
    up,
  };
}

export function translateWorldPointByScreenDelta(
  point: Point3,
  scale: number,
  dx: number,
  dy: number,
  position: Point3,
  target: Point3,
) {
  const { right, up } = cameraBasis(position, target);
  const screenRight = dx / Math.max(0.18, scale);
  const screenDown = dy / Math.max(0.18, scale);
  return {
    x: point.x + right.x * screenRight - up.x * screenDown,
    y: point.y + right.y * screenRight - up.y * screenDown,
    z: point.z + right.z * screenRight - up.z * screenDown,
  };
}

/**
 * The world point that projects to `screen` at camera distance `depth`: the
 * exact inverse of projectWorldPoint for a chosen depth, so a composition can
 * be authored in screen space and still live in the world.
 */
export function worldPointAtDepth(
  screen: { x: number; y: number },
  depth: number,
  position: Point3,
  target: Point3,
  fov: number,
  width: number,
  height: number,
): Point3 {
  const { forward, right, up } = cameraBasis(position, target);
  const scale = fov / depth;
  const a = (screen.x - width / 2) / scale;
  const b = (height / 2 - screen.y) / scale;
  return {
    x: position.x + right.x * a + up.x * b + forward.x * depth,
    y: position.y + right.y * a + up.y * b + forward.y * depth,
    z: position.z + right.z * a + up.z * b + forward.z * depth,
  };
}
