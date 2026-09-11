// Owns last-known-good source state, private file permissions, atomic
// replacement, and the 180-day raw-event deletion boundary. Retire these
// checks when local insight snapshots are removed.
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ensurePrivateDirectory,
  pruneRawSnapshots,
  rawEventsFileName,
  readLatestRawEvents,
  readSourceSnapshot,
  resolveSourceResult,
  writePrivateFile,
  writeRawEvents,
  writeSourceSnapshot,
} from "./portfolio-insights-storage.mjs";

const mode = async (path: string) => (await stat(path)).mode & 0o777;

let root: string;
let directory: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "portfolio-insights-storage-"));
  directory = join(root, "insights");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// Owns: the last-known-good event-level read is the newest raw file still
// inside retention, so an expired journey never reappears as stale data.
describe("latest raw events", () => {
  it("returns the newest readable raw file inside retention", async () => {
    await writeRawEvents(directory, [{ step: 1 }], "2026-09-09T07:10:00.000Z");
    await writeRawEvents(directory, [{ step: 2 }], "2026-09-10T07:10:00.000Z");
    await writeFile(join(directory, rawEventsFileName("2026-09-11T07:10:00.000Z")), "{torn");

    expect(await readLatestRawEvents(directory, "2026-09-11T08:00:00.000Z")).toEqual({
      capturedAt: "2026-09-10T07:10:00.000Z",
      events: [{ step: 2 }],
    });
  });

  it("answers null when every raw file has expired or none exists", async () => {
    await writeRawEvents(directory, [{ step: 1 }], "2026-01-01T00:00:00.000Z");
    expect(await readLatestRawEvents(directory, "2026-09-11T00:00:00.000Z")).toBeNull();
    expect(await readLatestRawEvents(join(root, "missing"), "2026-09-11T00:00:00.000Z")).toBeNull();
  });
});

describe("source snapshots", () => {
  it("replaces only the fetched source's file", async () => {
    await writeSourceSnapshot(directory, "clarity", { sessions: 1 }, "2026-09-10T07:10:00.000Z");
    await writeSourceSnapshot(directory, "cloudflare", { visits: 2 }, "2026-09-10T07:10:00.000Z");

    await writeSourceSnapshot(directory, "clarity", { sessions: 9 }, "2026-09-11T07:10:00.000Z");

    expect(await readSourceSnapshot(directory, "clarity")).toEqual({
      capturedAt: "2026-09-11T07:10:00.000Z",
      value: { sessions: 9 },
    });
    expect(await readSourceSnapshot(directory, "cloudflare")).toEqual({
      capturedAt: "2026-09-10T07:10:00.000Z",
      value: { visits: 2 },
    });
    expect((await readdir(directory)).sort()).toEqual(["source-clarity.json", "source-cloudflare.json"]);
  });

  it("returns null for a source that has never been written", async () => {
    expect(await readSourceSnapshot(directory, "insights")).toBeNull();
  });

  it("treats a corrupt snapshot as absent instead of crashing the run", async () => {
    await ensurePrivateDirectory(directory);
    await writeFile(join(directory, "source-clarity.json"), "{not json");
    expect(await readSourceSnapshot(directory, "clarity")).toBeNull();
  });

  it("rejects source names outside the four known sources", async () => {
    await expect(readSourceSnapshot(directory, "../history")).rejects.toThrow(/unknown insight source/u);
    await expect(writeSourceSnapshot(directory, "history", {}, "2026-09-11T07:10:00.000Z")).rejects.toThrow(
      /unknown insight source/u,
    );
  });

  it("never replaces a good snapshot with an error or a missing value", async () => {
    await writeSourceSnapshot(directory, "airtable", [{ code: "abc123" }], "2026-09-10T07:10:00.000Z");

    await expect(
      writeSourceSnapshot(directory, "airtable", new Error("503"), "2026-09-11T07:10:00.000Z"),
    ).rejects.toThrow(/error/u);
    await expect(writeSourceSnapshot(directory, "airtable", undefined, "2026-09-11T07:10:00.000Z")).rejects.toThrow();
    await expect(writeSourceSnapshot(directory, "airtable", [], "not a date")).rejects.toThrow(/capturedAt/u);

    expect(await readSourceSnapshot(directory, "airtable")).toEqual({
      capturedAt: "2026-09-10T07:10:00.000Z",
      value: [{ code: "abc123" }],
    });
  });

  it("accepts the CLI's file URL directory", async () => {
    const url = pathToFileURL(`${directory}/`);
    await writeSourceSnapshot(url, "insights", { rows: 3 }, "2026-09-11T07:10:00.000Z");
    expect(await readSourceSnapshot(url, "insights")).toEqual({
      capturedAt: "2026-09-11T07:10:00.000Z",
      value: { rows: 3 },
    });
  });
});

