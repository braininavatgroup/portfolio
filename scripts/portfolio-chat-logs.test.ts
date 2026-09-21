// Owns: reading the Guide's Workers Logs events without the query API's
// sampling hiding them. Retire when those events are no longer read from logs.
import { describe, expect, it } from "vitest";

import {
  MIN_SLICE_MS,
  SLICE_MS,
  formatChatLogEvent,
  parseChatLogArguments,
  readChatLogEvents,
} from "./portfolio-chat-logs.mjs";

/** A telemetry API that samples any window wider than `unsampledMs`. */
function fakeApi(events: Array<{ timestamp: number }>, unsampledMs: number) {
  const calls: Array<[number, number]> = [];
  const fetchImplementation = (async (_url: string, init: RequestInit) => {
    const { timeframe } = JSON.parse(init.body as string);
    calls.push([timeframe.from, timeframe.to]);
    const width = timeframe.to - timeframe.from;
    const inside = events.filter((event) => event.timestamp >= timeframe.from && event.timestamp < timeframe.to);
    const abr = width > unsampledMs ? 100 : 1;
    return Response.json({
      success: true,
      result: { events: { events: abr === 1 ? inside : [] }, statistics: { abr_level: abr } },
    });
  }) as unknown as typeof fetch;
  return { calls, fetchImplementation };
}

describe("readChatLogEvents", () => {
  it("asks in slices and splits a sampled slice until every event comes back", async () => {
    const from = Date.parse("2026-09-17T00:00:00.000Z");
    const events = [
      { timestamp: from + 17 * 3_600_000 + 50 * 60_000 },
      { timestamp: from + 18 * 3_600_000 + 46 * 60_000 },
      { timestamp: from + 43 * 3_600_000 },
    ];
    const api = fakeApi(events, SLICE_MS / 2);
    const result = await readChatLogEvents(
      { token: "t", fetchImplementation: api.fetchImplementation },
      from,
      from + 48 * 3_600_000,
    );
    expect(result.events.map((event) => event.timestamp)).toEqual(events.map((event) => event.timestamp));
    expect(result.sampled).toEqual([]);
    // Every answered slice is no wider than the unsampled width, and they tile the window.
    const answered = api.calls.filter(([start, end]) => end - start <= SLICE_MS / 2);
    expect(answered.reduce((sum, [start, end]) => sum + (end - start), 0)).toBe(48 * 3_600_000);
  });

  it("reports a slice that is still sampled at the smallest width instead of dropping it silently", async () => {
    const from = Date.parse("2026-09-17T00:00:00.000Z");
    const api = fakeApi([], MIN_SLICE_MS / 4);
    const result = await readChatLogEvents(
      { token: "t", fetchImplementation: api.fetchImplementation },
      from,
      from + MIN_SLICE_MS,
    );
    expect(result.sampled).toEqual([{ from, to: from + MIN_SLICE_MS, abrLevel: 100 }]);
  });

  it("fails loudly on an API error", async () => {
    const fetchImplementation = (async () =>
      Response.json({ success: false, errors: [{ message: "Authentication error" }] }, { status: 403 })) as unknown as typeof fetch;
    await expect(readChatLogEvents({ token: "t", fetchImplementation }, 0, 1000)).rejects.toThrow(/403.*Authentication error/u);
  });
});

describe("the command line", () => {
  it("defaults to the full seven-day retention and bounds --days", () => {
    expect(parseChatLogArguments([])).toEqual({ days: 7, json: false });
    expect(parseChatLogArguments(["--days", "3", "--json"])).toEqual({ days: 3, json: true });
    expect(() => parseChatLogArguments(["--days", "30"])).toThrow(/1 to 7/u);
  });

  it("prints outcome, timing, and citations, and nothing a visitor typed", () => {
    const line = formatChatLogEvent({
      timestamp: Date.parse("2026-09-18T19:39:00.000Z"),
      source: {
        event: "portfolio_chat_stream",
        outcome: "answered",
        durationMs: 5233,
        answerCharacters: 733,
        citedEvidenceIds: ["node:writ"],
      },
    });
    expect(line).toBe("2026-09-18 19:39 UTC · portfolio_chat_stream · answered · 5233 ms · 733 chars · cited: node:writ");
    expect(formatChatLogEvent({ timestamp: 0, source: { event: "portfolio_chat_stream", outcome: "answered" } })).toContain(
      "cited: not recorded",
    );
  });
});
