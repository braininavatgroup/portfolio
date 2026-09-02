import { describe, expect, it } from "vitest";
import {
  portfolioNodeMarkPrimitives,
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
});
