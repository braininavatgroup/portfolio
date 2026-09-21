// Guide chat transcripts, kept so Bradley can see what visitors ask.
//
// One JSON object per finished turn, in the private R2 bucket the insights run
// already keeps its records in (`biv-portfolio-insights`), under `chat/`:
//
//   chat/YYYY-MM-DD/<capturedAt>-<requestId>.json
//
// The date prefix is the UTC capture day, so the daily insights run reads a
// window and deletes anything past `CHAT_TRANSCRIPT_RETENTION_DAYS` by listing
// prefixes, without opening a single record. Nothing makes the bucket
// readable: it has no public or custom domain, and the only route that renders
// any of it is the Access-gated insights dashboard.
//
// A turn is kept only when all three hold:
//   - `PORTFOLIO_CHAT_TRANSCRIPTS` is exactly `r2` and the bucket is bound;
//   - the Guide sent a tab session id, which it does only for a visit the
//     analytics consent allows (so a browser enrolled with `?analytics=off`,
//     or one that declined analytics on /privacy, is never kept);
//   - the turn reached the provider or was refused for lack of evidence.
//
// Kept: the question, the answer as streamed, the turn mode, the outcome, the
// evidence IDs the answer was grounded on, its duration, the tab session id,
// and the same coarse network location and device class the insight sink
// keeps. Not kept: the address, the user agent string, cookies, the chat
// identifier, or the earlier turns the client re-sent as context (each of
// those was already kept as its own turn).

import {
  deviceClassFromUserAgent,
  geographyOf,
  type DeviceClass,
} from "./portfolio-insight-sink";

export const CHAT_TRANSCRIPTS_R2 = "r2";
export const CHAT_TRANSCRIPT_PREFIX = "chat/";
export const CHAT_TRANSCRIPT_RETENTION_DAYS = 90;
/** Generous for a Guide answer; a runaway stream is cut here, not stored whole. */
export const MAX_TRANSCRIPT_ANSWER_CHARACTERS = 16_000;

export type ChatTranscriptTurn = {
  version: 1;
  capturedAt: string;
  requestId: string;
  sessionId: string;
  mode: "portfolio" | "social" | "general" | "none";
  outcome: string;
  question: string;
  answer: string;
  answerTruncated: boolean;
  evidenceIds: string[];
  durationMs: number;
  country: string;
  regionCode: string;
  city: string;
  device: DeviceClass;
};

/** What the handler knows about a turn when it finishes. */
export type FinishedChatTurn = Pick<
  ChatTranscriptTurn,
  "requestId" | "mode" | "outcome" | "question" | "evidenceIds" | "durationMs"
> & { answer: string; sessionId?: string };

export type ChatTranscriptBucket = {
  put(key: string, value: string, options?: unknown): Promise<unknown>;
};

export type ChatTranscriptEnv = {
  PORTFOLIO_CHAT_TRANSCRIPTS?: string;
  PORTFOLIO_INSIGHTS_STORE?: ChatTranscriptBucket;
};

export function chatTranscriptsActive(env: ChatTranscriptEnv) {
  return (
    env.PORTFOLIO_CHAT_TRANSCRIPTS === CHAT_TRANSCRIPTS_R2 &&
    typeof env.PORTFOLIO_INSIGHTS_STORE?.put === "function"
  );
}

/** Safe in a key: the request id is a UUID, the time an ISO string. */
export function chatTranscriptKey(capturedAt: string, requestId: string) {
  const safeId = requestId.replace(/[^A-Za-z0-9-]/gu, "");
  return `${CHAT_TRANSCRIPT_PREFIX}${capturedAt.slice(0, 10)}/${capturedAt.replace(/[:.]/gu, "-")}-${safeId}.json`;
}

export function transcriptTurn(
  turn: FinishedChatTurn & { sessionId: string },
  request: Request,
  capturedAt: string,
): ChatTranscriptTurn {
  const truncated = turn.answer.length > MAX_TRANSCRIPT_ANSWER_CHARACTERS;
  const { country, regionCode, city } = geographyOf(request);
  return {
    version: 1,
    capturedAt,
    requestId: turn.requestId,
    sessionId: turn.sessionId,
    mode: turn.mode,
    outcome: turn.outcome,
    question: turn.question,
    answer: truncated ? turn.answer.slice(0, MAX_TRANSCRIPT_ANSWER_CHARACTERS) : turn.answer,
    answerTruncated: truncated,
    evidenceIds: turn.evidenceIds,
    durationMs: turn.durationMs,
    country,
    regionCode,
    city,
    device: deviceClassFromUserAgent(request.headers.get("user-agent")),
  };
}

/**
 * The keeper the handler calls when a turn finishes, or undefined when
 * transcripts are off. A storage failure is swallowed: the visitor already has
 * their answer, and keeping it is never allowed to change that.
 */
export function createChatTranscriptKeeper({
  env,
  request,
  now = Date.now,
}: {
  env: ChatTranscriptEnv;
  request: Request;
  now?: () => number;
}) {
  if (!chatTranscriptsActive(env)) return undefined;
  const bucket = env.PORTFOLIO_INSIGHTS_STORE!;
  return async (turn: FinishedChatTurn) => {
    if (!turn.sessionId) return;
    try {
      const capturedAt = new Date(now()).toISOString();
      const record = transcriptTurn({ ...turn, sessionId: turn.sessionId }, request, capturedAt);
      await bucket.put(chatTranscriptKey(capturedAt, turn.requestId), JSON.stringify(record), {
        httpMetadata: { contentType: "application/json" },
      });
    } catch {
      // Keeping a transcript never fails the visitor's turn.
    }
  };
}
