export type PortfolioChatRuntimeConfig = {
  turnstileRequired: boolean;
  identifierSecret?: string;
  turnstileSecret?: string;
  dailyRequestLimit?: number;
};

export type PortfolioChatRateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type PortfolioChatLaunchEvent = {
  event: "portfolio_chat_preflight";
  requestId: string;
  outcome:
    | "challenge_failed"
    | "rate_limited"
    | "budget_exhausted"
    | "misconfigured";
};

type LaunchGuardOptions = {
  config: PortfolioChatRuntimeConfig;
  rateLimiter?: PortfolioChatRateLimiter;
  verifyTurnstile?: (input: {
    token: string;
    secret: string;
    expectedAction: string;
    expectedHostname: string;
  }) => Promise<boolean>;
  record?: (event: PortfolioChatLaunchEvent) => void;
  randomId?: () => string;
};

export type PortfolioChatLaunchResult =
  | {
      ok: true;
      requestId: string;
      safetyIdentifier?: string;
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

function publicControlsConfigured(
  config: PortfolioChatRuntimeConfig,
  rateLimiter: PortfolioChatRateLimiter | undefined,
  verifyTurnstile: LaunchGuardOptions["verifyTurnstile"],
) {
  return (
    (config.identifierSecret?.length ?? 0) >= 32 &&
    Boolean(config.turnstileSecret) &&
    Boolean(rateLimiter) &&
    Boolean(verifyTurnstile)
  );
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

export function createTurnstileVerifier(
  fetchImplementation: typeof fetch = fetch,
) {
  return async function verifyTurnstile({
    token,
    secret,
    expectedAction,
    expectedHostname,
  }: {
    token: string;
    secret: string;
    expectedAction: string;
    expectedHostname: string;
  }) {
    try {
      const response = await fetchImplementation(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ response: token, secret }),
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        return false;
      }
      const result: unknown = await response.json();
      return (
        result !== null &&
        typeof result === "object" &&
        Reflect.get(result, "success") === true &&
        Reflect.get(result, "action") === expectedAction &&
        Reflect.get(result, "hostname") === expectedHostname
      );
    } catch {
      return false;
    }
  };
}

export function createPortfolioChatLaunchGuard({
  config,
  rateLimiter,
  verifyTurnstile,
  record,
  randomId = () => crypto.randomUUID(),
}: LaunchGuardOptions) {
  return async function guard(
    request: Request,
    input: { challengeToken?: string } = {},
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

    if (!config.turnstileRequired) {
      return { ok: true, requestId };
    }

    if (!publicControlsConfigured(config, rateLimiter, verifyTurnstile)) {
      return reject(
        503,
        "misconfigured",
        "Ask the portfolio is not configured.",
      );
    }

    const connectingIp = request.headers.get("cf-connecting-ip");
    if (!connectingIp) {
      return reject(
        503,
        "misconfigured",
        "Ask the portfolio is not configured.",
      );
    }

    const challengeToken = input.challengeToken;
    if (typeof challengeToken !== "string") {
      return reject(403, "challenge_failed", "Verification failed.");
    }
    try {
      const verified = await verifyTurnstile!({
        token: challengeToken,
        secret: config.turnstileSecret!,
        expectedAction: "portfolio_chat",
        expectedHostname: new URL(request.url).hostname,
      });
      if (!verified) {
        return reject(403, "challenge_failed", "Verification failed.");
      }
    } catch {
      return reject(403, "challenge_failed", "Verification failed.");
    }

    try {
      const actorKey = base64Url(
        await hmac(config.identifierSecret!, `portfolio-chat:${connectingIp}`),
      );
      const limited = await rateLimiter!.limit({
        key: `portfolio-chat:${actorKey}`,
      });
      if (!limited.success) {
        return reject(429, "rate_limited", "Please wait before asking again.");
      }
      return {
        ok: true,
        requestId,
        safetyIdentifier: `pc_${actorKey}`,
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