describe("resolveSourceResult", () => {
  const previous = { capturedAt: "2026-09-10T07:10:00.000Z", value: { sessions: 4 } };

  it("uses a successful fetch as fresh", () => {
    expect(resolveSourceResult({ fresh: { sessions: 9 }, previous, capturedAt: "2026-09-11T07:10:00.000Z" })).toEqual({
      status: "fresh",
      capturedAt: "2026-09-11T07:10:00.000Z",
      value: { sessions: 9 },
    });
  });

  it("falls back to the prior value as stale with its original timestamp", () => {
    expect(
      resolveSourceResult({ previous, error: new Error("Clarity 429"), capturedAt: "2026-09-11T07:10:00.000Z" }),
    ).toEqual({
      status: "stale",
      capturedAt: "2026-09-10T07:10:00.000Z",
      value: { sessions: 4 },
      error: "Clarity 429",
    });
  });

  it("prefers the prior value over a fresh value that arrived with an error", () => {
    const state = resolveSourceResult({
      fresh: { partial: true },
      previous,
      error: new Error("timeout"),
      capturedAt: "2026-09-11T07:10:00.000Z",
    });
    expect(state.status).toBe("stale");
    expect(state.value).toEqual({ sessions: 4 });
  });

  it("is unavailable, not zero, when there is no prior value", () => {
    expect(
      resolveSourceResult({ previous: null, error: new Error("Airtable 503"), capturedAt: "2026-09-11T07:10:00.000Z" }),
    ).toEqual({ status: "unavailable", capturedAt: null, value: null, error: "Airtable 503" });
  });

  it("keeps only a bounded error message, never the error's other properties", () => {
    const error = Object.assign(new Error(`x${"y".repeat(400)}`), {
      headers: { authorization: "Bearer secret-token" },
    });
    const state = resolveSourceResult({ previous: null, error, capturedAt: "2026-09-11T07:10:00.000Z" });
    expect(state.error).toHaveLength(300);
    expect(JSON.stringify(state)).not.toContain("secret-token");
  });
});

describe("private files", () => {
  it("keeps the directory 0700 and the dashboard and Airtable snapshot 0600", async () => {
    await mkdir(directory, { mode: 0o755 });
    await chmod(directory, 0o755);
    const dashboard = join(directory, "dashboard.html");
    await writeFile(dashboard, "<p>old</p>", { mode: 0o644 });
    await chmod(dashboard, 0o644);

    await ensurePrivateDirectory(directory);
    await writePrivateFile(dashboard, "<p>new</p>");
    await writeSourceSnapshot(directory, "airtable", [{ person: "Alex" }], "2026-09-11T07:10:00.000Z");

    expect(await mode(directory)).toBe(0o700);
    expect(await mode(dashboard)).toBe(0o600);
    expect(await mode(join(directory, "source-airtable.json"))).toBe(0o600);
    expect(await readFile(dashboard, "utf8")).toBe("<p>new</p>");
  });

  it("creates a missing directory as 0700 when writing a snapshot", async () => {
    await writeSourceSnapshot(directory, "clarity", {}, "2026-09-11T07:10:00.000Z");
    expect(await mode(directory)).toBe(0o700);
  });

  it("leaves no temporary file behind when the replacement fails", async () => {
    await ensurePrivateDirectory(directory);
    const blocked = join(directory, "dashboard.html");
    await mkdir(join(blocked, "occupied"), { recursive: true });

    await expect(writePrivateFile(blocked, "<p>new</p>")).rejects.toThrow();
    expect(await readdir(directory)).toEqual(["dashboard.html"]);
  });
});

