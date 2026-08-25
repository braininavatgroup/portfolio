import type { AvatarTargetId } from "./contracts";

type TargetElement = Pick<HTMLElement, "getBoundingClientRect">;

export type AvatarTargetBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  inViewport: boolean;
};

function viewportSize() {
  const scope = globalThis as typeof globalThis & {
    innerWidth?: number;
    innerHeight?: number;
  };

  return {
    width: typeof scope.innerWidth === "number" ? scope.innerWidth : Number.POSITIVE_INFINITY,
    height:
      typeof scope.innerHeight === "number"
        ? scope.innerHeight
        : Number.POSITIVE_INFINITY,
  };
}

export class AvatarTargetRegistry {
  #targets = new Map<AvatarTargetId, TargetElement>();

  register(target: AvatarTargetId, element: TargetElement) {
    this.#targets.set(target, element);
  }

  unregister(target: AvatarTargetId, element: TargetElement) {
    if (this.#targets.get(target) === element) {
      this.#targets.delete(target);
    }
  }

  resolve(target: AvatarTargetId): AvatarTargetBounds | undefined {
    const element = this.#targets.get(target);
    if (!element) {
      return undefined;
    }

    const bounds = element.getBoundingClientRect();
    const viewport = viewportSize();

    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height,
      centerX: bounds.left + bounds.width / 2,
      centerY: bounds.top + bounds.height / 2,
      inViewport:
        bounds.bottom > 0 &&
        bounds.right > 0 &&
        bounds.left < viewport.width &&
        bounds.top < viewport.height,
    };
  }
}
