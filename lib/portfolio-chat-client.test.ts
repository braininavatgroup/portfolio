import { describe, expect, it, vi } from "vitest";
import {
  PortfolioChatClientError,
  requestPortfolioChatPreviewAccess,
  streamPortfolioAnswer,
} from "./portfolio-chat-client";
import type { PortfolioChatEvent } from "./portfolio-chat-protocol";

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
  it("delivers NDJSON events even when transport chunks split a JSON line", async () => {
    const events: PortfolioChatEvent[] = [];
    const fetchImplementation = vi.fn(async () =>
      chunkedResponse([
        '{"type":"evidence","evidence":[]}\n{"type":"answer_',
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
});
