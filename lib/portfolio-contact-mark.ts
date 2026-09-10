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
  "spotify",
  "beatport",
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
    case "spotify":
      return [path("M0-9C-4.95-9-9-4.95-9 0s4.05 9 9 9 9-4.05 9-9S4.995-9 0-9z m4.14075 13.005c-0.18 0.26925-0.495 0.36-0.76575 0.18-2.115-1.305-4.77-1.57575-7.92075-0.85575-0.3135 0.0915-0.58425-0.13425-0.67425-0.40425-0.09-0.31575 0.135-0.585 0.405-0.675 3.42-0.76575 6.39-0.45 8.73 0.99 0.315 0.135 0.35925 0.49425 0.22575 0.765z m1.08-2.475c-0.22575 0.315-0.63075 0.45-0.9465 0.225-2.42925-1.485-6.11925-1.935-8.95425-1.035-0.35925 0.09-0.765-0.09-0.855-0.45-0.09-0.36 0.09-0.76575 0.45-0.85575C-1.8-1.575 2.25-1.07925 5.04 0.63c0.27075 0.13575 0.405 0.585 0.18075 0.9z m0.09-2.52C2.43-2.7-2.385-2.88-5.13-2.02425c-0.45 0.13425-0.9-0.13575-1.035-0.54075-0.135-0.45075 0.135-0.9 0.54-1.03575 3.195-0.945 8.46-0.765 11.79075 1.21575 0.40425 0.225 0.53925 0.765 0.31425 1.17-0.22425 0.31575-0.765 0.44925-1.16925 0.225z", true)];
    case "beatport":
      return [path("M7.07175 3.79125a5.3355 5.3355 0 0 1-0.5955 2.4345 5.18775 5.18775 0 0 1-1.63575 1.869 5.0235 5.0235 0 0 1-2.29725 0.87225 4.98975 4.98975 0 0 1-2.42925-0.3255 5.097 5.097 0 0 1-2.001-1.449 5.2725 5.2725 0 0 1-1.11075-2.23725 5.343 5.343 0 0 1 0.03675-2.50875 5.26125 5.26125 0 0 1 1.1745-2.20275l-3.4695 3.5475-1.81575-1.85925 3.90075-3.94875a2.84325 2.84325 0 0 0 0.7995-2.00625V-9h2.5575v4.95975a5.379 5.379 0 0 1-0.38925 2.0955 5.265 5.265 0 0 1-1.16925 1.76475l-0.11475 0.117a5.076 5.076 0 0 1 2.6175-1.29375 5.01525 5.01525 0 0 1 2.88375 0.375 5.15475 5.15475 0 0 1 2.21925 1.923 5.3385 5.3385 0 0 1 0.8385 2.85Zm-2.31675 0a2.9175 2.9175 0 0 0-0.45825-1.59975 2.814 2.814 0 0 0-1.2495-1.068 2.7375 2.7375 0 0 0-1.6185-0.17475 2.778 2.778 0 0 0-1.44 0.77775 2.889 2.889 0 0 0-0.77325 1.46625 2.931 2.931 0 0 0 0.15375 1.65975c0.2115 0.525 0.57 0.97425 1.0305 1.29075a2.754 2.754 0 0 0 1.557 0.48525 2.72775 2.72775 0 0 0 1.97625-0.822c0.26025-0.26325 0.4665-0.5775 0.6075-0.92325 0.141-0.34575 0.21375-0.717 0.2145-1.092Z", true)];
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
