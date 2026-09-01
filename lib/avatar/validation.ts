import { portfolioData } from "../portfolio-data";
import {
  allowedAvatarAnimations,
  allowedAvatarStates,
  avatarRouteIds,
  avatarConfidenceLevels,
  avatarEnergyLevels,
  avatarMischiefLevels,
  avatarPerformanceIntents,
  avatarWarmthLevels,
  type AllowedAnimation,
  type AvatarCommand,
  type AvatarRouteId,
  type AvatarPerformanceIntent,
  type AvatarState,
  type AvatarTargetId,
  type AvatarTone,
  type PortfolioResponseEffects,
} from "./contracts";

const baseTargets = ["hero", "portfolio:chat", "portfolio:index"] as const;

export const allowedAvatarTargets = [
  ...baseTargets,
  ...portfolioData.projects.map(({ slug }) => `project:${slug}` as const),
] as const satisfies readonly AvatarTargetId[];

const avatarStateSet = new Set<string>(allowedAvatarStates);
const animationSet = new Set<string>(allowedAvatarAnimations);
const targetSet = new Set<string>(allowedAvatarTargets);
const routeSet = new Set<string>(avatarRouteIds);
const energySet = new Set<string>(avatarEnergyLevels);
const warmthSet = new Set<string>(avatarWarmthLevels);
const confidenceSet = new Set<string>(avatarConfidenceLevels);
const mischiefSet = new Set<string>(avatarMischiefLevels);
const performanceIntentSet = new Set<string>(avatarPerformanceIntents);

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

function isAvatarTarget(value: unknown): value is AvatarTargetId {
  return typeof value === "string" && targetSet.has(value);
}

function isAvatarRoute(value: unknown): value is AvatarRouteId {
  return typeof value === "string" && routeSet.has(value);
}

function isPerformanceIntent(value: unknown): value is AvatarPerformanceIntent {
  return typeof value === "string" && performanceIntentSet.has(value);
}

function parseAvatarTone(
  value: unknown,
  issues: string[],
  issuePrefix = "avatarTone",
): AvatarTone | null {
  if (!isObject(value)) {
    issues.push(`${issuePrefix} must be an object`);
    return null;
  }
  if (
    !exactKeys(
      value,
      ["energy", "warmth", "confidence", "mischief"],
      issuePrefix,
      issues,
    )
  ) {
    return null;
  }
  if (typeof value.energy !== "string" || !energySet.has(value.energy)) {
    issues.push(`${issuePrefix}.energy must be an allowed value`);
    return null;
  }
  if (typeof value.warmth !== "string" || !warmthSet.has(value.warmth)) {
    issues.push(`${issuePrefix}.warmth must be an allowed value`);
    return null;
  }
  if (
    typeof value.confidence !== "string" ||
    !confidenceSet.has(value.confidence)
  ) {
    issues.push(`${issuePrefix}.confidence must be an allowed value`);
    return null;
  }
  if (typeof value.mischief !== "string" || !mischiefSet.has(value.mischief)) {
    issues.push(`${issuePrefix}.mischief must be an allowed value`);
    return null;
  }
  return {
    energy: value.energy as AvatarTone["energy"],
    warmth: value.warmth as AvatarTone["warmth"],
    confidence: value.confidence as AvatarTone["confidence"],
    mischief: value.mischief as AvatarTone["mischief"],
  };
}

function clampWait(value: number) {
  return Math.max(0, Math.min(maxWaitMs, value));
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
    case "setTone": {
      if (
        !exactKeys(
          value,
          ["action", "tone"],
          `avatarSequence[${index}]`,
          issues,
        )
      ) {
        return null;
      }
      const tone = parseAvatarTone(
        value.tone,
        issues,
        `avatarSequence[${index}].tone`,
      );
      return tone ? { action: "setTone", tone } : null;
    }
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
    case "swimTo":
      if (
        !exactKeys(value, ["action", "target"], `avatarSequence[${index}]`, issues) ||
        !isAvatarTarget(value.target)
      ) {
        issues.push(`avatarSequence[${index}].target must be a known target`);
        return null;
      }
      return { action: "swimTo", target: value.target };
    case "swimRoute":
      if (
        !exactKeys(value, ["action", "route"], `avatarSequence[${index}]`, issues) ||
        !isAvatarRoute(value.route)
      ) {
        issues.push(`avatarSequence[${index}].route must be an allowed route`);
        return null;
      }
      return { action: "swimRoute", route: value.route };
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
    avatarSequence: [],
    issues,
  };

  if (!isObject(value)) {
    issues.push("effects must be an object");
    return parsed;
  }

  exactKeys(
    value,
    ["avatarSequence", "avatarIntent", "avatarTone"],
    "effects",
    issues,
  );

  if ("avatarIntent" in value) {
    if (isPerformanceIntent(value.avatarIntent)) {
      parsed.avatarIntent = value.avatarIntent;
    } else {
      issues.push("avatarIntent must be an allowed value");
    }
  }

  if ("avatarTone" in value) {
    const tone = parseAvatarTone(value.avatarTone, issues);
    if (tone) parsed.avatarTone = tone;
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
