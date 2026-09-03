import type { PortfolioNodeMarkPrimitive } from "./portfolio-node-mark";

/**
 * The control glyphs: one primitive each, authored in the node-mark envelope
 * (the −9…9 viewBox that `PORTFOLIO_NODE_MARK_SIZE = 15` yields) so a control
 * reads at the same optical size and stroke as a register mark. The component
 * fills the `map` and `chat` outlines with the brain pattern.
 */
export type PortfolioControlMarkKind =
  | "map"
  | "index"
  | "chat"
  | "close"
  | "previous"
  | "next"
  | "send"
  | "minimize"
  | "sidebarLeft"
  | "mobileSidebar"
  | "sidebarRight"
  | "panelBottom"
  | "reader"
  | "copy"
  | "newChat"
  | "chevron"
  | "readArrow";

export const portfolioControlMarkKinds: readonly PortfolioControlMarkKind[] = [
  "map",
  "index",
  "chat",
  "close",
  "previous",
  "next",
  "send",
  "minimize",
  "sidebarLeft",
  "mobileSidebar",
  "sidebarRight",
  "panelBottom",
  "reader",
  "copy",
  "newChat",
  "chevron",
  "readArrow",
];

const stroke = (d: string): PortfolioNodeMarkPrimitive => ({ kind: "path", d, fill: false });

export function portfolioControlMarkPrimitives(
  kind: PortfolioControlMarkKind,
): readonly PortfolioNodeMarkPrimitive[] {
  switch (kind) {
    case "map":
      return [stroke("M6.93 4L0 8L-6.93 4L-6.93 -4L0 -8L6.93 -4Z")];
    case "index":
      return [stroke("M-7 -5H7 M-7 0H7 M-7 5H7")];
    case "chat":
      return [
        stroke(
          "M7.5 -1.6A7.5 5 0 1 0 -6.85 0.43L-7.4 6.6L-3.52 2.81A7.5 5 0 0 0 7.5 -1.6Z",
        ),
      ];
    case "close":
      return [stroke("M-5.5 -5.5L5.5 5.5 M-5.5 5.5L5.5 -5.5")];
    case "previous":
      return [stroke("M3 -6.5L-3.5 0L3 6.5")];
    case "next":
      return [stroke("M-3 -6.5L3.5 0L-3 6.5")];
    case "send":
      return [stroke("M6 -5V1H-5 M-2 -2L-5 1L-2 4")];
    case "minimize":
      return [stroke("M-7 0H7")];
    case "sidebarLeft":
      return [
        stroke(
          "M-6 -5.5H6A1 1 0 0 1 7 -4.5V4.5A1 1 0 0 1 6 5.5H-6A1 1 0 0 1 -7 4.5V-4.5A1 1 0 0 1 -6 -5.5Z M-2.5 -5.5V5.5",
        ),
      ];
    case "mobileSidebar":
      return [
        stroke(
          "M-6.5 -6H6.5A1 1 0 0 1 7.5 -5V5A1 1 0 0 1 6.5 6H-6.5A1 1 0 0 1 -7.5 5V-5A1 1 0 0 1 -6.5 -6Z M-2.5 -6V6",
        ),
      ];
    case "sidebarRight":
      return [
        stroke(
          "M-6 -5.5H6A1 1 0 0 1 7 -4.5V4.5A1 1 0 0 1 6 5.5H-6A1 1 0 0 1 -7 4.5V-4.5A1 1 0 0 1 -6 -5.5Z M2.5 -5.5V5.5",
        ),
      ];
    case "panelBottom":
      return [
        stroke(
          "M-6 -5.5H6A1 1 0 0 1 7 -4.5V4.5A1 1 0 0 1 6 5.5H-6A1 1 0 0 1 -7 4.5V-4.5A1 1 0 0 1 -6 -5.5Z M-7 1H7",
        ),
      ];
    case "reader":
      return [stroke("M-7 -5H7 M-7 0H7 M-7 5H1")];
    case "copy":
      return [stroke("M-2 -2H6V6H-2Z M2 -2V-6H-6V2H-2")];
    case "newChat":
      return [stroke("M-6 0H6 M0 -6V6")];
    case "chevron":
      return [stroke("M-3 -6.5L3.5 0L-3 6.5")];
    case "readArrow":
      return [stroke("M-5 0H5 M1 -4L5 0L1 4")];
  }
}
