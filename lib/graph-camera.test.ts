import { describe, expect, it } from "vitest";
import { frameSpatialNodes } from "./graph-camera";
import { portfolioNodes } from "./spatial-graph";

type Point3 = readonly [number, number, number];

const subtract = (left: Point3, right: Point3): Point3 => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2],
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
  return [point[0] / length, point[1] / length, point[2] / length];
};

describe("graph camera framing", () => {
  it("fits every spatial node bound inside a portrait viewport with margin", () => {
    const aspect = 9 / 16;
    const verticalFovDegrees = 52;
    const nodeBoundRadius = 0.6;
    const margin = 1.16;
    const worldOffset: Point3 = [0, 1.75, 0];
    const frame = frameSpatialNodes({
      nodes: portfolioNodes,
      aspect,
      verticalFovDegrees,
      nodeBoundRadius,
      margin,
      worldOffset,
    });
    const backward = normalize(subtract(frame.position, frame.target));
    const right = normalize(cross([0, 1, 0], backward));
    const up = normalize(cross(backward, right));
    const distance = Math.hypot(...subtract(frame.position, frame.target));
    const verticalHalfFov = (verticalFovDegrees * Math.PI) / 360;
    const horizontalHalfFov = Math.atan(
      Math.tan(verticalHalfFov) * aspect,
    );

    for (const node of portfolioNodes) {
      const worldPosition: Point3 = [
        node.position[0] + worldOffset[0],
        node.position[1] + worldOffset[1],
        node.position[2] + worldOffset[2],
      ];
      const relative = subtract(worldPosition, frame.target);
      const depth = distance - dot(relative, backward);
      const horizontalBound =
        (Math.abs(dot(relative, right)) + nodeBoundRadius) * margin;
      const verticalBound =
        (Math.abs(dot(relative, up)) + nodeBoundRadius) * margin;

      expect(horizontalBound).toBeLessThanOrEqual(
        depth * Math.tan(horizontalHalfFov),
      );
      expect(verticalBound).toBeLessThanOrEqual(
        depth * Math.tan(verticalHalfFov),
      );
    }
  });

  it("moves farther back when the same bounds have less horizontal room", () => {
    const common = {
      nodes: portfolioNodes,
      verticalFovDegrees: 52,
      nodeBoundRadius: 0.6,
      margin: 1.16,
      worldOffset: [0, 1.75, 0] as Point3,
    };
    const portrait = frameSpatialNodes({ ...common, aspect: 9 / 16 });
    const landscape = frameSpatialNodes({ ...common, aspect: 16 / 9 });

    expect(portrait.distance).toBeGreaterThan(landscape.distance);
  });
});
