import { describe, expect, it } from "vitest";
import {
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

  it("shares closed mark vertices with connector geometry", () => {
    expect(portfolioNodeMarkVertices("component")).toHaveLength(3);
    expect(portfolioNodeMarkVertices("engagement")).toHaveLength(4);
    expect(portfolioNodeMarkVertices("story")).toBeUndefined();
  });

  it("measures each mark's tightest circle from its center, ink included", () => {
    const half = PORTFOLIO_NODE_MARK_STROKE / 2;
    // The asterisk's diagonal arms reach a touch further than its upright.
    expect(portfolioNodeMarkRadius("story")).toBeCloseTo(
      Math.hypot(0.43, 0.245) * 15 + half,
      5,
    );
    expect(portfolioNodeMarkRadius("operation")).toBeCloseTo(15 * 0.5 + half, 5);
    expect(portfolioNodeMarkRadius("product")).toBeCloseTo(15 * 0.49 + half, 5);
    expect(portfolioNodeMarkRadius("engagement")).toBeCloseTo(15 * 0.54 + half, 5);
    // The triangle's base corners reach further than its apex.
    expect(portfolioNodeMarkRadius("component")).toBeCloseTo(
      Math.hypot(0.51, 0.42) * 15 + half,
      5,
    );
    expect(portfolioNodeMarkRadius("identity", 21)).toBeCloseTo(21 * 0.49 + half, 5);
  });
});
