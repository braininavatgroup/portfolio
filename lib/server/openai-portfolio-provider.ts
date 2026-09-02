import {
  Agent,
  assistant,
  MaxTurnsExceededError,
  ModelBehaviorError,
  ModelRefusalError,
  ModelTimeoutError,
  OpenAIProvider,
  Runner,
  user,
} from "@openai/agents";
import OpenAI from "openai";
import { z } from "zod";
import type {
  PortfolioChatProvider,
  PortfolioChatProviderFailureKind,
  PortfolioChatProviderInput,
} from "./portfolio-chat-provider";
import type { PortfolioChatTurnMode } from "../portfolio-chat-protocol";
import {
  allowedAvatarAnimations,
  expandAvatarSequence,
  formatAvatarBehaviorCatalog,
  type AllowedAnimation,
} from "../avatar/behaviors";
import {
  avatarConfidenceLevels,
  avatarEnergyLevels,
  avatarMischiefLevels,
  avatarPerformanceIntents,
  avatarWarmthLevels,
  type AvatarPerformanceIntent,
  type AvatarTone,
} from "../avatar/contracts";

type OpenAIPortfolioProviderOptions = {
  apiKey: string;
  model: string;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  fetchImplementation?: typeof fetch;
};

function groundedInput({
  question,
  evidence,
  conversation,
}: PortfolioChatProviderInput) {
  const sources = evidence
    .map(
      (item, index) =>
        `[E${index + 1}] id=${item.id}\nTitle: ${item.title}\nPortfolio context: ${item.excerpt}\nPortfolio link: ${item.href}`,
    )
    .join("\n\n");

  const currentTurn = user(
    `Current question: ${question}\n\nPortfolio evidence:\n${sources}`,
  );
  return [
    ...(conversation ?? []).map(({ role, content }) =>
      role === "user" ? user(content) : assistant(content),
    ),
    currentTurn,
  ];
}

const portfolioAgentInstructions =
  `You are the conversational guide to Bradley Berkman's portfolio, but you can also chat naturally with visitors. Classify every turn as exactly one mode: portfolio, social, or general.

Portfolio mode covers questions about Bradley, his work, projects, decisions, or a contextual follow-up to those topics. Answer conversationally from the complete portfolio context supplied with every request. Use only the supplied portfolio evidence for factual claims about Bradley; do not add portfolio facts from memory. Lines explicitly labeled DRAFT COPY PLACEHOLDER or PLANNED VISUAL are editorial workbench notes, not Bradley facts or published proof. Never present them as completed work; you may describe them as unfinished portfolio plans only when that distinction is relevant. You may synthesize across sources and make ordinary conversational inferences. If a requested detail is not in the portfolio, say that naturally and keep answering as helpfully as you can. Never replace the answer with a stock evidence refusal. Put each sentence in its own sentences item. Attach the exact supporting id values to factual portfolio claims; use an empty evidenceIds array for conversational language, clearly labeled uncertainty, or an honest statement that you do not know. Do not write citation labels in the text.

Social mode covers greetings, thanks, jokes, casual reactions, and interpersonal small talk. Respond naturally. Social chat is unlimited: never redirect it toward Bradley and never count it as a general off-topic question. Never add a portfolio nudge; the application owns that behavior. Use an empty evidenceIds array for every social sentence.

General mode covers unrelated factual questions, advice, and explanations. If the current question stands on its own without knowing Bradley, his work, or this site, choose general even when some words also appear in portfolio source titles. Answer directly from general knowledge, clearly acknowledging when current verification would be needed. Do not make claims about Bradley or his portfolio in social or general mode. Never add a portfolio nudge; the application owns when and how that appears. Use an empty evidenceIds array for every general sentence.

Always answer directly and use only as much detail as the visitor's question needs.

Choose an avatar behavior sequence for every answer. Choose exactly one behavior for an ordinary answer. Choose two or three for an explicitly requested performance or a response with a meaningful emotional progression. Match the answer's social and emotional intent rather than isolated keywords. Every allowed behavior is available whenever it fits the context. Use idle_3 when restraint is the best performance. Never mention the behavior choice unless the visitor asks about it.

Classify the performance intent as ordinary, expressive, or requested. Also direct the performance with a bounded tone: energy (low, medium, or high), warmth (reserved or warm), confidence (uncertain, neutral, or assured), and mischief (none or playful). These values adjust timing and subtle body motion; they never block the selected behavior.

Allowed avatar behaviors:
${formatAvatarBehaviorCatalog()}`;

function portfolioAgentOutput(
  evidence: PortfolioChatProviderInput["evidence"],
) {
  const evidenceIds = evidence.map(({ id }) => id) as [string, ...string[]];
  return z.object({
    mode: z.enum(["portfolio", "social", "general"]),
    sentences: z.array(
      z.object({
        text: z.string(),
        evidenceIds: z.array(z.enum(evidenceIds)),
      }),
    ),
    avatarSequence: z
      .array(z.enum(allowedAvatarAnimations))
      .min(1)
      .max(3),
    avatarIntent: z.enum(avatarPerformanceIntents),
    avatarTone: z.object({
      energy: z.enum(avatarEnergyLevels),
      warmth: z.enum(avatarWarmthLevels),
      confidence: z.enum(avatarConfidenceLevels),
      mischief: z.enum(avatarMischiefLevels),
    }),
  });
}

