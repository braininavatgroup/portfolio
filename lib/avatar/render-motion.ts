import type { AvatarTone } from "./contracts";

export function avatarPlaybackRate(tone: AvatarTone, baseRate: number) {
  const energyScale =
    tone.energy === "high" ? 1.15 : tone.energy === "low" ? 0.88 : 1;
  return baseRate * energyScale;
}

export function avatarCrossfadeSeconds(tone: AvatarTone) {
  return tone.energy === "high" ? 0.12 : tone.energy === "low" ? 0.28 : 0.2;
}

export function avatarAmbientAmplitude(
  tone: AvatarTone,
  reducedMotion: boolean,
) {
  if (reducedMotion) return 0;
  if (tone.mischief === "playful") return 0.018;
  return tone.energy === "low" ? 0.004 : 0.009;
}
