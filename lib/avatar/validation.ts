import { portfolioData } from "../portfolio-data";
import {
  allowedAvatarAnimations,
  allowedAvatarStates,
  allowedTabs,
  type AllowedAnimation,
  type AllowedTab,
  type AvatarCommand,
  type AvatarState,
  type AvatarTargetId,
  type PortfolioResponseEffects,
  type ProjectAvatarTargetId,
  type SiteAction,
} from "./contracts";

const baseTargets = ["hero", "portfolio:chat", "portfolio:index"] as const;

export const allowedAvatarTargets = [
  ...baseTargets,
  ...portfolioData.projects.map(({ slug }) => `project:${slug}` as const),
] as const satisfies readonly AvatarTargetId[];

const avatarStateSet = new Set<string>(allowedAvatarStates);
const animationSet = new Set<string>(allowedAvatarAnimations);
const tabSet = new Set<string>(allowedTabs);
const targetSet = new Set<string>(allowedAvatarTargets);
const projectTargetSet = new Set<string>(
  portfolioData.projects.map(({ slug }) => `project:${slug}`),
);

const maxWaitMs = 10_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  issuePrefix: string,
  issues: string[],
) {
  const allowedKeys = new Set(keys);
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    issues.push(`${issuePrefix} has unknown key: ${unknownKeys[0]}`);
    return false;
  }
  return true;
}

function isAvatarState(value: unknown): value is AvatarState {
  return typeof value === "string" && avatarStateSet.has(value);
}

function isAllowedAnimation(value: unknown): value is AllowedAnimation {
  return typeof value === "string" && animationSet.has(value);
}

function isAllowedTab(value: unknown): value is AllowedTab {
  return typeof value === "string" && tabSet.has(value);
}

function isAvatarTarget(value: unknown): value is AvatarTargetId {
  return typeof value === "string" && targetSet.has(value);
}

function isProjectTarget(value: unknown): value is ProjectAvatarTargetId {
  return typeof value === "string" && projectTargetSet.has(value);
}

function clampWait(value: number) {
  return Math.max(0, Math.min(maxWaitMs, value));
}

function parseSiteAction(value: unknown, issues: string[], index: number): SiteAction | null {
  if (!isObject(value)) {
    issues.push(`siteActions[${index}] must be an object`);
    return null;
  }

  if (typeof value.type !== "string") {
    issues.push(`siteActions[${index}] must include a string type`);
    return null;
  }

  switch (value.type) {
    case "openProject":
      if (
        !exactKeys(value, ["type", "target"], `siteActions[${index}]`, issues) ||
        !isProjectTarget(value.target)
      ) {
        if (!isProjectTarget(value.target)) {
          issues.push(`siteActions[${index}].target must be a known project target`);
        }
        return null;
      }
      return { type: "openProject", target: value.target };
    case "closeProject":
      if (!exactKeys(value, ["type"], `siteActions[${index}]`, issues)) {
        return null;
      }
      return { type: "closeProject" };
    case "activateTab":
      if (
        !exactKeys(value, ["type", "tab"], `siteActions[${index}]`, issues) ||
        !isAllowedTab(value.tab)
      ) {
        if (!isAllowedTab(value.tab)) {
          issues.push(`siteActions[${index}].tab must be an allowed tab`);
        }
        return null;
      }
      return { type: "activateTab", tab: value.tab };
    case "scrollTo":
      if (
        !exactKeys(value, ["type", "target"], `siteActions[${index}]`, issues) ||
        !isAvatarTarget(value.target)
      ) {
        if (!isAvatarTarget(value.target)) {
          issues.push(`siteActions[${index}].target must be a known target`);
        }
        return null;
      }
      return { type: "scrollTo", target: value.target };
    case "spotlight":
      if (
        !exactKeys(value, ["type", "target"], `siteActions[${index}]`, issues) ||
        !isAvatarTarget(value.target)
      ) {
        if (!isAvatarTarget(value.target)) {
          issues.push(`siteActions[${index}].target must be a known target`);
        }
        return null;
      }
      return { type: "spotlight", target: value.target };
    case "clearSpotlight":
      if (!exactKeys(value, ["type"], `siteActions[${index}]`, issues)) {
        return null;
      }
      return { type: "clearSpotlight" };
    default:
      issues.push(`siteActions[${index}].type is not supported`);
      return null;
  }
}

