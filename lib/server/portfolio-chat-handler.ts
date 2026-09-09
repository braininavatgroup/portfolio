import {
  encodePortfolioChatEvent,
  type PortfolioChatEvent,
  type PortfolioChatTurnMode,
  type PortfolioChatVisitState,
} from "../portfolio-chat-protocol";
import {
  groundPortfolioQuestion,
  type PortfolioGrounding,
} from "../portfolio-grounding";
import {
  INSUFFICIENT_EVIDENCE_MESSAGE,
  type PortfolioChatProvider,
  type PortfolioChatProviderFailureKind,
  type PortfolioChatProviderUsage,
} from "./portfolio-chat-provider";
import {
  parsePortfolioChatConversation,
  type PortfolioChatMessage,
} from "../portfolio-chat-conversation";
import type { PortfolioResponseEffects } from "../avatar/contracts";

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
    | "partial_answer"
    | "insufficient_evidence"
    | "provider_unavailable"
    | "aborted";
  evidenceCount: number;
  evidenceIds: string[];
  durationMs: number;
  answerCharacters: number;
  providerModel: string;
  usage?: PortfolioChatProviderUsage;
  providerFailureKind?: PortfolioChatProviderFailureKind;
};

type PortfolioChatHandlerDependencies = {
  getProvider(): PortfolioChatProvider;
  getRequestContext?(request: Request): PortfolioChatRequestContext;
  record?(event: PortfolioChatStreamEvent): void;
  now?(): number;
  providerTimeoutMs?: number;
};

const maxRequestBytes = 12_288;
const maxSingleTurnRequestBytes = 4_096;
const maxQuestionLength = 600;
const oneTimeGeneralNudge =
  "If you feel like changing subjects, Bradley's portfolio is nearby, pretending not to hover.";

export type ParsedPortfolioChatRequest = {
  question: string;
  conversation?: PortfolioChatMessage[];
  visitState?: PortfolioChatVisitState;
  grounding?: PortfolioGrounding;
};

class InvalidAttributionError extends Error {}

