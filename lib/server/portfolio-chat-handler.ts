import {
  encodePortfolioChatEvent,
  type PortfolioChatEvent,
} from "../portfolio-chat-protocol";
import {
  groundPortfolioQuestion,
  type PortfolioGrounding,
} from "../portfolio-grounding";
import {
  INSUFFICIENT_EVIDENCE_MESSAGE,
  type PortfolioChatProvider,
  type PortfolioChatProviderUsage,
} from "./portfolio-chat-provider";
import {
  parsePortfolioChatConversation,
  type PortfolioChatMessage,
} from "../portfolio-chat-conversation";

export type PortfolioChatRequestContext = {
  requestId: string;
  safetyIdentifier?: string;
  providerModel: string;
};

export type PortfolioChatStreamEvent = {
  event: "portfolio_chat_stream";
  requestId: string;
  outcome:
    | "answered"
    | "insufficient_evidence"
    | "provider_unavailable"
    | "aborted";
  evidenceCount: number;
  evidenceIds: string[];
  durationMs: number;
  answerCharacters: number;
  providerModel: string;
  usage?: PortfolioChatProviderUsage;
};

type PortfolioChatHandlerDependencies = {
  isEnabled(): boolean;
  getProvider(): PortfolioChatProvider;
  getRequestContext?(request: Request): PortfolioChatRequestContext;
  record?(event: PortfolioChatStreamEvent): void;
  now?(): number;
  providerTimeoutMs?: number;
};

const maxRequestBytes = 12_288;
const maxSingleTurnRequestBytes = 4_096;
const maxQuestionLength = 600;
const maxChallengeTokenLength = 2_048;

export type ParsedPortfolioChatRequest = {
  question: string;
  conversation?: PortfolioChatMessage[];
  challengeToken?: string;
  grounding?: PortfolioGrounding;
};

class InsufficientEvidenceError extends Error {}

function validateCitedSegment(segment: string, evidenceCount: number) {
  const labels = [...segment.matchAll(/\[E(\d+)\]/g)];
  if (labels.length === 0) throw new Error("Provider output is not attributed.");
  for (const label of labels) {
    const evidenceNumber = Number(label[1]);
    if (evidenceNumber < 1 || evidenceNumber > evidenceCount) {
      throw new Error("Provider output cites unknown evidence.");
    }
  }

  const claim = segment.replace(/(?:\s*\[E\d+\])+\s*$/, "").trim();
  if (!claim || /[.!?]["')\]]?\s+\S/.test(claim)) {
    throw new Error("Provider output contains an unattributed sentence.");
  }
}

async function* validatedAnswerDeltas(
  deltas: AsyncIterable<string>,
  evidenceCount: number,
) {
  let buffer = "";
  const followedCitation = /\[E\d+\](?:\s*\[E\d+\])*(?=\s+[^\s[])/;

  for await (const delta of deltas) {
    buffer += delta;
    let boundary = followedCitation.exec(buffer);
    while (boundary) {
      const end = boundary.index + boundary[0].length;
      const segment = buffer.slice(0, end).trim();
      validateCitedSegment(segment, evidenceCount);
      yield `${segment} `;
      buffer = buffer.slice(end).trimStart();
      boundary = followedCitation.exec(buffer);
    }
  }

  const finalSegment = buffer.trim();
  if (!finalSegment) return;
  if (finalSegment === INSUFFICIENT_EVIDENCE_MESSAGE) {
    throw new InsufficientEvidenceError(finalSegment);
  }
  validateCitedSegment(finalSegment, evidenceCount);
  yield finalSegment;
}

class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function jsonResponse(status: number, body: object) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function readRequest(request: Request): Promise<ParsedPortfolioChatRequest> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
    throw new RequestError(413, "request_too_large", "Question request is too large.");
  }

  if (!request.body) {
    throw new RequestError(400, "invalid_request", "A question is required.");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxRequestBytes) {
        await reader.cancel();
        throw new RequestError(
          413,
          "request_too_large",
          "Question request is too large.",
        );
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new RequestError(400, "invalid_request", "Question request is invalid.");
  }

  const includesConversation =
    parsed && typeof parsed === "object" && "conversation" in parsed;
  if (!includesConversation && bytesRead > maxSingleTurnRequestBytes) {
    throw new RequestError(413, "request_too_large", "Question request is too large.");
  }

  const question =
    parsed && typeof parsed === "object" && "question" in parsed
      ? Reflect.get(parsed, "question")
      : undefined;
  if (typeof question !== "string" || !question.trim()) {
    throw new RequestError(400, "invalid_request", "A question is required.");
  }
  if (question.length > maxQuestionLength) {
    throw new RequestError(413, "question_too_long", "Question is too long.");
  }
  const challengeToken =
    parsed && typeof parsed === "object" && "challengeToken" in parsed
      ? Reflect.get(parsed, "challengeToken")
      : undefined;
  if (
    challengeToken !== undefined &&
    (typeof challengeToken !== "string" ||
      !challengeToken ||
      challengeToken.length > maxChallengeTokenLength)
  ) {
    throw new RequestError(
      400,
      "invalid_request",
      "Verification token is invalid.",
    );
  }
  const rawConversation =
    parsed && typeof parsed === "object" && "conversation" in parsed
      ? Reflect.get(parsed, "conversation")
      : undefined;
  let conversation: PortfolioChatMessage[] | undefined;
  if (rawConversation !== undefined) {
    const parsedConversation = parsePortfolioChatConversation(rawConversation);
    if (!parsedConversation.ok) {
      throw new RequestError(
        400,
        "invalid_request",
        "Conversation context is invalid.",
      );
    }
    conversation = parsedConversation.value;
  }
  return {
    question: question.trim(),
    ...(conversation?.length ? { conversation } : {}),
    ...(typeof challengeToken === "string" ? { challengeToken } : {}),
  };
}

