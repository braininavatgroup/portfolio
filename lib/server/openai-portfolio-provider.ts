import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import OpenAI from "openai";
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
  `You are the conversational guide to Bradley Berkman's portfolio, but you can also chat naturally with visitors. Classify every turn as exactly one mode and put the classification on the first line as MODE: portfolio, MODE: social, or MODE: general. Never put anything else on that line.

Portfolio mode covers questions about Bradley, his work, projects, decisions, or a contextual follow-up to those topics. Answer from the complete published portfolio context supplied with every request. Use only the supplied portfolio evidence; do not add portfolio facts from memory or inference. Supporting-material status is editorial maturity metadata, not a restriction on using the published text. You may synthesize across sources. Every factual sentence must end with one or more evidence labels such as [E1]. If the evidence does not support the question, say exactly: ${INSUFFICIENT_EVIDENCE_MESSAGE}

Social mode covers greetings, thanks, jokes, casual reactions, and interpersonal small talk. Respond naturally. Social chat is unlimited: never redirect it toward Bradley and never count it as a general off-topic question. Never add a portfolio nudge; the application owns that behavior.

General mode covers unrelated factual questions, advice, and explanations. If the current question stands on its own without knowing Bradley, his work, or this site, choose general even when some words also appear in the portfolio evidence or project titles. Answer directly from general knowledge, clearly acknowledging when current verification would be needed. Do not make claims about Bradley or his portfolio in social or general mode. Never add a portfolio nudge; the application owns when and how that appears.

After the required MODE line, answer directly and use only as much detail as the visitor's question needs.`;

function parseModeMarker(line: string): PortfolioChatTurnMode | undefined {
  const match = /^MODE: (portfolio|social|general)$/.exec(line.trim());
  return match?.[1] as PortfolioChatTurnMode | undefined;
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
      let modeResolved = false;
      let modeBuffer = "";

      try {
        for await (const delta of result.toTextStream()) {
          let answerDelta = delta;
          if (!modeResolved) {
            modeBuffer += answerDelta;
            const markerEnd = modeBuffer.indexOf("\n");
            if (markerEnd < 0) {
              if (modeBuffer.length > 64) {
                throw new Error("OpenAI agent returned an invalid mode marker.");
              }
              continue;
            }
            const mode = parseModeMarker(modeBuffer.slice(0, markerEnd));
            if (!mode) {
              throw new Error("OpenAI agent returned an invalid mode marker.");
            }
            input.onMode?.(mode);
            modeResolved = true;
            answerDelta = modeBuffer.slice(markerEnd + 1);
            modeBuffer = "";
          }
          if (!answerDelta) continue;
          answerCharacters += answerDelta.length;
          yield answerDelta;
        }
        await result.completed;
        if (
          result.error ||
          !modeResolved ||
          answerCharacters === 0 ||
          !result.finalOutput
        ) {
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
