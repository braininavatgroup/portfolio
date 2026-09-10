import { describe, expect, it, vi } from "vitest";
import {
  PortfolioChatClientError,
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
  it("preserves the session error when reopening fails", async () => {
    const fetchImplementation = vi.fn(async (url: RequestInfo | URL) =>
      url === "/api/portfolio-chat/session"
        ? new Response(null, { status: 503 })
        : Response.json({ code: "session_required", message: "Session needed" }, { status: 403 }),
    );
    await expect(streamPortfolioAnswer("Question", {
      fetchImplementation,
      onEvent: () => {},
    })).rejects.toMatchObject({ code: "session_required" });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

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
        '{"type":"turn_mode","mode":"portfolio"}\n',
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
          avatarAction: null,
          issues: ["effects has unknown key: avatarSequence"],
        },
      },
      { type: "turn_mode", mode: "portfolio" },
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

  it("preserves the server configuration error without exposing response internals", async () => {
    const fetchImplementation = async () =>
      Response.json(
        { code: "misconfigured", message: "Ask the portfolio is not configured." },
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
      code: "misconfigured",
      message: "Ask the portfolio is not configured.",
    });
  });

  it("re-opens a lapsed session once and resends the same question", async () => {
    // The endpoint refuses a request whose session expired. Recovering here
    // keeps a lapse invisible instead of surfacing it as a failed answer.
    const calls: string[] = [];
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url === "/api/portfolio-chat/session") {
        return Response.json({ required: true, expiresAt: 1 });
      }
      if (calls.filter((call) => call === "/api/portfolio-chat").length === 1) {
        return Response.json(
          { code: "session_required", message: "Reload the page to ask again." },
          { status: 403 },
        );
      }
      return chunkedResponse(['{"type":"done"}\n']);
    });

    await streamPortfolioAnswer("Question", {
      fetchImplementation: fetchImplementation as unknown as typeof fetch,
      onEvent: () => {},
    });

    expect(calls).toEqual([
      "/api/portfolio-chat",
      "/api/portfolio-chat/session",
      "/api/portfolio-chat",
    ]);
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
