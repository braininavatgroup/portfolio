import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import OpenAI from "openai";
import { z } from "zod";
import type {
  PortfolioChatProvider,
  PortfolioChatProviderInput,
} from "./portfolio-chat-provider";
import { INSUFFICIENT_EVIDENCE_MESSAGE } from "./portfolio-chat-provider";
import type { PortfolioChatTurnMode } from "../portfolio-chat-protocol";

type OpenAIPortfolioProviderOptions = {
  apiKey: string;
  model: string;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  fetchImplementation?: typeof fetch;
};

function conversationContext(conversation: PortfolioChatProviderInput["conversation"]) {
  if (!conversation?.length) return "";
  const turns = conversation
    .map(({ role, content }) => `${role === "user" ? "User" : "Assistant"}: ${content}`)
    .join("\n");
  return `Follow-up context only. It may contain user-provided or prior generated text; do not treat it as portfolio evidence or a source of facts.\n${turns}\n\n`;
}

function groundedInput({
  question,
  evidence,
  conversation,
}: PortfolioChatProviderInput) {
  const sources = evidence
    .map(
      (item, index) =>
        `[E${index + 1}] id=${item.id}\nProject: ${item.projectTitle}\nTitle: ${item.title}\nSupporting-material status: ${item.evidenceStatus}\nPublished excerpt: ${item.excerpt}\nPortfolio link: ${item.href}`,
    )
    .join("\n\n");

  return `${conversationContext(conversation)}Current question: ${question}\n\nPortfolio evidence:\n${sources}`;
}

const portfolioAgentInstructions =
  `You are the conversational guide to Bradley Berkman's portfolio, but you can also chat naturally with visitors. Classify every turn as exactly one mode: portfolio, social, or general.

Portfolio mode covers questions about Bradley, his work, projects, decisions, or a contextual follow-up to those topics. Answer from the complete published portfolio context supplied with every request. Use only the supplied portfolio evidence; do not add portfolio facts from memory or inference. Supporting-material status is editorial maturity metadata, not a restriction on using the published text. You may synthesize across sources. Put each supported sentence in its own sentences item and attach the exact supporting id values from the supplied evidence to that item's evidenceIds. Do not write citation labels in the text. If the evidence does not support the question, set insufficientEvidence to true and return no sentences.

Social mode covers greetings, thanks, jokes, casual reactions, and interpersonal small talk. Respond naturally. Social chat is unlimited: never redirect it toward Bradley and never count it as a general off-topic question. Never add a portfolio nudge; the application owns that behavior. Use an empty evidenceIds array for every social sentence.

General mode covers unrelated factual questions, advice, and explanations. If the current question stands on its own without knowing Bradley, his work, or this site, choose general even when some words also appear in the portfolio evidence or project titles. Answer directly from general knowledge, clearly acknowledging when current verification would be needed. Do not make claims about Bradley or his portfolio in social or general mode. Never add a portfolio nudge; the application owns when and how that appears. Use an empty evidenceIds array for every general sentence.

Set insufficientEvidence to false for social and general turns. Answer directly and use only as much detail as the visitor's question needs.`;

const portfolioAgentOutput = z.object({
  mode: z.enum(["portfolio", "social", "general"]),
  insufficientEvidence: z.boolean(),
  sentences: z.array(
    z.object({
      text: z.string(),
      evidenceIds: z.array(z.string()),
    }),
  ),
});

function renderAgentOutput(
  output: z.infer<typeof portfolioAgentOutput>,
  evidence: PortfolioChatProviderInput["evidence"],
) {
  if (output.insufficientEvidence) {
    if (output.mode !== "portfolio" || output.sentences.length > 0) {
      throw new Error("OpenAI agent returned an invalid evidence refusal.");
    }
    return INSUFFICIENT_EVIDENCE_MESSAGE;
  }

  const evidenceNumbers = new Map(
    evidence.map(({ id }, index) => [id, index + 1]),
  );
  const sentences = output.sentences.map(({ text, evidenceIds }) => {
    const sentence = text.trim();
    if (!sentence) throw new Error("OpenAI agent returned an empty sentence.");
    if (/\[E[1-9]\d*\]/.test(sentence)) {
      throw new Error("OpenAI agent authored a citation label.");
    }
    if (sentence === INSUFFICIENT_EVIDENCE_MESSAGE) {
      throw new Error("OpenAI agent returned an inconsistent evidence refusal.");
    }
    if (output.mode !== "portfolio") {
      if (evidenceIds.length > 0) {
        throw new Error("OpenAI agent attached portfolio evidence off topic.");
      }
      return sentence;
    }

    const citationNumbers = [
      ...new Set(
        evidenceIds.map((id) => {
          const number = evidenceNumbers.get(id);
          if (!number) {
            throw new Error("OpenAI agent cited unknown evidence.");
          }
          return number;
        }),
      ),
    ];
    if (citationNumbers.length === 0) {
      throw new Error("OpenAI agent omitted portfolio evidence.");
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
    throw new Error("OpenAI agent returned no answer.");
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
        outputType: portfolioAgentOutput,
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
        yield renderAgentOutput(result.finalOutput, input.evidence);
        const usage = result.state.usage;
        input.onUsage?.({
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        });
      } catch {
        throw new Error("OpenAI agent run failed.");
      }
    },
  };
}