describe("raw events and retention", () => {
  it("names raw-event files by capture time and writes them 0600", async () => {
    expect(rawEventsFileName("2026-09-11T07:10:05.042Z")).toBe("raw-events-2026-09-11T07-10-05-042Z.json");

    const path = await writeRawEvents(directory, [{ action: "open" }], "2026-09-11T07:10:05.042Z");

    expect(path).toBe(join(directory, "raw-events-2026-09-11T07-10-05-042Z.json"));
    expect(await mode(path)).toBe(0o600);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
      capturedAt: "2026-09-11T07:10:05.042Z",
      events: [{ action: "open" }],
    });
  });

  it("deletes only raw-event files older than 180 days, by filename timestamp", async () => {
    const now = new Date("2026-09-11T07:10:00.000Z");
    const day = 86_400_000;
    const at = (daysAgo: number, extraMs = 0) => new Date(now.getTime() - daysAgo * day - extraMs).toISOString();

    const expired = await writeRawEvents(directory, [], at(180, 1));
    const ancient = await writeRawEvents(directory, [], at(400));
    const boundary = await writeRawEvents(directory, [], at(180));
    const recent = await writeRawEvents(directory, [], at(1));
    for (const source of ["clarity", "cloudflare", "insights", "airtable"]) {
      await writeSourceSnapshot(directory, source, {}, at(900));
    }
    await writePrivateFile(join(directory, "history.jsonl"), "{}\n");
    await writePrivateFile(join(directory, "dashboard.html"), "<p></p>");
    await writePrivateFile(join(directory, "2025-01-01T00-00-00-000Z.json"), "{}");
    await writePrivateFile(join(directory, "raw-events-unparseable.json"), "{}");

    const deleted = await pruneRawSnapshots(directory, now);

    expect(deleted.sort()).toEqual([ancient, expired].sort());
    const remaining = await readdir(directory);
    expect(remaining).toContain(boundary.slice(directory.length + 1));
    expect(remaining).toContain(recent.slice(directory.length + 1));
    expect(remaining).toEqual(
      expect.arrayContaining([
        "source-clarity.json",
        "source-cloudflare.json",
        "source-insights.json",
        "source-airtable.json",
        "history.jsonl",
        "dashboard.html",
        "2025-01-01T00-00-00-000Z.json",
        "raw-events-unparseable.json",
      ]),
    );
    expect(remaining).toHaveLength(10);
  });

  it("uses the filename timestamp rather than modification time", async () => {
    const recentName = await writeRawEvents(directory, [], "2026-09-10T00:00:00.000Z");
    expect(await pruneRawSnapshots(directory, "2026-09-11T00:00:00.000Z", 180)).toEqual([]);
    expect(await pruneRawSnapshots(directory, "2027-09-11T00:00:00.000Z", 180)).toEqual([recentName]);
  });

  it("returns nothing for a missing directory and rejects an invalid clock", async () => {
    expect(await pruneRawSnapshots(join(root, "absent"), new Date())).toEqual([]);
    await expect(pruneRawSnapshots(directory, "not a date")).rejects.toThrow(/now/u);
    await expect(pruneRawSnapshots(directory, new Date(), 0)).rejects.toThrow(/retentionDays/u);
  });
});
