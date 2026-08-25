import { describe, expect, it, vi } from "vitest";
import { createOpenAIPortfolioProvider } from "./openai-portfolio-provider";
import {
  INSUFFICIENT_EVIDENCE_MESSAGE,
  type PortfolioChatProviderInput,
} from "./portfolio-chat-provider";
import type { PortfolioGroundingEvidence } from "../portfolio-grounding";

const evidence: PortfolioGroundingEvidence[] = [
  {
    id: "project:pitching",
    title: "Pitching system",
    excerpt:
      "Research, curator selection, matching, and outreach arranged around a human approval step.",
    href: "/index/pitching",
    evidenceStatus: "needed",
    projectTitle: "Pitching system",
  },
];

const secondEvidence: PortfolioGroundingEvidence = {
  id: "project:reporting",
  title: "Campaign reporting",
  excerpt: "Reporting turns campaign activity into a reviewable record.",
  href: "/index/reporting",
  evidenceStatus: "needed",
  projectTitle: "Campaign reporting",
};

type StructuredOutput = {
  mode: "portfolio" | "social" | "general";
  insufficientEvidence: boolean;
  sentences: Array<{ text: string; evidenceIds: string[] }>;
};

function completedResponse(
  output: StructuredOutput | string,
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number },
) {
  const text = typeof output === "string" ? output : JSON.stringify(output);
  return Response.json({
    id: "resp_portfolio_test",
    output: [
      {
        id: "msg_portfolio_test",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text, annotations: [] }],
      },
    ],
    usage,
  });
}

function portfolioOutput(
  sentences: StructuredOutput["sentences"],
): StructuredOutput {
  return { mode: "portfolio", insufficientEvidence: false, sentences };
}

