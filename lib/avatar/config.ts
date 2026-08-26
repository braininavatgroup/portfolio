import type { AllowedAnimation, AvatarState } from "./contracts";

export type AvatarAssetConfig = {
  kind: "procedural" | "gltf";
  modelUrl: string | null;
  motionUrl: string | null;
  skeletonProfile: "procedural" | "humanoid" | "mixamo";
  scale: number;
  forwardAxis: "z" | "-z";
  groundOffset: number;
  playbackRate: number;
  targetFrameRate: number | null;
  flatShading: boolean;
  nearestTexture: boolean;
  glasses: {
    frameColor: string;
    headBoneName: string;
    position: readonly [number, number, number];
    rotation: readonly [number, number, number];
  } | null;
};

export const avatarStateBehaviors = {
  hidden: "idle_3",
  entering: "walking",
  idle: "idle_3",
  listening: "alert",
  thinking: "wake_up_and_look_up",
  tool_use: "indoor_play",
  talking: "agree_gesture",
  success: "cheer_with_both_hands",
  confused: "shrug",
  error: "groan_holding_stomach_in_sleep",
  exiting: "walking",
} as const satisfies Record<AvatarState, AllowedAnimation>;

export const avatarAsset: AvatarAssetConfig = {
  kind: "gltf",
  modelUrl: "/avatars/bradley-meshy-rigged.glb",
  motionUrl: "/avatars/bradley-motion-library.glb",
  skeletonProfile: "humanoid",
  scale: 1,
  forwardAxis: "z",
  groundOffset: -0.9,
  playbackRate: 1,
  targetFrameRate: null,
  flatShading: false,
  nearestTexture: false,
  glasses: null,
};
