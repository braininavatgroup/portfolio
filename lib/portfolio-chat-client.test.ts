import { describe, expect, it, vi } from "vitest";
import {
  PortfolioChatClientError,
  requestPortfolioChatPreviewAccess,
  streamPortfolioAnswer,
} from "./portfolio-chat-client";
import type { PortfolioChatEvent } from "./portfolio-chat-protocol";
import type { AskPortfolioOptions } from "./portfolio-chat-client";

function chunkedResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "content-type": "application/x-ndjson; charset=utf-8" },
    },
  );
}

describe("portfolio chat client", () => {
  it("sends per-visit routing state and accepts the hidden turn mode event", async () => {
    const events: PortfolioChatEvent[] = [];
    const fetchImplementation = vi.fn(async () =>
      chunkedResponse([
        '{"type":"turn_mode","mode":"general"}\n{"type":"done"}\n',
      ]),
    );
    const options = {
      visitState: { generalTurns: 2, portfolioNudgeShown: false },
      fetchImplementation,
      onEvent: (event: PortfolioChatEvent) => events.push(event),
    } as AskPortfolioOptions & {
      visitState: { generalTurns: number; portfolioNudgeShown: boolean };
    };

    await streamPortfolioAnswer("How do I sharpen a knife?", options);

    expect(events).toEqual([
      { type: "turn_mode", mode: "general" },
      { type: "done" },
    ]);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/portfolio-chat",
      expect.objectContaining({
        body: JSON.stringify({
          question: "How do I sharpen a knife?",
          visitState: { generalTurns: 2, portfolioNudgeShown: false },
        }),
      }),
    );
  });

  it("rejects a stream that ends before the terminal done event", async () => {
    const fetchImplementation = async () =>
      chunkedResponse([
        '{"type":"turn_mode","mode":"general"}\n',
        '{"type":"answer_delta","delta":"Incomplete answer"}\n',
      ]);

    await expect(
      streamPortfolioAnswer("Question", {
        fetchImplementation,
        onEvent: () => {},
      }),
    ).rejects.toMatchObject({
      code: "invalid_stream",
      message: "The answer service returned an invalid stream.",
    });
  });

  it("delivers NDJSON events even when transport chunks split a JSON line", async () => {
    const events: PortfolioChatEvent[] = [];
    const fetchImplementation = vi.fn(async () =>
      chunkedResponse([
        '{"type":"evidence","evidence":[]}\n{"type":"turn_mode","mode":"portfolio"}\n{"type":"answer_',
        'delta","delta":"Grounded "}\n',
        '{"type":"answer_delta","delta":"answer."}\n{"type":"done"}\n',
      ]),
    );

    await streamPortfolioAnswer("What is published?", {
      fetchImplementation,
      onEvent: (event) => events.push(event),
    });

    expect(events).toEqual([
      { type: "evidence", evidence: [] },
      { type: "turn_mode", mode: "portfolio" },
      { type: "answer_delta", delta: "Grounded " },
      { type: "answer_delta", delta: "answer." },
      { type: "done" },
    ]);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/portfolio-chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ question: "What is published?" }),
      }),
    );
  });

  it("sanitizes malformed nested effects without aborting later answer events", async () => {
    // Catches an invalid avatar command turning an otherwise valid text stream into invalid_stream.
    const events: PortfolioChatEvent[] = [];
    const fetchImplementation = vi.fn(async () =>
      chunkedResponse([
        '{"type":"effects","effects":{"avatarSequence":[{"action":"play","animation":"not-allowed"}]}}\n',
        '{"type":"answer_delta","delta":"Safe answer. [E1]"}\n',
        '{"type":"done"}\n',
      ]),
    );

    await streamPortfolioAnswer("Show me Dubs", {
      fetchImplementation,
      onEvent: (event) => events.push(event),
    });

    expect(events).toEqual([
      {
        type: "effects",
        effects: {
          siteActions: [],
          avatarSequence: [],
          issues: [
            "avatarSequence[0].animation must be an allowed animation",
          ],
        },
      },
      { type: "answer_delta", delta: "Safe answer. [E1]" },
      { type: "done" },
    ]);
  });

  it("retains invalid_stream for malformed non-effect events", async () => {
    // Catches effect isolation accidentally weakening the rest of the stream contract.
    const fetchImplementation = vi.fn(async () =>
      chunkedResponse(['{"type":"answer_delta","delta":42}\n']),
    );

    await expect(
      streamPortfolioAnswer("Question", {
        fetchImplementation,
        onEvent: () => {},
      }),
    ).rejects.toMatchObject({ code: "invalid_stream" });
  });

  it("preserves the disabled-gate error contract without exposing response internals", async () => {
    const fetchImplementation = async () =>
      Response.json(
        { code: "disabled", message: "Ask the portfolio is not enabled." },
        { status: 503 },
      );

    let caught: unknown;
    try {
      await streamPortfolioAnswer("Question", {
        fetchImplementation,
        onEvent: () => {},
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PortfolioChatClientError);
    expect(caught).toMatchObject({
      code: "disabled",
      message: "Ask the portfolio is not enabled.",
    });
  });

  it("exchanges a preview access code through the cookie-enabled endpoint", async () => {
    const fetchImplementation = vi.fn(async () =>
      Response.json({ ok: true, message: "Preview access ready." }),
    );

    await requestPortfolioChatPreviewAccess("  invite-code  ", {
      fetchImplementation,
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/portfolio-chat/preview",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({ accessCode: "invite-code" }),
      }),
    );
  });

  it("uses the redacted client error contract when preview access is denied", async () => {
    const fetchImplementation = async () =>
      Response.json(
        { code: "preview_denied", message: "Preview access was not accepted." },
        { status: 401 },
      );

    await expect(
      requestPortfolioChatPreviewAccess("wrong-code", { fetchImplementation }),
    ).rejects.toMatchObject({
      name: "PortfolioChatClientError",
      code: "preview_denied",
      message: "Preview access was not accepted.",
    });
  });

  it("keeps malformed preview failures redacted", async () => {
    const fetchImplementation = async () =>
      new Response("upstream details", { status: 502 });

    await expect(
      requestPortfolioChatPreviewAccess("invite-code", { fetchImplementation }),
    ).rejects.toMatchObject({
      code: "request_failed",
      message: "The answer service is temporarily unavailable.",
    });
  });

  it("adds an optional challenge token without changing ordinary chat requests", async () => {
    const fetchImplementation = vi.fn(async () =>
      chunkedResponse(['{"type":"done"}\n']),
    );

    await streamPortfolioAnswer("Question", {
      challengeToken: "challenge-token",
      fetchImplementation,
      onEvent: () => {},
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/portfolio-chat",
      expect.objectContaining({
        body: JSON.stringify({
          question: "Question",
          challengeToken: "challenge-token",
        }),
      }),
    );
  });

  it("sends bounded conversation context only when a follow-up has history", async () => {
    const fetchImplementation = vi.fn(async () =>
      chunkedResponse(['{"type":"done"}\n']),
    );

    await streamPortfolioAnswer("What changed?", {
      conversation: [
        { role: "user", content: "Tell me about pitching." },
        { role: "assistant", content: "It keeps approval human. [E1]" },
      ],
      fetchImplementation,
      onEvent: () => {},
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/portfolio-chat",
      expect.objectContaining({
        body: JSON.stringify({
          question: "What changed?",
          conversation: [
            { role: "user", content: "Tell me about pitching." },
            { role: "assistant", content: "It keeps approval human. [E1]" },
          ],
        }),
      }),
    );
  });
});
