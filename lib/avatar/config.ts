import type { AllowedAnimation, AvatarState } from "./contracts";

export type AvatarAssetConfig = {
  kind: "procedural" | "gltf";
  modelUrl: string | null;
  skeletonProfile: "procedural" | "humanoid" | "mixamo";
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
  kind: "gltf",
  modelUrl: "/avatars/quaternius-casual-2.glb",
  skeletonProfile: "humanoid",
  scale: 1,
  forwardAxis: "z",
  groundOffset: -0.9,
  playbackRate: 1,
  targetFrameRate: null,
  flatShading: false,
  nearestTexture: false,
  animations: {
    idle: "Idle",
    walk: "Walk",
    think: "Idle_Neutral",
    talk: "Interact",
    point: "Idle_Gun_Pointing",
    present: "Wave",
    celebrate: "Wave",
    confused: "HitRecieve_2",
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
