import { describe, expect, it } from "vitest";
import {
  PORTFOLIO_NODE_MARK_SIZE,
  PORTFOLIO_NODE_MARK_STROKE,
  portfolioNodeMarkPrimitives,
  portfolioNodeMarkRadius,
  portfolioNodeMarkVertices,
} from "./portfolio-node-mark";

describe("portfolio node mark grammar", () => {
  it("keeps the existing graph shapes as shared geometry", () => {
    expect(portfolioNodeMarkPrimitives("identity")).toEqual([
      { kind: "brain" },
    ]);
    expect(portfolioNodeMarkPrimitives("story")).toHaveLength(3);
    expect(portfolioNodeMarkPrimitives("operation")).toMatchObject([
      { kind: "circle", fill: false },
      { kind: "circle", fill: false },
    ]);
    expect(portfolioNodeMarkPrimitives("component")).toMatchObject([
      { kind: "polyline", close: true, fill: false },
    ]);
    expect(portfolioNodeMarkPrimitives("engagement")).toMatchObject([
      { kind: "polyline", close: true, fill: false },
    ]);
    expect(portfolioNodeMarkPrimitives("product")).toMatchObject([
      { kind: "circle", fill: false },
      { kind: "circle", fill: true },
    ]);
  });

  it("draws Story as three exact 60-degree spokes", () => {
    const size = PORTFOLIO_NODE_MARK_SIZE;

    expect(portfolioNodeMarkPrimitives("story")).toEqual([
      {
        kind: "polyline",
        points: [
          { x: 0, y: -size * 0.5 },
          { x: 0, y: size * 0.5 },
        ],
        close: false,
        fill: false,
      },
      {
        kind: "polyline",
        points: [
          { x: -size * 0.433, y: -size * 0.25 },
          { x: size * 0.433, y: size * 0.25 },
        ],
        close: false,
        fill: false,
      },
      {
        kind: "polyline",
        points: [
          { x: -size * 0.433, y: size * 0.25 },
          { x: size * 0.433, y: -size * 0.25 },
        ],
        close: false,
        fill: false,
      },
    ]);
  });

  it("draws Component as an equilateral triangle with circumradius 0.56", () => {
    const vertices = portfolioNodeMarkVertices("component")!;
    const expectedRadius = PORTFOLIO_NODE_MARK_SIZE * 0.56;
    const sideLengths = vertices.map((point, index) => {
      const next = vertices[(index + 1) % vertices.length];
      return Math.hypot(point.x - next.x, point.y - next.y);
    });

    for (const point of vertices) {
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(expectedRadius, 3);
    }
    expect(sideLengths[0]).toBeCloseTo(sideLengths[1], 3);
    expect(sideLengths[1]).toBeCloseTo(sideLengths[2], 3);
  });

  it("draws Operation with an inner radius half its outer radius", () => {
    const [outer, inner] = portfolioNodeMarkPrimitives("operation");

    expect(outer).toMatchObject({ kind: "circle", radius: 7.5 });
    expect(inner).toMatchObject({ kind: "circle", radius: 3.75 });
  });

  it("shares closed mark vertices with connector geometry", () => {
    expect(portfolioNodeMarkVertices("component")).toHaveLength(3);
    expect(portfolioNodeMarkVertices("engagement")).toHaveLength(4);
    expect(portfolioNodeMarkVertices("story")).toBeUndefined();
  });

  it("measures each mark's tightest circle from its center, ink included", () => {
    const half = PORTFOLIO_NODE_MARK_STROKE / 2;
    expect(portfolioNodeMarkRadius("story")).toBeCloseTo(15 * 0.5 + half, 5);
    expect(portfolioNodeMarkRadius("operation")).toBeCloseTo(15 * 0.5 + half, 5);
    expect(portfolioNodeMarkRadius("product")).toBeCloseTo(15 * 0.5 + half, 5);
    expect(portfolioNodeMarkRadius("engagement")).toBeCloseTo(15 * 0.54 + half, 5);
    expect(portfolioNodeMarkRadius("component")).toBeCloseTo(15 * 0.56 + half, 5);
    expect(portfolioNodeMarkRadius("identity", 21)).toBeCloseTo(21 * 0.49 + half, 5);
  });
});
