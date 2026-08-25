import type { AllowedAnimation, AvatarState } from "./contracts";

export type AvatarAssetConfig = {
  kind: "procedural" | "gltf";
  modelUrl: string | null;
  skeletonProfile: "procedural" | "mixamo";
  scale: number;
  forwardAxis: "z" | "-z";
  groundOffset: number;
  playbackRate: number;
  targetFrameRate: number | null;
  flatShading: boolean;
  nearestTexture: boolean;
  animations: Record<AllowedAnimation, string>;
  stateFallbacks: Record<AvatarState, readonly AllowedAnimation[]>;
};

export const avatarAsset: AvatarAssetConfig = {
  kind: "procedural",
  modelUrl: null,
  skeletonProfile: "procedural",
  scale: 1,
  forwardAxis: "z",
  groundOffset: 0,
  playbackRate: 1,
  targetFrameRate: null,
  flatShading: true,
  nearestTexture: false,
  animations: {
    idle: "idle",
    walk: "walk",
    think: "think",
    talk: "talk",
    point: "point",
    present: "present",
    celebrate: "celebrate",
    confused: "confused",
  },
  stateFallbacks: {
    hidden: ["idle"],
    entering: ["walk", "idle"],
    idle: ["idle"],
    listening: ["idle"],
    thinking: ["think", "idle"],
    tool_use: ["think", "idle"],
    talking: ["talk", "idle"],
    success: ["present", "celebrate", "idle"],
    confused: ["confused", "idle"],
    error: ["confused", "idle"],
    exiting: ["walk", "idle"],
  },
};
