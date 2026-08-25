export const allowedAvatarStates = [
  "hidden",
  "entering",
  "idle",
  "listening",
  "thinking",
  "tool_use",
  "talking",
  "success",
  "confused",
  "error",
  "exiting",
] as const;

export const allowedAvatarAnimations = [
  "idle",
  "walk",
  "think",
  "talk",
  "point",
  "present",
  "celebrate",
  "confused",
] as const;

export const allowedTabs = ["instinct", "approach", "output"] as const;

export const allowedEdgeDirections = ["left", "right"] as const;

export type AvatarState = (typeof allowedAvatarStates)[number];
export type AllowedAnimation = (typeof allowedAvatarAnimations)[number];
export type AllowedTab = (typeof allowedTabs)[number];
export type EdgeDirection = (typeof allowedEdgeDirections)[number];

export type AvatarTargetId =
  | "hero"
  | "portfolio:chat"
  | "portfolio:index"
  | `project:${string}`;

export type ProjectAvatarTargetId = Extract<AvatarTargetId, `project:${string}`>;

export type AvatarCommand =
  | { action: "setState"; state: AvatarState }
  | { action: "play"; animation: AllowedAnimation }
  | { action: "wait"; durationMs: number }
  | { action: "enter"; from: EdgeDirection }
  | { action: "exit"; to: EdgeDirection }
  | { action: "walkTo"; target: AvatarTargetId }
  | { action: "lookAt"; target: AvatarTargetId }
  | { action: "pointAt"; target: AvatarTargetId };

export type SiteAction =
  | { type: "openProject"; target: ProjectAvatarTargetId }
  | { type: "closeProject" }
  | { type: "activateTab"; tab: AllowedTab }
  | { type: "scrollTo"; target: AvatarTargetId }
  | { type: "spotlight"; target: AvatarTargetId }
  | { type: "clearSpotlight" };

export type PortfolioResponseEffects = {
  siteActions: SiteAction[];
  avatarSequence: AvatarCommand[];
  issues: string[];
};
