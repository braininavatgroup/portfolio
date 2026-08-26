import { avatarStateBehaviors } from "./config";
import type { AllowedAnimation, AvatarCommand, AvatarState } from "./contracts";

export function resolveAvatarAnimation(
  state: AvatarState,
): AllowedAnimation {
  return avatarStateBehaviors[state];
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
      case "play":
        break;
      case "walkTo":
      case "swimTo":
        adapted.push({ action: "lookAt", target: command.target });
        break;
      case "swimRoute":
        break;
      default:
        adapted.push(command);
        break;
    }
  }

  return adapted;
}
