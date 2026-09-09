import { PORTFOLIO_GLYPH } from "./portfolio-glyph-metrics";
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
    }
  | {
      /** SVG path data in the same mark coordinate space; curves only. */
      kind: "path";
      d: string;
      fill: boolean;
    };

export function portfolioNodeMarkVertices(
  family: PortfolioWorldFamily,
  size = PORTFOLIO_NODE_MARK_SIZE,
): readonly PortfolioNodeMarkPoint[] | undefined {
  if (family === "component") {
    const radius = size * 0.56;
    return [
      { x: 0, y: -radius },
      { x: Math.sin(Math.PI / 3) * radius, y: radius / 2 },
      { x: -Math.sin(Math.PI / 3) * radius, y: radius / 2 },
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

/**
 * The tightest circle around a mark, measured from its center: the furthest
 * any of its ink reaches, including half the stroke. Relationship lines stop
 * at this circle, never inside it, so a line cannot bleed through the open
 * arms of an asterisk or the gaps in a triangle.
 */
export const PORTFOLIO_NODE_MARK_STROKE = PORTFOLIO_GLYPH.node.stroke;

export function portfolioNodeMarkRadius(
  family: PortfolioWorldFamily,
  size = PORTFOLIO_NODE_MARK_SIZE,
): number {
  let reach = 0;
  for (const primitive of portfolioNodeMarkPrimitives(family, size)) {
    if (primitive.kind === "brain") {
      reach = Math.max(reach, size * 0.49);
    } else if (primitive.kind === "circle") {
      reach = Math.max(reach, Math.hypot(primitive.x, primitive.y) + primitive.radius);
    } else if (primitive.kind === "polyline") {
      for (const { x, y } of primitive.points) reach = Math.max(reach, Math.hypot(x, y));
    } else {
      throw new Error("portfolioNodeMarkRadius cannot measure a path primitive");
    }
  }
  return reach + PORTFOLIO_NODE_MARK_STROKE / 2;
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
    ];
  }
  if (family === "identity") return [{ kind: "brain" }];
  if (family === "operation") {
    return [
      { kind: "circle", x: 0, y: 0, radius: size * 0.5, fill: false },
      { kind: "circle", x: 0, y: 0, radius: size * 0.25, fill: false },
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
    { kind: "circle", x: 0, y: 0, radius: size * 0.5, fill: false },
    { kind: "circle", x: 0, y: 0, radius: size * (1.9 / 15), fill: true },
  ];
}
