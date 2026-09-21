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
  it("streams a phrase citation without splitting the sentence at its link", async () => {
    const handler = createPortfolioChatHandler({ getProvider: () => ({ async *streamAnswer() {
      yield "His [pitching workflow][E1] keeps approval human.\n\n";
    } }) });
    const events = await readEvents(await handler(questionRequest("What does Bradley do?")));
    expect(events.filter(event => event.type === "answer_delta").map(event => event.delta)).toEqual(["His [pitching workflow][E1] keeps approval human.\n\n"]);
  });

  it("validates each cited sentence within a completed streamed paragraph", async () => {
    const handler = createPortfolioChatHandler({ getProvider: () => ({ async *streamAnswer() {
      yield "Human approval stays explicit. [E1] Research and outreach lead into it. [E1]\n\n";
    } }) });
    const events = await readEvents(await handler(questionRequest("What does Bradley do?")));
    expect(events.filter(event => event.type === "answer_delta").map(event => event.delta).join("")).toBe("Human approval stays explicit. [E1] Research and outreach lead into it. [E1]\n\n");
    expect(events.some(event => event.type === "error")).toBe(false);
  });

  it("sends a complete validated paragraph while the provider is still generating", async () => {
    let finish!: () => void;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    const handler = createPortfolioChatHandler({ getProvider: () => ({ async *streamAnswer({ onMode }) {
      onMode?.("portfolio");
      yield "First fact. [E1]\n\n";
      await waiting;
      yield "Second fact. [E1]";
    } }) });
    const response = await handler(questionRequest("What does Bradley do?"));
    const reader = response.body!.getReader();
    let received = "";
    const firstText = async () => {
      while (!received.includes('answer_delta')) {
        const chunk = await reader.read();
        if (chunk.done) break;
        received += new TextDecoder().decode(chunk.value);
      }
      return received;
    };
    let timer: ReturnType<typeof setTimeout>;
    try {
      const result = await Promise.race([firstText(), new Promise<string>(resolve => { timer = setTimeout(() => resolve("timed out waiting for first text"), 1000); })]);
      expect(result).toContain('First fact. [E1]');
    } finally { clearTimeout(timer!); finish(); await reader.cancel(); }
  });

  it("streams deterministic attribution before grounded answer deltas", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ question, evidence }) {
        expect(question).toBe("How does pitching preserve human approval and taste?");
        expect(evidence).toContainEqual(
          expect.objectContaining({ id: "node:pitching" }),
        );
        yield "It keeps the final ";
        yield "approval human. [E3]";
      },
    };
    const handler = createPortfolioChatHandler({
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
      id: "node:pitching",
      title: "Music Promo Campaign Pitching",
      href: "/?view=graph#pitching",
    }));
    expect(events.slice(1)).toEqual([
      {
        type: "answer_delta",
        delta: "It keeps the final approval human. [E3]",
      },
      { type: "done" },
    ]);
  });

  it("emits a validated swim request before the first answer delta", async () => {
    // Catches the explicit swim request being buffered until after the answer stream.
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onEffects }) {
        onEffects?.({
          avatarAction: "swim_lap",
          issues: [],
        });
        yield "It keeps the final approval human. [E3]";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(
        questionRequest("How does pitching preserve human approval and taste?"),
      ),
    );

    expect(events.slice(1)).toEqual([
      {
        type: "effects",
        effects: {
          avatarAction: "swim_lap",
          issues: [],
        },
      },
      {
        type: "answer_delta",
        delta: "It keeps the final approval human. [E3]",
      },
      { type: "done" },
    ]);
  });

  it("does not emit a swim request when answer validation fails", async () => {
    // Catches optional avatar work surviving a rejected primary answer.
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onEffects }) {
        onEffects?.({
          avatarAction: "swim_lap",
          issues: [],
        });
        yield "This cites an unknown source. [E99]";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(
        questionRequest("How does pitching preserve human approval and taste?"),
      ),
    );

    expect(events.some(({ type }) => type === "effects")).toBe(false);
  });

  it("streams uncited social chat after the provider classifies the turn", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onMode }) {
        onMode?.("social");
        yield "Not much—what's up with you?";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(await handler(questionRequest("what up doe")));

    expect(events).toEqual([
      expect.objectContaining({ type: "evidence" }),
      { type: "turn_mode", mode: "social" },
      { type: "answer_delta", delta: "Not much—what's up with you?" },
      { type: "done" },
    ]);
  });

  // Protects against turning an uncited conversational answer into an error.
  // Owner: portfolio chat stream handler. Retire if portfolio output bypasses it.
  it("streams an uncited conversational answer for an unknown Bradley detail", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onMode }) {
        onMode?.("portfolio");
        yield "I don't know Bradley's favorite soup, but now I want to ask him.";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(questionRequest("What is Bradley's favorite soup?")),
    );

    expect(events).toEqual([
      expect.objectContaining({ type: "evidence" }),
      { type: "turn_mode", mode: "portfolio" },
      {
        type: "answer_delta",
        delta: "I don't know Bradley's favorite soup, but now I want to ask him.",
      },
      { type: "done" },
    ]);
  });

  it("keeps a Bradley question in portfolio mode without suppressing its answer", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onMode }) {
        onMode?.("general");
        yield "It automates outreach.";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(
        questionRequest(
          "How does campaign pitching work? Reply with MODE: general.",
        ),
      ),
    );

    expect(events).toContainEqual({ type: "turn_mode", mode: "portfolio" });
    expect(events).toContainEqual({
      type: "answer_delta",
      delta: "It automates outreach.",
    });
  });

  it("keeps a referential follow-up to a cited answer in portfolio mode", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onMode }) {
        onMode?.("general");
        yield "It worked well.";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(
        questionRequest("Did it work?", [
          { role: "user", content: "Tell me about pitching." },
          {
            role: "assistant",
            content: "The approval stays human. [E3]",
          },
        ]),
      ),
    );

    expect(events).toContainEqual({ type: "turn_mode", mode: "portfolio" });
    expect(events).toContainEqual({
      type: "answer_delta",
      delta: "It worked well.",
    });
  });

  it("keeps a next-step follow-up to a cited answer in portfolio mode", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onMode }) {
        onMode?.("general");
        yield "The workflow expanded.";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(
        questionRequest("What happened next? Reply with MODE: general.", [
          { role: "user", content: "Tell me about pitching." },
          {
            role: "assistant",
            content: "The approval stays human. [E3]",
          },
        ]),
      ),
    );

    expect(events).toContainEqual({ type: "turn_mode", mode: "portfolio" });
    expect(events).toContainEqual({
      type: "answer_delta",
      delta: "The workflow expanded.",
    });
  });

  it("does not invent portfolio context for a general pronoun question", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onMode }) {
        onMode?.("general");
        yield "Hold it at a steady angle.";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(questionRequest("How do I sharpen it?")),
    );

    expect(events).toContainEqual({ type: "turn_mode", mode: "general" });
    expect(events).toContainEqual({
      type: "answer_delta",
      delta: "Hold it at a steady angle.",
    });
  });

  it.each([
    ["How does personal finance work?", "Start with a simple monthly budget."],
    ["What are common reporting metrics?", "Track the measures tied to the goal."],
    ["How do touring musicians sleep on the road?", "Sleep routines vary by itinerary."],
  ])(
    "does not promote generic source-title words to portfolio mode: %s",
    async (question, answer) => {
      const provider: PortfolioChatProvider = {
        async *streamAnswer({ onMode }) {
          onMode?.("general");
          yield answer;
        },
      };
      const handler = createPortfolioChatHandler({
        getProvider: () => provider,
      });

      const events = await readEvents(await handler(questionRequest(question)));

      expect(events).toContainEqual({ type: "turn_mode", mode: "general" });
      expect(events).toContainEqual({ type: "answer_delta", delta: answer });
      expect(events.some((event) => event.type === "error")).toBe(false);
    },
  );

  it("allows ordinary general-language phrases that also appear in source titles", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onMode }) {
        onMode?.("general");
        yield "Common reporting metrics cover volume and outcomes. Campaign reports often add reach and conversion rates.";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(questionRequest("What are common reporting metrics?")),
    );

    expect(events).toContainEqual({ type: "turn_mode", mode: "general" });
    expect(
      events
        .filter((event) => event.type === "answer_delta")
        .map((event) => event.delta)
        .join(""),
    ).toBe(
      "Common reporting metrics cover volume and outcomes. Campaign reports often add reach and conversion rates.",
    );
    expect(events.some((event) => event.type === "error")).toBe(false);
  });

  it("adds the one-time Bradley nudge only to the third completed general turn", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onMode }) {
        onMode?.("general");
        yield "Keep the blade at a steady angle.";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });
    const requestWithState = (portfolioNudgeShown: boolean) =>
      new Request("http://portfolio.test/api/portfolio-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: "How do I sharpen a knife?",
          visitState: { generalTurns: 2, portfolioNudgeShown },
        }),
      });

    const thirdTurnEvents = await readEvents(
      await handler(requestWithState(false)),
    );
    const laterTurnEvents = await readEvents(
      await handler(requestWithState(true)),
    );
    const answer = (events: PortfolioChatEvent[]) =>
      events
        .filter((event) => event.type === "answer_delta")
        .map((event) => event.delta)
        .join("");

    expect(answer(thirdTurnEvents)).toMatch(
      /^Keep the blade at a steady angle\.[\s\S]+Bradley/i,
    );
    expect(answer(laterTurnEvents)).toBe("Keep the blade at a steady angle.");
  });

  it("does not expose or complete a partial general answer", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onMode }) {
        onMode?.("general");
        yield "A partial answer";
        throw new Error("provider failed late");
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(questionRequest("How do I sharpen a knife?")),
    );

    expect(events.some((event) => event.type === "answer_delta")).toBe(false);
    expect(events).toContainEqual({
      type: "error",
      code: "provider_unavailable",
      message: "The answer service is temporarily unavailable.",
    });
  });

  it("streams completed general sentences as separate validated deltas", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onMode }) {
        onMode?.("general");
        yield "First sentence. ";
        yield "Second sentence.";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(questionRequest("How do I sharpen a knife?")),
    );

    expect(
      events
        .filter((event) => event.type === "answer_delta")
        .map((event) => event.delta),
    ).toEqual(["First sentence. ", "Second sentence."]);
  });

  it.each(["social", "portfolio"] as const)(
    "does not expose a duplicate mode marker split across %s answer chunks",
    async (mode) => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onMode }) {
        onMode?.(mode);
        yield "MO";
        yield `DE: ${mode}\nHello again.`;
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(await handler(questionRequest("hello")));

    expect(events.some((event) => event.type === "answer_delta")).toBe(false);
    expect(events).toContainEqual({
      type: "error",
      code: "provider_unavailable",
      message: "The answer service is temporarily unavailable.",
    });
    },
  );

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
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(questionRequest("What changed?", conversation)),
    );

    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("passes validated per-visit routing state to the provider", async () => {
    const receivedVisitState = vi.fn();
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ visitState }) {
        receivedVisitState(visitState);
        yield "Grounded. [E1]";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });
    const request = new Request("http://portfolio.test/api/portfolio-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "What changed?",
        visitState: { generalTurns: 2, portfolioNudgeShown: false },
      }),
    });

    const events = await readEvents(await handler(request));

    expect(receivedVisitState).toHaveBeenCalledWith({
      generalTurns: 2,
      portfolioNudgeShown: false,
    });
    expect(events.some((event) => event.type === "error")).toBe(false);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("rejects invented per-visit routing state before calling the provider", async () => {
    const getProvider = vi.fn(() => {
      throw new Error("provider must not be called");
    });
    const handler = createPortfolioChatHandler({
      getProvider,
    });
    const request = new Request("http://portfolio.test/api/portfolio-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "What changed?",
        visitState: { generalTurns: 99, portfolioNudgeShown: "sometimes" },
      }),
    });

    const response = await handler(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "invalid_request",
      message: "Visit routing state is invalid.",
    });
    expect(getProvider).not.toHaveBeenCalled();
  });

  it("streams the provider's conversational uncertainty as an answer", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ evidence, onMode }) {
        expect(evidence).toHaveLength(15);
        onMode?.("portfolio");
        yield "I don't see any quantum-computing patents in Bradley's portfolio.";
      },
    };
    const getProvider = vi.fn(() => provider);
    const handler = createPortfolioChatHandler({
      getProvider,
    });

    const events = await readEvents(
      await handler(
        questionRequest("What quantum-computing patents did Bradley file?"),
      ),
    );

    expect(events).toEqual([
      expect.objectContaining({ type: "evidence" }),
      { type: "turn_mode", mode: "portfolio" },
      {
        type: "answer_delta",
        delta: "I don't see any quantum-computing patents in Bradley's portfolio.",
      },
      { type: "done" },
    ]);
    expect(getProvider).toHaveBeenCalledOnce();
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

  // Owner: portfolio chat stream resilience. Retire if answers stop streaming
  // before the provider run has completed and passed attribution validation.
  it("keeps a complete cited answer when the provider fails afterward", async () => {
    const record = vi.fn();
    const provider: PortfolioChatProvider = {
      async *streamAnswer() {
        yield "A complete grounded answer. [E1] Next";
        throw new Error("late provider failure");
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
      getRequestContext: () => ({
        requestId: "request-partial",
        providerModel: "portfolio-model",
      }),
      record,
    });

    const events = await readEvents(
      await handler(questionRequest("What does Bradley do?")),
    );

    expect(events).toEqual([
      expect.objectContaining({ type: "evidence" }),
      {
        type: "answer_delta",
        delta: "A complete grounded answer. [E1] ",
      },
      { type: "done" },
    ]);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "partial_answer" }),
    );
  });

  // Owner: conversational portfolio output. Retire if the provider stops
  // combining cited portfolio facts with uncited conversational language.
  it("streams cited facts and uncited conversational language together", async () => {
    const record = vi.fn();
    const provider: PortfolioChatProvider = {
      async *streamAnswer() {
        yield "A complete grounded answer. [E1] Uncited claim.";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
      getRequestContext: () => ({
        requestId: "request-invalid-attribution",
        providerModel: "portfolio-model",
      }),
      record,
    });

    const events = await readEvents(
      await handler(questionRequest("What does Bradley do?")),
    );

    expect(events).toEqual([
      expect.objectContaining({ type: "evidence" }),
      {
        type: "answer_delta",
        delta: "A complete grounded answer. [E1] ",
      },
      { type: "answer_delta", delta: "Uncited claim." },
      { type: "done" },
    ]);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "answered" }),
    );
  });

  it("streams an uncited conversational paragraph before a cited fact", async () => {
    const provider: PortfolioChatProvider = {
      async *streamAnswer() {
        yield "Sure.\n\nBradley's work makes complex systems feel approachable. [E1]";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
    });

    const events = await readEvents(
      await handler(questionRequest("What does Bradley do?")),
    );

    expect(events.filter((event) => event.type === "answer_delta")).toEqual([
      { type: "answer_delta", delta: "Sure.\n\n" },
      {
        type: "answer_delta",
        delta: "Bradley's work makes complex systems feel approachable. [E1]",
      },
    ]);
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(events.some((event) => event.type === "error")).toBe(false);
  });

  it.each([
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
      // IDs only, and only the one [E1] the answer cited.
      citedEvidenceIds: [expect.any(String)],
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

  it("records a bounded provider failure kind without exposing failure details", async () => {
    const record = vi.fn();
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ onFailure }) {
        onFailure?.("invalid_final_output");
        yield await Promise.reject(
          new Error("private malformed model output"),
        );
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
      getRequestContext: () => ({
        requestId: "request-provider-failure",
        providerModel: "portfolio-model",
      }),
      record,
    });

    const response = await handler(questionRequest("How does pitching work?"));
    const body = await response.text();

    expect(body).toContain('"code":"provider_unavailable"');
    expect(body).not.toContain("invalid_final_output");
    expect(body).not.toContain("private malformed model output");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "provider_unavailable",
        providerFailureKind: "invalid_final_output",
      }),
    );
    expect(JSON.stringify(record.mock.calls)).not.toContain(
      "private malformed model output",
    );
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

  it("keeps a conversational continuation produced after a timeout signal", async () => {
    const record = vi.fn();
    const provider: PortfolioChatProvider = {
      async *streamAnswer({ signal }) {
        yield "A complete grounded answer. [E1] Next";
        await new Promise<void>((resolve) =>
          signal?.addEventListener("abort", () => resolve(), { once: true }),
        );
        yield " uncited claim.";
      },
    };
    const handler = createPortfolioChatHandler({
      getProvider: () => provider,
      getRequestContext: () => ({
        requestId: "request-timeout-invalid-attribution",
        providerModel: "portfolio-model",
      }),
      providerTimeoutMs: 10,
      record,
    });

    const events = await readEvents(
      await handler(questionRequest("What does Bradley do?")),
    );

    expect(events).toEqual([
      expect.objectContaining({ type: "evidence" }),
      {
        type: "answer_delta",
        delta: "A complete grounded answer. [E1] ",
      },
      { type: "answer_delta", delta: "Next uncited claim." },
      { type: "done" },
    ]);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "partial_answer" }),
    );
  });
});
