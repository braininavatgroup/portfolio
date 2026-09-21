// Owns: the daily insights run. Each source resolves on its own and falls back
// to its last-known-good snapshot; an Airtable configuration error never uses
// cached identity; the event-level read failing never erases aggregate counts;
// files are written sources → raw events → history → dashboard with pruning
// last; the directory is 0700 and every file 0600; event-level rows and
// identity stay out of history and aggregate snapshots; the terminal leads with
// the dashboard's findings; and the launchd installer checks the directory
// mode before installing. Retire with the scheduled job.
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AirtableConfigurationError, AirtableRequestError } from "./portfolio-insights-airtable.mjs";
import { escapeHtml } from "./portfolio-insights-dashboard.mjs";
import {
  buildFixtureDashboard,
  eventRow,
  FIXTURE_TOKENS,
  fixtureAssignments,
  fixtureClarity,
  fixtureCloudflare,
  runFixture,
} from "./portfolio-insights-fixture.mjs";
import { INSIGHT_EVENT_LIMIT, summarizeInsightEvents } from "./portfolio-insights-report.mjs";
import * as storage from "./portfolio-insights-storage.mjs";
import { capLog, defaultInsightsDirectory, LOG_LIMIT_BYTES } from "./portfolio-insights.mjs";

const NOW = "2026-09-11T11:10:00.000Z";
const EARLIER = "2026-09-10T07:10:00.000Z";

let root: string;
let directory: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "portfolio-insights-run-"));
  directory = join(root, "insights");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const mode = async (path: string) => (await stat(path)).mode & 0o777;
