import { portfolioWhatNodes } from "../portfolio-world";
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
  type EdgeDirection,
  type PortfolioResponseEffects,
} from "./contracts";

const baseTargets = ["portfolio:chat", "portfolio:index"] as const;

export const allowedAvatarTargets = [
  ...baseTargets,
  ...portfolioWhatNodes.map(({ id }) => `portfolio:record:${id}` as const),
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

function isEdgeDirection(value: unknown): value is EdgeDirection {
  return value === "left" || value === "right";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

type FieldParser = (raw: unknown, issues: string[], prefix: string) => unknown;

/**
 * Every command in the grammar is `{ action, <one field> }`, so the only thing
 * that varies between them is which field to read, what it must satisfy, and
 * how to say so. This was eleven near-identical switch arms, and they had
 * already drifted: setState and play suppressed the field-level issue when the
 * key check was what failed, while the other seven pushed both.
 */
function guardedField(
  accepts: (value: unknown) => boolean,
  requirement: string,
  coerce: (value: unknown) => unknown = (value) => value,
): FieldParser {
  return (raw, issues, prefix) => {
    if (!accepts(raw)) {
      issues.push(`${prefix} ${requirement}`);
      return null;
    }
    return coerce(raw);
  };
}

/**
 * `satisfies Record<AvatarCommand["action"], …>` is the load-bearing part.
 * The union in contracts.ts, the controller's switch and this parser have to
 * agree, and nothing used to make them: adding a twelfth action meant a
 * command the model could be told to emit and the client would silently drop
 * at the network boundary. Now it is a compile error here until the grammar
 * learns the new action.
 */
const commandGrammar = {
  setState: { field: "state", parse: guardedField(isAvatarState, "must be an allowed state") },
  setTone: { field: "tone", parse: parseAvatarTone as FieldParser },
  play: { field: "animation", parse: guardedField(isAllowedAnimation, "must be an allowed animation") },
  wait: {
    field: "durationMs",
    parse: guardedField(isFiniteNumber, "must be a finite number", (value) =>
      clampWait(value as number),
    ),
  },
  enter: { field: "from", parse: guardedField(isEdgeDirection, "must be left or right") },
  exit: { field: "to", parse: guardedField(isEdgeDirection, "must be left or right") },
  walkTo: { field: "target", parse: guardedField(isAvatarTarget, "must be a known target") },
  swimTo: { field: "target", parse: guardedField(isAvatarTarget, "must be a known target") },
  swimRoute: { field: "route", parse: guardedField(isAvatarRoute, "must be an allowed route") },
  lookAt: { field: "target", parse: guardedField(isAvatarTarget, "must be a known target") },
  pointAt: { field: "target", parse: guardedField(isAvatarTarget, "must be a known target") },
} as const satisfies Record<
  AvatarCommand["action"],
  { field: string; parse: FieldParser }
>;

export const avatarCommandActions = Object.keys(
  commandGrammar,
) as readonly AvatarCommand["action"][];

function parseAvatarCommand(
  value: unknown,
  issues: string[],
  index: number,
): AvatarCommand | null {
  const prefix = `avatarSequence[${index}]`;
  if (!isObject(value)) {
    issues.push(`${prefix} must be an object`);
    return null;
  }
  const { action } = value;
  if (typeof action !== "string") {
    issues.push(`${prefix} must include a string action`);
    return null;
  }
  // hasOwn, not `in`: `action: "toString"` would otherwise reach the prototype.
  if (!Object.hasOwn(commandGrammar, action)) {
    issues.push(`${prefix}.action is not supported`);
    return null;
  }
  const { field, parse } = commandGrammar[action as AvatarCommand["action"]];
  if (!exactKeys(value, ["action", field], prefix, issues)) return null;
  const parsed = parse(value[field], issues, `${prefix}.${field}`);
  if (parsed === null) return null;
  return { action, [field]: parsed } as AvatarCommand;
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