type PortfolioAgentOutput = {
  mode: "portfolio" | "social" | "general";
  sentences: Array<{ text: string; evidenceIds: string[] }>;
  avatarSequence: AllowedAnimation[];
  avatarIntent: AvatarPerformanceIntent;
  avatarTone: AvatarTone;
};

type InvalidEvidenceFailureKind =
  | "citation_label"
  | "invalid_evidence_output"
  | "unknown_evidence";

class InvalidEvidenceOutputError extends Error {
  constructor(
    readonly kind: InvalidEvidenceFailureKind,
    message: string,
  ) {
    super(message);
  }
}

function failureKind(
  error: unknown,
  signal: AbortSignal | undefined,
): PortfolioChatProviderFailureKind {
  if (signal?.aborted) return "aborted";
  if (error instanceof InvalidEvidenceOutputError) {
    return error.kind;
  }
  if (error instanceof ModelBehaviorError) return "invalid_final_output";
  if (error instanceof MaxTurnsExceededError) return "max_turns";
  if (error instanceof ModelRefusalError) return "model_refusal";
  if (error instanceof ModelTimeoutError) return "provider_timeout";
  return "provider_error";
}

function renderAgentOutput(
  output: PortfolioAgentOutput,
  evidence: PortfolioChatProviderInput["evidence"],
) {
  const evidenceNumbers = new Map(
    evidence.map(({ id }, index) => [id, index + 1]),
  );
  const sentences = output.sentences.map(({ text, evidenceIds }) => {
    const sentence = text.trim();
    if (!sentence) {
      throw new InvalidEvidenceOutputError(
        "invalid_evidence_output",
        "OpenAI agent returned an empty sentence.",
      );
    }
    if (/\[E[1-9]\d*\]/.test(sentence)) {
      throw new InvalidEvidenceOutputError(
        "citation_label",
        "OpenAI agent authored a citation label.",
      );
    }
    if (output.mode !== "portfolio") {
      if (evidenceIds.length > 0) {
        throw new InvalidEvidenceOutputError(
          "invalid_evidence_output",
          "OpenAI agent attached portfolio evidence off topic.",
        );
      }
      return sentence;
    }

    const citationNumbers = [
      ...new Set(
        evidenceIds.map((id) => {
          const number = evidenceNumbers.get(id);
          if (!number) {
            throw new InvalidEvidenceOutputError(
              "unknown_evidence",
              "OpenAI agent cited unknown evidence.",
            );
          }
          return number;
        }),
      ),
    ];
    if (citationNumbers.length === 0) {
      return sentence;
    }
    const citations = citationNumbers
      .map((number) => `[E${number}]`)
      .join(" ");
    const citedSentences = sentence.replace(
      /([.!?]["')\]]?)(?=\s+\S)/g,
      `$1 ${citations}`,
    );
    return `${citedSentences} ${citations}`;
  });
  if (sentences.length === 0) {
    throw new InvalidEvidenceOutputError(
      "invalid_evidence_output",
      "OpenAI agent returned no answer.",
    );
  }
  return sentences.join("\n\n");
}

export function createOpenAIPortfolioProvider({
  apiKey,
  model,
  reasoningEffort,
  fetchImplementation = fetch,
}: OpenAIPortfolioProviderOptions): PortfolioChatProvider {
  const openAIClient = new OpenAI({
    apiKey,
    fetch: fetchImplementation,
    maxRetries: 0,
  });
  const runner = new Runner({
    modelProvider: new OpenAIProvider({
      openAIClient,
      useResponses: true,
    }),
    tracingDisabled: true,
  });

  return {
    async *streamAnswer(input) {
      const agent = new Agent({
        name: "Bradley portfolio guide",
        instructions: portfolioAgentInstructions,
        model,
        outputType: portfolioAgentOutput(input.evidence),
        modelSettings: {
          maxTokens: 3_000,
          store: false,
          ...(reasoningEffort
            ? { reasoning: { effort: reasoningEffort } }
            : {}),
          ...(input.safetyIdentifier
            ? {
                providerData: {
                  safety_identifier: input.safetyIdentifier,
                },
              }
            : {}),
        },
      });
      try {
        const result = await runner.run(agent, groundedInput(input), {
          maxTurns: 1,
          signal: input.signal,
        });
        if (!result.finalOutput) throw new Error("OpenAI agent returned no answer.");
        input.onMode?.(result.finalOutput.mode as PortfolioChatTurnMode);
        input.onEffects?.({
          avatarSequence: expandAvatarSequence(result.finalOutput.avatarSequence),
          avatarIntent: result.finalOutput.avatarIntent,
          avatarTone: result.finalOutput.avatarTone,
          issues: [],
        });
        yield renderAgentOutput(result.finalOutput, input.evidence);
        const usage = result.state.usage;
        input.onUsage?.({
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        });
      } catch (error) {
        input.onFailure?.(failureKind(error, input.signal));
        throw new Error("OpenAI agent run failed.");
      }
    },
  };
}
