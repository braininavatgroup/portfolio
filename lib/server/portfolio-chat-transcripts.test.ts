// Owns: whether a finished Guide turn is kept, where, and in what shape — the
// transcript gate, the consent-bearing tab id, the handler's capture of mode,
// answer, and outcome, and that keeping never touches the visitor's answer.
// Retire with chat transcripts.
import { describe, expect, it, vi } from "vitest";

import { createPortfolioChatHandler } from "./portfolio-chat-handler";
import {
  CHAT_TRANSCRIPT_PREFIX,
  MAX_TRANSCRIPT_ANSWER_CHARACTERS,
  chatTranscriptKey,
  createChatTranscriptKeeper,
  type FinishedChatTurn,
} from "./portfolio-chat-transcripts";

const SESSION = "tab-session-0001";

function request(body: Record<string, unknown>) {
  const value = new Request("https://bradleyberkman.com/api/portfolio-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148",
      "cf-connecting-ip": "203.0.113.9",
    },
    body: JSON.stringify(body),
  });
  Object.defineProperty(value, "cf", {
    value: { country: "US", regionCode: "NY", city: "New York City", latitude: "40.7", postalCode: "10001" },
  });
  return value;
}

function bucket() {
  const puts: Array<{ key: string; value: string }> = [];
  return {
    puts,
    put: vi.fn(async (key: string, value: string) => {
      puts.push({ key, value });
    }),
  };
}

const turn: FinishedChatTurn = {
  requestId: "3f1c2b8e-1111-4222-8333-944455556666",
  sessionId: SESSION,
  mode: "portfolio",
  outcome: "answered",
  question: "What is Writ?",
  answer: "Writ is a product Bradley built. [E1]",
  citedEvidenceIds: ["node:writ"],
  durationMs: 1200,
};

describe("chat transcript keeper", () => {
  it("is off unless the gate is exactly r2 and the bucket is bound", () => {
    const store = bucket();
    const req = request({ question: "hi" });
    expect(createChatTranscriptKeeper({ env: {}, request: req })).toBeUndefined();
    expect(createChatTranscriptKeeper({ env: { PORTFOLIO_INSIGHTS_STORE: store }, request: req })).toBeUndefined();
    expect(
      createChatTranscriptKeeper({ env: { PORTFOLIO_CHAT_TRANSCRIPTS: "on", PORTFOLIO_INSIGHTS_STORE: store }, request: req }),
    ).toBeUndefined();
    expect(createChatTranscriptKeeper({ env: { PORTFOLIO_CHAT_TRANSCRIPTS: "r2" }, request: req })).toBeUndefined();
  });

  it("keeps one dated record per turn, with coarse location and nothing identifying", async () => {
    const store = bucket();
    const keep = createChatTranscriptKeeper({
      env: { PORTFOLIO_CHAT_TRANSCRIPTS: "r2", PORTFOLIO_INSIGHTS_STORE: store },
      request: request({ question: "What is Writ?" }),
      now: () => Date.parse("2026-09-21T12:34:56.789Z"),
    })!;
    await keep(turn);

    expect(store.puts).toHaveLength(1);
    const [{ key, value }] = store.puts;
    expect(key).toBe(`${CHAT_TRANSCRIPT_PREFIX}2026-09-21/2026-09-21T12-34-56-789Z-${turn.requestId}.json`);
    const record = JSON.parse(value);
    expect(record).toEqual({
      version: 1,
      capturedAt: "2026-09-21T12:34:56.789Z",
      requestId: turn.requestId,
      sessionId: SESSION,
      mode: "portfolio",
      outcome: "answered",
      question: "What is Writ?",
      answer: turn.answer,
      answerTruncated: false,
      citedEvidenceIds: ["node:writ"],
      durationMs: 1200,
      country: "US",
      regionCode: "NY",
      city: "New York City",
      device: "mobile",
    });
    // Neither the address, the user agent string, nor any finer location.
    expect(value).not.toMatch(/203\.0\.113\.9|iPhone OS|40\.7|10001/u);
  });

  it("keeps nothing for a turn without a tab id, so a declined or opted-out visit is never kept", async () => {
    const store = bucket();
    const keep = createChatTranscriptKeeper({
      env: { PORTFOLIO_CHAT_TRANSCRIPTS: "r2", PORTFOLIO_INSIGHTS_STORE: store },
      request: request({ question: "hi" }),
    })!;
    await keep({ ...turn, sessionId: undefined });
    expect(store.put).not.toHaveBeenCalled();
  });

  it("cuts a runaway answer at the cap and says so", async () => {
    const store = bucket();
    const keep = createChatTranscriptKeeper({
      env: { PORTFOLIO_CHAT_TRANSCRIPTS: "r2", PORTFOLIO_INSIGHTS_STORE: store },
      request: request({ question: "hi" }),
    })!;
    await keep({ ...turn, answer: "x".repeat(MAX_TRANSCRIPT_ANSWER_CHARACTERS + 1) });
    const record = JSON.parse(store.puts[0].value);
    expect(record.answer).toHaveLength(MAX_TRANSCRIPT_ANSWER_CHARACTERS);
    expect(record.answerTruncated).toBe(true);
  });

  it("swallows a storage failure", async () => {
    const keep = createChatTranscriptKeeper({
      env: {
        PORTFOLIO_CHAT_TRANSCRIPTS: "r2",
        PORTFOLIO_INSIGHTS_STORE: { put: async () => { throw new Error("R2 down"); } },
      },
      request: request({ question: "hi" }),
    })!;
    await expect(keep(turn)).resolves.toBeUndefined();
  });

  it("keeps request ids out of the key's path structure", () => {
    expect(chatTranscriptKey("2026-09-21T00:00:00.000Z", "../../x")).toBe(
      "chat/2026-09-21/2026-09-21T00-00-00-000Z-x.json",
    );
  });
});

