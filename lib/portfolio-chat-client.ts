import type { PortfolioChatEvent } from "./portfolio-chat-protocol";

export type AskPortfolioOptions = {
  signal?: AbortSignal;
  challengeToken?: string;
  onEvent(event: PortfolioChatEvent): void;
  fetchImplementation?: typeof fetch;
};

export type AskPortfolio = (
  question: string,
  options: AskPortfolioOptions,
) => Promise<void>;

export type PortfolioChatPreviewAccessOptions = {
  signal?: AbortSignal;
  fetchImplementation?: typeof fetch;
};

export type RequestPortfolioChatPreviewAccess = (
  accessCode: string,
  options?: PortfolioChatPreviewAccessOptions,
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
  if (type === "answer_delta") {
    return typeof Reflect.get(value, "delta") === "string";
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
  { signal, challengeToken, onEvent, fetchImplementation = fetch },
) => {
  const body = challengeToken ? { question, challengeToken } : { question };
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
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n");
      let boundary = buffer.indexOf("\n");
      while (boundary >= 0) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        if (line) onEvent(parseEvent(line));
        boundary = buffer.indexOf("\n");
      }
      if (done) break;
    }
    const finalLine = buffer.trim();
    if (finalLine) onEvent(parseEvent(finalLine));
  } finally {
    reader.releaseLock();
  }
};

export const requestPortfolioChatPreviewAccess: RequestPortfolioChatPreviewAccess =
  async (
    accessCode,
    { signal, fetchImplementation = fetch } = {},
  ) => {
    const response = await fetchImplementation("/api/portfolio-chat/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode: accessCode.trim() }),
      credentials: "same-origin",
      signal,
    });
    if (!response.ok) throw await responseError(response);
  };
