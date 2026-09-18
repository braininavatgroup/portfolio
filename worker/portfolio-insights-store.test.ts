import { describe, expect, it } from "vitest";

import { INSIGHTS_PREFIX, r2InsightStorage } from "./portfolio-insights-store";

// Failure this pins: the run's retention and last-known-good rules are written
// once, in scripts/portfolio-insights-records.mjs, against a backend contract.
// The local backend is a directory; this one is an R2 bucket, whose listing is
// prefixed and paginated and whose absent object is a null rather than an
// error. Getting either wrong is silent: a prefix mistake makes every run look
// like the first one, and an unpaginated list makes raw events older than the
// first page immortal — event-level rows that should have expired at 180 days.
//
// The rules themselves are proved in scripts/portfolio-insights-storage.test.ts
// over the other backend. These are the R2-shaped ways to break them.
//
// Owner: worker/portfolio-insights-store.ts. Retire with the R2 backend.

/** R2's get/put/list/delete, with a page size small enough to force paging. */
function fakeBucket(pageSize = 2) {
  const objects = new Map<string, string>();
  const reads: string[] = [];
  return {
    objects,
    reads,
    bucket: {
      get: async (key: string) => {
        reads.push(key);
        const body = objects.get(key);
        return body === undefined ? null : { text: async () => body };
      },
      put: async (key: string, value: string) => {
        objects.set(key, value);
      },
      delete: async (key: string) => {
        objects.delete(key);
      },
      list: async ({ prefix = "", cursor }: { prefix?: string; cursor?: string } = {}) => {
        const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
        const start = cursor ? keys.indexOf(cursor) : 0;
        const page = keys.slice(start, start + pageSize);
        const next = start + pageSize;
        return {
          objects: page.map((key) => ({ key })),
          truncated: next < keys.length,
          cursor: keys[next],
        };
      },
    } as unknown as R2Bucket,
  };
}

const NOW = "2026-09-18T11:10:00.000Z";
const ago = (days: number) => new Date(Date.parse(NOW) - days * 86_400_000).toISOString();

