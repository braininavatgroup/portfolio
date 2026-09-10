export type AvatarAssetConfig = {
  modelUrl: string;
  scale: number;
  forwardAxis: "z" | "-z";
  groundOffset: number;
  playbackRate: number;
  /** Forward pitch for standing clips; Meshy's rig rests with a slight lean back. */
  standingPitchRadians: number;
};

export const avatarAsset: AvatarAssetConfig = {
  modelUrl: "/avatars/bradley-quiet-portrait.glb",
  scale: 1,
  forwardAxis: "z",
  groundOffset: -0.9,
  playbackRate: 1,
  standingPitchRadians: 0.08,
};
