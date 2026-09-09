import { describe, expect, it } from "vitest";

import {
  clarityFrustration,
  clarityTraffic,
  deriveTrafficShape,
  formatReport,
  historyRow,
  microsecondsToMilliseconds,
  parseArguments,
  rankDimension,
  summarizeClarity,
  summarizeDaily,
  summarizePerformance,
  windowForDays,
} from "./portfolio-insights-report.mjs";

describe("parseArguments", () => {
  it("defaults to a week of both sources", () => {
    expect(parseArguments([])).toEqual({
      days: 7,
      json: false,
      clarity: true,
      cloudflare: true,
      snapshot: true,
    });
  });

  it("reads the flags", () => {
    expect(parseArguments(["--days", "30", "--json", "--no-clarity"])).toMatchObject({
      days: 30,
      json: true,
      clarity: false,
    });
  });

  it("rejects a day count outside the range either source can answer", () => {
    expect(() => parseArguments(["--days", "0"])).toThrow(/1 to 30/u);
    expect(() => parseArguments(["--days", "90"])).toThrow(/1 to 30/u);
    expect(() => parseArguments(["--nope"])).toThrow(/Unknown argument/u);
  });
});

describe("windowForDays", () => {
  it("covers whole UTC days, inclusive of today", () => {
    const range = windowForDays(3, new Date("2026-09-09T18:30:00Z"));
    expect(range.start).toBe("2026-09-07T00:00:00.000Z");
    expect(range.end.slice(0, 19)).toBe("2026-09-09T23:59:59");
  });

  it("treats one day as today alone", () => {
    const range = windowForDays(1, new Date("2026-09-09T00:05:00Z"));
    expect(range.start.slice(0, 10)).toBe("2026-09-09");
  });
});

describe("summarizeDaily", () => {
  it("sorts by date and drops groups with no date", () => {
    const rows = summarizeDaily([
      { dimensions: { date: "2026-09-02" }, count: 10, sum: { visits: 2 } },
      { dimensions: {}, count: 99, sum: { visits: 99 } },
      { dimensions: { date: "2026-09-01" }, count: 5, sum: { visits: 1 } },
    ]);
    expect(rows).toEqual([
      { date: "2026-09-01", pageloads: 5, visits: 1 },
      { date: "2026-09-02", pageloads: 10, visits: 2 },
    ]);
  });
});

describe("rankDimension", () => {
  const groups = [
    { dimensions: { countryName: "US" }, count: 90, sum: { visits: 9 } },
    { dimensions: { countryName: "CA" }, count: 10, sum: { visits: 1 } },
  ];

  it("ranks by pageloads and computes share of the returned rows", () => {
    const rows = rankDimension(groups, "countryName");
    expect(rows[0]).toEqual({ value: "US", pageloads: 90, visits: 9, share: 0.9 });
    expect(rows[1].share).toBeCloseTo(0.1);
  });

  it("labels an empty dimension value rather than rendering a blank row", () => {
    const rows = rankDimension(
      [{ dimensions: { refererHost: "" }, count: 3, sum: { visits: 3 } }],
      "refererHost",
    );
    expect(rows[0].value).toBe("(none)");
  });

  it("does not divide by zero when nothing came back", () => {
    expect(rankDimension([], "countryName")).toEqual([]);
  });
});

describe("deriveTrafficShape", () => {
  const shape = deriveTrafficShape({
    daily: [
      { date: "2026-09-08", pageloads: 400, visits: 8 },
      { date: "2026-09-09", pageloads: 100, visits: 2 },
    ],
    referrers: [
      { value: "bradleyberkman.com", pageloads: 470, visits: 0, share: 0.94 },
      { value: "www.linkedin.com", pageloads: 20, visits: 7, share: 0.04 },
      { value: "(none)", pageloads: 10, visits: 3, share: 0.02 },
    ],
    navigation: [
      { value: "routing-apis", pageloads: 450, visits: 0, share: 0.9 },
      { value: "navigate", pageloads: 50, visits: 10, share: 0.1 },
    ],
    site: "bradleyberkman.com",
  });

  it("totals pageloads and visits across the window", () => {
    expect(shape.pageloads).toBe(500);
    expect(shape.visits).toBe(10);
    expect(shape.pageloadsPerVisit).toBe(50);
  });

  it("counts only genuinely external hosts as external", () => {
    expect(shape.externalReferrers.map((row) => row.value)).toEqual(["www.linkedin.com"]);
    expect(shape.externalVisits).toBe(7);
  });

  it("treats the site's own host and www as self-referred", () => {
    const withWww = deriveTrafficShape({
      daily: [],
      referrers: [{ value: "www.bradleyberkman.com", pageloads: 5, visits: 0, share: 1 }],
      navigation: [],
      site: "bradleyberkman.com",
    });
    expect(withWww.externalReferrers).toEqual([]);
  });

  it("separates in-app route changes from real entries", () => {
    expect(shape.softNavigationShare).toBeCloseTo(0.9);
    expect(shape.selfReferredShare).toBeCloseTo(0.94);
  });

  it("reports zero rather than Infinity when there were no visits", () => {
    const empty = deriveTrafficShape({ daily: [{ date: "x", pageloads: 5, visits: 0 }] });
    expect(empty.pageloadsPerVisit).toBe(0);
  });
});

