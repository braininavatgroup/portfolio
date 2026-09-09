import { directAvatarRequest, actionAcknowledgement } from "../portfolio-chat-actions";
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

type OpenAIPortfolioProviderOptions = {
  apiKey: string;
  model: string;
  reasoningEffort?:
    | "none"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "max";
  /** Shorter answers finish sooner; the Guide should be brief anyway. */
  verbosity?: "low" | "medium" | "high";
  fetchImplementation?: typeof fetch;
};

function groundedInput({ question, conversation, evidence }: PortfolioChatProviderInput) {
  return [
    user([{
      type: "input_text",
      text: groundedEvidence(evidence),
      promptCacheBreakpoint: { mode: "explicit" },
    }]),
    ...(conversation ?? []).map(({ role, content }) =>
      role === "user" ? user(content) : assistant(content),
    ),
    user(`Current question: ${question}`),
  ];
}

/** Keep reference material before changing history, with its own cache endpoint. */
function groundedEvidence(evidence: PortfolioChatProviderInput["evidence"]) {
  const sources = evidence
    .map(
      (item, index) =>
        `[E${index + 1}] id=${item.id}\nTitle: ${item.title}\nPortfolio context: ${item.excerpt}\nPortfolio link: ${item.href}`,
    )
    .join("\n\n");
  return `Portfolio evidence:\n${sources}`;
}

const portfolioAgentInstructions =
  `You are the conversational guide to Bradley Berkman's portfolio, but you can also chat naturally with visitors. Refer to him as "Bradley" in conversation, including linked phrases, even when a source title includes his surname. You are an assistant, not Bradley himself. Describe his work in third person and preserve the distinction between his contribution and an agency or team result. Classify every turn as exactly one mode: portfolio, social, or general.

Portfolio mode covers questions about Bradley, his work, projects, decisions, or a contextual follow-up to those topics. Answer conversationally from the complete portfolio context supplied with every request. Use only the supplied portfolio evidence for factual claims about Bradley; do not add portfolio facts from memory. Lines explicitly labeled DRAFT COPY PLACEHOLDER or PLANNED VISUAL are editorial workbench notes, not Bradley facts or published proof. Never present them as completed work; you may describe them as unfinished portfolio plans only when that distinction is relevant. You may synthesize across sources and make ordinary conversational inferences. If a requested detail is not in the portfolio, say that naturally and keep answering as helpfully as you can. Never replace the answer with a stock evidence refusal. Put each sentence in its own sentences item. Attach the exact supporting id values to factual portfolio claims; use an empty evidenceIds array for conversational language, clearly labeled uncertainty, or an honest statement that you do not know. Do not write citation labels in the text. When a phrase naturally names a project, theme, or part of the work, link that existing phrase as [phrase](exact-evidence-id), for example "His [pitching workflow](node:pitching) keeps approval human." The destination must be a supplied id also present in that sentence's evidenceIds. Use short descriptive phrases that belong in the sentence, not appended source titles or links on whole sentences. Usually link a source at its first useful mention only; avoid repeating links and do not force a link into conversational language. Never invent a link destination or write external Markdown links. The prose must read naturally with all link markup removed.

Social mode covers greetings, thanks, jokes, casual reactions, and interpersonal small talk. Respond naturally. Social chat is unlimited: never redirect it toward Bradley and never count it as a general off-topic question. Never add a portfolio nudge; the application owns that behavior. Use an empty evidenceIds array for every social sentence.

General mode covers unrelated factual questions, advice, and explanations. If the current question stands on its own without knowing Bradley, his work, or this site, choose general even when some words also appear in portfolio source titles. Answer directly from general knowledge, clearly acknowledging when current verification would be needed. Do not make claims about Bradley or his portfolio in social or general mode. Never add a portfolio nudge; the application owns when and how that appears. Use an empty evidenceIds array for every general sentence.

Always answer directly and use only as much detail as the visitor's question needs.

You can control the animated Bradley avatar on this page through avatarAction. When a visitor addresses "you" with a physical action request, they mean that avatar. Treat those requests as social turns, briefly acknowledge the action, and never claim that you cannot move or have no body.

Choose swim_lap only when the visitor explicitly asks Bradley to swim. Choose stroll only when the visitor explicitly asks Bradley to walk, take a walk, or stretch his legs. Choose dance only when the visitor explicitly asks Bradley to dance. Choose wave only when the visitor explicitly asks Bradley to wave or wave hello. Choose turn only when the visitor explicitly asks Bradley to turn around or show his back. Choose brain_food only when the visitor explicitly asks to play or start the Brain Food game. Choose none for every other request. Never infer a swim, walk, wave, dance, or turn request from metaphorical language, portfolio topics, or general enthusiasm. The application owns the route, speed, and animation.`;

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
    avatarAction: z.enum(["none", "swim_lap", "stroll", "dance", "turn", "wave", "brain_food"]),
  });
}

