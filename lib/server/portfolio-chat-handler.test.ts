import { describe, expect, it, vi } from "vitest";
import { createPortfolioChatHandler } from "./portfolio-chat-handler";
import type { PortfolioChatProvider } from "./portfolio-chat-provider";
import type { PortfolioChatEvent } from "../portfolio-chat-protocol";

function questionRequest(
  question: string,
  conversation?: Array<{ role: "user" | "assistant"; content: string }>,
) {
  return new Request("http://portfolio.test/api/portfolio-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, ...(conversation ? { conversation } : {}) }),
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
        expect(evidence).toContainEqual(
          expect.objectContaining({ id: "project:pitching" }),
        );
        yield "It keeps the final ";
        yield "approval human. [E3]";
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
    expect(events[0].evidence).toContainEqual(expect.objectContaining({
      id: "project:pitching",
      title: "Pitching system",
      href: "/index/pitching",
      evidenceStatus: "needed",
    }));
    expect(events.slice(1)).toEqual([
      {
        type: "answer_delta",
        delta: "It keeps the final approval human. [E3]",
      },
      { type: "done" },
    ]);
  });

  it("passes visit conversation context to the provider while grounding the current question", async () => {
    const conversation = [
      { role: "user" as const, content: "Tell me about pitching." },
      { role: "assistant" as const, content: "It keeps approval human. [E1]" },
    ];
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ question, conversation: receivedConversation }) {
        expect(question).toBe("What changed?");
        expect(receivedConversation).toEqual(conversation);
        yield "The approval step remains explicit. [E1]";
      },
    };
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(questionRequest("What changed?", conversation)),
    );

    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("lets the provider decide when complete portfolio context cannot answer", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ evidence }) {
        expect(evidence).toHaveLength(10);
        yield "The portfolio does not publish enough evidence to answer that question.";
      },
    };
    const getProvider = vi.fn(() => provider);
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
      expect.objectContaining({ type: "evidence" }),
      {
        type: "notice",
        code: "insufficient_evidence",
        message:
          "The portfolio does not publish enough evidence to answer that question.",
      },
      { type: "done" },
    ]);
    expect(getProvider).toHaveBeenCalledOnce();
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

  it("maps an answer followed by an evidence-gap result to a clearing error", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer() {
        yield "Published answer. [E1] ";
        yield "The portfolio does not publish enough evidence to answer that question.";
      },
    };
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(questionRequest("Tell me about Bradley.")),
    );

    expect(events.some((event) => event.type === "answer_delta")).toBe(true);
    expect(events.some((event) => event.type === "notice")).toBe(false);
    expect(events).toContainEqual({
      type: "error",
      code: "provider_unavailable",
      message: "The answer service is temporarily unavailable.",
    });
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
    ["This claim uses a noncanonical citation. [E01]", "zero-padded citations"],
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

  it("passes a privacy-safe identity to the provider and records only bounded stream metadata", async () => {
    const record = vi.fn();
    const nowValues = [1_000, 1_025];
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ safetyIdentifier, onUsage }) {
        expect(safetyIdentifier).toBe("pc_session-hash");
        onUsage?.({ inputTokens: 20, outputTokens: 7, totalTokens: 27 });
        yield "Human approval stays explicit. [E1]";
      },
    };
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider: () => provider,
      getRequestContext: () => ({
        requestId: "request-safe",
        safetyIdentifier: "pc_session-hash",
        providerModel: "portfolio-model",
      }),
      now: () => nowValues.shift() ?? 1_025,
      record,
    });

    const response = await handler(
      questionRequest("private question that must never enter telemetry"),
    );
    await response.text();

    expect(record).toHaveBeenCalledWith({
      event: "portfolio_chat_stream",
      requestId: "request-safe",
      outcome: "answered",
      evidenceCount: expect.any(Number),
      evidenceIds: expect.any(Array),
      durationMs: 25,
      answerCharacters: 35,
      providerModel: "portfolio-model",
      usage: { inputTokens: 20, outputTokens: 7, totalTokens: 27 },
    });
    const serialized = JSON.stringify(record.mock.calls);
    expect(serialized).not.toContain("private question");
    expect(serialized).not.toContain("Human approval stays explicit");
    expect(serialized).not.toContain("pc_session-hash");
  });

  it("delivers a validated cited segment before the provider finishes", async () => {
    let releaseProvider = () => {};
    let providerReleased = false;
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = () => {
        providerReleased = true;
        resolve();
      };
    });
    const provider: PortfolioChatProvider = {
      async *streamAnswer() {
        yield "The first cited sentence streams. [E1] The";
        await providerGate;
        yield " second cited sentence follows. [E1]";
      },
    };
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider: () => provider,
    });
    const response = await handler(questionRequest("How does pitching work?"));
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let received = "";

    while (!received.includes('"type":"answer_delta"')) {
      const { value, done } = await reader.read();
      if (done) throw new Error("Stream ended before the first answer segment.");
      received += decoder.decode(value, { stream: true });
    }

    expect(providerReleased).toBe(false);
    expect(received.indexOf('"type":"evidence"')).toBeLessThan(
      received.indexOf('"type":"answer_delta"'),
    );
    expect(received).toContain("The first cited sentence streams. [E1]");

    releaseProvider();
    while (!(await reader.read()).done) {
      // Drain the completed response.
    }
  });

  it("aborts provider work when the response reader cancels and records one aborted outcome", async () => {
    let providerSignal: AbortSignal | undefined;
    let observedAbort = () => {};
    const aborted = new Promise<void>((resolve) => {
      observedAbort = resolve;
    });
    const record = vi.fn();
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ signal }) {
        providerSignal = signal;
        signal?.addEventListener("abort", observedAbort, { once: true });
        yield "A cited sentence streams. [E1] More";
        await aborted;
      },
    };
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider: () => provider,
      getRequestContext: () => ({
        requestId: "request-cancelled",
        safetyIdentifier: "pc_cancelled",
        providerModel: "portfolio-model",
      }),
      record,
    });
    const response = await handler(questionRequest("How does pitching work?"));
    const reader = response.body!.getReader();

    await reader.read();
    await reader.cancel();
    await aborted;
    await vi.waitFor(() => expect(record).toHaveBeenCalledTimes(1));

    expect(providerSignal?.aborted).toBe(true);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "request-cancelled",
        outcome: "aborted",
      }),
    );
  });

  it("times out provider work with a redacted stream error", async () => {
    const record = vi.fn();
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ signal }) {
        await new Promise<void>((resolve) =>
          signal?.addEventListener("abort", () => resolve(), { once: true }),
        );
        yield "";
      },
    };
    const handler = createPortfolioChatHandler({
      isEnabled: () => true,
      getProvider: () => provider,
      getRequestContext: () => ({
        requestId: "request-timeout",
        safetyIdentifier: "pc_timeout",
        providerModel: "portfolio-model",
      }),
      providerTimeoutMs: 10,
      record,
    });

    const response = await handler(questionRequest("How does pitching work?"));
    const body = await response.text();

    expect(body).toContain('"code":"provider_unavailable"');
    expect(body).not.toContain("TimeoutError");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "request-timeout",
        outcome: "provider_unavailable",
      }),
    );
  });
});
