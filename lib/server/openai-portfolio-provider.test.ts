import { describe, expect, it, vi } from "vitest";
import { createOpenAIPortfolioProvider } from "./openai-portfolio-provider";
import type { PortfolioGroundingEvidence } from "../portfolio-grounding";

const evidence: PortfolioGroundingEvidence[] = [
  {
    id: "project:pitching",
    title: "Pitching system",
    excerpt:
      "Research, curator selection, matching, and outreach arranged around a human approval step.",
    href: "/work/pitching",
    evidenceStatus: "needed",
    projectTitle: "Pitching system",
  },
];

function sseResponse(events: object[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

describe("OpenAI portfolio provider", () => {
  it("streams only text deltas while keeping the key in the server request header", async () => {
    const apiKey = "sk-test-server-only";
    const requests: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchImplementation: typeof fetch = async (input, init) => {
      requests.push([input, init]);
      return sseResponse([
        { type: "response.created" },
        { type: "response.output_text.delta", delta: "Human approval " },
        { type: "response.output_text.delta", delta: "stays explicit. [E1]" },
        {
          type: "response.completed",
          response: {
            status: "completed",
            usage: {
              input_tokens: 37,
              output_tokens: 11,
              total_tokens: 48,
            },
          },
        },
      ]);
    };
    const provider = createOpenAIPortfolioProvider({
      apiKey,
      model: "portfolio-model-test",
      reasoningEffort: "low",
      fetchImplementation,
    });

    const chunks: string[] = [];
    const onUsage = vi.fn();
    for await (const chunk of provider.streamAnswer({
      question: "How does pitching preserve approval?",
      evidence,
      safetyIdentifier: "pc_anonymous-session-hash",
      onUsage,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Human approval ", "stays explicit. [E1]"]);
    expect(chunks.join("")).not.toContain(apiKey);

    const [url, init] = requests[0] ?? [];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      `Bearer ${apiKey}`,
    );
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "portfolio-model-test",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      safety_identifier: "pc_anonymous-session-hash",
    });
    expect(JSON.stringify(body)).toContain("project:pitching");
    expect(JSON.stringify(body)).toContain(
      "Use only the supplied portfolio evidence",
    );
    expect(onUsage).toHaveBeenCalledWith({
      inputTokens: 37,
      outputTokens: 11,
      totalTokens: 48,
    });
  });

  it("does not expose an upstream error body", async () => {
    const upstreamSecret = "upstream-secret-detail";
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async () =>
        new Response(upstreamSecret, { status: 401 }),
    });

    let message = "";
    try {
      for await (const chunk of provider.streamAnswer({
        question: "How does pitching work?",
        evidence,
      })) {
        throw new Error(`Unexpected provider output: ${chunk}`);
      }
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe("OpenAI response request failed.");
    expect(message).not.toContain(upstreamSecret);
  });

  it("parses CRLF event boundaries split across transport chunks", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"type":"response.output_text.delta","delta":"Grounded. [E1]"}\r',
      "\n\r",
      '\ndata: {"type":"response.completed","response":{"status":"completed"}}\r\n\r\n',
    ];
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async (_input, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return new Response(
          new ReadableStream({
            start(controller) {
              for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
              controller.close();
            },
          }),
          { status: 200 },
        );
      },
    });

    const output: string[] = [];
    for await (const chunk of provider.streamAnswer({
      question: "How does pitching work?",
      evidence,
      signal: new AbortController().signal,
    })) {
      output.push(chunk);
    }
    expect(output).toEqual(["Grounded. [E1]"]);
  });

  it.each([
    { events: [{ type: "response.incomplete" }] },
    { events: [{ type: "response.output_text.delta", delta: "Truncated. [E1]" }] },
  ])("rejects streams that do not complete successfully", async ({ events }) => {
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async () => sseResponse(events),
    });

    await expect(async () => {
      for await (const chunk of provider.streamAnswer({
        question: "How does pitching work?",
        evidence,
      })) {
        expect(typeof chunk).toBe("string");
      }
    }).rejects.toThrow("OpenAI response stream failed.");
  });
});
