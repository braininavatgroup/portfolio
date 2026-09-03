import type { AvatarAction, PortfolioResponseEffects } from "./contracts";

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

  if (value.avatarAction === "swim_lap") {
    parsed.avatarAction = value.avatarAction satisfies AvatarAction;
    return parsed;
  }

  parsed.issues.push("avatarAction must be swim_lap or null");
  return parsed;
}
