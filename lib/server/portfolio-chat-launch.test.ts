import { describe, expect, it, vi } from "vitest";
import {
  createPortfolioChatLaunchGuard,
  createTurnstileVerifier,
} from "./portfolio-chat-launch";

const publicConfig = {
  liveEnabled: true,
  turnstileRequired: true,
  identifierSecret: "privacy-safe-identifier-secret-32-chars",
  turnstileSecret: "turnstile-test-secret",
  dailyRequestLimit: 12,
};

function chatRequest(ip = "203.0.113.10") {
  return new Request("https://portfolio.test/api/portfolio-chat", {
    method: "POST",
    headers: ip ? { "cf-connecting-ip": ip } : {},
    body: JSON.stringify({ question: "How does pitching work?" }),
  });
}

describe("portfolio chat launch guard", () => {
  it("leaves every protected dependency untouched while the live gate is false", async () => {
    const rateLimit = vi.fn();
    const verifyTurnstile = vi.fn();
    const record = vi.fn();
    const guard = createPortfolioChatLaunchGuard({
      config: { liveEnabled: false, turnstileRequired: true },
      rateLimiter: { limit: rateLimit },
      verifyTurnstile,
      record,
    });

    const result = await guard(chatRequest(), {
      challengeToken: "unused-token",
    });

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

  it("serves an enabled pre-launch site without public abuse controls", async () => {
    const rateLimit = vi.fn();
    const verifyTurnstile = vi.fn();
    const guard = createPortfolioChatLaunchGuard({
      config: { liveEnabled: true, turnstileRequired: false },
      rateLimiter: { limit: rateLimit },
      verifyTurnstile,
      randomId: () => "direct-request",
    });

    const result = await guard(chatRequest());

    expect(result).toEqual({ ok: true, requestId: "direct-request" });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "identifier secret",
      config: { ...publicConfig, identifierSecret: undefined },
      rateLimiter: { limit: vi.fn() },
      verifyTurnstile: vi.fn(),
    },
    {
      name: "Turnstile secret",
      config: { ...publicConfig, turnstileSecret: undefined },
      rateLimiter: { limit: vi.fn() },
      verifyTurnstile: vi.fn(),
    },
    {
      name: "route limiter",
      config: publicConfig,
      rateLimiter: undefined,
      verifyTurnstile: vi.fn(),
    },
    {
      name: "Turnstile verifier",
      config: publicConfig,
      rateLimiter: { limit: vi.fn() },
      verifyTurnstile: undefined,
    },
  ])(
    "fails closed when public mode is missing its $name",
    async ({ config, rateLimiter, verifyTurnstile }) => {
      const record = vi.fn();
      const guard = createPortfolioChatLaunchGuard({
        config,
        rateLimiter,
        verifyTurnstile,
        randomId: () => "request-misconfigured",
        record,
      });

      const result = await guard(chatRequest(), {
        challengeToken: "private-challenge-token",
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Incomplete public controls must reject.");
      expect(result.response.status).toBe(503);
      expect(await result.response.json()).toEqual({
        code: "misconfigured",
        message: "Ask the portfolio is not configured.",
      });
      if (rateLimiter) expect(rateLimiter.limit).not.toHaveBeenCalled();
      if (verifyTurnstile) expect(verifyTurnstile).not.toHaveBeenCalled();
      expect(record).toHaveBeenCalledWith({
        event: "portfolio_chat_preflight",
        requestId: "request-misconfigured",
        outcome: "misconfigured",
      });
      expect(JSON.stringify(record.mock.calls)).not.toContain("private-challenge");
    },
  );

  it("requires successful Turnstile verification before consuming a rate limit", async () => {
    const rateLimit = vi.fn();
    const verifyTurnstile = vi.fn(async () => false);
    const guard = createPortfolioChatLaunchGuard({
      config: publicConfig,
      rateLimiter: { limit: rateLimit },
      verifyTurnstile,
    });

    const result = await guard(chatRequest(), {
      challengeToken: "single-use-token",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Failed challenge must reject.");
    expect(result.response.status).toBe(403);
    expect(await result.response.json()).toMatchObject({
      code: "challenge_failed",
    });
    expect(verifyTurnstile).toHaveBeenCalledWith({
      token: "single-use-token",
      secret: "turnstile-test-secret",
      expectedAction: "portfolio_chat",
      expectedHostname: "portfolio.test",
    });
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("uses one stable privacy-safe actor identity for limiting and provider safety", async () => {
    const limit = vi.fn(async (input: { key: string }) => {
      void input;
      return { success: true };
    });
    const guard = createPortfolioChatLaunchGuard({
      config: publicConfig,
      rateLimiter: { limit },
      verifyTurnstile: async () => true,
      randomId: () => "public-request",
    });

    const first = await guard(chatRequest("203.0.113.10"), {
      challengeToken: "first-token",
    });
    const repeated = await guard(chatRequest("203.0.113.10"), {
      challengeToken: "second-token",
    });
    const different = await guard(chatRequest("203.0.113.11"), {
      challengeToken: "third-token",
    });

    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("Configured public controls must pass.");
    expect(first.safetyIdentifier).toMatch(/^pc_[A-Za-z0-9_-]{32,}$/);
    expect(repeated.ok && repeated.safetyIdentifier).toBe(
      first.ok ? first.safetyIdentifier : undefined,
    );
    expect(different.ok && different.safetyIdentifier).not.toBe(
      first.ok ? first.safetyIdentifier : undefined,
    );
    const keys = limit.mock.calls.map(([input]) => input.key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(keys.every((key) => key.startsWith("portfolio-chat:"))).toBe(true);
    expect(JSON.stringify({ keys, first, repeated, different })).not.toContain(
      "203.0.113",
    );
  });

  it("fails closed when the trusted connecting actor is unavailable", async () => {
    const limit = vi.fn();
    const guard = createPortfolioChatLaunchGuard({
      config: publicConfig,
      rateLimiter: { limit },
      verifyTurnstile: async () => true,
    });

    const result = await guard(chatRequest(""), {
      challengeToken: "single-use-token",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Missing connecting actor must reject.");
    expect(result.response.status).toBe(503);
    expect(await result.response.json()).toMatchObject({ code: "misconfigured" });
    expect(limit).not.toHaveBeenCalled();
  });

  it("fails closed when the public rate limit is exhausted", async () => {
    const guard = createPortfolioChatLaunchGuard({
      config: publicConfig,
      rateLimiter: { limit: async () => ({ success: false }) },
      verifyTurnstile: async () => true,
    });

    const result = await guard(chatRequest(), {
      challengeToken: "single-use-token",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Exhausted public limit must reject.");
    expect(result.response.status).toBe(429);
    expect(await result.response.json()).toMatchObject({ code: "rate_limited" });
  });

  it("redacts and fails closed when a launch dependency throws", async () => {
    const record = vi.fn();
    const guard = createPortfolioChatLaunchGuard({
      config: publicConfig,
      randomId: () => "request-dependency-error",
      rateLimiter: {
        limit: async () => {
          throw new Error("binding-secret-detail");
        },
      },
      verifyTurnstile: async () => true,
      record,
    });

    const result = await guard(chatRequest(), {
      challengeToken: "private-challenge-token",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Thrown launch dependency must reject.");
    expect(result.response.status).toBe(503);
    const serialized = JSON.stringify({
      response: await result.response.json(),
      calls: record.mock.calls,
    });
    expect(serialized).not.toContain("binding-secret-detail");
    expect(serialized).not.toContain("private-challenge-token");
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
