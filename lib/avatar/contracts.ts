import type { AllowedAnimation } from "./behaviors";

export { allowedAvatarAnimations } from "./behaviors";
export type { AllowedAnimation } from "./behaviors";

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

export const allowedEdgeDirections = ["left", "right"] as const;

export const avatarEnergyLevels = ["low", "medium", "high"] as const;
export const avatarWarmthLevels = ["reserved", "warm"] as const;
export const avatarConfidenceLevels = [
  "uncertain",
  "neutral",
  "assured",
] as const;
export const avatarMischiefLevels = ["none", "playful"] as const;
export const avatarPerformanceIntents = [
  "ordinary",
  "expressive",
  "requested",
] as const;

export type AvatarState = (typeof allowedAvatarStates)[number];
export type EdgeDirection = (typeof allowedEdgeDirections)[number];
export type AvatarPerformanceIntent =
  (typeof avatarPerformanceIntents)[number];
export type AvatarTone = {
  energy: (typeof avatarEnergyLevels)[number];
  warmth: (typeof avatarWarmthLevels)[number];
  confidence: (typeof avatarConfidenceLevels)[number];
  mischief: (typeof avatarMischiefLevels)[number];
};

export const defaultAvatarTone: AvatarTone = {
  energy: "medium",
  warmth: "warm",
  confidence: "neutral",
  mischief: "none",
};

export type AvatarTargetId =
  | "hero"
  | "portfolio:chat"
  | "portfolio:index"
  | `project:${string}`;

export type ProjectAvatarTargetId = Extract<AvatarTargetId, `project:${string}`>;

export const avatarRouteIds = ["lap"] as const;
export type AvatarRouteId = (typeof avatarRouteIds)[number];

export type AvatarCommand =
  | { action: "setState"; state: AvatarState }
  | { action: "setTone"; tone: AvatarTone }
  | { action: "play"; animation: AllowedAnimation }
  | { action: "wait"; durationMs: number }
  | { action: "enter"; from: EdgeDirection }
  | { action: "exit"; to: EdgeDirection }
  | { action: "walkTo"; target: AvatarTargetId }
  | { action: "swimTo"; target: AvatarTargetId }
  | { action: "swimRoute"; route: AvatarRouteId }
  | { action: "lookAt"; target: AvatarTargetId }
  | { action: "pointAt"; target: AvatarTargetId };

export type PortfolioResponseEffects = {
  avatarSequence: AvatarCommand[];
  avatarIntent?: AvatarPerformanceIntent;
  avatarTone?: AvatarTone;
  issues: string[];
};
