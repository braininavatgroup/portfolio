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

  it("reserves view-plane space without changing the graph's world positions", () => {
    const common = {
      nodes: portfolioNodes,
      aspect: 16 / 9,
      verticalFovDegrees: 43,
      nodeBoundRadius: 0.6,
      margin: 1.16,
      worldOffset: [0, 1.75, 0] as Point3,
    };
    const centered = frameSpatialNodes(common);
    const reserved = frameSpatialNodes({
      ...common,
      viewPlaneOffset: [-1.4, -0.5],
    });

    expect(reserved.target[0]).toBeCloseTo(centered.target[0] - 1.4);
    expect(reserved.target).not.toEqual(centered.target);
    expect(reserved.distance).toBeGreaterThan(centered.distance);
  });

  it("keeps graph fog behind every node at a narrow desktop viewport", () => {
    const nodeBoundRadius = 0.6;
    const worldOffset: Point3 = [0, 1.75, 0];
    const frame = frameSpatialNodes({
      nodes: portfolioNodes,
      aspect: 876 / 910,
      verticalFovDegrees: 43,
      nodeBoundRadius,
      margin: 1.16,
      worldOffset,
      viewPlaneOffset: [-1.55, -0.48],
    });
    const backward = normalize(subtract(frame.position, frame.target));
    const cameraDistance = Math.hypot(
      ...subtract(frame.position, frame.target),
    );

    for (const node of portfolioNodes) {
      const worldPosition: Point3 = [
        node.position[0] + worldOffset[0],
        node.position[1] + worldOffset[1],
        node.position[2] + worldOffset[2],
      ];
      const relative = subtract(worldPosition, frame.target);
      const nodeDepth = cameraDistance - dot(relative, backward);

      expect(frame.fog.near).toBeGreaterThanOrEqual(
        nodeDepth + nodeBoundRadius,
      );
    }
    expect(frame.fog.far).toBeGreaterThan(frame.fog.near);
  });

  it("uses a supplied up axis for portrait domain framing", () => {
    const frame = frameSpatialNodes({
      nodes: portfolioNodes,
      aspect: 390 / 844,
      verticalFovDegrees: 52,
      nodeBoundRadius: 0.75,
      margin: 1.16,
      viewDirection: [1, 0, 0],
      viewUp: [0, 0, 1],
    });

    expect(frame.up).toEqual([0, 0, 1]);
  });
});