describe("summarizePerformance", () => {
  it("converts Cloudflare's microseconds to milliseconds", () => {
    expect(microsecondsToMilliseconds(413_000)).toBe(413);
    expect(microsecondsToMilliseconds(undefined)).toBeNull();

    const summary = summarizePerformance({
      count: 275,
      quantiles: { firstContentfulPaintP50: 352_400, pageLoadTimeP95: 3_911_000 },
    });
    expect(summary.samples).toBe(275);
    expect(summary.firstContentfulPaint.p50).toBe(352);
    expect(summary.pageLoadTime.p95).toBe(3911);
    expect(summary.pageLoadTime.p50).toBeNull();
  });

  it("survives a dataset that returned nothing", () => {
    expect(summarizePerformance(undefined).samples).toBe(0);
  });
});

describe("summarizeClarity", () => {
  const payloads = [
    [
      {
        metricName: "Traffic",
        information: [
          { totalSessionCount: "40", totalBotSessionCount: "12", distantUserCount: "31" },
        ],
      },
    ],
    [
      {
        metricName: "Traffic",
        information: [
          { totalSessionCount: "25", totalBotSessionCount: "5", distantUserCount: "31", URL: "/" },
          { totalSessionCount: "15", totalBotSessionCount: "7", distantUserCount: "31", URL: "/privacy" },
        ],
      },
      { metricName: "RageClickCount", information: [{ sessionsCount: "3", URL: "/" }] },
    ],
  ];

  it("folds every payload into one metric map and coerces string counts", () => {
    const metrics = summarizeClarity(payloads);
    expect(metrics.Traffic).toHaveLength(3);
    expect(metrics.Traffic[0].totalSessionCount).toBe(40);
    expect(metrics.RageClickCount[0].sessionsCount).toBe(3);
  });

  it("ignores a payload that is not the documented array shape", () => {
    expect(summarizeClarity([{ error: "nope" }, null])).toEqual({});
  });

  it("subtracts bots from sessions and does not double-count users", () => {
    const traffic = clarityTraffic(summarizeClarity(payloads));
    expect(traffic.sessions).toBe(80);
    expect(traffic.botSessions).toBe(24);
    expect(traffic.humanSessions).toBe(56);
    // distantUserCount repeats per row, so the largest value is the project total.
    expect(traffic.users).toBe(31);
  });

  it("never reports negative human sessions", () => {
    const traffic = clarityTraffic({
      Traffic: [{ totalSessionCount: 2, totalBotSessionCount: 9 }],
    });
    expect(traffic.humanSessions).toBe(0);
  });

  it("totals only the frustration metrics that came back", () => {
    expect(clarityFrustration(summarizeClarity(payloads))).toEqual([
      { label: "Rage clicks", value: 3 },
    ]);
  });
});

describe("historyRow", () => {
  it("flattens a snapshot into one appendable row", () => {
    expect(
      historyRow({
        capturedAt: "2026-09-09T21:00:00.000Z",
        window: { start: "2026-09-03T00:00:00.000Z", end: "2026-09-09T23:59:59.000Z" },
        cloudflare: { shape: { pageloads: 4504, visits: 121, externalVisits: 17 } },
        clarity: { traffic: { sessions: 80, humanSessions: 56, botSessions: 24 } },
      }),
    ).toEqual({
      capturedAt: "2026-09-09T21:00:00.000Z",
      windowStart: "2026-09-03T00:00:00.000Z",
      windowEnd: "2026-09-09T23:59:59.000Z",
      cloudflarePageloads: 4504,
      cloudflareVisits: 121,
      cloudflareExternalVisits: 17,
      claritySessions: 80,
      clarityHumanSessions: 56,
      clarityBotSessions: 24,
    });
  });

  it("nulls the half that failed instead of inventing zeros", () => {
    const row = historyRow({
      capturedAt: "2026-09-09T21:00:00.000Z",
      window: { start: "a", end: "b" },
      cloudflare: { error: "no token" },
      clarity: { error: "429" },
    });
    expect(row.cloudflareVisits).toBeNull();
    expect(row.claritySessions).toBeNull();
  });
});

describe("formatReport", () => {
  const base = {
    capturedAt: "2026-09-09T21:00:00.000Z",
    window: { start: "2026-09-03T00:00:00.000Z", end: "2026-09-09T23:59:59.000Z" },
  };

  it("says plainly when nothing has linked in", () => {
    const report = formatReport({
      ...base,
      cloudflare: {
        shape: {
          pageloads: 100,
          visits: 4,
          pageloadsPerVisit: 25,
          softNavigationShare: 0.9,
          selfReferredShare: 0.95,
          externalReferrers: [],
          externalVisits: 0,
        },
        dimensions: {},
        performance: { samples: 0 },
        edge: { error: "no permission" },
      },
    });
    expect(report).toContain("nothing has linked in yet");
    expect(report).toContain("Zone Analytics Read");
  });

  it("surfaces a failed source instead of rendering it as zero", () => {
    const report = formatReport({ ...base, clarity: { error: "429 today" } });
    expect(report).toContain("Clarity: 429 today");
  });

  it("points custom events at the dashboard, which is the only place they exist", () => {
    const report = formatReport({
      ...base,
      clarity: {
        days: 3,
        traffic: { sessions: 10, humanSessions: 7, botSessions: 3 },
        frustration: [{ label: "Rage clicks", value: 2 }],
      },
    });
    expect(report).toContain("human sessions  7");
    expect(report).toContain("Rage clicks");
    expect(report).toContain("Clarity dashboard");
  });
});
