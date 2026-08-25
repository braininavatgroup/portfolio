import type {
  AllowedTab,
  AvatarTargetId,
  ProjectAvatarTargetId,
  SiteAction,
} from "./contracts";
import type { AvatarTargetBounds } from "./target-registry";
import { AvatarTargetRegistry } from "./target-registry";

export type SiteActionResult = {
  ok: boolean;
  reason?: "missing_target" | "unsupported";
};

export type SiteActionCallbacks = {
  openProject?: (target: ProjectAvatarTargetId) => void | Promise<void>;
  closeProject?: () => void | Promise<void>;
  activateTab?: (tab: AllowedTab) => void | Promise<void>;
  scrollTo?: (
    target: AvatarTargetId,
    bounds: AvatarTargetBounds,
  ) => void | Promise<void>;
  spotlight?: (target: AvatarTargetId) => void | Promise<void>;
  clearSpotlight?: () => void | Promise<void>;
};

async function invoke(
  callback: (() => void | Promise<void>) | undefined,
): Promise<SiteActionResult> {
  if (!callback) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    await callback();
    return { ok: true };
  } catch {
    return { ok: false, reason: "unsupported" };
  }
}

export class SiteActionExecutor {
  #registry: AvatarTargetRegistry;
  #callbacks: SiteActionCallbacks;

  constructor(registry: AvatarTargetRegistry, callbacks: SiteActionCallbacks) {
    this.#registry = registry;
    this.#callbacks = callbacks;
  }

  async execute(action: SiteAction): Promise<SiteActionResult> {
    switch (action.type) {
      case "openProject":
        return invoke(() => this.#callbacks.openProject?.(action.target));
      case "closeProject":
        return invoke(this.#callbacks.closeProject);
      case "activateTab":
        return invoke(() => this.#callbacks.activateTab?.(action.tab));
      case "scrollTo": {
        const bounds = this.#registry.resolve(action.target);
        if (!bounds) {
          return { ok: false, reason: "missing_target" };
        }
        return invoke(() => this.#callbacks.scrollTo?.(action.target, bounds));
      }
      case "spotlight":
        return invoke(() => this.#callbacks.spotlight?.(action.target));
      case "clearSpotlight":
        return invoke(this.#callbacks.clearSpotlight);
    }
  }
}
