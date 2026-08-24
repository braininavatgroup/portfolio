import {
  encodePortfolioChatEvent,
  type PortfolioChatEvent,
} from "../portfolio-chat-protocol";
import { groundPortfolioQuestion } from "../portfolio-grounding";
import {
  INSUFFICIENT_EVIDENCE_MESSAGE,
  type PortfolioChatProvider,
} from "./portfolio-chat-provider";

type PortfolioChatHandlerDependencies = {
  isEnabled(): boolean;
  getProvider(): PortfolioChatProvider;
};

const maxRequestBytes = 4_096;
const maxQuestionLength = 600;

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

async function readQuestion(request: Request) {
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
  return question.trim();
}

function streamResponse(
  produce: (send: (event: PortfolioChatEvent) => void) => Promise<void>,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PortfolioChatEvent) => {
        controller.enqueue(encoder.encode(encodePortfolioChatEvent(event)));
      };
      try {
        await produce(send);
      } finally {
        controller.close();
      }
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
}: PortfolioChatHandlerDependencies) {
  return async function handlePortfolioChat(request: Request) {
    if (!isEnabled()) {
      return jsonResponse(503, {
        code: "disabled",
        message: "Ask the portfolio is not enabled.",
      });
    }

    let question: string;
    try {
      question = await readQuestion(request);
    } catch (error) {
      if (error instanceof RequestError) {
        return jsonResponse(error.status, {
          code: error.code,
          message: error.message,
        });
      }
      return jsonResponse(400, {
        code: "invalid_request",
        message: "Question request is invalid.",
      });
    }

    const grounding = groundPortfolioQuestion(question);
    return streamResponse(async (send) => {
      send({ type: "evidence", evidence: grounding.evidence });
      if (grounding.evidence.length === 0) {
        send({
          type: "notice",
          code: "insufficient_evidence",
          message: INSUFFICIENT_EVIDENCE_MESSAGE,
        });
        send({ type: "done" });
        return;
      }

      try {
        const provider = getProvider();
        const providerDeltas = provider.streamAnswer({
          ...grounding,
          signal: request.signal,
        });
        for await (const delta of validatedAnswerDeltas(
          providerDeltas,
          grounding.evidence.length,
        )) {
          if (delta) send({ type: "answer_delta", delta });
        }
      } catch (error) {
        if (error instanceof InsufficientEvidenceError) {
          send({
            type: "notice",
            code: "insufficient_evidence",
            message: INSUFFICIENT_EVIDENCE_MESSAGE,
          });
        } else {
          send({
            type: "error",
            code: "provider_unavailable",
            message: "The answer service is temporarily unavailable.",
          });
        }
      }
      send({ type: "done" });
    });
  };
}
