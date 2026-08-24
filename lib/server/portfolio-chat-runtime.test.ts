import { describe, expect, it, vi } from "vitest";
import type { PortfolioChatProvider } from "./portfolio-chat-provider";
import { createPortfolioChatRuntime } from "./portfolio-chat-runtime";

function chatRequest(cookie?: string, body: object = {
  question: "How does pitching preserve approval?",
}) {
  return new Request("https://portfolio.test/api/portfolio-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function budgetNamespace(consume: (input: { limit: number }) => Promise<{ success: boolean }>) {
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
  it("does not construct a provider or touch bindings while disabled", async () => {
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
    });

    const response = await runtime.handleChat(chatRequest());
    const previewResponse = await runtime.handlePreview(
      new Request("https://portfolio.test/api/portfolio-chat/preview", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "disabled" });
    expect(previewResponse.status).toBe(503);
    expect(await previewResponse.json()).toMatchObject({ code: "disabled" });
    expect(getProvider).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
    expect(namespace.getByName).not.toHaveBeenCalled();
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it("uses the signed preview session for preflight and provider safety identity", async () => {
    const seenSafetyIdentifiers: Array<string | undefined> = [];
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ safetyIdentifier }) {
        seenSafetyIdentifiers.push(safetyIdentifier);
        yield "The final approval remains human. [E1]";
      },
    };
    const record = vi.fn();
    const ids = ["preview-session", "chat-request"];
    const consume = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false });
    const { namespace, stub } = budgetNamespace(consume);
    const getProvider = vi.fn(() => provider);
    const runtime = createPortfolioChatRuntime({
      env: {
        PORTFOLIO_CHAT_LIVE_ENABLED: "true",
        PORTFOLIO_CHAT_PREVIEW_ENABLED: "true",
        PORTFOLIO_CHAT_PREVIEW_ACCESS_CODE:
          "preview-access-code-with-32-chars",
        PORTFOLIO_CHAT_SESSION_SECRET:
          "session-signing-secret-with-32-chars",
        PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "5",
        OPENAI_API_KEY: "sk-server-only",
        OPENAI_PORTFOLIO_MODEL: "portfolio-model",
        PORTFOLIO_CHAT_RATE_LIMITER: {
          limit: vi.fn(async () => ({ success: true })),
        },
        PORTFOLIO_CHAT_PREVIEW_RATE_LIMITER: {
          limit: vi.fn(async () => ({ success: true })),
        },
        PORTFOLIO_CHAT_BUDGET: namespace,
      },
      getProvider,
      now: () => Date.UTC(2026, 7, 24, 3, 0, 0),
      randomId: () => ids.shift() ?? "extra-id",
      record,
    });
    const previewResponse = await runtime.handlePreview(
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
    const cookie = previewResponse.headers.get("set-cookie")?.split(";")[0];

    const response = await runtime.handleChat(chatRequest(cookie));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"answer_delta"');
    expect(seenSafetyIdentifiers).toHaveLength(1);
    expect(seenSafetyIdentifiers[0]).toMatch(/^pc_/);
    expect(namespace.getByName).toHaveBeenCalledWith(
      "portfolio-chat-global-budget",
    );
    expect(stub.fetch).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith({ limit: 5 });
    expect(getProvider).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "portfolio_chat_stream",
        requestId: "chat-request",
        providerModel: "portfolio-model",
      }),
    );
    expect(JSON.stringify(record.mock.calls)).not.toContain(
      "preview-access-code",
    );
    expect(JSON.stringify(record.mock.calls)).not.toContain("sk-server-only");

    const exhausted = await runtime.handleChat(chatRequest(cookie));
    expect(exhausted.status).toBe(503);
    expect(await exhausted.json()).toMatchObject({ code: "budget_exhausted" });
    expect(namespace.getByName).toHaveBeenNthCalledWith(
      2,
      "portfolio-chat-global-budget",
    );
    expect(getProvider).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({
      event: "portfolio_chat_preflight",
      requestId: "extra-id",
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
        PORTFOLIO_CHAT_LIVE_ENABLED: "true",
        PORTFOLIO_CHAT_PREVIEW_ENABLED: "true",
        PORTFOLIO_CHAT_PREVIEW_ACCESS_CODE:
          "preview-access-code-with-32-chars",
        PORTFOLIO_CHAT_SESSION_SECRET:
          "session-signing-secret-with-32-chars",
        PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "5",
        OPENAI_API_KEY: "sk-server-only",
        OPENAI_PORTFOLIO_MODEL: "portfolio-model",
        PORTFOLIO_CHAT_RATE_LIMITER: { limit },
        PORTFOLIO_CHAT_PREVIEW_RATE_LIMITER: { limit: vi.fn() },
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

  it("does not consume the provider budget when grounding finds no evidence", async () => {
    const provider: PortfolioChatProvider = {
      streamAnswer() {
        throw new Error("provider must not be called without evidence");
      },
    };
    const consume = vi.fn(async () => ({ success: true }));
    const { namespace } = budgetNamespace(consume);
    const ids = ["preview-session", "chat-request"];
    const runtime = createPortfolioChatRuntime({
      env: {
        PORTFOLIO_CHAT_LIVE_ENABLED: "true",
        PORTFOLIO_CHAT_PREVIEW_ENABLED: "true",
        PORTFOLIO_CHAT_PREVIEW_ACCESS_CODE:
          "preview-access-code-with-32-chars",
        PORTFOLIO_CHAT_SESSION_SECRET:
          "session-signing-secret-with-32-chars",
        PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "5",
        OPENAI_API_KEY: "sk-server-only",
        OPENAI_PORTFOLIO_MODEL: "portfolio-model",
        PORTFOLIO_CHAT_RATE_LIMITER: {
          limit: vi.fn(async () => ({ success: true })),
        },
        PORTFOLIO_CHAT_PREVIEW_RATE_LIMITER: {
          limit: vi.fn(async () => ({ success: true })),
        },
        PORTFOLIO_CHAT_BUDGET: namespace,
      },
      getProvider: () => provider,
      now: () => Date.UTC(2026, 7, 24, 3, 0, 0),
      randomId: () => ids.shift() ?? "extra-id",
      record: () => {},
    });
    const preview = await runtime.handlePreview(
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
    const cookie = preview.headers.get("set-cookie")?.split(";")[0];

    const response = await runtime.handleChat(
      chatRequest(cookie, {
        question: "What quantum-computing patents did Bradley file?",
      }),
    );
    const body = await response.text();

    expect(body).toContain("insufficient_evidence");
    expect(namespace.getByName).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
  });
});
