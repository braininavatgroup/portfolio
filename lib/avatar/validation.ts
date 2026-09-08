import {
  avatarActions,
  type AvatarAction,
  type PortfolioResponseEffects,
} from "./contracts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePortfolioResponseEffects(
  value: unknown,
): PortfolioResponseEffects {
  const parsed: PortfolioResponseEffects = {
    avatarAction: null,
    issues: [],
  };

  if (!isObject(value)) {
    parsed.issues.push("effects must be an object");
    return parsed;
  }

  for (const key of Object.keys(value)) {
    if (key !== "avatarAction") {
      parsed.issues.push(`effects has unknown key: ${key}`);
    }
  }

  if (!("avatarAction" in value) || value.avatarAction === null) {
    return parsed;
  }

  if ((avatarActions as readonly unknown[]).includes(value.avatarAction)) {
    parsed.avatarAction = value.avatarAction as AvatarAction;
    return parsed;
  }

  parsed.issues.push(`avatarAction must be ${avatarActions.join(", ")}, or null`);
  return parsed;
}
