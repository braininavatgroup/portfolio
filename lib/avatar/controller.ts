import { avatarAsset } from "./config";
import type {
  AllowedAnimation,
  AvatarCommand,
  AvatarState,
  AvatarTargetId,
} from "./contracts";
import { resolveAvatarAnimation } from "./state";
import { AvatarTargetRegistry } from "./target-registry";

export type AvatarSnapshot = {
  state: AvatarState;
  animation: AllowedAnimation;
  currentCommand: AvatarCommand | null;
  target: AvatarTargetId | null;
  anchorX: number;
  facing: "left" | "right";
  pointing: "left" | "right" | null;
  visible: boolean;
  failed: boolean;
};

type AvatarListener = () => void;

const horizontalInset = 80;

function viewportWidth() {
  return typeof globalThis.innerWidth === "number"
    ? globalThis.innerWidth
    : horizontalInset * 2;
}

function clampAnchor(anchorX: number) {
  const width = viewportWidth();
  const minimum = Math.min(horizontalInset, width / 2);
  const maximum = Math.max(minimum, width - horizontalInset);
  return Math.min(maximum, Math.max(minimum, anchorX));
}

function createInitialSnapshot(): AvatarSnapshot {
  return {
    state: "idle",
    animation: "idle",
    currentCommand: null,
    target: null,
    anchorX: clampAnchor(viewportWidth() - horizontalInset),
    facing: "right",
    pointing: null,
    visible: true,
    failed: false,
  };
}

export class AvatarController {
  #registry: AvatarTargetRegistry;
  #listeners = new Set<AvatarListener>();
  #initialSnapshot: AvatarSnapshot;
  #snapshot: AvatarSnapshot;
  #availableAnimations = new Set<AllowedAnimation>(Object.keys(avatarAsset.animations) as AllowedAnimation[]);

  constructor(registry: AvatarTargetRegistry) {
    this.#registry = registry;
    this.#initialSnapshot = createInitialSnapshot();
    this.#snapshot = this.#initialSnapshot;
  }

  getSnapshot = () => this.#snapshot;

  subscribe = (listener: AvatarListener) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  setAvailableAnimations = (available: ReadonlySet<AllowedAnimation>) => {
    this.#availableAnimations = new Set(available);
    const animation = resolveAvatarAnimation(
      this.#snapshot.state,
      this.#availableAnimations,
    );
    if (animation !== this.#snapshot.animation) {
      this.#update({ animation });
    }
  };

  setVisible(visible: boolean) {
    this.#update({ visible });
  }

  markFailed() {
    this.#update({ failed: true });
  }

  reset() {
    this.#replace(this.#initialSnapshot);
  }

  execute(command: Exclude<AvatarCommand, { action: "wait" }>) {
    switch (command.action) {
      case "setState":
        this.#update({
          state: command.state,
          animation: resolveAvatarAnimation(command.state, this.#availableAnimations),
          currentCommand: command,
          pointing: null,
        });
        return;
      case "play":
        if (!this.#availableAnimations.has(command.animation)) {
          return;
        }
        this.#update({ animation: command.animation, currentCommand: command });
        return;
      case "enter":
        this.#update({
          state: "entering",
          animation: resolveAvatarAnimation("entering", this.#availableAnimations),
          currentCommand: command,
          anchorX: command.from === "left" ? horizontalInset : viewportWidth() - horizontalInset,
          facing: command.from === "left" ? "right" : "left",
          pointing: null,
          visible: true,
        });
        return;
      case "exit":
        this.#update({
          state: "exiting",
          animation: resolveAvatarAnimation("exiting", this.#availableAnimations),
          currentCommand: command,
          facing: command.to,
          pointing: null,
        });
        return;
      case "walkTo":
        this.#applyTargetCommand(command, { animation: "walk", pointing: null, anchor: true });
        return;
      case "lookAt":
        this.#applyTargetCommand(command, { pointing: null, anchor: false });
        return;
      case "pointAt":
        this.#applyTargetCommand(command, { animation: "point", point: true, anchor: false });
        return;
    }
  }

  #applyTargetCommand(
    command: Extract<AvatarCommand, { action: "walkTo" | "lookAt" | "pointAt" }>,
    options: { animation?: AllowedAnimation; pointing?: null; point?: true; anchor: boolean },
  ) {
    const bounds = this.#registry.resolve(command.target);
    if (!bounds) {
      return;
    }

    const direction = bounds.centerX < this.#snapshot.anchorX ? "left" : "right";
    this.#update({
      currentCommand: command,
      target: command.target,
      ...(options.anchor ? { anchorX: clampAnchor(bounds.centerX) } : {}),
      ...(options.animation && this.#availableAnimations.has(options.animation)
        ? { animation: options.animation }
        : {}),
      facing: direction,
      pointing: options.point ? direction : options.pointing ?? null,
    });
  }

  #update(update: Partial<AvatarSnapshot>) {
    this.#replace({ ...this.#snapshot, ...update });
  }

  #replace(snapshot: AvatarSnapshot) {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
