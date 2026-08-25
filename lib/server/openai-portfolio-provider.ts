import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import OpenAI from "openai";
import type {
  PortfolioChatProvider,
  PortfolioChatProviderInput,
} from "./portfolio-chat-provider";
import { INSUFFICIENT_EVIDENCE_MESSAGE } from "./portfolio-chat-provider";

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

function groundedInput({ question, evidence, conversation }: PortfolioChatProviderInput) {
  const sources = evidence
    .map(
      (item, index) =>
        `[E${index + 1}] id=${item.id}\nProject: ${item.projectTitle}\nTitle: ${item.title}\nSupporting-material status: ${item.evidenceStatus}\nPublished excerpt: ${item.excerpt}\nPortfolio link: ${item.href}`,
    )
    .join("\n\n");

  return `${conversationContext(conversation)}Current question: ${question}\n\nPortfolio evidence:\n${sources}`;
}

const portfolioAgentInstructions =
  `You are the conversational guide to Bradley Berkman's portfolio. Answer the visitor's current question from the complete published portfolio context supplied with every request. Use only the supplied portfolio evidence; do not add portfolio facts from memory or inference. Supporting-material status is editorial maturity metadata, not a restriction on using the published text. You may synthesize across sources. Answer directly and use only as much detail as the visitor's question needs. Every factual sentence must end with one or more evidence labels such as [E1]. If the evidence does not support the question, say exactly: ${INSUFFICIENT_EVIDENCE_MESSAGE}`;

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
      const result = await runner.run(agent, groundedInput(input), {
        stream: true,
        maxTurns: 1,
        signal: input.signal,
      });
      let answerCharacters = 0;

      try {
        for await (const delta of result.toTextStream()) {
          answerCharacters += delta.length;
          yield delta;
        }
        await result.completed;
        if (result.error || answerCharacters === 0 || !result.finalOutput) {
          throw result.error ?? new Error("OpenAI agent returned no answer.");
        }
        const usage = result.state.usage;
        input.onUsage?.({
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        });
      } catch {
        await result.completed.catch(() => {});
        throw new Error("OpenAI agent run failed.");
      }
    },
  };
}