describe("R2 insight storage", () => {
  it("keys every record under its prefix and reads back what it wrote", async () => {
    const { bucket, objects } = fakeBucket();
    const store = r2InsightStorage(bucket);

    await store.writeSourceSnapshot(INSIGHTS_PREFIX, "airtable", [{ campaignCode: "alexcode01" }], NOW);
    await store.appendHistoryRow(INSIGHTS_PREFIX, { capturedAt: NOW });
    await store.writeDashboard(INSIGHTS_PREFIX, "<html></html>");

    expect([...objects.keys()].sort()).toEqual([
      "runs/dashboard.html",
      "runs/history.jsonl",
      "runs/source-airtable.json",
    ]);
    expect(await store.readSourceSnapshot(INSIGHTS_PREFIX, "airtable")).toEqual({
      capturedAt: NOW,
      value: [{ campaignCode: "alexcode01" }],
    });
    expect(await store.readHistory(INSIGHTS_PREFIX)).toEqual([{ capturedAt: NOW }]);
  });

  it("reads an untouched bucket as a first run rather than an error", async () => {
    const store = r2InsightStorage(fakeBucket().bucket);
    expect(await store.readSourceSnapshot(INSIGHTS_PREFIX, "clarity")).toBeNull();
    expect(await store.readHistory(INSIGHTS_PREFIX)).toEqual([]);
    expect(await store.readLatestRawEvents(INSIGHTS_PREFIX, NOW)).toBeNull();
    expect(await store.pruneRawSnapshots(INSIGHTS_PREFIX, new Date(NOW))).toEqual([]);
  });

  it("appends history rows across runs instead of replacing them", async () => {
    const store = r2InsightStorage(fakeBucket().bucket);
    await store.appendHistoryRow(INSIGHTS_PREFIX, { run: 1 });
    await store.appendHistoryRow(INSIGHTS_PREFIX, { run: 2 });
    expect(await store.readHistory(INSIGHTS_PREFIX)).toEqual([{ run: 1 }, { run: 2 }]);
  });

  // The pruning boundary itself is proved over the local backend; what R2 adds
  // is a truncated listing. With a page size of two and five raw entries, an
  // unpaginated prune would never see the oldest ones.
  it("pages through a truncated listing so every expired raw entry is found", async () => {
    const { bucket } = fakeBucket(2);
    const store = r2InsightStorage(bucket);
    const expired = [ago(400), ago(300), ago(200)];
    const kept = [ago(10), ago(1)];
    for (const capturedAt of [...expired, ...kept]) {
      await store.writeRawEvents(INSIGHTS_PREFIX, [], capturedAt, { windowStart: capturedAt });
    }

    const deleted = await store.pruneRawSnapshots(INSIGHTS_PREFIX, new Date(NOW));
    expect(deleted).toHaveLength(expired.length);
    const remaining = await store.pruneRawSnapshots(INSIGHTS_PREFIX, new Date(NOW));
    expect(remaining).toEqual([]);
    expect(await store.readLatestRawEvents(INSIGHTS_PREFIX, NOW)).toMatchObject({ capturedAt: ago(1) });
  });

  // Each raw entry holds up to 10,000 event rows, and at steady state there is
  // one per day inside the 180-day retention. Opening them all to decide which
  // to delete would be ~180 serial round trips on every scheduled run, inside a
  // Worker's CPU budget, to delete nothing.
  it("prunes without opening an entry whose name already settles its age", async () => {
    const { bucket, reads } = fakeBucket(50);
    const store = r2InsightStorage(bucket);
    for (const days of [170, 100, 40, 5, 1]) {
      const capturedAt = ago(days);
      await store.writeRawEvents(INSIGHTS_PREFIX, [], capturedAt, { windowStart: capturedAt });
    }

    reads.length = 0;
    expect(await store.pruneRawSnapshots(INSIGHTS_PREFIX, new Date(NOW))).toEqual([]);
    // Only the entry close enough to the boundary that its window could reach
    // past it — captured 170 days ago, against a 30-day longest window.
    expect(reads).toEqual([`${INSIGHTS_PREFIX}raw-events-${ago(170).replace(/[:.]/gu, "-")}.json`]);
  });

  // A truncated listing must not hide a newer raw entry behind an older one,
  // which would serve stale journeys while fresh ones sat unread.
  it("finds the newest raw entry even when it is not on the first page", async () => {
    const { bucket } = fakeBucket(1);
    const store = r2InsightStorage(bucket);
    for (const capturedAt of [ago(3), ago(2), ago(1)]) {
      await store.writeRawEvents(INSIGHTS_PREFIX, [{ timestamp: capturedAt }], capturedAt, {
        windowStart: capturedAt,
      });
    }
    expect(await store.readLatestRawEvents(INSIGHTS_PREFIX, NOW)).toMatchObject({ capturedAt: ago(1) });
  });

  // Records under another prefix belong to another run — a comparison against a
  // recorded window, say — and must not be listed, read or pruned as this one's.
  it("keeps records under another prefix out of this run entirely", async () => {
    const { bucket, objects } = fakeBucket();
    const store = r2InsightStorage(bucket);
    await store.writeRawEvents("compare/", [], ago(400), { windowStart: ago(400) });
    await store.appendHistoryRow("compare/", { run: "comparison" });
    await store.appendHistoryRow(INSIGHTS_PREFIX, { run: "scheduled" });

    expect(await store.pruneRawSnapshots(INSIGHTS_PREFIX, new Date(NOW))).toEqual([]);
    expect(await store.readHistory(INSIGHTS_PREFIX)).toEqual([{ run: "scheduled" }]);
    expect([...objects.keys()].some((key) => key.startsWith("compare/raw-events-"))).toBe(true);
  });
});
