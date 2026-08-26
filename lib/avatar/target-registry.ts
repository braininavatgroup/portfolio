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

export type AvatarObstacleId =
  | "portfolio:header"
  | "avatar:director-console";

export type AvatarStageMap = {
  viewport: { width: number; height: number };
  targets: Array<{ target: AvatarTargetId; bounds: AvatarTargetBounds }>;
  obstacles: Array<{ obstacle: AvatarObstacleId; bounds: AvatarTargetBounds }>;
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
  #obstacles = new Map<AvatarObstacleId, TargetElement>();

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

    return this.resolveElement(element);
  }

  resolveAll(): Array<{ target: AvatarTargetId; bounds: AvatarTargetBounds }> {
    return Array.from(this.#targets.keys()).flatMap((target) => {
      const bounds = this.resolve(target);
      return bounds ? [{ target, bounds }] : [];
    });
  }

  registerObstacle(obstacle: AvatarObstacleId, element: TargetElement) {
    this.#obstacles.set(obstacle, element);
  }

  unregisterObstacle(obstacle: AvatarObstacleId, element: TargetElement) {
    if (this.#obstacles.get(obstacle) === element) {
      this.#obstacles.delete(obstacle);
    }
  }

  resolveObstacles(): Array<{
    obstacle: AvatarObstacleId;
    bounds: AvatarTargetBounds;
  }> {
    return Array.from(this.#obstacles.keys()).flatMap((obstacle) => {
      const element = this.#obstacles.get(obstacle);
      if (!element) {
        return [];
      }

      const bounds = this.resolveElement(element);
      return [{ obstacle, bounds }];
    });
  }

  resolveStageMap(): AvatarStageMap {
    return {
      viewport: viewportSize(),
      targets: this.resolveAll(),
      obstacles: this.resolveObstacles(),
    };
  }

  private resolveElement(element: TargetElement): AvatarTargetBounds {
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
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.bottom > 0 &&
        bounds.right > 0 &&
        bounds.left < viewport.width &&
        bounds.top < viewport.height,
    };
  }
}