export async function parsePortfolioChatRequest(request: Request) {
  try {
    return { ok: true as const, value: await readRequest(request) };
  } catch (error) {
    if (error instanceof RequestError) {
      return {
        ok: false as const,
        response: jsonResponse(error.status, {
          code: error.code,
          message: error.message,
        }),
      };
    }
    return {
      ok: false as const,
      response: jsonResponse(400, {
        code: "invalid_request",
        message: "Question request is invalid.",
      }),
    };
  }
}

function streamResponse(
  produce: (send: (event: PortfolioChatEvent) => void) => Promise<void>,
  onCancel: () => void = () => {},
) {
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PortfolioChatEvent) => {
        if (cancelled) return;
        controller.enqueue(encoder.encode(encodePortfolioChatEvent(event)));
      };
      try {
        await produce(send);
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
      onCancel();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/x-ndjson; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

export function createPortfolioChatHandler({
  isEnabled,
  getProvider,
  getRequestContext,
  record,
  now = Date.now,
  providerTimeoutMs = 15_000,
}: PortfolioChatHandlerDependencies) {
  return async function handlePortfolioChat(
    request: Request,
    prepared?: ParsedPortfolioChatRequest,
  ) {
    if (!isEnabled()) {
      return jsonResponse(503, {
        code: "disabled",
        message: "Ask the portfolio is not enabled.",
      });
    }

    const parsed = prepared
      ? { ok: true as const, value: prepared }
      : await parsePortfolioChatRequest(request);
    if (!parsed.ok) return parsed.response;
    const { question, conversation } = parsed.value;

    const grounding = parsed.value.grounding ?? groundPortfolioQuestion(question);
    const context = getRequestContext?.(request);
    const startedAt = now();
    const streamCancellation = new AbortController();
    const timeoutSignal = AbortSignal.timeout(providerTimeoutMs);
    const providerSignal = AbortSignal.any([
      request.signal,
      streamCancellation.signal,
      timeoutSignal,
    ]);
    return streamResponse(async (send) => {
      let outcome: PortfolioChatStreamEvent["outcome"] = "answered";
      let answerCharacters = 0;
      let usage: PortfolioChatProviderUsage | undefined;
      let finished = false;
      const markCancelledOrTimedOut = () => {
        if (request.signal.aborted || streamCancellation.signal.aborted) {
          outcome = "aborted";
          return;
        }
        outcome = "provider_unavailable";
        send({
          type: "error",
          code: "provider_unavailable",
          message: "The answer service is temporarily unavailable.",
        });
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        if (!context || !record) return;
        record({
          event: "portfolio_chat_stream",
          requestId: context.requestId,
          outcome,
          evidenceCount: grounding.evidence.length,
          evidenceIds: grounding.evidence.map(({ id }) => id),
          durationMs: Math.max(0, now() - startedAt),
          answerCharacters,
          providerModel: context.providerModel,
          ...(usage ? { usage } : {}),
        });
      };
      send({ type: "evidence", evidence: grounding.evidence });
      if (grounding.evidence.length === 0) {
        outcome = "insufficient_evidence";
        send({
          type: "notice",
          code: "insufficient_evidence",
          message: INSUFFICIENT_EVIDENCE_MESSAGE,
        });
        send({ type: "done" });
        finish();
        return;
      }

      try {
        const provider = getProvider();
        const providerDeltas = provider.streamAnswer({
          ...grounding,
          ...(conversation ? { conversation } : {}),
          signal: providerSignal,
          safetyIdentifier: context?.safetyIdentifier,
          onUsage: (reportedUsage) => {
            usage = reportedUsage;
          },
        });
        for await (const delta of validatedAnswerDeltas(
          providerDeltas,
          grounding.evidence.length,
        )) {
          if (delta) {
            answerCharacters += delta.length;
            send({ type: "answer_delta", delta });
          }
        }
        if (providerSignal.aborted) markCancelledOrTimedOut();
      } catch (error) {
        if (providerSignal.aborted) {
          markCancelledOrTimedOut();
        } else if (error instanceof InsufficientEvidenceError) {
          outcome = "insufficient_evidence";
          send({
            type: "notice",
            code: "insufficient_evidence",
            message: INSUFFICIENT_EVIDENCE_MESSAGE,
          });
        } else {
          outcome = "provider_unavailable";
          send({
            type: "error",
            code: "provider_unavailable",
            message: "The answer service is temporarily unavailable.",
          });
        }
      }
      if (!request.signal.aborted && !streamCancellation.signal.aborted) {
        send({ type: "done" });
      }
      finish();
    }, () => streamCancellation.abort());
  };
}
