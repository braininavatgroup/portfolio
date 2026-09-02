import type { PortfolioWorldFamily } from "./portfolio-world";

export const PORTFOLIO_NODE_MARK_SIZE = 15;

export type PortfolioNodeMarkPoint = { x: number; y: number };

export type PortfolioNodeMarkPrimitive =
  | { kind: "brain" }
  | {
      kind: "circle";
      x: number;
      y: number;
      radius: number;
      fill: boolean;
    }
  | {
      kind: "polyline";
      points: readonly PortfolioNodeMarkPoint[];
      close: boolean;
      fill: boolean;
    };

export function portfolioNodeMarkVertices(
  family: PortfolioWorldFamily,
  size = PORTFOLIO_NODE_MARK_SIZE,
): readonly PortfolioNodeMarkPoint[] | undefined {
  if (family === "component") {
    return [
      { x: 0, y: -size * 0.52 },
      { x: size * 0.51, y: size * 0.42 },
      { x: -size * 0.51, y: size * 0.42 },
    ];
  }
  if (family === "engagement") {
    return [
      { x: 0, y: -size * 0.54 },
      { x: size * 0.54, y: 0 },
      { x: 0, y: size * 0.54 },
      { x: -size * 0.54, y: 0 },
    ];
  }
  return undefined;
}

export function portfolioNodeMarkPrimitives(
  family: PortfolioWorldFamily,
  size = PORTFOLIO_NODE_MARK_SIZE,
): readonly PortfolioNodeMarkPrimitive[] {
  if (family === "story") {
    return [
      {
        kind: "polyline",
        points: [
          { x: 0, y: -size * 0.49 },
          { x: 0, y: size * 0.49 },
        ],
        close: false,
        fill: false,
      },
      {
        kind: "polyline",
        points: [
          { x: -size * 0.43, y: -size * 0.245 },
          { x: size * 0.43, y: size * 0.245 },
        ],
        close: false,
        fill: false,
      },
      {
        kind: "polyline",
        points: [
          { x: -size * 0.43, y: size * 0.245 },
          { x: size * 0.43, y: -size * 0.245 },
        ],
        close: false,
        fill: false,
      },
    ];
  }
  if (family === "identity") return [{ kind: "brain" }];
  if (family === "operation") {
    return [
      { kind: "circle", x: 0, y: 0, radius: size * 0.5, fill: false },
      { kind: "circle", x: 0, y: 0, radius: size * 0.28, fill: false },
    ];
  }
  if (family === "component" || family === "engagement") {
    return [
      {
        kind: "polyline",
        points: portfolioNodeMarkVertices(family, size)!,
        close: true,
        fill: false,
      },
    ];
  }
  return [
    { kind: "circle", x: 0, y: 0, radius: size * 0.49, fill: false },
    { kind: "circle", x: 0, y: 0, radius: size * 0.14, fill: true },
  ];
}