const text = (name: string) => readFile(join(directory, name), "utf8");
const json = async (name: string) => JSON.parse(await text(name));
const historyRows = async () =>
  (await text("history.jsonl"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
const refuse = async () => {
  throw new Error("this source must not be called");
};
const configurationError = async () => {
  throw new AirtableConfigurationError(["duplicate campaign code: alexcode01"]);
};
const eventReadFails = async () => {
  throw new Error("Analytics Engine returned 503");
};
/** One dashboard section, from its id to its closing tag. */
const sectionOf = (html: string, id: string) => {
  const start = html.indexOf(`id="${id}"`);
  return html.slice(start, html.indexOf("</section>", start));
};

function run(argv: string[] = [], overrides: Record<string, unknown> = {}) {
  return runFixture(argv, { directory, now: NOW, ...overrides });
}

describe("source failure behavior", () => {
  it("shows Clarity's last-known-good snapshot with its timestamp after a 429", async () => {
    const cached = fixtureClarity(99);
    await storage.writeSourceSnapshot(directory, "clarity", cached, EARLIER);

    const result = await run([], {
      fetchers: {
        clarity: async () => {
          throw new Error("Clarity returned 429: the project's 10 requests for today are spent.");
        },
      },
    });

    expect(result.snapshot.sources.clarity).toMatchObject({ status: "stale", capturedAt: EARLIER, value: cached });
    expect(result.snapshot.sources.clarity.error).toMatch(/429/u);
    expect(result.snapshot.sources.cloudflare.status).toBe("fresh");
    expect(await json("source-clarity.json")).toEqual({ capturedAt: EARLIER, value: cached });
    expect(await readFile(result.dashboardPath, "utf8")).toContain("Stale — last good data 2026-09-10 07:10 UTC");
    expect(result.output).toMatch(/Clarity\s+stale · last good 2026-09-10 07:10 UTC/u);
    expect(result.exitCode).toBe(0);
    // A stale value is not this run's measurement, so history records nothing for it.
    const [row] = await historyRows();
    expect(row.claritySessions).toBeNull();
    expect(row.cloudflareVisits).toBe(26);
  });

  it("keeps attributing from the cached Airtable copy while Airtable is down", async () => {
    await storage.writeSourceSnapshot(directory, "airtable", fixtureAssignments(), EARLIER);

    const result = await run([], {
      fetchers: {
        airtable: async () => {
          throw new AirtableRequestError("Airtable People request failed: HTTP 503", 503);
        },
      },
    });

    expect(result.snapshot.sources.airtable).toMatchObject({ status: "stale", capturedAt: EARLIER });
    expect(result.snapshot.intelligence.diagnostics.identityResolution).toBe("available");
    expect(await readFile(result.dashboardPath, "utf8")).toContain("Activity from Alex Rivera&#39;s assigned link");
  });

  it("refuses cached identity on an Airtable configuration error and renders everything unattributed", async () => {
    await storage.writeSourceSnapshot(directory, "airtable", fixtureAssignments(), EARLIER);

    const result = await run([], {
      fetchers: {
        airtable: async () => {
          throw new AirtableConfigurationError(["duplicate campaign code: alexcode01"]);
        },
      },
    });

    expect(result.snapshot.sources.airtable).toEqual({
      status: "unavailable",
      capturedAt: null,
      value: null,
      error: "duplicate campaign code: alexcode01",
    });
    const { intelligence } = result.snapshot;
    expect(intelligence.diagnostics.identityResolution).toBe("unavailable");
    expect(intelligence.diagnostics.assignedSessions).toBe(0);
    expect(intelligence.anonymousJourneys.length).toBe(intelligence.diagnostics.sessions);
    const html = await readFile(result.dashboardPath, "utf8");
    expect(html).not.toContain("Alex Rivera");
    expect(html).toContain("duplicate campaign code: alexcode01");
    // Anonymous analytics still render.
    expect(html).toContain(escapeHtml('Record <9Q> & "quotes"'));
    expect(result.output).toContain("duplicate campaign code: alexcode01");
    // The saved identity is replaced by the errors, so no later run can bring it back.
    expect(await json("source-airtable.json")).toEqual({
      capturedAt: NOW,
      value: null,
      configurationErrors: ["duplicate campaign code: alexcode01"],
    });
  });

  it("keeps identity off in a rebuild from disk after a configuration error", async () => {
    await storage.writeSourceSnapshot(directory, "airtable", fixtureAssignments(), EARLIER);
    await run([], { fetchers: { airtable: configurationError } });

    const result = await run(["--dashboard", "--no-cloudflare", "--no-clarity"], {
      now: "2026-09-11T12:00:00.000Z",
      fetchers: { clarity: refuse, cloudflare: refuse, insightAggregates: refuse, insightEvents: refuse, airtable: refuse },
    });

    expect(result.snapshot.sources.airtable).toMatchObject({ status: "unavailable", value: null });
    expect(result.snapshot.sources.airtable.error).toContain("duplicate campaign code: alexcode01");
    const html = await readFile(result.dashboardPath, "utf8");
    expect(html).not.toContain("Alex Rivera");
    expect(html).toContain("duplicate campaign code: alexcode01");
  });

  it("keeps identity off through an Airtable outage after a configuration error, until a clean read", async () => {
    await storage.writeSourceSnapshot(directory, "airtable", fixtureAssignments(), EARLIER);
    await run([], { now: EARLIER, fetchers: { airtable: configurationError } });

    const outage = await run([], {
      fetchers: {
        airtable: async () => {
          throw new AirtableRequestError("Airtable People request failed: HTTP 503", 503);
        },
      },
    });

    expect(outage.snapshot.sources.airtable).toMatchObject({ status: "unavailable", value: null });
    expect(outage.snapshot.sources.airtable.error).toContain("duplicate campaign code: alexcode01");
    expect(outage.snapshot.intelligence.diagnostics.identityResolution).toBe("unavailable");
    expect(await readFile(outage.dashboardPath, "utf8")).not.toContain("Alex Rivera");
    expect(outage.output).toContain("duplicate campaign code: alexcode01");
    expect((await json("source-airtable.json")).configurationErrors).toEqual(["duplicate campaign code: alexcode01"]);

    const fixed = await run([], { now: "2026-09-11T12:00:00.000Z" });
    expect(fixed.snapshot.sources.airtable.status).toBe("fresh");
    expect(await readFile(fixed.dashboardPath, "utf8")).toContain("Activity from Alex Rivera&#39;s assigned link");
  });

  it("names the missing Analytics Engine capability and still renders Clarity and Cloudflare", async () => {
    const down = async () => {
      throw new Error("Analytics Engine returned 422: dataset portfolio_insights not found");
    };

    const result = await run([], { fetchers: { insightAggregates: down, insightEvents: down } });

    const insights = result.snapshot.sources.insights;
    expect(insights.status).toBe("unavailable");
    expect(insights.error).toMatch(/Account Analytics Read/u);
    expect(insights.error).toMatch(/PORTFOLIO_INSIGHT_EVENTS_SINK/u);
    expect(insights.error).toMatch(/dataset portfolio_insights not found/u);
    expect(result.snapshot.intelligence).toBeNull();
    const html = await readFile(result.dashboardPath, "utf8");
    expect(html).toContain("www.linkedin.com");
    expect(html).toContain("GPTBot");
    expect(result.exitCode).toBe(0);
    const [row] = await historyRows();
    expect(row.insightEvents).toBeNull();
    expect(row.intelligence.journeys).toBe("unavailable");
    expect((await readdir(directory)).some((name) => name.startsWith("raw-events-"))).toBe(false);
  });

  it("keeps the aggregate counts when only the event-level read fails", async () => {
    const result = await run([], {
      fetchers: {
        insightEvents: async () => {
          throw new Error("Analytics Engine returned 500: query timed out");
        },
      },
    });

    expect(result.snapshot.insights.events).toBe(37);
    expect((await json("source-insights.json")).value.events).toBe(37);
    const [row] = await historyRows();
    expect(row.insightEvents).toBe(37);
    expect(row.intelligence.journeys).toBe("unavailable");
    expect(result.snapshot.sources.insights.error).toMatch(/query timed out/u);
  });

  it("shows the newest raw events as stale journeys when the event read fails", async () => {
    await runFixture([], { directory, now: EARLIER });

    const result = await run([], {
      fetchers: {
        insightEvents: async () => {
          throw new Error("Analytics Engine returned 503");
        },
      },
    });

    expect(result.snapshot.sources.insights).toMatchObject({ status: "stale", capturedAt: EARLIER });
    expect(result.snapshot.intelligence.diagnostics.sessions).toBeGreaterThan(0);
    const rows = await historyRows();
    expect(rows.map((row) => row.intelligence.journeys)).toEqual(["available", "unavailable"]);
  });

  it("shows stale journeys at their capture time but draws no findings from them", async () => {
    const captured = "2026-07-03T11:10:00.000Z";
    const first = await run([], { now: captured });
    expect(first.snapshot.intelligence.findings.map((finding: { kind: string }) => finding.kind)).toContain("assigned-link");

    // Seventy days later the event read fails and Clarity shows a real rise.
    const result = await run([], {
      fetchers: {
        insightEvents: eventReadFails,
        clarity: async () => ({ ...fixtureClarity(), frustration: [{ label: "Dead clicks", value: 140, sessionShare: 0.3 }] }),
      },
    });

    expect(result.snapshot.sources.insights).toMatchObject({ status: "stale", capturedAt: captured });
    const kinds = result.snapshot.intelligence.findings.map((finding: { kind: string }) => finding.kind);
    expect(kinds).toContain("frustration");
    for (const kind of kinds) expect(["frustration", "error", "performance"]).toContain(kind);
    const html = await readFile(result.dashboardPath, "utf8");
    expect(sectionOf(html, "journeys")).toContain("Stale — last good data 2026-07-03 11:10 UTC");
    expect(result.output).not.toMatch(/returned after|holds attention|evidence-open rate/u);
  });

  it("never shows or keeps journeys from a window that began more than 180 days ago", async () => {
    // Captured 175 days before NOW with a 7-day window: the window began about 181 days ago.
    const captured = "2026-03-20T11:10:00.000Z";
    await run([], {
      now: captured,
      events: [eventRow({ at: "2026-03-14 06:00:00", action: "entry", session: "tab-old" })],
    });
    expect(await readdir(directory)).toContain(storage.rawEventsFileName(captured));

    const result = await run([], { fetchers: { insightEvents: eventReadFails } });

    expect(result.snapshot.sources.insights.status).toBe("unavailable");
    expect(result.snapshot.intelligence).toBeNull();
    expect(await readdir(directory)).not.toContain(storage.rawEventsFileName(captured));
  });

  it("keeps the row-cap flag with the raw rows even when decoding dropped some", async () => {
    const rows = Array.from({ length: INSIGHT_EVENT_LIMIT }, (_, index) =>
      eventRow({ at: "2026-09-10 12:00:00", action: "entry", session: `tab-${index % 40}`, schema: index % 2 ? "v2" : "v9" }),
    );
    await run([], { now: EARLIER, events: rows });

    const result = await run([], { fetchers: { insightEvents: eventReadFails } });

    expect(result.snapshot.sources.insights.status).toBe("stale");
    expect(result.snapshot.sources.insights.value.raw).toEqual({ truncated: true, eventCount: INSIGHT_EVENT_LIMIT / 2 });
  });

  it("renders a valid empty window without fabricating a trend", async () => {
    const result = await run([], { events: [], fetchers: { insightAggregates: async () => summarizeInsightEvents({}) } });

    expect(result.snapshot.sources.insights.status).toBe("fresh");
    expect(result.snapshot.intelligence.findings).toEqual([]);
    const html = await readFile(result.dashboardPath, "utf8");
    expect(html).toContain("Nothing needs a decision in this window");
    expect(html).not.toMatch(/NaN|Infinity/u);
    expect(result.output).toContain("Nothing needs a decision in this window.");
    const [row] = await historyRows();
    expect(row.intelligence).toMatchObject({ journeys: "available", sessions: 0 });
    expect(result.exitCode).toBe(0);
  });

  it("warns when the event-level read reaches the 10,000-row cap", async () => {
    const rows = Array.from({ length: INSIGHT_EVENT_LIMIT }, (_, index) =>
      eventRow({ at: "2026-09-10 12:00:00", action: "entry", session: `tab-${index % 40}` }),
    );

    const result = await run([], { events: rows });

    expect(result.snapshot.sources.insights.value.raw).toEqual({ truncated: true, eventCount: INSIGHT_EVENT_LIMIT });
    expect(await readFile(result.dashboardPath, "utf8")).toContain("Event data is truncated");
    expect(result.output).toContain("10,000-row cap");
    const [raw] = (await readdir(directory)).filter((name) => name.startsWith("raw-events-"));
    expect((await json(raw)).events).toHaveLength(INSIGHT_EVENT_LIMIT);
  });

  it("exits non-zero only when no current or cached source can produce a dashboard", async () => {
    const nothing = {
      env: {},
      readKeychain: async () => {
        throw new Error("not in the Keychain");
      },
    };

    const empty = await run([], nothing);
    expect(empty.exitCode).toBe(1);
    expect(empty.snapshot.sources.clarity.error).toMatch(/no token/u);
    expect(empty.snapshot.sources.airtable.error).toMatch(/no token/u);

    await storage.writeSourceSnapshot(directory, "cloudflare", fixtureCloudflare(), EARLIER);
    const cached = await run([], nothing);
    expect(cached.exitCode).toBe(0);
    expect(cached.snapshot.sources.cloudflare.status).toBe("stale");
  });
});

describe("run options", () => {
  it("rebuilds the dashboard from disk without calling any source", async () => {
    await run();
    const history = await text("history.jsonl");

    const result = await run(["--dashboard", "--no-cloudflare", "--no-clarity"], {
      now: "2026-09-11T12:00:00.000Z",
      fetchers: { clarity: refuse, cloudflare: refuse, insightAggregates: refuse, insightEvents: refuse, airtable: refuse },
    });

    const { sources } = result.snapshot;
    expect([sources.clarity, sources.cloudflare, sources.insights, sources.airtable].map((state) => state.status)).toEqual([
      "stale",
      "stale",
      "stale",
      "stale",
    ]);
    expect(sources.clarity.error).toBeUndefined();
    expect(await text("history.jsonl")).toBe(history);
    expect(await readFile(result.dashboardPath, "utf8")).toContain("Activity from Alex Rivera&#39;s assigned link");
  });

  it("renders without identity under --no-airtable and ignores the cached copy", async () => {
    await storage.writeSourceSnapshot(directory, "airtable", fixtureAssignments(), EARLIER);

    const result = await run(["--no-airtable"], { fetchers: { airtable: refuse } });

    expect(result.snapshot.sources.airtable).toMatchObject({ status: "unavailable", value: null });
    expect(result.snapshot.intelligence.diagnostics.identityResolution).toBe("unavailable");
    expect(await readFile(result.dashboardPath, "utf8")).not.toContain("Alex Rivera");
  });

  it("writes nothing with --no-snapshot unless --dashboard asks for the page", async () => {
    await run(["--no-snapshot"]);
    await expect(readdir(directory)).rejects.toThrow(/ENOENT/u);

    const result = await run(["--no-snapshot", "--dashboard"]);
    expect(await readdir(directory)).toEqual(["dashboard.html"]);
    expect(result.dashboardPath).toBe(join(directory, "dashboard.html"));
  });

  // Owns: the whole run splits the two campaign-code paths the same way the
  // page and the terminal do. `straycode9` is carried by no Action and stays a
  // neutral note; `dupecode04` is claimed by two, so it stays an error. Retire
  // with the unmappedCampaigns diagnostic.
  it("separates an unmapped campaign code from a duplicate one, in the page and the terminal", async () => {
    const result = await buildFixtureDashboard(directory, { degraded: true });

    expect(result.snapshot.intelligence.diagnostics.unmappedCampaigns).toEqual([
      { code: "straycode9", sessions: 1, events: 1 },
    ]);
    expect(result.snapshot.intelligence.diagnostics.configurationErrors).toEqual(["duplicate campaign code: dupecode04"]);

    const html = await readFile(result.dashboardPath, "utf8");
    expect(html).toContain("1 tab session came from a link that is not in Airtable, kept anonymous: straycode9");
    expect(html).toContain("duplicate campaign code: dupecode04");
    expect(html).not.toContain("unmapped campaign code");

    expect(result.output).toContain("1 tab session came from a link that is not in Airtable, kept anonymous: straycode9");
    expect(result.output).toContain("Configuration error: affected links stay unattributed");
    expect(result.output).toContain("duplicate campaign code: dupecode04");
  });

  it("leads the terminal report with the dashboard's findings", async () => {
    const result = await buildFixtureDashboard(directory);

    const findings = result.snapshot.intelligence.findings;
    expect(findings.map((finding: { kind: string }) => finding.kind)).toEqual(
      expect.arrayContaining(["assigned-link", "content", "geography"]),
    );
    const html = await readFile(result.dashboardPath, "utf8");
    const report = result.output.indexOf("Portfolio insights ·");
    expect(report).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(html).toContain(escapeHtml(finding.message));
      const at = result.output.indexOf(finding.message);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeLessThan(report);
    }
  });
});

describe("local files", () => {
  it("writes sources, raw events, history, then the dashboard, and prunes last", async () => {
    const calls: string[] = [];
    const recorded = {
      ...storage,
      writeSourceSnapshot: async (...args: Parameters<typeof storage.writeSourceSnapshot>) => {
        calls.push(`source:${args[1]}`);
        return storage.writeSourceSnapshot(...args);
      },
      writeRawEvents: async (...args: Parameters<typeof storage.writeRawEvents>) => {
        calls.push("raw-events");
        return storage.writeRawEvents(...args);
      },
      appendHistoryRow: async (...args: Parameters<typeof storage.appendHistoryRow>) => {
        calls.push("file:history.jsonl");
        return storage.appendHistoryRow(...args);
      },
      writeDashboard: async (...args: Parameters<typeof storage.writeDashboard>) => {
        calls.push("file:dashboard.html");
        return storage.writeDashboard(...args);
      },
      pruneRawSnapshots: async (...args: Parameters<typeof storage.pruneRawSnapshots>) => {
        calls.push("prune");
        return storage.pruneRawSnapshots(...args);
      },
    };

    await run([], { storage: recorded });

    expect(calls).toEqual([
      "source:clarity",
      "source:cloudflare",
      "source:insights",
      "source:airtable",
      "raw-events",
      "file:history.jsonl",
      "file:dashboard.html",
      "prune",
    ]);
  });

  it("skips pruning when the dashboard write fails, and prunes on the next good run", async () => {
    const expired = storage.rawEventsFileName("2026-01-01T00:00:00.000Z");
    await storage.writeRawEvents(directory, [], "2026-01-01T00:00:00.000Z");
    const prune = vi.fn(storage.pruneRawSnapshots);
    const failing = {
      ...storage,
      pruneRawSnapshots: prune,
      writeDashboard: async () => {
        throw new Error("disk full");
      },
    };

    await expect(run([], { storage: failing })).rejects.toThrow(/disk full/u);
    expect(prune).not.toHaveBeenCalled();
    expect(await readdir(directory)).toContain(expired);

    await run();
    expect(await readdir(directory)).not.toContain(expired);
  });

  it("keeps the directory 0700 and every file 0600", async () => {
    await mkdir(directory, { recursive: true });
    await chmod(directory, 0o755);

    await run();

    expect(await mode(directory)).toBe(0o700);
    const names = (await readdir(directory)).sort();
    expect(names).toEqual([
      "dashboard.html",
      "history.jsonl",
      storage.rawEventsFileName(NOW),
      "source-airtable.json",
      "source-clarity.json",
      "source-cloudflare.json",
      "source-insights.json",
    ]);
    for (const name of names) expect(await mode(join(directory, name))).toBe(0o600);
  });

  it("keeps names, campaign codes, session IDs, and tokens out of history and aggregate snapshots", async () => {
    await buildFixtureDashboard(directory);

    const history = await text("history.jsonl");
    const aggregates = [await text("source-insights.json"), await text("source-clarity.json"), await text("source-cloudflare.json")];
    const identity = ["Alex Rivera", "Acme", "Staff Engineer", "recAlexAction", "recAlexPerson", "Sam &"];
    const codes = ["alexcode01", "samcode03", "nobodycode02", "straycode9"];
    const sessions = ["tab-alex-1", "tab-ny-1", "tab-prior-1", "tab-paris"];
    for (const value of [...identity, ...codes, ...sessions]) expect(history).not.toContain(value);
    for (const file of aggregates) {
      for (const value of [...identity, ...sessions]) expect(file).not.toContain(value);
    }
    // Event-level rows live only in the expiring raw files.
    const raw = (await readdir(directory)).filter((name) => name.startsWith("raw-events-"));
    expect(raw).toHaveLength(2);
    expect(await text(raw[1])).toContain("tab-alex-1");
    for (const name of await readdir(directory)) {
      const contents = await text(name);
      for (const token of Object.values(FIXTURE_TOKENS)) expect(contents).not.toContain(token);
    }
  });
});

describe("the local run", () => {
  it("keeps its records where every run shares one history and one prune", async () => {
    expect(defaultInsightsDirectory({ HOME: "/Users/example" })).toBe(
      "/Users/example/Library/Application Support/biv/portfolio-insights",
    );
    expect(defaultInsightsDirectory({ HOME: "/Users/example", PORTFOLIO_INSIGHTS_DIR: "/tmp/elsewhere/" })).toBe(
      "/tmp/elsewhere",
    );
  });

  it("starts the log over once it passes the cap, keeping it 0600", async () => {
    await mkdir(directory, { recursive: true });
    const log = join(directory, "portfolio-insights.log");
    expect(await capLog(log, 10)).toBe(false);

    await writeFile(log, "x".repeat(10));
    await chmod(log, 0o644);
    expect(await capLog(log, 10)).toBe(false);
    expect((await stat(log)).size).toBe(10);

    await writeFile(log, "Activity from Alex Rivera's assigned link\n");
    expect(await capLog(log, 10)).toBe(true);
    expect((await stat(log)).size).toBe(0);
    expect(await mode(log)).toBe(0o600);
    expect(LOG_LIMIT_BYTES).toBe(1_048_576);
  });

  it("runs every insights suite from test:insights without changing npm test", async () => {
    const { scripts } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    expect(scripts["test:insights"]).toBe(
      "vitest run scripts/portfolio-insights scripts/portfolio-chat-logs.test.ts scripts/setup-portfolio-insights.test.ts",
    );
    expect(scripts.test).toBe("vitest run && npm run test:media-studio && npm run test:clip-studio");
    expect(scripts["insights:dashboard"]).toBe("node scripts/portfolio-insights.mjs --dashboard --no-cloudflare --no-clarity");
    // BIV-527 retired the launchd job; the schedule now lives in the Worker's
    // `triggers.crons`, so an installer entry point coming back is a mistake.
    expect(scripts).not.toHaveProperty("schedule:insights");
  });
});

describe("Guide transcripts in a run", () => {
  const kept = {
    version: 1,
    capturedAt: "2026-09-11T09:00:00.000Z",
    requestId: "r1",
    sessionId: "tab-aaaaaa",
    mode: "portfolio",
    outcome: "answered",
    question: "What is Writ?",
    answer: "A product.",
    citedEvidenceIds: [],
  };

  it("reads the window through the port, records the count, and prunes after the dashboard", async () => {
    const calls: string[] = [];
    const chatTranscripts = {
      read: vi.fn(async () => {
        calls.push("read");
        return [kept];
      }),
      prune: vi.fn(async () => {
        calls.push(`prune:${(await readdir(directory)).includes("dashboard.html")}`);
      }),
    };
    const result = await runFixture([], { directory, now: NOW, chatTranscripts });
    expect(result.snapshot.sources.chat).toMatchObject({ status: "fresh", value: { turns: [kept] } });
    expect(chatTranscripts.read).toHaveBeenCalledWith(expect.objectContaining({ end: expect.any(String), start: expect.any(String) }));
    expect(calls).toEqual(["read", "prune:true"]);
    const rows = (await text("history.jsonl")).trim().split("\n").map((line) => JSON.parse(line));
    expect(rows.at(-1)).toMatchObject({ chatTurns: 1, sources: { chat: "fresh" } });
    // History keeps the count only, never what anyone asked.
    expect(await text("history.jsonl")).not.toContain("What is Writ?");
    expect(await text("dashboard.html")).toContain("What is Writ?");
  });

  it("marks transcripts unavailable when the read fails, and still prunes", async () => {
    const chatTranscripts = {
      read: async () => {
        throw new Error("R2 list failed");
      },
      prune: vi.fn(async () => {}),
    };
    const result = await runFixture([], { directory, now: NOW, chatTranscripts });
    expect(result.snapshot.sources.chat).toMatchObject({ status: "unavailable", error: "transcripts: R2 list failed" });
    expect(chatTranscripts.prune).toHaveBeenCalledOnce();
  });

  it("says a local run cannot read them rather than reporting an empty window", async () => {
    const result = await runFixture([], { directory, now: NOW });
    expect(result.snapshot.sources.chat.status).toBe("unavailable");
    expect(result.snapshot.sources.chat.error).toMatch(/insights dashboard/u);
  });
});
