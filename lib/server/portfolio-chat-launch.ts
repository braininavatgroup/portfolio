import { mintSession, verifySession } from "./portfolio-chat-session";

export type PortfolioChatRuntimeConfig = {
  /** Public deployments require a session token issued to the visitor's page. */
  sessionRequired: boolean;
  identifierSecret?: string;
  dailyRequestLimit?: number;
};

export type PortfolioChatRateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type PortfolioChatLaunchEvent = {
  event: "portfolio_chat_preflight";
  requestId: string;
  outcome:
    | "session_required"
    | "rate_limited"
    | "budget_exhausted"
    | "misconfigured";
  /**
   * The thrown error's class, when the outcome came from a caught failure
   * rather than a decision. The class alone, never the message: a message can
   * quote its input, and this path handles the identifier secret.
   */
  cause?: string;
};

type LaunchGuardOptions = {
  config: PortfolioChatRuntimeConfig;
  rateLimiter?: PortfolioChatRateLimiter;
  record?: (event: PortfolioChatLaunchEvent) => void;
  randomId?: () => string;
  now?: () => number;
};

/**
 * A live session for this actor, renewed on every accepted request so an active
 * conversation never expires mid-answer.
 */
export type PortfolioChatSession = {
  expiresAt: number;
  setCookie: string;
};

export type PortfolioChatLaunchResult =
  | {
      ok: true;
      requestId: string;
      safetyIdentifier?: string;
      session?: PortfolioChatSession;
    }
  | { ok: false; response: Response };

function jsonResponse(status: number, body: object) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

/** A usable identifier secret is what lets the actor key be handed to the provider. */
function identifierSecretUsable(config: PortfolioChatRuntimeConfig) {
  return (config.identifierSecret?.length ?? 0) >= 32;
}

/** HMAC when a secret is available, plain SHA-256 otherwise. */
async function digest(secret: string | undefined, value: string) {
  if (secret && secret.length >= 32) return hmac(secret, value);
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

/**
 * The one derivation both the session issuer and the guard use, so a token
 * minted for a visitor verifies for that same visitor and nobody else. The
 * secret exists so the key cannot be reversed to an address.
 */
export async function deriveActorKey(
  secret: string | undefined,
  connectingIp: string,
) {
  return base64Url(await digest(secret, `portfolio-chat:${connectingIp}`));
}

function rejection(
  status: number,
  code: PortfolioChatLaunchEvent["outcome"],
  message: string,
) {
  return {
    ok: false as const,
    response: jsonResponse(status, { code, message }),
  };
}

export function createPortfolioChatLaunchGuard({
  config,
  rateLimiter,
  record,
  randomId = () => crypto.randomUUID(),
  now = () => Date.now(),
}: LaunchGuardOptions) {
  return async function guard(
    request: Request,
  ): Promise<PortfolioChatLaunchResult> {
    const requestId = randomId();
    const reject = (
      status: number,
      outcome: PortfolioChatLaunchEvent["outcome"],
      message: string,
    ) => {
      record?.({ event: "portfolio_chat_preflight", requestId, outcome });
      return rejection(status, outcome, message);
    };

    const connectingIp = request.headers.get("cf-connecting-ip");

    // The actor key is derived once: the session cookie binds to it, the
    // throttle keys on it, and the provider receives it as a safety
    // identifier. The secret exists so none of those can be reversed to an IP.
    // The throttle key never leaves this worker, so it falls back to a plain
    // digest rather than disabling the limiter.
    let actorKey: string | undefined;
    if (connectingIp) {
      try {
        actorKey = await deriveActorKey(config.identifierSecret, connectingIp);
      } catch {
        return reject(
          503,
          "misconfigured",
          "Ask the portfolio is not configured.",
        );
      }
    }

    let session: PortfolioChatSession | undefined;

    // The session token and the per-IP throttle are independent controls. The
    // flag used to return early for the whole guard, which skipped the throttle
    // and the identifier derivation too — so wherever it was off, the endpoint
    // had no per-actor limit at all. It now gates only the session.
    if (config.sessionRequired) {
      // Public mode fails closed on any missing control: an exposed endpoint
      // without a limiter or an identifier secret is a misconfiguration, not
      // something to serve degraded.
      if (
        !identifierSecretUsable(config) ||
        !rateLimiter ||
        !connectingIp ||
        !actorKey
      ) {
        return reject(
          503,
          "misconfigured",
          "Ask the portfolio is not configured.",
        );
      }

      const live = await verifySession({
        cookieHeader: request.headers.get("cookie"),
        secret: config.identifierSecret!,
        actorKey,
        now: now(),
      }).catch(() => null);
      if (!live) {
        return reject(403, "session_required", "Reload the page to ask again.");
      }

      // Renewed on every accepted request, so a long conversation never has to
      // stop and re-establish itself mid-answer.
      session = await mintSession({
        secret: config.identifierSecret!,
        actorKey,
        now: now(),
      });
    }

    if (!rateLimiter) {
      return { ok: true, requestId, ...(session ? { session } : {}) };
    }

    if (!connectingIp || !actorKey) {
      return reject(
        503,
        "misconfigured",
        "Ask the portfolio is not configured.",
      );
    }

    try {
      const limited = await rateLimiter.limit({
        key: `portfolio-chat:${actorKey}`,
      });
      if (!limited.success) {
        return reject(429, "rate_limited", "Please wait before asking again.");
      }
      return {
        ok: true,
        requestId,
        ...(session ? { session } : {}),
        ...(identifierSecretUsable(config)
          ? { safetyIdentifier: `pc_${actorKey}` }
          : {}),
      };
    } catch {
      return reject(
        503,
        "misconfigured",
        "Ask the portfolio is not configured.",
      );
    }
  };
}
