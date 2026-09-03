export type AvatarAssetConfig = {
  modelUrl: string;
  motionUrl: string;
  scale: number;
  forwardAxis: "z" | "-z";
  groundOffset: number;
  playbackRate: number;
};

export const avatarAsset: AvatarAssetConfig = {
  modelUrl: "/avatars/bradley-meshy-rigged.glb",
  motionUrl: "/avatars/bradley-motion-library.glb",
  scale: 1,
  forwardAxis: "z",
  groundOffset: -0.9,
  playbackRate: 1,
};
