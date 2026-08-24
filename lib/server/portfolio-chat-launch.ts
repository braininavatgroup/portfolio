export type PortfolioChatRuntimeConfig = {
  liveEnabled: boolean;
  previewEnabled: boolean;
  turnstileRequired: boolean;
  previewAccessCode?: string;
  sessionSecret?: string;
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
    | "preview_required"
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
  now?: () => number;
  randomId?: () => string;
};

type PreviewHandlerOptions = Pick<
  LaunchGuardOptions,
  "config" | "now" | "randomId"
> & { previewRateLimiter?: PortfolioChatRateLimiter };

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

const previewCookieName = "__Host-portfolio_chat_preview";
const previewSessionDurationSeconds = 8 * 60 * 60;
const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
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

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let mismatch = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

async function equalSecrets(left: string, right: string) {
  return equalBytes(await digest(left), await digest(right));
}

type PreviewSession = { id: string; expiresAt: number };

async function signSession(session: PreviewSession, secret: string) {
  const payload = base64Url(encoder.encode(JSON.stringify(session)));
  const signature = base64Url(await hmac(secret, payload));
  return `${payload}.${signature}`;
}

async function readSession(
  request: Request,
  secret: string,
  now: number,
): Promise<PreviewSession | undefined> {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${previewCookieName}=`));
  const token = cookie?.slice(previewCookieName.length + 1);
  if (!token) return undefined;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return undefined;

  try {
    const expected = await hmac(secret, payload);
    if (!equalBytes(expected, fromBase64Url(signature))) return undefined;
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload)),
    );
    if (!parsed || typeof parsed !== "object") return undefined;
    const id = Reflect.get(parsed, "id");
    const expiresAt = Reflect.get(parsed, "expiresAt");
    if (
      typeof id !== "string" ||
      id.length < 1 ||
      typeof expiresAt !== "number" ||
      expiresAt <= now
    ) {
      return undefined;
    }
    return { id, expiresAt };
  } catch {
    return undefined;
  }
}

function isConfigured(
  config: PortfolioChatRuntimeConfig,
  rateLimiter: PortfolioChatRateLimiter | undefined,
  verifyTurnstile: LaunchGuardOptions["verifyTurnstile"],
) {
  return (
    config.previewEnabled &&
    (config.previewAccessCode?.length ?? 0) >= 24 &&
    (config.sessionSecret?.length ?? 0) >= 32 &&
    Boolean(rateLimiter) &&
    (!config.turnstileRequired ||
      (Boolean(config.turnstileSecret) && Boolean(verifyTurnstile)))
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

export function createPortfolioChatPreviewHandler({
  config,
  now = Date.now,
  randomId = () => crypto.randomUUID(),
  previewRateLimiter,
}: PreviewHandlerOptions) {
  return async function handlePreview(request: Request) {
    if (!config.liveEnabled) {
      return jsonResponse(503, {
        code: "disabled",
        message: "Ask the portfolio is not enabled.",
      });
    }
    const previewAccessCode = config.previewAccessCode;
    const sessionSecret = config.sessionSecret;
    if (
      !config.previewEnabled ||
      (previewAccessCode?.length ?? 0) < 24 ||
      (sessionSecret?.length ?? 0) < 32 ||
      !previewRateLimiter
    ) {
      return jsonResponse(503, {
        code: "misconfigured",
        message: "Ask the portfolio preview is not configured.",
      });
    }
    if (request.method !== "POST") {
      return jsonResponse(405, {
        code: "method_not_allowed",
        message: "That request method is not allowed.",
      });
    }
    const url = new URL(request.url);
    if (request.headers.get("origin") !== url.origin) {
      return jsonResponse(403, {
        code: "preview_denied",
        message: "Preview access must be requested from this site.",
      });
    }
    const connectingIp = request.headers.get("cf-connecting-ip");
    if (!connectingIp) {
      return jsonResponse(503, {
        code: "misconfigured",
        message: "Ask the portfolio preview is not configured.",
      });
    }
    try {
      const actorKey = base64Url(
        await hmac(sessionSecret!, `preview-rate:${connectingIp}`),
      );
      const attempt = await previewRateLimiter.limit({
        key: `preview-access:${actorKey}`,
      });
      if (!attempt.success) {
        return jsonResponse(429, {
          code: "rate_limited",
          message: "Please wait before trying preview access again.",
        });
      }
    } catch {
      return jsonResponse(503, {
        code: "misconfigured",
        message: "Ask the portfolio preview is not configured.",
      });
    }

    let accessCode: unknown;
    try {
      const declaredLength = Number(request.headers.get("content-length") ?? 0);
      if (Number.isFinite(declaredLength) && declaredLength > 4_096) {
        return jsonResponse(413, {
          code: "request_too_large",
          message: "Preview access request is too large.",
        });
      }
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.byteLength > 4_096) {
        return jsonResponse(413, {
          code: "request_too_large",
          message: "Preview access request is too large.",
        });
      }
      const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
      accessCode =
        body && typeof body === "object"
          ? Reflect.get(body, "accessCode")
          : undefined;
    } catch {
      accessCode = undefined;
    }

    if (
      typeof accessCode !== "string" ||
      !(await equalSecrets(accessCode, previewAccessCode!))
    ) {
      return jsonResponse(401, {
        code: "preview_denied",
        message: "That preview code is not valid.",
      });
    }

    const session = await signSession(
      {
        id: randomId(),
        expiresAt: now() + previewSessionDurationSeconds * 1_000,
      },
      sessionSecret!,
    );
    return Response.json(
      { status: "preview_ready" },
      {
        headers: {
          "cache-control": "no-store",
          "set-cookie": `${previewCookieName}=${session}; Path=/; Max-Age=${previewSessionDurationSeconds}; HttpOnly; Secure; SameSite=Strict`,
          "x-content-type-options": "nosniff",
        },
      },
    );
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
  now = Date.now,
  randomId = () => crypto.randomUUID(),
}: LaunchGuardOptions) {
  return async function guard(
    request: Request,
    input: { challengeToken?: string } = {},
  ): Promise<PortfolioChatLaunchResult> {
    if (!config.liveEnabled) {
      return {
        ok: false,
        response: jsonResponse(503, {
          code: "disabled",
          message: "Ask the portfolio is not enabled.",
        }),
      };
    }

    const requestId = randomId();
    const reject = (
      status: number,
      outcome: PortfolioChatLaunchEvent["outcome"],
      message: string,
    ) => {
      record?.({ event: "portfolio_chat_preflight", requestId, outcome });
      return rejection(status, outcome, message);
    };
    if (!config.previewEnabled && !config.turnstileRequired) {
      return { ok: true, requestId };
    }
    if (!isConfigured(config, rateLimiter, verifyTurnstile)) {
      return reject(
        503,
        "misconfigured",
        "Ask the portfolio is not configured.",
      );
    }

    const session = await readSession(request, config.sessionSecret!, now());
    if (!session) {
      return reject(
        401,
        "preview_required",
        "Preview access is required.",
      );
    }

    if (config.turnstileRequired) {
      const challengeToken = input.challengeToken;
      if (
        typeof challengeToken !== "string" ||
        !verifyTurnstile
      ) {
        return reject(403, "challenge_failed", "Verification failed.");
      }
      try {
        const verified = await verifyTurnstile({
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
    }

    try {
      const limited = await rateLimiter!.limit({ key: session.id });
      if (!limited.success) {
        return reject(429, "rate_limited", "Please wait before asking again.");
      }
    } catch {
      return reject(
        503,
        "misconfigured",
        "Ask the portfolio is not configured.",
      );
    }

    const safetyIdentifier = `pc_${base64Url(await digest(session.id))}`;

    return {
      ok: true,
      requestId,
      safetyIdentifier,
    };
  };
}
