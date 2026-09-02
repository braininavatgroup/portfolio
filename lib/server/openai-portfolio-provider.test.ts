import { describe, expect, it, vi } from "vitest";
import { createOpenAIPortfolioProvider } from "./openai-portfolio-provider";
import type { PortfolioChatProviderInput } from "./portfolio-chat-provider";
import type { PortfolioGroundingEvidence } from "../portfolio-grounding";
import { allowedAvatarAnimations, avatarBehaviors } from "../avatar/behaviors";

const evidence: PortfolioGroundingEvidence[] = [
  {
    id: "node:pitching",
    title: "Music promo campaign pitching",
    excerpt:
      "Weekly curator targeting driven by recorded taste, with the one read the data can't make kept human.",
    href: "/?view=graph#pitching",
  },
];

const secondEvidence: PortfolioGroundingEvidence = {
  id: "node:reporting",
  title: "Music promo campaign reporting",
  excerpt: "A daily pipeline that finds wins, verifies the evidence, and drafts every client report.",
  href: "/?view=graph#reporting",
};

type StructuredOutput = {
  mode: "portfolio" | "social" | "general";
  sentences: Array<{ text: string; evidenceIds: string[] }>;
  avatarSequence: string[];
  avatarIntent: "ordinary" | "expressive" | "requested";
  avatarTone: {
    energy: "low" | "medium" | "high";
    warmth: "reserved" | "warm";
    confidence: "uncertain" | "neutral" | "assured";
    mischief: "none" | "playful";
  };
};

type StructuredOutputInput = Omit<
  StructuredOutput,
  "avatarIntent" | "avatarTone"
> &
  Partial<Pick<StructuredOutput, "avatarIntent" | "avatarTone">>;

const defaultAvatarOutput = {
  avatarIntent: "ordinary" as const,
  avatarTone: {
    energy: "medium" as const,
    warmth: "warm" as const,
    confidence: "neutral" as const,
    mischief: "none" as const,
  },
};

