// Owns: which kept Guide turns a scheduled run reads for its window, and which
// days retention deletes. Retire with chat transcripts.
import { describe, expect, it } from "vitest";

import { r2ChatTranscripts, windowDays } from "./portfolio-chat-transcript-store";

function fakeBucket(entries: Record<string, unknown>) {
  const objects = new Map(Object.entries(entries).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]));
  const bucket = {
    get: async (key: string) => {
      const body = objects.get(key);
      return body === undefined ? null : { text: async () => body };
    },
    delete: async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
    list: async ({ prefix = "", delimiter }: { prefix?: string; delimiter?: string }) => {
      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      if (!delimiter) return { objects: keys.map((key) => ({ key })), truncated: false, delimitedPrefixes: [] };
      const prefixes = new Set(keys.map((key) => prefix + key.slice(prefix.length).split(delimiter)[0] + delimiter));
      return { objects: [], truncated: false, delimitedPrefixes: [...prefixes] };
    },
  } as unknown as R2Bucket;
  return { objects, bucket };
}

const turn = (capturedAt: string, extra: Record<string, unknown> = {}) => ({
  version: 1,
  capturedAt,
  requestId: capturedAt,
  sessionId: "tab-aaaaaa",
  question: "q",
  answer: "a",
  ...extra,
});

describe("r2ChatTranscripts", () => {
  it("lists the UTC days a window touches", () => {
    expect(windowDays({ start: "2026-09-14T00:00:00.000Z", end: "2026-09-16T23:59:59.000Z" })).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
    ]);
  });

  it("reads the window's turns oldest first and skips malformed records", async () => {
    const { bucket } = fakeBucket({
      "chat/2026-09-13/a.json": turn("2026-09-13T10:00:00.000Z"),
      "chat/2026-09-14/b.json": turn("2026-09-14T12:00:00.000Z"),
      "chat/2026-09-14/a.json": turn("2026-09-14T09:00:00.000Z"),
      "chat/2026-09-15/bad.json": "{not json",
      "chat/2026-09-15/old-shape.json": { version: 2, capturedAt: "2026-09-15T01:00:00.000Z" },
      "runs/history.jsonl": "{}",
    });
    const turns = await r2ChatTranscripts(bucket).read({ start: "2026-09-14T00:00:00.000Z", end: "2026-09-15T23:59:59.000Z" });
    expect(turns.map((value) => value.capturedAt)).toEqual(["2026-09-14T09:00:00.000Z", "2026-09-14T12:00:00.000Z"]);
  });

  it("deletes whole days past 90 days and nothing else", async () => {
    const { bucket, objects } = fakeBucket({
      "chat/2026-06-22/old.json": turn("2026-06-22T00:00:00.000Z"),
      "chat/2026-06-23/edge.json": turn("2026-06-23T00:00:00.000Z"),
      "chat/2026-09-20/new.json": turn("2026-09-20T00:00:00.000Z"),
      "runs/raw-events-2026-01-01T00-00-00-000Z.json": "{}",
    });
    await r2ChatTranscripts(bucket).prune(new Date("2026-09-21T11:10:00.000Z"));
    expect([...objects.keys()].sort()).toEqual([
      "chat/2026-06-23/edge.json",
      "chat/2026-09-20/new.json",
      "runs/raw-events-2026-01-01T00-00-00-000Z.json",
    ]);
  });
});
