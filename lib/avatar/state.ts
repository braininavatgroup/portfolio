import { avatarAsset } from "./config";
import type { AllowedAnimation, AvatarCommand, AvatarState } from "./contracts";

export function resolveAvatarAnimation(
  state: AvatarState,
  available: ReadonlySet<AllowedAnimation>,
): AllowedAnimation {
  for (const animation of avatarAsset.stateFallbacks[state]) {
    if (available.has(animation)) {
      return animation;
    }
  }

  return "idle";
}

export function adaptCommandsForReducedMotion(
  commands: readonly AvatarCommand[],
): AvatarCommand[] {
  const adapted: AvatarCommand[] = [];

  for (const command of commands) {
    switch (command.action) {
      case "enter":
      case "exit":
      case "wait":
        break;
      case "walkTo":
        adapted.push({ action: "lookAt", target: command.target });
        break;
      default:
        adapted.push(command);
        break;
    }
  }

  return adapted;
}
