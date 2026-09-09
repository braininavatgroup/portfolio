import { describe, expect, it, vi } from "vitest";
import { createPortfolioChatLaunchGuard } from "./portfolio-chat-launch";
import { mintSession } from "./portfolio-chat-session";

const publicConfig = {
  sessionRequired: true,
  identifierSecret: "privacy-safe-identifier-secret-32-chars",
  dailyRequestLimit: 12,
};

const clock = 1_700_000_000_000;

/** The cookie a visitor's browser would replay after opening a session. */
async function sessionCookie(
  ip = "203.0.113.10",
  secret = publicConfig.identifierSecret,
) {
  const { deriveActorKey } = await import("./portfolio-chat-launch");
  const actorKey = await deriveActorKey(secret, ip);
  const minted = await mintSession({ secret, actorKey, now: clock });
  return minted.setCookie.split(";")[0]!;
}

function chatRequest(ip = "203.0.113.10", cookie?: string) {
  return new Request("https://portfolio.test/api/portfolio-chat", {
    method: "POST",
    headers: {
      ...(ip ? { "cf-connecting-ip": ip } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ question: "How does pitching work?" }),
  });
}

describe("portfolio chat launch guard", () => {
  /**
   * sessionRequired gates the session token only. It used to short-circuit the
   * whole guard, which skipped the per-IP throttle too — so any deployment
   * with the flag off had no per-actor limit at all. The limiter now runs
   * whenever one is bound.
   */
  it("throttles per actor even when the session is not required", async () => {
    const rateLimit = vi.fn().mockResolvedValue({ success: true });
    const guard = createPortfolioChatLaunchGuard({
      config: { sessionRequired: false },
      rateLimiter: { limit: rateLimit },
      randomId: () => "direct-request",
    });

    const result = await guard(chatRequest());

    expect(result).toEqual({ ok: true, requestId: "direct-request" });
    expect(rateLimit).toHaveBeenCalledTimes(1);
  });

  it("rejects a throttled actor when the session is not required", async () => {
    const guard = createPortfolioChatLaunchGuard({
      config: { sessionRequired: false },
      rateLimiter: { limit: async () => ({ success: false }) },
      randomId: () => "direct-request",
    });

    const result = await guard(chatRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(429);
  });

  /** No limiter bound is the local/dev shape; it must still serve. */
  it("serves when no limiter is bound and the session is not required", async () => {
    const guard = createPortfolioChatLaunchGuard({
      config: { sessionRequired: false },
      randomId: () => "direct-request",
    });

    expect(await guard(chatRequest())).toEqual({
      ok: true,
      requestId: "direct-request",
    });
  });

  it.each([
    {
      name: "identifier secret",
      config: { ...publicConfig, identifierSecret: undefined },
      rateLimiter: { limit: vi.fn() },
    },
    {
      name: "route limiter",
      config: publicConfig,
      rateLimiter: undefined,
    },
  ])(
    "fails closed when public mode is missing its $name",
    async ({ config, rateLimiter }) => {
      const record = vi.fn();
      const guard = createPortfolioChatLaunchGuard({
        config,
        rateLimiter,
        randomId: () => "request-misconfigured",
        record,
      });

      const result = await guard(
        chatRequest("203.0.113.10", await sessionCookie()),
      );

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("Incomplete public controls must reject.");
      expect(result.response.status).toBe(503);
      expect(await result.response.json()).toEqual({
        code: "misconfigured",
        message: "Ask the portfolio is not configured.",
      });
      if (rateLimiter) expect(rateLimiter.limit).not.toHaveBeenCalled();
      expect(record).toHaveBeenCalledWith({
        event: "portfolio_chat_preflight",
        requestId: "request-misconfigured",
        outcome: "misconfigured",
      });
    },
  );

  it("requires a session token before consuming a rate limit", async () => {
    const rateLimit = vi.fn();
    const guard = createPortfolioChatLaunchGuard({
      config: publicConfig,
      rateLimiter: { limit: rateLimit },
      now: () => clock,
    });

    const result = await guard(chatRequest());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("A missing session must reject.");
    expect(result.response.status).toBe(403);
    expect(await result.response.json()).toMatchObject({
      code: "session_required",
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
      randomId: () => "public-request",
      now: () => clock,
    });

    const first = await guard(
      chatRequest("203.0.113.10", await sessionCookie("203.0.113.10")),
    );
    const repeated = await guard(
      chatRequest("203.0.113.10", await sessionCookie("203.0.113.10")),
    );
    const different = await guard(
      chatRequest("203.0.113.11", await sessionCookie("203.0.113.11")),
    );

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

  it("renews the session on every accepted request", async () => {
    // A conversation that outlives one session window must not stop to
    // re-establish itself mid-answer.
    let now = clock;
    const guard = createPortfolioChatLaunchGuard({
      config: publicConfig,
      rateLimiter: { limit: async () => ({ success: true }) },
      randomId: () => "public-request",
      now: () => now,
    });
    const cookie = await sessionCookie();

    const first = await guard(chatRequest("203.0.113.10", cookie));
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("A live session must pass.");
    expect(first.session?.expiresAt).toBe(clock / 1_000 + 1_800);
    expect(first.session?.setCookie).toContain("pc_session=");
    expect(first.session?.setCookie).toContain("HttpOnly");
    expect(first.session?.setCookie).toContain("Secure");
    expect(first.session?.setCookie).not.toContain("203.0.113");

    now = clock + 600_000;
    const later = await guard(chatRequest("203.0.113.10", cookie));
    expect(later.ok).toBe(true);
    if (!later.ok) throw new Error("A live session must pass.");
    expect(later.session!.expiresAt).toBeGreaterThan(first.session!.expiresAt);
  });

  it.each([
    ["another actor", "203.0.113.11", clock],
    ["the same actor after it lapses", "203.0.113.10", clock + 1_801_000],
  ])("refuses a session replayed by %s", async (_case, ip, at) => {
    let now = clock;
    const guard = createPortfolioChatLaunchGuard({
      config: publicConfig,
      rateLimiter: { limit: async () => ({ success: true }) },
      randomId: () => "public-request",
      now: () => now,
    });
    const cookie = await sessionCookie();

    now = at;
    const replayed = await guard(chatRequest(ip, cookie));

    expect(replayed.ok).toBe(false);
    if (replayed.ok) throw new Error("A replayed session must reject.");
    expect(replayed.response.status).toBe(403);
    expect(await replayed.response.json()).toMatchObject({
      code: "session_required",
    });
  });

  it("refuses a forged session signature", async () => {
    const guard = createPortfolioChatLaunchGuard({
      config: publicConfig,
      rateLimiter: { limit: async () => ({ success: true }) },
      now: () => clock,
    });

    const forged = await guard(
      chatRequest(
        "203.0.113.10",
        `pc_session=v1.${clock / 1_000 + 1_800}.notarealsignature`,
      ),
    );

    expect(forged.ok).toBe(false);
    if (forged.ok) throw new Error("A forged session must reject.");
    expect(forged.response.status).toBe(403);
  });

  it("still throttles an actor holding a valid session", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const guard = createPortfolioChatLaunchGuard({
      config: publicConfig,
      rateLimiter: { limit },
      now: () => clock,
    });

    const throttled = await guard(
      chatRequest("203.0.113.10", await sessionCookie()),
    );

    expect(limit).toHaveBeenCalledTimes(1);
    if (throttled.ok) throw new Error("A throttled actor must reject.");
    expect(throttled.response.status).toBe(429);
  });

  it("fails closed when the trusted connecting actor is unavailable", async () => {
    const limit = vi.fn();
    const guard = createPortfolioChatLaunchGuard({
      config: publicConfig,
      rateLimiter: { limit },
      now: () => clock,
    });

    const result = await guard(chatRequest(""));

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
      now: () => clock,
    });

    const result = await guard(
      chatRequest("203.0.113.10", await sessionCookie()),
    );

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
      now: () => clock,
      record,
    });

    const result = await guard(
      chatRequest("203.0.113.10", await sessionCookie()),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Thrown launch dependency must reject.");
    expect(result.response.status).toBe(503);
    const serialized = JSON.stringify({
      response: await result.response.json(),
      calls: record.mock.calls,
    });
    expect(serialized).not.toContain("binding-secret-detail");
  });
});