describe("OpenAI portfolio provider", () => {
  it("renders portfolio citations from structured evidence ids instead of model-authored labels", async () => {
    let requestBody = "";
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async (_input, init) => {
        requestBody = String(init?.body);
        return completedResponse(
          portfolioOutput([
            {
              text: "Human approval stays explicit.",
              evidenceIds: ["project:pitching"],
            },
            {
              text: "The system arranges research and outreach around that approval.",
              evidenceIds: ["project:pitching"],
            },
          ]),
          { input_tokens: 37, output_tokens: 29, total_tokens: 66 },
        );
      },
    });

    const chunks: string[] = [];
    const onMode = vi.fn();
    const onUsage = vi.fn();
    for await (const chunk of provider.streamAnswer({
      question: "How does pitching preserve approval?",
      evidence,
      onMode,
      onUsage,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      "Human approval stays explicit. [E1]\n\nThe system arranges research and outreach around that approval. [E1]",
    ]);
    expect(onMode).toHaveBeenCalledWith("portfolio");
    expect(onUsage).toHaveBeenCalledWith({
      inputTokens: 37,
      outputTokens: 29,
      totalTokens: 66,
    });

    const body = JSON.parse(requestBody);
    expect(body.stream).toBe(false);
    expect(body.text?.format).toMatchObject({
      type: "json_schema",
      strict: true,
    });
    expect(body.instructions).not.toContain(
      "Every factual sentence must end with one or more evidence labels",
    );
  });

  it("cites every sentence when the model groups sentences into one structured item", async () => {
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async () =>
        completedResponse(
          portfolioOutput([
            {
              text: "Human approval stays explicit. Research and outreach lead into it.",
              evidenceIds: ["project:pitching"],
            },
          ]),
        ),
    });

    const chunks: string[] = [];
    for await (const chunk of provider.streamAnswer({
      question: "How does pitching preserve approval?",
      evidence,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      "Human approval stays explicit. [E1] Research and outreach lead into it. [E1]",
    ]);
  });

  it.each(["portfolio", "general"] as const)(
    "rejects model-authored citation labels in %s text",
    async (mode) => {
      const onFailure = vi.fn();
      const provider = createOpenAIPortfolioProvider({
        apiKey: "sk-test-server-only",
        model: "portfolio-model-test",
        fetchImplementation: async () =>
          completedResponse({
            mode,
            insufficientEvidence: false,
            sentences: [
              {
                text: "The model tried to attach another source. [E2]",
                evidenceIds:
                  mode === "portfolio" ? ["project:pitching"] : [],
              },
            ],
          }),
      });

      await expect(async () => {
        for await (const chunk of provider.streamAnswer({
          question: "How does pitching work?",
          evidence: [...evidence, secondEvidence],
          onFailure,
        })) {
          throw new Error(`Unexpected provider output: ${chunk}`);
        }
      }).rejects.toThrow("OpenAI agent run failed.");
      expect(onFailure).toHaveBeenCalledWith("citation_label");
    },
  );

  it.each([
    ["social", "Not much, what's up?"],
    ["general", "Keep the blade at a steady angle."],
  ] as const)("returns an uncited %s answer from the structured result", async (mode, answer) => {
    const onMode = vi.fn();
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async () =>
        completedResponse({
          mode,
          insufficientEvidence: false,
          sentences: [{ text: answer, evidenceIds: [] }],
        }),
    });

    const chunks: string[] = [];
    for await (const chunk of provider.streamAnswer({
      question: mode === "social" ? "what up doe" : "How do I sharpen a knife?",
      evidence,
      onMode,
    })) {
      chunks.push(chunk);
    }

    expect(onMode).toHaveBeenCalledWith(mode);
    expect(chunks).toEqual([answer]);
  });

  it("keeps credentials server-side and sends the bounded model configuration", async () => {
    const apiKey = "sk-test-server-only";
    const requests: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchImplementation: typeof fetch = async (input, init) => {
      requests.push([input, init]);
      return completedResponse(
        portfolioOutput([
          {
            text: "Human approval stays explicit.",
            evidenceIds: ["project:pitching"],
          },
        ]),
        { input_tokens: 37, output_tokens: 11, total_tokens: 48 },
      );
    };
    const provider = createOpenAIPortfolioProvider({
      apiKey,
      model: "portfolio-model-test",
      reasoningEffort: "medium",
      fetchImplementation,
    });

    const chunks: string[] = [];
    const onUsage = vi.fn();
    for await (const chunk of provider.streamAnswer({
      question: "How does pitching preserve approval?",
      evidence,
      safetyIdentifier: "pc_anonymous-session-hash",
      visitState: { generalTurns: 2, portfolioNudgeShown: false },
      onUsage,
    })) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).not.toContain(apiKey);
    const [url, init] = requests[0] ?? [];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      `Bearer ${apiKey}`,
    );
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "portfolio-model-test",
      stream: false,
      store: false,
      max_output_tokens: 3_000,
      reasoning: { effort: "medium" },
      safety_identifier: "pc_anonymous-session-hash",
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(JSON.stringify(body)).toContain("project:pitching");
    expect(JSON.stringify(body)).toContain(
      "Use only the supplied portfolio evidence",
    );
    expect(JSON.stringify(body)).toContain("Social chat is unlimited");
    expect(JSON.stringify(body)).toContain(
      "Never add a portfolio nudge; the application owns",
    );
    expect(JSON.stringify(body)).not.toContain("Visit routing state");
    expect(onUsage).toHaveBeenCalledWith({
      inputTokens: 37,
      outputTokens: 11,
      totalTokens: 48,
    });
  });

  it("sends prior turns as role-aware context and grounds only the current user turn", async () => {
    let requestBody = "";
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async (_input, init) => {
        requestBody = String(init?.body);
        return completedResponse(
          portfolioOutput([
            { text: "Grounded.", evidenceIds: ["project:pitching"] },
          ]),
        );
      },
    });

    for await (const chunk of provider.streamAnswer({
      question: "What changed?",
      conversation: [
        { role: "user", content: "Tell me about pitching." },
        { role: "assistant", content: "It keeps approval human. [E1]" },
      ],
      evidence,
    })) {
      expect(chunk).toBe("Grounded. [E1]");
    }

    const body = JSON.parse(requestBody);
    expect(body.input).toEqual([
      {
        role: "user",
        content: [{ type: "input_text", text: "Tell me about pitching." }],
      },
      {
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: "It keeps approval human. [E1]",
            annotations: [],
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: expect.stringContaining(
              "Current question: What changed?\n\nPortfolio evidence:\n[E1] id=project:pitching",
            ),
          },
        ],
      },
    ]);
  });

  it("returns the exact evidence refusal from a structured portfolio result", async () => {
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async () =>
        completedResponse({
          mode: "portfolio",
          insufficientEvidence: true,
          sentences: [],
        }),
    });

    const chunks: string[] = [];
    for await (const chunk of provider.streamAnswer({
      question: "What is Bradley's favorite soup?",
      evidence,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([INSUFFICIENT_EVIDENCE_MESSAGE]);
  });

  it("rejects an evidence refusal outside portfolio mode", async () => {
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async () =>
        completedResponse({
          mode: "general",
          insufficientEvidence: true,
          sentences: [],
        }),
    });

    await expect(async () => {
      for await (const chunk of provider.streamAnswer({
        question: "How do I sharpen a knife?",
        evidence,
      })) {
        throw new Error(`Unexpected provider output: ${chunk}`);
      }
    }).rejects.toThrow("OpenAI agent run failed.");
  });

  it.each([
    [
      "evidence ids outside portfolio mode",
      {
        mode: "general" as const,
        insufficientEvidence: false,
        sentences: [
          {
            text: "Keep the blade at a steady angle.",
            evidenceIds: ["project:pitching"],
          },
        ],
      },
    ],
    [
      "the refusal text when insufficientEvidence is false",
      portfolioOutput([
        {
          text: INSUFFICIENT_EVIDENCE_MESSAGE,
          evidenceIds: ["project:pitching"],
        },
      ]),
    ],
  ])("rejects %s", async (_label, output) => {
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async () => completedResponse(output),
    });

    await expect(async () => {
      for await (const chunk of provider.streamAnswer({
        question: "How does pitching work?",
        evidence,
      })) {
        throw new Error(`Unexpected provider output: ${chunk}`);
      }
    }).rejects.toThrow("OpenAI agent run failed.");
  });

  it.each([
    ["malformed structured output", "not json", "invalid_final_output"],
    [
      "an evidence id outside the supplied structured-output enum",
      portfolioOutput([
        { text: "Unsupported.", evidenceIds: ["project:not-supplied"] },
      ]),
      "invalid_final_output",
    ],
  ])("rejects %s without exposing it", async (_label, output, failureKind) => {
    const onFailure = vi.fn();
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async () => completedResponse(output),
    });

    await expect(async () => {
      for await (const chunk of provider.streamAnswer({
        question: "How does pitching work?",
        evidence,
        onFailure,
      })) {
        throw new Error(`Unexpected provider output: ${chunk}`);
      }
    }).rejects.toThrow("OpenAI agent run failed.");
    expect(onFailure).toHaveBeenCalledWith(failureKind);
  });

  it("does not expose an upstream error body", async () => {
    const upstreamSecret = "upstream-secret-detail";
    const onFailure = vi.fn();
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
        onFailure,
      })) {
        throw new Error(`Unexpected provider output: ${chunk}`);
      }
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe("OpenAI agent run failed.");
    expect(message).not.toContain(upstreamSecret);
    expect(onFailure).toHaveBeenCalledWith("provider_error");
  });

  it("passes the request abort signal to the OpenAI fetch", async () => {
    const signal = new AbortController().signal;
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async (_input, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return completedResponse(
          portfolioOutput([
            { text: "Grounded.", evidenceIds: ["project:pitching"] },
          ]),
        );
      },
    });

    const chunks: string[] = [];
    for await (const chunk of provider.streamAnswer({
      question: "How does pitching work?",
      evidence,
      signal,
    } as PortfolioChatProviderInput)) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(["Grounded. [E1]"]);
  });
});
