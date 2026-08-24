import { describe, expect, it, vi } from "vitest";
import {
  PortfolioChatClientError,
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
});
