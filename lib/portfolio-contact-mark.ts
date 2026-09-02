// Marks for the Contact rows. Not nodes, so no family or register: they draw
// in the node-mark envelope (Rule 6.4) in the identity colour, so they sit
// beside the record marks as one set. Email and CV are built from the node
// primitives (diamond, ring, line). GitHub and LinkedIn are the brand marks as
// filled silhouettes, the same treatment as Bradley's brain symbol; their
// geometry is Simple Icons (CC0), re-based from the 24-unit box onto the
// 15-unit mark: (x - 12) * 0.625, baked at the default size. The marks
// themselves remain those companies' trademarks.

import type { PortfolioNodeMarkPrimitive } from "./portfolio-node-mark";

export const portfolioContactMarkKinds = [
  "email",
  "cv",
  "linkedin",
  "github",
  "instagram",
] as const;

export type PortfolioContactMarkKind = (typeof portfolioContactMarkKinds)[number];

type Point = readonly [number, number];

const line = (points: readonly Point[], close = false): PortfolioNodeMarkPrimitive => ({
  kind: "polyline",
  points: points.map(([x, y]) => ({ x, y })),
  close,
  fill: false,
});
const path = (d: string, fill = false): PortfolioNodeMarkPrimitive => ({ kind: "path", d, fill });
const dot = (x: number, y: number, radius: number): PortfolioNodeMarkPrimitive => ({
  kind: "circle",
  x,
  y,
  radius,
  fill: true,
});
const ring = (x: number, y: number, radius: number): PortfolioNodeMarkPrimitive => ({
  kind: "circle",
  x,
  y,
  radius,
  fill: false,
});

export function portfolioContactMarkPrimitives(
  kind: PortfolioContactMarkKind,
): readonly PortfolioNodeMarkPrimitive[] {
  switch (kind) {
    case "email":
      // The engagement diamond with an envelope flap.
      return [
        line([[0, -8.1], [8.1, 0], [0, 8.1], [-8.1, 0]], true),
        line([[-4, -4], [0, 0], [4, -4]]),
      ];
    case "cv":
      // The product ring with a down arrow.
      return [
        ring(0, 0, 7.2),
        line([[0, -4], [0, 3.6]]),
        line([[-3.2, 0.6], [0, 3.6], [3.2, 0.6]]),
      ];
    case "linkedin":
      return [
        path(
          "M 5.28 5.28 L 3.06 5.28 L 3.06 1.8 C 3.06 0.97 3.04 -0.1 1.9 -0.1 C 0.74 -0.1 0.57 0.81 0.57 1.74 L 0.57 5.28 L -1.66 5.28 L -1.66 -1.88 L 0.48 -1.88 L 0.48 -0.9 L 0.51 -0.9 C 0.81 -1.46 1.53 -2.06 2.61 -2.06 C 4.86 -2.06 5.28 -0.57 5.28 1.35 L 5.28 5.28 Z M -4.16 -2.85 C -4.88 -2.85 -5.45 -3.43 -5.45 -4.14 C -5.45 -4.86 -4.88 -5.43 -4.16 -5.43 C -3.45 -5.43 -2.87 -4.86 -2.87 -4.14 C -2.87 -3.43 -3.45 -2.85 -4.16 -2.85 Z M -3.05 5.28 L -5.28 5.28 L -5.28 -1.88 L -3.05 -1.88 L -3.05 5.28 Z M 6.39 -7.5 L -6.39 -7.5 C -7 -7.5 -7.5 -7.02 -7.5 -6.42 L -7.5 6.42 C -7.5 7.02 -7 7.5 -6.39 7.5 L 6.39 7.5 C 7 7.5 7.5 7.02 7.5 6.42 L 7.5 -6.42 C 7.5 -7.02 7 -7.5 6.39 -7.5 L 6.39 -7.5 Z",
          true,
        ),
      ];
    case "github":
      return [
        path(
          "M 0 -7.31 C -4.14 -7.31 -7.5 -3.96 -7.5 0.19 C -7.5 3.5 -5.35 6.31 -2.37 7.3 C -2 7.37 -1.86 7.14 -1.86 6.94 C -1.86 6.76 -1.87 6.29 -1.87 5.67 C -3.96 6.12 -4.39 4.66 -4.39 4.66 C -4.74 3.79 -5.23 3.56 -5.23 3.56 C -5.91 3.1 -5.18 3.11 -5.18 3.11 C -4.42 3.16 -4.03 3.88 -4.03 3.88 C -3.36 5.03 -2.27 4.7 -1.84 4.5 C -1.78 4.02 -1.58 3.69 -1.37 3.5 C -3.03 3.31 -4.79 2.67 -4.79 -0.21 C -4.79 -1.02 -4.49 -1.69 -4.01 -2.22 C -4.1 -2.41 -4.35 -3.17 -3.95 -4.2 C -3.95 -4.2 -3.32 -4.4 -1.88 -3.43 C -1.28 -3.6 -0.65 -3.68 -0.01 -3.69 C 0.63 -3.68 1.27 -3.6 1.87 -3.43 C 3.29 -4.4 3.92 -4.2 3.92 -4.2 C 4.32 -3.17 4.07 -2.41 3.99 -2.22 C 4.47 -1.69 4.76 -1.02 4.76 -0.21 C 4.76 2.68 3.01 3.31 1.34 3.49 C 1.6 3.72 1.85 4.18 1.85 4.88 C 1.85 5.89 1.84 6.69 1.84 6.94 C 1.84 7.13 1.97 7.37 2.35 7.29 C 5.35 6.31 7.5 3.49 7.5 0.19 C 7.5 -3.96 4.14 -7.31 0 -7.31",
          true,
        ),
      ];
    case "instagram":
      return [
        path(
          "M -4 -7 H 4 A 3 3 0 0 1 7 -4 V 4 A 3 3 0 0 1 4 7 H -4 A 3 3 0 0 1 -7 4 V -4 A 3 3 0 0 1 -4 -7 Z",
        ),
        ring(0, 0, 3.1),
        dot(4.2, -4.2, 0.9),
      ];
  }
}
