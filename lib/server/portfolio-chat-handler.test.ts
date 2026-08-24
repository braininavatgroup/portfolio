import { describe, expect, it, vi } from "vitest";
import { createPortfolioChatHandler } from "./portfolio-chat-handler";
import type { PortfolioChatProvider } from "./portfolio-chat-provider";
import type { PortfolioChatEvent } from "../portfolio-chat-protocol";

function questionRequest(question: string) {
  return new Request("http://portfolio.test/api/portfolio-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

async function readEvents(response: Response) {
  const body = await response.text();
  return body
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PortfolioChatEvent);
}

describe("portfolio chat route handler", () => {
  it("keeps the provider unreachable while the deployment gate is disabled", async () => {
    const getProvider = vi.fn(() => {
      throw new Error("provider must remain dormant");
    });
    const handler = createPortfolioChatHandler({
      isEnabled: () => false,
      getProvider,
    });

    const response = await handler(questionRequest("How does pitching work?"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "disabled",
      message: "Ask the portfolio is not enabled.",
    });
    expect(getProvider).not.toHaveBeenCalled();
  });

  it("streams deterministic attribution before grounded answer deltas", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ question, evidence }) {
        expect(question).toBe("How does pitching preserve human approval and taste?");
        expect(evidence[0]?.id).toBe("project:pitching");
        yield "It keeps the final ";
        yield "approval human. [E1]";
      },
    };
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider: () => provider,
    });

    const response = await handler(
      questionRequest("How does pitching preserve human approval and taste?"),
    );
    const events = await readEvents(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/x-ndjson; charset=utf-8",
    );
    expect(events[0]?.type).toBe("evidence");
    if (events[0]?.type !== "evidence") {
      throw new Error("First stream event must carry portfolio evidence.");
    }
    expect(events[0].evidence[0]).toMatchObject({
      id: "project:pitching",
      title: "Pitching system",
      href: "/work/pitching",
      evidenceStatus: "needed",
    });
    expect(events.slice(1)).toEqual([
      {
        type: "answer_delta",
        delta: "It keeps the final approval human. [E1]",
      },
      { type: "done" },
    ]);
  });

  it("does not call a provider when the portfolio has no supporting evidence", async () => {
    const getProvider = vi.fn<() => PortfolioChatProvider>();
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider,
    });

    const events = await readEvents(
      await handler(
        questionRequest("What quantum-computing patents did Bradley file?"),
      ),
    );

    expect(events).toEqual([
      { type: "evidence", evidence: [] },
      {
        type: "notice",
        code: "insufficient_evidence",
        message:
          "The portfolio does not publish enough evidence to answer that question.",
      },
      { type: "done" },
    ]);
    expect(getProvider).not.toHaveBeenCalled();
  });

  it("maps a provider evidence-gap result to the evidence-gap notice", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer() {
        yield "The portfolio does not publish enough evidence to answer that question.";
      },
    };
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(questionRequest("How does pitching work?")),
    );

    expect(events).toEqual([
      expect.objectContaining({ type: "evidence" }),
      {
        type: "notice",
        code: "insufficient_evidence",
        message:
          "The portfolio does not publish enough evidence to answer that question.",
      },
      { type: "done" },
    ]);
  });

  it("redacts provider failures from an in-progress stream", async () => {
    const secret = "sk-test-secret-that-must-not-leak";
    const provider: PortfolioChatProvider = {
      async *streamAnswer() {
        yield "Published context. ";
        throw new Error(`provider failed with ${secret}`);
      },
    };
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider: () => provider,
    });

    const response = await handler(questionRequest("How does pitching work?"));
    const body = await response.text();

    expect(body).not.toContain(secret);
    expect(
      body
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    ).toContainEqual({
      type: "error",
      code: "provider_unavailable",
      message: "The answer service is temporarily unavailable.",
    });
  });

  it.each([
    ["This claim has no citation.", "missing citations"],
    ["This claim cites missing evidence. [E99]", "unknown citations"],
    ["First claim. Second claim. [E1]", "uncited sentences"],
  ])("rejects provider output with %s", async (output) => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer() {
        yield output;
      },
    };
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(questionRequest("How does pitching work?")),
    );

    expect(events.some((event) => event.type === "answer_delta")).toBe(false);
    expect(events).toContainEqual({
      type: "error",
      code: "provider_unavailable",
      message: "The answer service is temporarily unavailable.",
    });
  });

  it("forwards the request cancellation signal to the provider", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ signal }) {
        expect(signal).toBeInstanceOf(AbortSignal);
        yield "Grounded answer. [E1]";
      },
    };
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider: () => provider,
    });

    await (await handler(questionRequest("How does pitching work?"))).text();
  });
});
