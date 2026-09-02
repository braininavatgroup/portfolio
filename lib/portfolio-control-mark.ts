import type { PortfolioNodeMarkPrimitive } from "./portfolio-node-mark";

/**
 * The control glyphs: one primitive each, authored in the node-mark envelope
 * (the −9…9 viewBox that `PORTFOLIO_NODE_MARK_SIZE = 15` yields) so a control
 * reads at the same optical size and stroke as a register mark. `map` is the
 * brain symbol and has no primitives; the component renders the mask.
 */
export type PortfolioControlMarkKind =
  | "map"
  | "index"
  | "chat"
  | "close"
  | "previous"
  | "next"
  | "send"
  | "minimize";

export const portfolioControlMarkKinds: readonly PortfolioControlMarkKind[] = [
  "map",
  "index",
  "chat",
  "close",
  "previous",
  "next",
  "send",
  "minimize",
];

const stroke = (d: string): PortfolioNodeMarkPrimitive => ({ kind: "path", d, fill: false });

export function portfolioControlMarkPrimitives(
  kind: PortfolioControlMarkKind,
): readonly PortfolioNodeMarkPrimitive[] {
  switch (kind) {
    case "map":
      return [{ kind: "brain" }];
    case "index":
      return [stroke("M-7 -5H7 M-7 0H7 M-7 5H7")];
    case "chat":
      return [-5.4, 0, 5.4].map((x) => ({
        kind: "circle",
        x,
        y: 0,
        radius: 1.6,
        fill: true,
      }));
    case "close":
      return [stroke("M-6.45 -6.45L6.45 6.45 M-6.45 6.45L6.45 -6.45")];
    case "previous":
      return [stroke("M3.5 -7L-3.5 0L3.5 7")];
    case "next":
      return [stroke("M-3.5 -7L3.5 0L-3.5 7")];
    case "send":
      return [stroke("M-7 3.5L0 -3.5L7 3.5")];
    case "minimize":
      return [stroke("M-7 0H7")];
  }
}
