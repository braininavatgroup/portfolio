import type {
  PortfolioChatEvent,
  PortfolioChatVisitState,
} from "./portfolio-chat-protocol";
import type { PortfolioChatMessage } from "./portfolio-chat-conversation";
import { parsePortfolioResponseEffects } from "./avatar/validation";

export type AskPortfolioOptions = {
  signal?: AbortSignal;
  challengeToken?: string;
  conversation?: readonly PortfolioChatMessage[];
  visitState?: PortfolioChatVisitState;
  onEvent(event: PortfolioChatEvent): void;
  fetchImplementation?: typeof fetch;
};

export type AskPortfolio = (
  question: string,
  options: AskPortfolioOptions,
) => Promise<void>;

export class PortfolioChatClientError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "PortfolioChatClientError";
  }
}

function isPortfolioChatEvent(value: unknown): value is PortfolioChatEvent {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const type = Reflect.get(value, "type");
  if (type === "done") return true;
  if (type === "evidence") return Array.isArray(Reflect.get(value, "evidence"));
  if (type === "turn_mode") {
    const mode = Reflect.get(value, "mode");
    return mode === "portfolio" || mode === "social" || mode === "general";
  }
  if (type === "answer_delta") {
    return typeof Reflect.get(value, "delta") === "string";
  }
  if (type === "effects") {
    Reflect.set(
      value,
      "effects",
      parsePortfolioResponseEffects(Reflect.get(value, "effects")),
    );
    return true;
  }
  if (type === "notice" || type === "error") {
    return (
      typeof Reflect.get(value, "code") === "string" &&
      typeof Reflect.get(value, "message") === "string"
    );
  }
  return false;
}

function parseEvent(line: string) {
  const parsed: unknown = JSON.parse(line);
  if (!isPortfolioChatEvent(parsed)) {
    throw new PortfolioChatClientError(
      "invalid_stream",
      "The answer service returned an invalid stream.",
    );
  }
  return parsed;
}

function invalidStream() {
  return new PortfolioChatClientError(
    "invalid_stream",
    "The answer service returned an invalid stream.",
  );
}

async function responseError(response: Response) {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return new PortfolioChatClientError(
      "request_failed",
      "The answer service is temporarily unavailable.",
    );
  }

  const code =
    parsed && typeof parsed === "object" ? Reflect.get(parsed, "code") : undefined;
  const message =
    parsed && typeof parsed === "object"
      ? Reflect.get(parsed, "message")
      : undefined;
  return new PortfolioChatClientError(
    typeof code === "string" ? code : "request_failed",
    typeof message === "string"
      ? message
      : "The answer service is temporarily unavailable.",
  );
}

export const streamPortfolioAnswer: AskPortfolio = async (
  question,
  {
    signal,
    challengeToken,
    conversation,
    visitState,
    onEvent,
    fetchImplementation = fetch,
  },
) => {
  const body = {
    question,
    ...(conversation?.length ? { conversation } : {}),
    ...(visitState ? { visitState } : {}),
    ...(challengeToken ? { challengeToken } : {}),
  };
  const response = await fetchImplementation("/api/portfolio-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw await responseError(response);
  if (!response.body) {
    throw new PortfolioChatClientError(
      "empty_stream",
      "The answer service returned no response.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let modeReceived = false;
  let doneReceived = false;
  const deliver = (event: PortfolioChatEvent) => {
    if (doneReceived) throw invalidStream();
    if (event.type === "turn_mode") {
      if (modeReceived) throw invalidStream();
      modeReceived = true;
    }
    if (event.type === "answer_delta" && !modeReceived) {
      throw invalidStream();
    }
    if (event.type === "done") doneReceived = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
      let boundary = buffer.indexOf("\n");
      while (boundary >= 0) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        if (line) deliver(parseEvent(line));
        boundary = buffer.indexOf("\n");
      }
      if (done) break;
    }
    const finalLine = buffer.trim();
    if (finalLine) deliver(parseEvent(finalLine));
    if (!doneReceived) throw invalidStream();
  } finally {
    reader.releaseLock();
  }
};
