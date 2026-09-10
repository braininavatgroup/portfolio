import type { PortfolioNodeMarkPrimitive } from "./portfolio-node-mark";

/** Approved A artwork, authored in a centered 20-unit canvas.
 * Coordinates include the accepted sizing and optical placement. Rendering
 * never fits or recenters a path. Bounds checks live in the test suite. */
export type PortfolioControlMarkKind =
  | "avatarShown"
  | "avatarHidden"
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
  "avatarShown",
  "avatarHidden",
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

// One 18px painted square frame for all panel controls. A’s 1.25px stroke
// and corner radius are retained; the old short rectangle broke row alignment.
const panelFrame = "M-7.178571-8.375H7.178571A1.196429 1.196429 0 0 1 8.375-7.178571V7.178571A1.196429 1.196429 0 0 1 7.178571 8.375H-7.178571A1.196429 1.196429 0 0 1-8.375 7.178571V-7.178571A1.196429 1.196429 0 0 1-7.178571-8.375Z";

export function portfolioControlMarkPrimitives(
  kind: PortfolioControlMarkKind,
): readonly PortfolioNodeMarkPrimitive[] {
  switch (kind) {
    // Approved connected bust: one closed silhouette, centered in 18px of ink.
    case "avatarShown":
    case "avatarHidden":
      return [stroke("M0-8.375C2.1-8.375 3.3-6.8 3.3-4.6C3.3-2.6 2.3-1.2 1.6-.7V1C2.8 2 7.5 2.8 7.5 6.4V8.375H-7.5V6.4C-7.5 2.8-2.8 2-1.6 1V-.7C-2.3-1.2-3.3-2.6-3.3-4.6C-3.3-6.8-2.1-8.375 0-8.375Z")];
    case "map":
      return [stroke("M-1.131757-8.035473Q0-8.714527 1.131757-8.035473L6.451014-4.97973Q7.58277-4.300676 7.58277-3.055743V3.055743Q7.58277 4.300676 6.451014 4.97973L1.131757 8.035473Q0 8.714527-1.131757 8.035473L-6.451014 4.97973Q-7.58277 4.300676-7.58277 3.055743V-3.055743Q-7.58277-4.300676-6.451014-4.97973Z")];
    case "index":
      return [stroke("M-8.375-5.982143H8.375M-8.375 0H8.375M-8.375 5.982143H8.375")];
    case "chat":
      return [
        stroke(
          "M0-8.375C5.127551-8.375 8.318027-5.298469 8.318027-0.968537 8.318027 3.361395 4.89966 6.32398 0 6.32398H-2.278912L-6.608844 8.375-5.92517 4.159014C-7.520408 2.791667-8.318027 1.082483-8.318027-0.968537-8.318027-5.298469-5.127551-8.375 0-8.375Z",
        ),
      ];
    case "close":
      return [stroke("M-8.375-8.375L8.375 8.375M-8.375 8.375L8.375-8.375")];
    case "previous":
      return [stroke("M4.1875-8.375L-4.1875 0 4.1875 8.375")];
    case "next":
      return [stroke("M-4.1875-8.375L4.1875 0-4.1875 8.375")];
    case "send":
      return [stroke("M8.375-6.852273V2.284091H-8.375M-3.806818-2.284091L-8.375 2.284091-3.806818 6.852273")];
    case "minimize":
      return [stroke("M-8.375 0H8.375")];
    case "sidebarLeft":
    case "mobileSidebar":
      return [stroke(`${panelFrame}M-2.991071-8.375V8.375`)];
    case "sidebarRight":
      return [stroke(`${panelFrame}M2.991071-8.375V8.375`)];
    case "panelBottom":
      return [stroke(`${panelFrame}M-8.375 1.196429H8.375`)];
    case "reader":
      return [stroke("M-8.375-5.982143H8.375M-8.375 0H8.375M-8.375 5.982143H1.196429")];
    case "copy":
      return [stroke("M-2.791667-2.791667H8.375V8.375H-2.791667ZM2.791667-2.791667V-8.375H-8.375V2.791667H-2.791667")];
    case "newChat":
      return [stroke("M-8.375 0H8.375M0-8.375V8.375")];
    case "chevron":
      return [stroke("M-4.1875-8.375L4.1875 0-4.1875 8.375")];
    case "readArrow":
      return [stroke("M-8.375 0H8.375M1.675-6.7L8.375 0 1.675 6.7")];
  }
}

/** User-selected texture positioning; silhouette coordinates are authored above. */
export const portfolioControlCrops = {
  map: { textureTransform: "translate(-2px, 2px) rotate(65deg) scale(1.65)" },
  chat: { textureTransform: "translate(1.25px, 2px) rotate(-10deg) scale(1.65)" },
  avatarShown: { textureTransform: "translate(-0.25px, -2px) rotate(-55deg) scale(1.65)" },
  avatarHidden: { textureTransform: "translate(-0.25px, -2px) rotate(-55deg) scale(1.65)" },
} as const;
