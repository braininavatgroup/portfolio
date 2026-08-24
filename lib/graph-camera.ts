export type Point3 = readonly [number, number, number];

type PositionedNode = {
  position: Point3;
};

export type SpatialCameraFrame = {
  position: Point3;
  target: Point3;
  distance: number;
  up: Point3;
  fog: {
    near: number;
    far: number;
  };
};

type SpatialCameraFrameInput = {
  nodes: readonly PositionedNode[];
  aspect: number;
  verticalFovDegrees: number;
  nodeBoundRadius: number;
  margin: number;
  worldOffset?: Point3;
  viewDirection?: Point3;
  viewUp?: Point3;
  viewPlaneOffset?: readonly [number, number];
};

const add = (left: Point3, right: Point3): Point3 => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2],
];

const subtract = (left: Point3, right: Point3): Point3 => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2],
];

const scale = (point: Point3, factor: number): Point3 => [
  point[0] * factor,
  point[1] * factor,
  point[2] * factor,
];

const dot = (left: Point3, right: Point3) =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const cross = (left: Point3, right: Point3): Point3 => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
];

const normalize = (point: Point3): Point3 => {
  const length = Math.hypot(...point);
  if (length === 0) throw new Error("Camera view direction must be non-zero");
  return scale(point, 1 / length);
};

export function frameSpatialNodes({
  nodes,
  aspect,
  verticalFovDegrees,
  nodeBoundRadius,
  margin,
  worldOffset = [0, 0, 0],
  viewDirection = [0, 0.32, 1],
  viewUp = [0, 1, 0],
  viewPlaneOffset = [0, 0],
}: SpatialCameraFrameInput): SpatialCameraFrame {
  if (nodes.length === 0) throw new Error("Cannot frame an empty spatial graph");
  if (aspect <= 0) throw new Error("Camera aspect must be positive");

  const worldPositions = nodes.map(({ position }) =>
    add(position, worldOffset),
  );
  const target = worldPositions.reduce(
    (center, position, index) => {
      if (index === 0) {
        return {
          min: [...position] as [number, number, number],
          max: [...position] as [number, number, number],
        };
      }

      for (let axis = 0; axis < 3; axis += 1) {
        center.min[axis] = Math.min(center.min[axis], position[axis]);
        center.max[axis] = Math.max(center.max[axis], position[axis]);
      }
      return center;
    },
    {
      min: [0, 0, 0] as [number, number, number],
      max: [0, 0, 0] as [number, number, number],
    },
  );
  const boundsCenter: Point3 = [
    (target.min[0] + target.max[0]) / 2,
    (target.min[1] + target.max[1]) / 2,
    (target.min[2] + target.max[2]) / 2,
  ];
  const backward = normalize(viewDirection);
  const lateral = cross(normalize(viewUp), backward);
  const right =
    Math.hypot(...lateral) > Number.EPSILON
      ? normalize(lateral)
      : ([1, 0, 0] as const);
  const up = normalize(cross(backward, right));
  const focus = add(
    boundsCenter,
    add(scale(right, viewPlaneOffset[0]), scale(up, viewPlaneOffset[1])),
  );
  const verticalHalfFov = (verticalFovDegrees * Math.PI) / 360;
  const horizontalHalfFov = Math.atan(
    Math.tan(verticalHalfFov) * aspect,
  );
  const horizontalSlope = Math.tan(horizontalHalfFov);
  const verticalSlope = Math.tan(verticalHalfFov);
  const distance = Math.max(
    ...worldPositions.flatMap((position) => {
      const relative = subtract(position, focus);
      const towardCamera = dot(relative, backward);
      const horizontalExtent =
        (Math.abs(dot(relative, right)) + nodeBoundRadius) * margin;
      const verticalExtent =
        (Math.abs(dot(relative, up)) + nodeBoundRadius) * margin;

      return [
        towardCamera + horizontalExtent / horizontalSlope,
        towardCamera + verticalExtent / verticalSlope,
      ];
    }),
  );
  const farthestNodeDepth = Math.max(
    ...worldPositions.map((position) => {
      const relative = subtract(position, focus);
      return distance - dot(relative, backward) + nodeBoundRadius;
    }),
  );

  return {
    position: add(focus, scale(backward, distance)),
    target: focus,
    distance,
    up,
    fog: {
      near: farthestNodeDepth,
      far: farthestNodeDepth + 19,
    },
  };
}
