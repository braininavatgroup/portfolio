// Reads and retires Guide transcripts for the scheduled insights run.
//
// The chat handler writes them (`lib/server/portfolio-chat-transcripts.ts`)
// under `chat/YYYY-MM-DD/`, one object per turn. The day prefix is what makes
// both jobs cheap: a window reads only its own days, and retention deletes
// whole days by name without opening anything.

import {
  CHAT_TRANSCRIPT_PREFIX,
  CHAT_TRANSCRIPT_PRUNE_AFTER_DAYS,
  type ChatTranscriptTurn,
} from "../lib/server/portfolio-chat-transcripts";

const DAY_MS = 86_400_000;
const DAY_PREFIX = /^chat\/(\d{4}-\d{2}-\d{2})\/$/u;

async function listKeys(bucket: R2Bucket, prefix: string) {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    for (const object of page.objects) keys.push(object.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

async function listDayPrefixes(bucket: R2Bucket) {
  const days: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: CHAT_TRANSCRIPT_PREFIX, delimiter: "/", cursor });
    for (const prefix of page.delimitedPrefixes ?? []) {
      const day = DAY_PREFIX.exec(prefix)?.[1];
      if (day) days.push(day);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return days;
}

/** The UTC days a window touches, oldest first. */
export function windowDays(range: { start: string; end: string }) {
  const days: string[] = [];
  const end = Date.parse(range.end);
  for (let at = Date.parse(range.start.slice(0, 10)); at <= end; at += DAY_MS) {
    days.push(new Date(at).toISOString().slice(0, 10));
  }
  return days;
}

function isTurn(value: unknown): value is ChatTranscriptTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Record<string, unknown>;
  return (
    turn.version === 1 &&
    typeof turn.capturedAt === "string" &&
    typeof turn.sessionId === "string" &&
    typeof turn.question === "string" &&
    typeof turn.answer === "string"
  );
}

export function r2ChatTranscripts(bucket: R2Bucket) {
  return {
    /** Every kept turn captured inside the window, oldest first. */
    async read(range: { start: string; end: string }) {
      const start = Date.parse(range.start);
      const end = Date.parse(range.end);
      const turns: ChatTranscriptTurn[] = [];
      for (const day of windowDays(range)) {
        for (const key of await listKeys(bucket, `${CHAT_TRANSCRIPT_PREFIX}${day}/`)) {
          const object = await bucket.get(key);
          if (!object) continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(await object.text());
          } catch {
            continue;
          }
          if (!isTurn(parsed)) continue;
          const at = Date.parse(parsed.capturedAt);
          if (at >= start && at <= end) turns.push(parsed);
        }
      }
      return turns.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    },
    /** Deletes every day that could hold a turn near the 90-day limit. */
    async prune(now: Date) {
      const cutoff = new Date(now.getTime() - CHAT_TRANSCRIPT_PRUNE_AFTER_DAYS * DAY_MS).toISOString().slice(0, 10);
      for (const day of await listDayPrefixes(bucket)) {
        if (day >= cutoff) continue;
        const keys = await listKeys(bucket, `${CHAT_TRANSCRIPT_PREFIX}${day}/`);
        // R2 deletes up to 1,000 keys per call.
        for (let index = 0; index < keys.length; index += 1000) {
          await bucket.delete(keys.slice(index, index + 1000));
        }
      }
    },
  };
}
