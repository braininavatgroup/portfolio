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

type OpenAIStreamEvent = {
  type?: unknown;
  delta?: unknown;
  response?: unknown;
};

function usageFromEvent(event: OpenAIStreamEvent) {
  if (!event.response || typeof event.response !== "object") return undefined;
  const usage = Reflect.get(event.response, "usage");
  if (!usage || typeof usage !== "object") return undefined;
  const inputTokens = Reflect.get(usage, "input_tokens");
  const outputTokens = Reflect.get(usage, "output_tokens");
  const totalTokens = Reflect.get(usage, "total_tokens");
  if (
    typeof inputTokens !== "number" ||
    typeof outputTokens !== "number" ||
    typeof totalTokens !== "number"
  ) {
    return undefined;
  }
  return { inputTokens, outputTokens, totalTokens };
}

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
        `[E${index + 1}] id=${item.id}\nProject: ${item.projectTitle}\nTitle: ${item.title}\nEvidence status: ${item.evidenceStatus}\nPublished excerpt: ${item.excerpt}\nPortfolio link: ${item.href}`,
    )
    .join("\n\n");

  return `${conversationContext(conversation)}Current question: ${question}\n\nPortfolio evidence:\n${sources}`;
}

async function* parseServerSentEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<OpenAIStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replaceAll("\r\n", "\n");
      if (done && buffer.trim()) buffer += "\n\n";

      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");

        if (data && data !== "[DONE]") {
          const parsed: unknown = JSON.parse(data);
          if (parsed && typeof parsed === "object") {
            yield parsed as OpenAIStreamEvent;
          }
        }
        boundary = buffer.indexOf("\n\n");
      }

      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

export function createOpenAIPortfolioProvider({
  apiKey,
  model,
  reasoningEffort,
  fetchImplementation = fetch,
}: OpenAIPortfolioProviderOptions): PortfolioChatProvider {
  return {
    async *streamAnswer(input) {
      const response = await fetchImplementation(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            stream: true,
            store: false,
            max_output_tokens: 450,
            ...(reasoningEffort
              ? { reasoning: { effort: reasoningEffort } }
              : {}),
            ...(input.safetyIdentifier
              ? { safety_identifier: input.safetyIdentifier }
              : {}),
            instructions:
              `Use only the supplied portfolio evidence. Do not add portfolio facts from memory or inference. Every factual sentence must end with one or more evidence labels such as [E1]. If the evidence does not support the question, say exactly: ${INSUFFICIENT_EVIDENCE_MESSAGE}`,
            input: groundedInput(input),
          }),
          signal: input.signal,
        },
      );

      if (!response.ok || !response.body) {
        if (response.body) await response.body.cancel();
        throw new Error("OpenAI response request failed.");
      }

      let completed = false;
      for await (const event of parseServerSentEvents(response.body)) {
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          yield event.delta;
        }
        if (event.type === "response.completed") {
          completed = true;
          const usage = usageFromEvent(event);
          if (usage) input.onUsage?.(usage);
        }
        if (
          event.type === "response.failed" ||
          event.type === "response.incomplete" ||
          event.type === "error" ||
          (typeof event.type === "string" && event.type.startsWith("response.refusal"))
        ) {
          throw new Error("OpenAI response stream failed.");
        }
      }
      if (!completed) throw new Error("OpenAI response stream failed.");
    },
  };
}
