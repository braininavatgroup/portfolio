import { describe, expect, it, vi } from "vitest";
import type { PortfolioChatProvider } from "./portfolio-chat-provider";
import { createPortfolioChatRuntime } from "./portfolio-chat-runtime";

function chatRequest(
  body: object = { question: "How does pitching preserve approval?" },
  ip?: string,
) {
  return new Request("https://portfolio.test/api/portfolio-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(ip ? { "cf-connecting-ip": ip } : {}),
    },
    body: JSON.stringify(body),
  });
}

function budgetNamespace(
  consume: (input: { limit: number }) => Promise<{ success: boolean }>,
) {
  const stub = {
    fetch: vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const result = await consume(JSON.parse(String(init?.body)));
      return Response.json(result);
    }),
  };
  return {
    stub,
    namespace: {
      getByName: vi.fn(() => stub),
    },
  };
}

describe("portfolio chat runtime", () => {
  it("fails closed without provider configuration", async () => {
    const getProvider = vi.fn(() => {
      throw new Error("provider must stay dormant");
    });
    const limit = vi.fn();
    const { namespace, stub } = budgetNamespace(vi.fn());
    const runtime = createPortfolioChatRuntime({
      env: {
        PORTFOLIO_CHAT_RATE_LIMITER: { limit },
        PORTFOLIO_CHAT_BUDGET: namespace,
      },
      getProvider,
      record: () => {},
    });

    const response = await runtime.handleChat(chatRequest());

    expect(Object.keys(runtime)).toEqual(["handleChat"]);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "misconfigured" });
    expect(getProvider).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
    expect(namespace.getByName).not.toHaveBeenCalled();
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it("serves chat whenever its provider configuration is present", async () => {
    const seenSafetyIdentifiers: Array<string | undefined> = [];
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ safetyIdentifier }) {
        seenSafetyIdentifiers.push(safetyIdentifier);
        yield "The final approval remains human. [E1]";
      },
    };
    const consume = vi.fn(async () => ({ success: true }));
    const { namespace } = budgetNamespace(consume);
    const runtime = createPortfolioChatRuntime({
      env: {
        PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "200",
        OPENAI_API_KEY: "sk-server-only",
        OPENAI_PORTFOLIO_MODEL: "gpt-5.4-2026-03-05",
        OPENAI_PORTFOLIO_REASONING_EFFORT: "low",
        PORTFOLIO_CHAT_BUDGET: namespace,
      },
      getProvider: () => provider,
      randomId: () => "direct-request",
      record: () => {},
    });

    const response = await runtime.handleChat(chatRequest());

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"type":"answer_delta"');
    expect(consume).toHaveBeenCalledWith({ limit: 200 });
    expect(seenSafetyIdentifiers).toEqual([undefined]);
  });

  it("uses dormant public controls for preflight and provider safety identity", async () => {
    const seenSafetyIdentifiers: Array<string | undefined> = [];
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ safetyIdentifier }) {
        seenSafetyIdentifiers.push(safetyIdentifier);
        yield "The final approval remains human. [E1]";
      },
    };
    const record = vi.fn();
    const consume = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false });
    const { namespace, stub } = budgetNamespace(consume);
    const limit = vi.fn(async () => ({ success: true }));
    const getProvider = vi.fn(() => provider);
    const verify = vi.fn(async () =>
      Response.json({
        success: true,
        action: "portfolio_chat",
        hostname: "portfolio.test",
      }),
    );
    const runtime = createPortfolioChatRuntime({
      env: {
        PORTFOLIO_CHAT_TURNSTILE_REQUIRED: "true",
        PORTFOLIO_CHAT_IDENTIFIER_SECRET:
          "privacy-safe-identifier-secret-32-chars",
        TURNSTILE_SECRET_KEY: "turnstile-server-secret",
        PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "5",
        OPENAI_API_KEY: "sk-server-only",
        OPENAI_PORTFOLIO_MODEL: "portfolio-model",
        PORTFOLIO_CHAT_RATE_LIMITER: { limit },
        PORTFOLIO_CHAT_BUDGET: namespace,
      },
      fetchImplementation: verify,
      getProvider,
      randomId: () => "public-request",
      record,
    });
    const requestBody = {
      question: "How does pitching preserve approval?",
      challengeToken: "single-use-token",
    };

    const response = await runtime.handleChat(
      chatRequest(requestBody, "203.0.113.10"),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"answer_delta"');
    expect(seenSafetyIdentifiers[0]).toMatch(/^pc_/);
    expect(limit).toHaveBeenCalledWith({
      key: expect.stringMatching(/^portfolio-chat:/),
    });
    expect(JSON.stringify({ limiter: limit.mock.calls, record: record.mock.calls }))
      .not.toContain("203.0.113.10");
    expect(namespace.getByName).toHaveBeenCalledWith(
      "portfolio-chat-global-budget",
    );
    expect(stub.fetch).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith({ limit: 5 });
    expect(getProvider).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "portfolio_chat_stream",
        requestId: "public-request",
        providerModel: "portfolio-model",
      }),
    );
    expect(JSON.stringify(record.mock.calls)).not.toContain("single-use-token");
    expect(JSON.stringify(record.mock.calls)).not.toContain("sk-server-only");

    const exhausted = await runtime.handleChat(
      chatRequest(requestBody, "203.0.113.10"),
    );
    expect(exhausted.status).toBe(503);
    expect(await exhausted.json()).toMatchObject({ code: "budget_exhausted" });
    expect(namespace.getByName).toHaveBeenNthCalledWith(
      2,
      "portfolio-chat-global-budget",
    );
    expect(getProvider).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({
      event: "portfolio_chat_preflight",
      requestId: "public-request",
      outcome: "budget_exhausted",
    });
  });

  it("rejects an oversized chat body before rate limiting, budget use, or provider construction", async () => {
    const getProvider = vi.fn();
    const limit = vi.fn();
    const consume = vi.fn();
    const { namespace } = budgetNamespace(consume);
    const runtime = createPortfolioChatRuntime({
      env: {
        PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "5",
        OPENAI_API_KEY: "sk-server-only",
        OPENAI_PORTFOLIO_MODEL: "portfolio-model",
        PORTFOLIO_CHAT_RATE_LIMITER: { limit },
        PORTFOLIO_CHAT_BUDGET: namespace,
      },
      getProvider,
    });
    const oversized = new Request("https://portfolio.test/api/portfolio-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "x".repeat(5_000) }),
    });

    const response = await runtime.handleChat(oversized);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "request_too_large" });
    expect(limit).not.toHaveBeenCalled();
    expect(namespace.getByName).not.toHaveBeenCalled();
    expect(getProvider).not.toHaveBeenCalled();
  });

  // Owner: portfolio chat runtime. Retire only if unsupported questions no
  // longer reach the full-context agent or provider budgeting is replaced.
  it("budgets an unsupported question before the full-context agent answers conversationally", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ evidence }) {
        expect(evidence).toHaveLength(10);
        yield "I don't see any quantum-computing patents in Bradley's portfolio.";
      },
    };
    const consume = vi.fn(async () => ({ success: true }));
    const { namespace } = budgetNamespace(consume);
    const runtime = createPortfolioChatRuntime({
      env: {
        PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "5",
        OPENAI_API_KEY: "sk-server-only",
        OPENAI_PORTFOLIO_MODEL: "portfolio-model",
        PORTFOLIO_CHAT_BUDGET: namespace,
      },
      getProvider: () => provider,
      randomId: () => "unsupported-request",
      record: () => {},
    });

    const response = await runtime.handleChat(
      chatRequest({
        question: "What quantum-computing patents did Bradley file?",
      }),
    );
    const body = await response.text();

    expect(body).toContain('"type":"answer_delta"');
    expect(body).toContain(
      "I don't see any quantum-computing patents in Bradley's portfolio.",
    );
    expect(namespace.getByName).toHaveBeenCalledWith(
      "portfolio-chat-global-budget",
    );
    expect(consume).toHaveBeenCalledWith({ limit: 5 });
  });
});