function words(text: string) {
  return text
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function includesPortfolioAlias(text: string, grounding: PortfolioGrounding) {
  const normalizedText = ` ${words(text).join(" ")} `;
  const aliases = grounding.evidence.flatMap(({ id, title }) => {
    const titleWords = words(title);
    return [
      id.replace(/^(?:entity|node|thread):/, "").replaceAll("-", " "),
      title,
      ...(titleWords.length >= 3 ? [titleWords.slice(-2).join(" ")] : []),
    ];
  });
  return aliases.some((alias) => {
    const aliasWords = words(alias);
    return (
      aliasWords.length >= 2 &&
      normalizedText.includes(` ${aliasWords.join(" ")} `)
    );
  });
}

function includesPortfolioEntity(
  text: string,
  grounding: PortfolioGrounding,
) {
  const normalized = text.toLocaleLowerCase();
  if (/\b(?:bradley|berkman|portfolio)\b/i.test(text)) return true;
  return includesPortfolioAlias(normalized, grounding);
}

function requiresPortfolioMode(
  question: string,
  conversation: readonly PortfolioChatMessage[] | undefined,
  grounding: PortfolioGrounding,
) {
  if (includesPortfolioEntity(question, grounding)) return true;
  if (
    /\b(?:case stud(?:y|ies)|what do you do|who are you|your (?:work|projects?|background|experience|approach|process|consulting)|this (?:site|website))\b/i.test(
      question,
    )
  ) {
    return true;
  }
  const priorAssistant = conversation
    ?.toReversed()
    .find(({ role }) => role === "assistant");
  return Boolean(
    priorAssistant &&
      /\[E[1-9]\d*\]/.test(priorAssistant.content) &&
      (/\b(?:which example|tell me more about (?:that|it)|how did (?:that|it)|what changed)\b/i.test(
        question,
      ) ||
        /\b(?:it|that|this|they|them|those|these|one|ones)\b/i.test(question) ||
        /\b(?:next|then|else|more|continue|continued|elaborate|expand|expanded|results?|outcomes?|happened|afterward)\b/i.test(
          question,
        ) ||
        /^(?:why|how|when|where)\??$/i.test(question.trim())),
  );
}

function validateUncitedAnswer(answer: string) {
  const normalized = answer.trim();
  if (
    !normalized ||
    /\b(?:bradley|berkman|portfolio)\b/i.test(normalized) ||
    /(?:^|\n)\s*MODE:\s*/i.test(normalized)
  ) {
    throw new InvalidAttributionError(
      "Non-portfolio output crossed the portfolio boundary.",
    );
  }
  return normalized;
}

async function* withoutModeMarkers(deltas: AsyncIterable<string>) {
  let output = "";
  for await (const delta of deltas) {
    output += delta;
    if (/(?:^|\n)\s*MODE:\s*/i.test(output)) {
      throw new InvalidAttributionError(
        "Provider output contains an extra mode marker.",
      );
    }
    yield delta;
  }
}

async function* validatedUncitedAnswerDeltas(
  deltas: AsyncIterable<string>,
  appendNudge: boolean,
) {
  let buffer = "";
  const sentenceBoundary = /[.!?]["')\]]?\s+/;

  for await (const delta of deltas) {
    buffer += delta;
    let boundary = sentenceBoundary.exec(buffer);
    while (boundary) {
      const end = boundary.index + boundary[0].length;
      const segment = buffer.slice(0, end);
      validateUncitedAnswer(segment);
      yield segment;
      buffer = buffer.slice(end);
      boundary = sentenceBoundary.exec(buffer);
    }
  }

  const finalSegment = buffer.trim();
  if (finalSegment) validateUncitedAnswer(finalSegment);
  if (finalSegment || appendNudge) {
    yield `${finalSegment}${finalSegment && appendNudge ? "\n\n" : ""}${appendNudge ? oneTimeGeneralNudge : ""}`;
  }
}

function validatePortfolioSegment(segment: string, evidenceCount: number) {
  const labels = [...segment.matchAll(/\[E(\d+)\]/g)];
  if (labels.length === 0) return;
  for (const label of labels) {
    if (label[1].startsWith("0")) {
      throw new InvalidAttributionError(
        "Provider output uses a noncanonical evidence label.",
      );
    }
    const evidenceNumber = Number(label[1]);
    if (evidenceNumber < 1 || evidenceNumber > evidenceCount) {
      throw new InvalidAttributionError(
        "Provider output cites unknown evidence.",
      );
    }
  }

  const claim = segment.replace(/\[([^\]\n]+)\]\[E[1-9]\d*\]/g, "$1").replace(/(?:\s*\[E[1-9]\d*\])+\s*$/, "").trim();
  if (!claim || /[.!?]["')\]]?\s+\S/.test(claim)) {
    throw new InvalidAttributionError(
      "Provider output contains an unattributed sentence.",
    );
  }
}

async function* validatedAnswerDeltas(
  deltas: AsyncIterable<string>,
  evidenceCount: number,
) {
  let buffer = "";
  const paragraphBoundaryPattern = /\n\n/;
  const followedCitation =
    /(?<!\])\[E[1-9]\d*\](?:\s*\[E[1-9]\d*\])*(?=\s+[^\s[])/;

  for await (const delta of deltas) {
    buffer += delta;
    let paragraphBoundary = paragraphBoundaryPattern.exec(buffer);
    while (paragraphBoundary) {
      const end = paragraphBoundary.index + paragraphBoundary[0].length;
      let paragraph = buffer.slice(0, end);
      let citationBoundary = followedCitation.exec(paragraph);
      while (citationBoundary) {
        const citationEnd = citationBoundary.index + citationBoundary[0].length;
        const sentence = paragraph.slice(0, citationEnd);
        validatePortfolioSegment(sentence, evidenceCount);
        yield sentence;
        paragraph = paragraph.slice(citationEnd);
        citationBoundary = followedCitation.exec(paragraph);
      }
      validatePortfolioSegment(paragraph, evidenceCount);
      if (paragraph) yield paragraph;
      buffer = buffer.slice(end);
      paragraphBoundary = paragraphBoundaryPattern.exec(buffer);
    }
    let boundary = followedCitation.exec(buffer);
    while (boundary) {
      const end = boundary.index + boundary[0].length;
      const segment = buffer.slice(0, end).trim();
      validatePortfolioSegment(segment, evidenceCount);
      yield `${segment} `;
      buffer = buffer.slice(end).trimStart();
      boundary = followedCitation.exec(buffer);
    }
  }

  const finalSegment = buffer.trim();
  if (!finalSegment) return;
  validatePortfolioSegment(finalSegment, evidenceCount);
  yield finalSegment;
}

async function* answerDeltasWithFirst(
  first: IteratorResult<string>,
  iterator: AsyncIterator<string>,
) {
  try {
    let current = first;
    while (!current.done) {
      yield current.value;
      current = await iterator.next();
    }
  } finally {
    await iterator.return?.();
  }
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
  const rawVisitState =
    parsed && typeof parsed === "object" && "visitState" in parsed
      ? Reflect.get(parsed, "visitState")
      : undefined;
  let visitState: PortfolioChatVisitState | undefined;
  if (rawVisitState !== undefined) {
    const generalTurns =
      rawVisitState && typeof rawVisitState === "object"
        ? Reflect.get(rawVisitState, "generalTurns")
        : undefined;
    const portfolioNudgeShown =
      rawVisitState && typeof rawVisitState === "object"
        ? Reflect.get(rawVisitState, "portfolioNudgeShown")
        : undefined;
    if (
      !Number.isInteger(generalTurns) ||
      typeof generalTurns !== "number" ||
      generalTurns < 0 ||
      generalTurns > 2 ||
      typeof portfolioNudgeShown !== "boolean"
    ) {
      throw new RequestError(
        400,
        "invalid_request",
        "Visit routing state is invalid.",
      );
    }
    visitState = { generalTurns, portfolioNudgeShown };
  }
  return {
    question: question.trim(),
    ...(conversation?.length ? { conversation } : {}),
    ...(visitState ? { visitState } : {}),
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
    const parsed = prepared
      ? { ok: true as const, value: prepared }
      : await parsePortfolioChatRequest(request);
    if (!parsed.ok) return parsed.response;
    const { question, conversation, visitState } = parsed.value;

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
      let providerFailureKind: PortfolioChatProviderFailureKind | undefined;
      let pendingEffects: PortfolioResponseEffects | undefined;
      let finished = false;
      let preservePartialAnswer = true;
      const markProviderUnavailable = () => {
        if (answerCharacters > 0 && preservePartialAnswer) {
          outcome = "partial_answer";
          return;
        }
        outcome = "provider_unavailable";
        send({
          type: "error",
          code: "provider_unavailable",
          message: "The answer service is temporarily unavailable.",
        });
      };
      const markCancelledOrTimedOut = () => {
        if (request.signal.aborted || streamCancellation.signal.aborted) {
          outcome = "aborted";
          return;
        }
        markProviderUnavailable();
      };
      const sendPendingEffects = () => {
        if (!pendingEffects) return;
        send({ type: "effects", effects: pendingEffects });
        pendingEffects = undefined;
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
          ...(providerFailureKind ? { providerFailureKind } : {}),
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
        let turnMode: PortfolioChatTurnMode | undefined;
        const providerDeltas = provider.streamAnswer({
          ...grounding,
          ...(conversation ? { conversation } : {}),
          ...(visitState ? { visitState } : {}),
          signal: providerSignal,
          safetyIdentifier: context?.safetyIdentifier,
          onMode: (mode) => {
            if (turnMode && turnMode !== mode) {
              throw new Error("Provider changed the turn mode.");
            }
            if (!turnMode) {
              turnMode = mode;
            }
          },
          onEffects: (effects) => {
            pendingEffects = effects;
          },
          onUsage: (reportedUsage) => {
            usage = reportedUsage;
          },
          onFailure: (kind) => {
            providerFailureKind = kind;
          },
        });
        const iterator = providerDeltas[Symbol.asyncIterator]();
        const first = await iterator.next();
        const answerDeltas = withoutModeMarkers(
          answerDeltasWithFirst(first, iterator),
        );
        const proposedMode = turnMode as PortfolioChatTurnMode | undefined;
        const effectiveMode =
          proposedMode &&
          proposedMode !== "portfolio" &&
          requiresPortfolioMode(question, conversation, grounding)
            ? "portfolio"
            : (proposedMode ?? "portfolio");
        if (proposedMode) send({ type: "turn_mode", mode: effectiveMode });

        if (effectiveMode === "portfolio") {
          for await (const delta of validatedAnswerDeltas(
            answerDeltas,
            grounding.evidence.length,
          )) {
            if (delta) {
              answerCharacters += delta.length;
              sendPendingEffects();
              send({ type: "answer_delta", delta });
            }
          }
        } else {
          preservePartialAnswer = false;
          const appendNudge =
            effectiveMode === "general" &&
            visitState?.generalTurns === 2 &&
            !visitState.portfolioNudgeShown;
          for await (const delta of validatedUncitedAnswerDeltas(
            answerDeltas,
            appendNudge,
          )) {
            answerCharacters += delta.length;
            sendPendingEffects();
            send({ type: "answer_delta", delta });
          }
        }
        if (providerSignal.aborted) {
          markCancelledOrTimedOut();
        } else if (answerCharacters > 0) {
          sendPendingEffects();
        }
      } catch (error) {
        if (request.signal.aborted || streamCancellation.signal.aborted) {
          outcome = "aborted";
        } else if (error instanceof InvalidAttributionError) {
          markProviderUnavailable();
        } else {
          markProviderUnavailable();
        }
      }
      if (!request.signal.aborted && !streamCancellation.signal.aborted) {
        send({ type: "done" });
      }
      finish();
    }, () => streamCancellation.abort());
  };
}