describe("the chat handler's finished turn", () => {
  const context = () => ({ requestId: turn.requestId, providerModel: "test-model" });
  // The handler schedules the keeper through waitUntil; tests await what it scheduled.
  let scheduled: Promise<unknown>[] = [];
  const waitUntil = (work: Promise<unknown>) => {
    scheduled.push(work);
  };
  const settle = () => Promise.all(scheduled).finally(() => {
    scheduled = [];
  });

  it("hands the keeper the question, the streamed answer, the mode, and the tab id", async () => {
    const kept: FinishedChatTurn[] = [];
    const handler = createPortfolioChatHandler({
      getProvider: () => ({
        async *streamAnswer({ onMode }) {
          onMode?.("portfolio");
          yield "His [pitching workflow][E1] keeps approval human.\n\n";
        },
      }),
      getRequestContext: context,
      waitUntil,
      keepTranscript: async (value) => {
        kept.push(value);
      },
    });
    const response = await handler(request({ question: "What does Bradley do?", sessionId: SESSION }));
    await response.text();
    await settle();

    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({
      requestId: turn.requestId,
      sessionId: SESSION,
      mode: "portfolio",
      outcome: "answered",
      question: "What does Bradley do?",
      answer: "His [pitching workflow][E1] keeps approval human.\n\n",
    });
    // Only what the answer cited: [E1] is the first grounding item.
    expect(kept[0].citedEvidenceIds).toHaveLength(1);
  });

  it("records what the answer cited, in first-cited order, not the whole grounding set", async () => {
    const kept: FinishedChatTurn[] = [];
    const logged: string[][] = [];
    const handler = createPortfolioChatHandler({
      getProvider: () => ({
        async *streamAnswer({ onMode }) {
          onMode?.("portfolio");
          yield "Human approval stays explicit. [E2]\n\n";
          yield "Research leads into it. [E1] It stays human. [E2]\n\n";
        },
      }),
      getRequestContext: context,
      record: (event) => logged.push(event.citedEvidenceIds),
      waitUntil,
      keepTranscript: async (value) => {
        kept.push(value);
      },
    });
    const body = await (await handler(request({ question: "What does Bradley do?", sessionId: SESSION }))).text();
    await settle();
    const evidence = body
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .find((event) => event.type === "evidence").evidence as Array<{ id: string }>;
    expect(evidence.length).toBeGreaterThan(2);
    expect(kept[0].citedEvidenceIds).toEqual([evidence[1].id, evidence[0].id]);
    expect(logged).toEqual([[evidence[1].id, evidence[0].id]]);
  });

  it("keeps a question the portfolio could not answer, with no mode", async () => {
    const kept: FinishedChatTurn[] = [];
    const handler = createPortfolioChatHandler({
      getProvider: () => {
        throw new Error("the provider is never reached without evidence");
      },
      getRequestContext: context,
      waitUntil,
      keepTranscript: async (value) => {
        kept.push(value);
      },
    });
    const response = await handler(request({ question: "zzqx vbnm", sessionId: SESSION }), {
      question: "zzqx vbnm",
      sessionId: SESSION,
      grounding: { evidence: [] } as never,
    });
    await response.text();
    await settle();
    expect(kept).toEqual([
      expect.objectContaining({ outcome: "insufficient_evidence", mode: "none", question: "zzqx vbnm", answer: "" }),
    ]);
  });

  it("ignores a malformed tab id instead of refusing the question", async () => {
    const kept: FinishedChatTurn[] = [];
    const handler = createPortfolioChatHandler({
      getProvider: () => ({
        async *streamAnswer({ onMode }) {
          onMode?.("portfolio");
          yield "His [pitching workflow][E1] keeps approval human.\n\n";
        },
      }),
      getRequestContext: context,
      waitUntil,
      keepTranscript: async (value) => {
        kept.push(value);
      },
    });
    const response = await handler(request({ question: "What does Bradley do?", sessionId: "bad id!" }));
    expect(response.status).toBe(200);
    await response.text();
    await settle();
    expect(kept[0].sessionId).toBeUndefined();
  });

  it("still streams the full answer when keeping it fails", async () => {
    const handler = createPortfolioChatHandler({
      getProvider: () => ({
        async *streamAnswer({ onMode }) {
          onMode?.("portfolio");
          yield "His [pitching workflow][E1] keeps approval human.\n\n";
        },
      }),
      getRequestContext: context,
      waitUntil,
      keepTranscript: async () => {
        throw new Error("R2 down");
      },
    });
    const body = await (await handler(request({ question: "What does Bradley do?", sessionId: SESSION }))).text();
    expect(body).toContain("keeps approval human");
    expect(body).toContain('"type":"done"');
    await settle();
  });

  it("closes the stream after done while a transcript write never finishes", async () => {
    const recorded: string[] = [];
    const handler = createPortfolioChatHandler({
      getProvider: () => ({
        async *streamAnswer({ onMode }) {
          onMode?.("portfolio");
          yield "His [pitching workflow][E1] keeps approval human.\n\n";
        },
      }),
      getRequestContext: context,
      record: (event) => recorded.push(event.event),
      waitUntil,
      keepTranscript: () => new Promise<void>(() => {}),
    });
    const response = await handler(request({ question: "What does Bradley do?", sessionId: SESSION }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const body = await Promise.race([
      response.text(),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve("stream never closed"), 1000);
      }),
    ]).finally(() => clearTimeout(timer));
    expect(body).toContain('"type":"done"');
    // The operational event does not wait on the write either.
    expect(recorded).toEqual(["portfolio_chat_stream"]);
    expect(scheduled).toHaveLength(1);
    scheduled = [];
  });
});