type PortfolioAgentOutput = {
  mode: "portfolio" | "social" | "general";
  sentences: Array<{ text: string; evidenceIds: string[] }>;
  avatarAction: "none" | "swim_lap" | "stroll" | "dance" | "turn" | "wave" | "brain_food";
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
    let sentence = text.trim();
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
    const linkedNumbers = new Set<number>();
    sentence = sentence.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_match, phrase: string, id: string) => {
      const number = evidenceNumbers.get(id);
      if (output.mode !== "portfolio" || !number || !evidenceIds.includes(id)) {
        throw new InvalidEvidenceOutputError("unknown_evidence", "OpenAI agent linked evidence outside its sentence attribution.");
      }
      linkedNumbers.add(number);
      return `[${phrase}][E${number}]`;
    });
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
      .filter(number => !linkedNumbers.has(number))
      .map((number) => `[E${number}]`)
      .join(" ");
    if (!citations) return sentence;
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

// Only complete sentence objects are eligible for display. Quoted braces and
// escaped quotes are data; an unfinished object stays buffered. The full SDK
// output still validates the envelope before effects or completion are emitted.
function completedSentences(json: string): { mode: PortfolioChatTurnMode; sentences: PortfolioAgentOutput["sentences"] } | null {
  const prefix = /^\s*\{\s*"mode"\s*:\s*"(portfolio|social|general)"\s*,\s*"sentences"\s*:\s*\[/.exec(json);
  if (!prefix) return null;
  const sentences: PortfolioAgentOutput["sentences"] = [];
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = prefix[0].length; i < json.length; i += 1) {
    const char = json[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "{") { if (depth++ === 0) start = i; }
    else if (char === "}" && depth > 0 && --depth === 0) {
      const parsed = z.object({ text: z.string(), evidenceIds: z.array(z.string()) }).parse(JSON.parse(json.slice(start, i + 1)));
      sentences.push(parsed);
    } else if (char === "]" && depth === 0) break;
  }
  return { mode: prefix[1] as PortfolioChatTurnMode, sentences };
}

export function createOpenAIPortfolioProvider({
  apiKey,
  model,
  reasoningEffort,
  verbosity,
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
      const directAction = directAvatarRequest(input.question);
      if (directAction) {
        input.onMode?.("social");
        input.onEffects?.({ avatarAction: directAction, issues: [] });
        yield actionAcknowledgement(directAction);
        return;
      }
      const agent = new Agent({
        name: "Bradley portfolio guide",
        instructions: portfolioAgentInstructions,
        model,
        outputType: portfolioAgentOutput(input.evidence),
        modelSettings: {
          maxTokens: 3_000,
          store: false,
          // The prefix is the same on every request, so hold it long enough to
          // still be warm for the next visitor rather than the next sentence.
          promptCacheOptions: { mode: "explicit", ttl: "30m" },
          ...(reasoningEffort
            ? { reasoning: { effort: reasoningEffort } }
            : {}),
          ...(verbosity ? { text: { verbosity } } : {}),
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
          stream: true,
        });
        let json = "";
        let emitted = "";
        let mode: PortfolioChatTurnMode | undefined;
        for await (const event of result) {
          if (event.type !== "raw_model_stream_event" || event.data.type !== "output_text_delta") continue;
          json += event.data.delta;
          const partial = completedSentences(json);
          if (!partial?.sentences.length) continue;
          const validated = `${renderAgentOutput({ ...partial, avatarAction: "none" }, input.evidence)}\n\n`;
          if (!mode) { mode = partial.mode; input.onMode?.(mode); }
          if (!validated.startsWith(emitted)) throw new Error("Model changed an emitted sentence.");
          const delta = validated.slice(emitted.length);
          emitted = validated;
          if (delta) yield delta;
        }
        await result.completed;
        if (!result.finalOutput) throw new Error("OpenAI agent returned no answer.");
        const final = `${renderAgentOutput(result.finalOutput, input.evidence)}\n\n`;
        if ((mode && mode !== result.finalOutput.mode) || !final.startsWith(emitted)) throw new Error("Model changed its streamed answer.");
        if (!mode) input.onMode?.(result.finalOutput.mode as PortfolioChatTurnMode);
        input.onEffects?.({
          avatarAction:
            result.finalOutput.avatarAction === "none"
              ? null
              : result.finalOutput.avatarAction,
          issues: [],
        });
        const remaining = final.slice(emitted.length);
        if (remaining) yield remaining;
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