function completedResponse(
  output: StructuredOutputInput | string,
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number },
) {
  const text =
    typeof output === "string"
      ? output
      : JSON.stringify({ ...defaultAvatarOutput, ...output });
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
  return {
    ...defaultAvatarOutput,
    mode: "portfolio",
    sentences,
    avatarSequence: ["agree_gesture"],
  };
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
              evidenceIds: ["node:pitching"],
            },
            {
              text: "The system arranges research and outreach around that approval.",
              evidenceIds: ["node:pitching"],
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
    expect(body.text.format.schema.properties.avatarSequence).toMatchObject({
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { enum: allowedAvatarAnimations },
    });
    expect(body.text.format.schema.properties.avatarIntent).toMatchObject({
      enum: ["ordinary", "expressive", "requested"],
    });
    expect(body.text.format.schema.properties.avatarTone).toMatchObject({
      type: "object",
      required: ["energy", "warmth", "confidence", "mischief"],
    });
    for (const behavior of avatarBehaviors) {
      expect(body.instructions).toContain(`${behavior.id}: ${behavior.guidance}`);
    }
    expect(body.instructions).not.toContain(
      "Every factual sentence must end with one or more evidence labels",
    );
    expect(body.instructions).toContain(
      "editorial workbench notes, not Bradley facts or published proof",
    );
    expect(requestBody).toContain("Portfolio context:");
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
              evidenceIds: ["node:pitching"],
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
            avatarSequence: ["agree_gesture"],
            sentences: [
              {
                text: "The model tried to attach another source. [E2]",
                evidenceIds:
                  mode === "portfolio" ? ["node:pitching"] : [],
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
          avatarSequence: ["agree_gesture"],
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
            evidenceIds: ["node:pitching"],
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
    expect(JSON.stringify(body)).toContain("node:pitching");
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
            { text: "Grounded.", evidenceIds: ["node:pitching"] },
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
              "Current question: What changed?\n\nPortfolio evidence:\n[E1] id=node:pitching",
            ),
          },
        ],
      },
    ]);
  });

  // Protects against restoring a model-selectable refusal branch.
  // Owner: OpenAI provider output contract. Retire if this provider is replaced.
  it("answers conversationally when an exact Bradley detail is not published", async () => {
    let requestBody = "";
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async (_input, init) => {
        requestBody = String(init?.body);
        return completedResponse({
          mode: "portfolio",
          avatarSequence: ["shrug"],
          sentences: [
            {
              text: "I don't know Bradley's favorite soup. If he publishes it, this portfolio will gain one strangely important data point.",
              evidenceIds: [],
            },
          ],
        });
      },
    });

    const chunks: string[] = [];
    for await (const chunk of provider.streamAnswer({
      question: "What is Bradley's favorite soup?",
      evidence,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      "I don't know Bradley's favorite soup. If he publishes it, this portfolio will gain one strangely important data point.",
    ]);
    const responseFormat = JSON.parse(requestBody).text.format;
    expect(responseFormat.schema.properties).not.toHaveProperty(
      "insufficientEvidence",
    );
    expect(responseFormat.schema.required).not.toContain(
      "insufficientEvidence",
    );
  });

  it("rejects evidence ids outside portfolio mode", async () => {
    const output: StructuredOutputInput = {
      mode: "general",
      avatarSequence: ["agree_gesture"],
      sentences: [
        {
          text: "Keep the blade at a steady angle.",
          evidenceIds: ["node:pitching"],
        },
      ],
    };
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
        { text: "Unsupported.", evidenceIds: ["node:not-supplied"] },
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
            { text: "Grounded.", evidenceIds: ["node:pitching"] },
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

  it("reports tone and a validated performance in time for first-text scheduling", async () => {
    // Catches structured direction arriving too late for the client to coordinate it with the answer.
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async () =>
        completedResponse({
          mode: "social",
          sentences: [{ text: "Here we go.", evidenceIds: [] }],
          avatarSequence: ["wave_one_hand", "joyful_dance_with_hand_sway"],
          avatarIntent: "requested",
          avatarTone: {
            energy: "high",
            warmth: "warm",
            confidence: "assured",
            mischief: "playful",
          },
        }),
    });
    const lifecycle: string[] = [];
    const onEffects = vi.fn(() => lifecycle.push("effects"));

    for await (const chunk of provider.streamAnswer({
      question: "Do the dance",
      evidence,
      onEffects,
    })) {
      lifecycle.push(`answer:${chunk}`);
    }

    expect(lifecycle).toEqual(["effects", "answer:Here we go."]);
    expect(onEffects).toHaveBeenCalledWith({
      avatarSequence: [
        { action: "play", animation: "wave_one_hand" },
        { action: "wait", durationMs: 1_600 },
        { action: "play", animation: "joyful_dance_with_hand_sway" },
        { action: "wait", durationMs: 2_800 },
      ],
      avatarIntent: "requested",
      avatarTone: {
        energy: "high",
        warmth: "warm",
        confidence: "assured",
        mischief: "playful",
      },
      issues: [],
    });
  });

  it.each([
    ["zero", []],
    ["more than three", ["idle_3", "shrug", "alert", "walking"]],
    ["unknown", ["dance"]],
  ])("rejects a %s-behavior structured performance", async (_label, avatarSequence) => {
    // Catches invalid control data reaching the effect callback.
    const onEffects = vi.fn();
    const onFailure = vi.fn();
    const provider = createOpenAIPortfolioProvider({
      apiKey: "sk-test-server-only",
      model: "portfolio-model-test",
      fetchImplementation: async () =>
        completedResponse({
          mode: "social",
          sentences: [{ text: "Nope.", evidenceIds: [] }],
          avatarSequence,
        }),
    });

    await expect(async () => {
      for await (const chunk of provider.streamAnswer({
        question: "Perform",
        evidence,
        onEffects,
        onFailure,
      })) {
        throw new Error(`Unexpected provider output: ${chunk}`);
      }
    }).rejects.toThrow("OpenAI agent run failed.");

    expect(onEffects).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith("invalid_final_output");
  });
});