function parseAvatarCommand(
  value: unknown,
  issues: string[],
  index: number,
): AvatarCommand | null {
  if (!isObject(value)) {
    issues.push(`avatarSequence[${index}] must be an object`);
    return null;
  }

  if (typeof value.action !== "string") {
    issues.push(`avatarSequence[${index}] must include a string action`);
    return null;
  }

  switch (value.action) {
    case "setState":
      if (
        !exactKeys(value, ["action", "state"], `avatarSequence[${index}]`, issues) ||
        !isAvatarState(value.state)
      ) {
        if (!isAvatarState(value.state)) {
          issues.push(`avatarSequence[${index}].state must be an allowed state`);
        }
        return null;
      }
      return { action: "setState", state: value.state };
    case "play":
      if (
        !exactKeys(
          value,
          ["action", "animation"],
          `avatarSequence[${index}]`,
          issues,
        ) ||
        !isAllowedAnimation(value.animation)
      ) {
        if (!isAllowedAnimation(value.animation)) {
          issues.push(
            `avatarSequence[${index}].animation must be an allowed animation`,
          );
        }
        return null;
      }
      return { action: "play", animation: value.animation };
    case "wait":
      if (!exactKeys(value, ["action", "durationMs"], `avatarSequence[${index}]`, issues)) {
        return null;
      }
      if (typeof value.durationMs !== "number" || !Number.isFinite(value.durationMs)) {
        issues.push(`avatarSequence[${index}].durationMs must be a finite number`);
        return null;
      }
      return { action: "wait", durationMs: clampWait(value.durationMs) };
    case "enter":
      if (
        !exactKeys(value, ["action", "from"], `avatarSequence[${index}]`, issues) ||
        (value.from !== "left" && value.from !== "right")
      ) {
        issues.push(`avatarSequence[${index}].from must be left or right`);
        return null;
      }
      return { action: "enter", from: value.from };
    case "exit":
      if (
        !exactKeys(value, ["action", "to"], `avatarSequence[${index}]`, issues) ||
        (value.to !== "left" && value.to !== "right")
      ) {
        issues.push(`avatarSequence[${index}].to must be left or right`);
        return null;
      }
      return { action: "exit", to: value.to };
    case "walkTo":
      if (
        !exactKeys(value, ["action", "target"], `avatarSequence[${index}]`, issues) ||
        !isAvatarTarget(value.target)
      ) {
        issues.push(`avatarSequence[${index}].target must be a known target`);
        return null;
      }
      return { action: "walkTo", target: value.target };
    case "lookAt":
      if (
        !exactKeys(value, ["action", "target"], `avatarSequence[${index}]`, issues) ||
        !isAvatarTarget(value.target)
      ) {
        issues.push(`avatarSequence[${index}].target must be a known target`);
        return null;
      }
      return { action: "lookAt", target: value.target };
    case "pointAt":
      if (
        !exactKeys(value, ["action", "target"], `avatarSequence[${index}]`, issues) ||
        !isAvatarTarget(value.target)
      ) {
        issues.push(`avatarSequence[${index}].target must be a known target`);
        return null;
      }
      return { action: "pointAt", target: value.target };
    default:
      issues.push(`avatarSequence[${index}].action is not supported`);
      return null;
  }
}

export function parsePortfolioResponseEffects(value: unknown): PortfolioResponseEffects {
  const issues: string[] = [];
  const parsed: PortfolioResponseEffects = {
    siteActions: [],
    avatarSequence: [],
    issues,
  };

  if (!isObject(value)) {
    issues.push("effects must be an object");
    return parsed;
  }

  exactKeys(value, ["siteActions", "avatarSequence"], "effects", issues);

  if ("siteActions" in value) {
    if (Array.isArray(value.siteActions)) {
      for (const [index, item] of value.siteActions.entries()) {
        const siteAction = parseSiteAction(item, issues, index);
        if (siteAction) {
          parsed.siteActions.push(siteAction);
        }
      }
    } else {
      issues.push("siteActions must be an array when provided");
    }
  }

  if ("avatarSequence" in value) {
    if (Array.isArray(value.avatarSequence)) {
      for (const [index, item] of value.avatarSequence.entries()) {
        const command = parseAvatarCommand(item, issues, index);
        if (command) {
          parsed.avatarSequence.push(command);
        }
      }
    } else {
      issues.push("avatarSequence must be an array when provided");
    }
  }

  return parsed;
}
