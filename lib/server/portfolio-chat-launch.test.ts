import { describe, expect, it, vi } from "vitest";
import {
  createPortfolioChatLaunchGuard,
  createPortfolioChatPreviewHandler,
  createTurnstileVerifier,
} from "./portfolio-chat-launch";

const livePreviewConfig = {
  liveEnabled: true,
  previewEnabled: true,
  turnstileRequired: false,
  previewAccessCode: "preview-access-code-with-32-chars",
  sessionSecret: "session-signing-secret-with-32-chars",
  dailyRequestLimit: 12,
};

async function previewCookie(now = () => Date.UTC(2026, 7, 24, 3, 0, 0)) {
  const preview = createPortfolioChatPreviewHandler({
    config: livePreviewConfig,
    now,
    randomId: () => "session-123",
    previewRateLimiter: {
      limit: async () => ({ success: true }),
    },
  });
  const response = await preview(
    new Request("https://portfolio.test/api/portfolio-chat/preview", {
      method: "POST",
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "content-type": "application/json",
        origin: "https://portfolio.test",
      },
      body: JSON.stringify({
        accessCode: "preview-access-code-with-32-chars",
      }),
    }),
  );
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

describe("portfolio chat launch guard", () => {
  it("leaves every protected dependency untouched while the live gate is false", async () => {
    const rateLimit = vi.fn();
    const verifyTurnstile = vi.fn();
    const record = vi.fn();
    const guard = createPortfolioChatLaunchGuard({
      config: {
        liveEnabled: false,
        previewEnabled: false,
        turnstileRequired: false,
      },
      rateLimiter: { limit: rateLimit },
      verifyTurnstile,
      record,
    });

    const result = await guard(
      new Request("https://portfolio.test/api/portfolio-chat", {
        method: "POST",
        body: JSON.stringify({ question: "How does the work operate?" }),
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Disabled launch guard must reject the request.");
    expect(result.response.status).toBe(503);
    expect(await result.response.json()).toEqual({
      code: "disabled",
      message: "Ask the portfolio is not enabled.",
    });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("exchanges the access code for a signed HttpOnly session used by the limiter", async () => {
    const now = () => Date.UTC(2026, 7, 24, 3, 0, 0);
    const preview = createPortfolioChatPreviewHandler({
      config: livePreviewConfig,
      now,
      randomId: () => "session-123",
      previewRateLimiter: {
        limit: async () => ({ success: true }),
      },
    });
    const previewResponse = await preview(
      new Request("https://portfolio.test/api/portfolio-chat/preview", {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.10",
          "content-type": "application/json",
          origin: "https://portfolio.test",
        },
        body: JSON.stringify({
          accessCode: "preview-access-code-with-32-chars",
        }),
      }),
    );

    expect(previewResponse.status).toBe(200);
    expect(await previewResponse.json()).toEqual({ status: "preview_ready" });
    const cookie = previewResponse.headers.get("set-cookie");
    expect(cookie).toContain("__Host-portfolio_chat_preview=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");

    const rateLimit = vi.fn(async () => ({ success: true }));
    const guard = createPortfolioChatLaunchGuard({
      config: livePreviewConfig,
      now,
      randomId: () => "request-456",
      rateLimiter: { limit: rateLimit },
    });
    const result = await guard(
      new Request("https://portfolio.test/api/portfolio-chat", {
        method: "POST",
        headers: { cookie: cookie?.split(";")[0] ?? "" },
        body: JSON.stringify({ question: "How does pitching work?" }),
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Signed preview session must pass the guard.");
    expect(result.requestId).toBe("request-456");
    expect(result.safetyIdentifier).toMatch(/^pc_[A-Za-z0-9_-]{32,}$/);
    expect(rateLimit).toHaveBeenCalledWith({ key: "session-123" });
  });

  it("fails closed on missing activation configuration before touching a capability", async () => {
    const rateLimit = vi.fn();
    const record = vi.fn();
    const guard = createPortfolioChatLaunchGuard({
      config: {
        liveEnabled: true,
        previewEnabled: true,
        turnstileRequired: false,
      },
      rateLimiter: { limit: rateLimit },
      randomId: () => "request-misconfigured",
      record,
    });

    const result = await guard(
      new Request("https://portfolio.test/api/portfolio-chat", {
        method: "POST",
        body: JSON.stringify({ question: "private question contents" }),
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Missing activation values must reject.");
    expect(result.response.status).toBe(503);
    expect(await result.response.json()).toEqual({
      code: "misconfigured",
      message: "Ask the portfolio is not configured.",
    });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith({
      event: "portfolio_chat_preflight",
      requestId: "request-misconfigured",
      outcome: "misconfigured",
    });
    expect(JSON.stringify(record.mock.calls)).not.toContain("private question");
  });

  it("rejects an expired preview session before rate limiting", async () => {
    const cookie = await previewCookie(() => Date.UTC(2026, 7, 24, 3, 0, 0));
    const rateLimit = vi.fn();
    const guard = createPortfolioChatLaunchGuard({
      config: livePreviewConfig,
      now: () => Date.UTC(2026, 7, 24, 12, 0, 1),
      rateLimiter: { limit: rateLimit },
    });

    const result = await guard(
      new Request("https://portfolio.test/api/portfolio-chat", {
        method: "POST",
        headers: { cookie },
        body: JSON.stringify({ question: "How does pitching work?" }),
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expired preview session must reject.");
    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toMatchObject({
      code: "preview_required",
    });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("rejects a tampered preview session before rate limiting", async () => {
    const cookie = await previewCookie();
    const tampered = `${cookie.slice(0, -1)}${cookie.endsWith("a") ? "b" : "a"}`;
    const rateLimit = vi.fn();
    const guard = createPortfolioChatLaunchGuard({
      config: livePreviewConfig,
      now: () => Date.UTC(2026, 7, 24, 3, 0, 0),
      rateLimiter: { limit: rateLimit },
    });

    const result = await guard(
      new Request("https://portfolio.test/api/portfolio-chat", {
        method: "POST",
        headers: { cookie: tampered },
        body: JSON.stringify({ question: "How does pitching work?" }),
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Tampered preview session must reject.");
    expect(result.response.status).toBe(401);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("requires successful Turnstile verification before consuming limits", async () => {
    const cookie = await previewCookie();
    const rateLimit = vi.fn();
    const verifyTurnstile = vi.fn(async () => false);
    const guard = createPortfolioChatLaunchGuard({
      config: {
        ...livePreviewConfig,
        turnstileRequired: true,
        turnstileSecret: "turnstile-test-secret",
      },
      now: () => Date.UTC(2026, 7, 24, 3, 0, 0),
      rateLimiter: { limit: rateLimit },
      verifyTurnstile,
    });

    const result = await guard(
      new Request("https://portfolio.test/api/portfolio-chat", {
        method: "POST",
        headers: { cookie },
        body: JSON.stringify({
          question: "How does pitching work?",
          challengeToken: "single-use-token",
        }),
      }),
      { challengeToken: "single-use-token" },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Failed challenge must reject.");
    expect(result.response.status).toBe(403);
    expect(verifyTurnstile).toHaveBeenCalledWith({
      token: "single-use-token",
      secret: "turnstile-test-secret",
      expectedAction: "portfolio_chat",
      expectedHostname: "portfolio.test",
    });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "burst limit",
      rateAllowed: false,
      status: 429,
      code: "rate_limited",
    },
  ])(
    "fails closed when the $name is exhausted",
    async ({ rateAllowed, status, code }) => {
      const cookie = await previewCookie();
      const guard = createPortfolioChatLaunchGuard({
        config: livePreviewConfig,
        now: () => Date.UTC(2026, 7, 24, 3, 0, 0),
        rateLimiter: {
          limit: vi.fn(async () => ({ success: rateAllowed })),
        },
      });

      const result = await guard(
        new Request("https://portfolio.test/api/portfolio-chat", {
          method: "POST",
          headers: { cookie },
          body: JSON.stringify({ question: "How does pitching work?" }),
        }),
      );

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Exhausted launch control must reject.");
      expect(result.response.status).toBe(status);
      expect(await result.response.json()).toMatchObject({ code });
    },
  );

  it("redacts and fails closed when a launch dependency throws", async () => {
    const cookie = await previewCookie();
    const record = vi.fn();
    const guard = createPortfolioChatLaunchGuard({
      config: livePreviewConfig,
      now: () => Date.UTC(2026, 7, 24, 3, 0, 0),
      randomId: () => "request-dependency-error",
      rateLimiter: {
        limit: async () => {
          throw new Error("binding-secret-detail");
        },
      },
      record,
    });

    const result = await guard(
      new Request("https://portfolio.test/api/portfolio-chat", {
        method: "POST",
        headers: { cookie },
        body: JSON.stringify({ question: "private question" }),
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Thrown launch dependency must reject.");
    expect(result.response.status).toBe(503);
    const serialized = JSON.stringify({
      response: await result.response.json(),
      calls: record.mock.calls,
    });
    expect(serialized).not.toContain("binding-secret-detail");
    expect(serialized).not.toContain("private question");
  });
});

describe("preview access handler", () => {
  function handler(
    limit: (input: { key: string }) => Promise<{ success: boolean }> = async () => ({
      success: true,
    }),
  ) {
    return createPortfolioChatPreviewHandler({
      config: livePreviewConfig,
      now: () => Date.UTC(2026, 7, 24, 3, 0, 0),
      randomId: () => "session-123",
      previewRateLimiter: { limit },
    });
  }

  function request(
    body: string,
    options: { method?: string; origin?: string; ip?: string } = {},
  ) {
    return new Request("https://portfolio.test/api/portfolio-chat/preview", {
      method: options.method ?? "POST",
      headers: {
        ...(options.ip === ""
          ? {}
          : { "cf-connecting-ip": options.ip ?? "203.0.113.10" }),
        "content-type": "application/json",
        ...(options.origin === undefined
          ? { origin: "https://portfolio.test" }
          : options.origin
            ? { origin: options.origin }
            : {}),
      },
      ...(options.method === "GET" ? {} : { body }),
    });
  }

  it("denies an invalid access code without setting a session", async () => {
    const response = await handler()(
      request(JSON.stringify({ accessCode: "wrong-preview-code-with-32-chars" })),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(JSON.stringify(await response.json())).not.toContain(
      "preview-access-code-with-32-chars",
    );
  });

  it.each([
    {
      name: "wrong method",
      request: request("", { method: "GET" }),
      status: 405,
    },
    {
      name: "missing origin",
      request: request(JSON.stringify({ accessCode: "x" }), { origin: "" }),
      status: 403,
    },
    {
      name: "cross-site origin",
      request: request(JSON.stringify({ accessCode: "x" }), {
        origin: "https://attacker.test",
      }),
      status: 403,
    },
    {
      name: "oversized body",
      request: request(
        JSON.stringify({ accessCode: "x".repeat(5_000) }),
      ),
      status: 413,
    },
  ])("rejects a $name", async ({ request: previewRequest, status }) => {
    const response = await handler()(previewRequest);

    expect(response.status).toBe(status);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rate limits access-code attempts and fails closed on limiter errors", async () => {
    const limited = await handler(async () => ({ success: false }))(
      request(JSON.stringify({ accessCode: "wrong-preview-code-with-32-chars" })),
    );
    const unavailable = await handler(async () => {
      throw new Error("limiter internals");
    })(request(JSON.stringify({ accessCode: "wrong-preview-code-with-32-chars" })));

    expect(limited.status).toBe(429);
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("limiter internals");
  });

  it("uses a stable privacy-safe limiter key per connecting actor", async () => {
    const limit = vi.fn(async (input: { key: string }) => {
      void input;
      return { success: true };
    });
    const accessCode = JSON.stringify({
      accessCode: "preview-access-code-with-32-chars",
    });

    await handler(limit)(request(accessCode, { ip: "203.0.113.10" }));
    await handler(limit)(request(accessCode, { ip: "203.0.113.10" }));
    await handler(limit)(request(accessCode, { ip: "203.0.113.11" }));
    const keys = limit.mock.calls.map(([input]) => input.key);

    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(keys.every((key) => key.startsWith("preview-access:"))).toBe(true);
    expect(JSON.stringify(keys)).not.toContain("203.0.113");
  });

  it("fails closed when the trusted connecting actor is unavailable", async () => {
    const limit = vi.fn();
    const response = await handler(limit)(
      request(JSON.stringify({ accessCode: "any-value" }), { ip: "" }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "misconfigured" });
    expect(limit).not.toHaveBeenCalled();
  });
});

describe("Turnstile verifier", () => {
  it("posts the token and server secret to Siteverify and returns only its decision", async () => {
    const requests: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const verifier = createTurnstileVerifier(async (input, init) => {
      requests.push([input, init]);
      return Response.json({
        success: true,
        action: "portfolio_chat",
        hostname: "portfolio.test",
      });
    });

    await expect(
      verifier({
        token: "visitor-token",
        secret: "server-secret",
        expectedAction: "portfolio_chat",
        expectedHostname: "portfolio.test",
      }),
    ).resolves.toBe(true);
    expect(requests).toHaveLength(1);
    const [url, init] = requests[0] ?? [];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(init?.method).toBe("POST");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init?.body))).toEqual({
      response: "visitor-token",
      secret: "server-secret",
    });
  });

  it.each([
    new Response("upstream detail", { status: 500 }),
    Response.json({ success: false, "error-codes": ["bad-secret"] }),
    Response.json({ success: "yes" }),
  ])("fails closed on unsuccessful or malformed verification", async (response) => {
    const verifier = createTurnstileVerifier(async () => response.clone());

    await expect(
      verifier({
        token: "visitor-token",
        secret: "server-secret",
        expectedAction: "portfolio_chat",
        expectedHostname: "portfolio.test",
      }),
    ).resolves.toBe(false);
  });

  it.each([
    { success: true, action: "other_action", hostname: "portfolio.test" },
    { success: true, action: "portfolio_chat", hostname: "other.test" },
  ])("rejects a valid token minted for another context", async (result) => {
    const verifier = createTurnstileVerifier(async () => Response.json(result));

    await expect(
      verifier({
        token: "visitor-token",
        secret: "server-secret",
        expectedAction: "portfolio_chat",
        expectedHostname: "portfolio.test",
      }),
    ).resolves.toBe(false);
  });
});
