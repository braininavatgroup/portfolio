import type { AllowedAnimation, AvatarState } from "./contracts";

export type AvatarAssetConfig = {
  modelUrl: string;
  motionUrl: string;
  scale: number;
  forwardAxis: "z" | "-z";
  groundOffset: number;
  playbackRate: number;
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
  modelUrl: "/avatars/bradley-meshy-rigged.glb",
  motionUrl: "/avatars/bradley-motion-library.glb",
  scale: 1,
  forwardAxis: "z",
  groundOffset: -0.9,
  playbackRate: 1,
};
