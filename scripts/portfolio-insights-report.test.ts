import { describe, expect, it } from "vitest";

import {
  clarityBreakdowns,
  deriveBelievable,
  formatDailyTrend,
  formatHistory,
  summarizePerformanceByDevice,
  classifyUserAgent,
  formatEdgeDetail,
  formatInsightEvents,
  isProbePath,
  summarizeInsightEvents,
  mergeDayGroups,
  normalizeClarityUrl,
  summarizeEdgeDetail,
  clarityFrustration,
  clarityTraffic,
  deriveTrafficShape,
  formatReport,
  historyRow,
  INSIGHT_EVENT_LIMIT,
  insightEventQuery,
  insightWindowClause,
  microsecondsToMilliseconds,
  normalizeInsightEvents,
  parseArguments,
  readInsightEventRows,
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
      insights: true,
      airtable: true,
      snapshot: true,
      history: false,
      dashboard: false,
    });
  });

  it("skips Airtable identity with --no-airtable", () => {
    expect(parseArguments(["--no-airtable"])).toMatchObject({ airtable: false, insights: true });
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
  // The export returns, per metric, one project-wide row and then one row per
  // dimension value. Four requests therefore repeat the project total four times.
  const payloads = [
    [
      {
        metricName: "Traffic",
        information: [
          { totalSessionCount: "454", totalBotSessionCount: "13", distinctUserCount: "479" },
        ],
      },
      {
        metricName: "RageClickCount",
        information: [{ sessionsCount: "454", sessionsWithMetricPercentage: "0.66", subTotal: "4" }],
      },
      { metricName: "EngagementTime", information: [{ totalTime: "107", activeTime: "52" }] },
      { metricName: "ScrollDepth", information: [{ averageScrollDepth: "99.31" }] },
    ],
    [
      {
        metricName: "Traffic",
        information: [
          { totalSessionCount: "454", totalBotSessionCount: "13", distinctUserCount: "479" },
          { totalSessionCount: "125", totalBotSessionCount: "5", Url: "https://bradleyberkman.com/" },
          {
            totalSessionCount: "3",
            totalBotSessionCount: "0",
            Url: "https://bradleyberkman.com/?fbclid=abc&view=graph#real-estate",
          },
          {
            totalSessionCount: "16",
            totalBotSessionCount: "0",
            Url: "https://bradleyberkman.com/?view=graph#real-estate",
          },
        ],
      },
      {
        metricName: "RageClickCount",
        information: [
          { sessionsCount: "454", sessionsWithMetricPercentage: "0.66", subTotal: "4" },
          { sessionsCount: "125", subTotal: "4", Url: "https://bradleyberkman.com/" },
        ],
      },
    ],
    [
      {
        metricName: "Traffic",
        information: [
          { totalSessionCount: "454", totalBotSessionCount: "13", distinctUserCount: "479" },
          { totalSessionCount: "130", totalBotSessionCount: "2", Source: "www.linkedin.com", Channel: "Social" },
          { totalSessionCount: "177", totalBotSessionCount: "7", Source: "", Channel: "Other" },
        ],
      },
    ],
    [
      {
        metricName: "Traffic",
        information: [
          { totalSessionCount: "454", totalBotSessionCount: "13", distinctUserCount: "479" },
          { totalSessionCount: "253", totalBotSessionCount: "4", Device: "Mobile" },
          { totalSessionCount: "0", totalBotSessionCount: "0", Device: "Email" },
        ],
      },
    ],
  ];

  it("folds every payload into one metric map and coerces string counts", () => {
    const metrics = summarizeClarity(payloads);
    expect(metrics.Traffic).toHaveLength(11);
    expect(metrics.Traffic[0].totalSessionCount).toBe(454);
    expect(metrics.RageClickCount[0].subTotal).toBe(4);
  });

  it("ignores a payload that is not the documented array shape", () => {
    expect(summarizeClarity([{ error: "nope" }, null])).toEqual({});
  });

  it("reads the project total once, not once per requested dimension", () => {
    const traffic = clarityTraffic(summarizeClarity(payloads));
    expect(traffic.sessions).toBe(454);
    expect(traffic.botSessions).toBe(13);
    expect(traffic.humanSessions).toBe(441);
    expect(traffic.users).toBe(479);
  });

  it("never reports negative human sessions", () => {
    const traffic = clarityTraffic({
      Traffic: [{ totalSessionCount: 2, totalBotSessionCount: 9 }],
    });
    expect(traffic.humanSessions).toBe(0);
  });

  it("counts a frustration metric by its own occurrences, not by total sessions", () => {
    expect(clarityFrustration(summarizeClarity(payloads))).toEqual([
      { label: "Rage clicks", value: 4, sessionShare: 0.0066 },
    ]);
  });

  it("breaks sessions down by source, page, and device from the dimension rows", () => {
    const breakdowns = clarityBreakdowns(summarizeClarity(payloads));
    expect(breakdowns.sources).toEqual([
      { value: "(no referrer)  ·  Other", sessions: 177 },
      { value: "www.linkedin.com  ·  Social", sessions: 130 },
    ]);
    // The two real-estate URLs differ only by a click id, so they are one page.
    expect(breakdowns.pages).toEqual([
      { value: "/", sessions: 125 },
      { value: "/?view=graph#real-estate", sessions: 19 },
    ]);
    expect(breakdowns.devices).toEqual([{ value: "Mobile", sessions: 253 }]);
    expect(breakdowns.engagement).toEqual({ totalSeconds: 107, activeSeconds: 52 });
    expect(breakdowns.averageScrollDepth).toBe(99.31);
  });
});

describe("normalizeClarityUrl", () => {
  it("drops tracking parameters and keeps the ones that name a view", () => {
    expect(
      normalizeClarityUrl(
        "https://bradleyberkman.com/index/touring?utm_source=ig&utm_medium=social&fbclid=x&view=graph",
      ),
    ).toBe("/index/touring?view=graph");
    expect(normalizeClarityUrl("https://bradleyberkman.com/?trk=feed-detail_main-feed")).toBe("/");
  });

  it("returns a non-URL value unchanged so nothing is silently dropped", () => {
    expect(normalizeClarityUrl("not a url")).toBe("not a url");
    expect(normalizeClarityUrl(null)).toBe("(none)");
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
      believableVisits: null,
      believableSessions: null,
      edgeRequests: null,
      edgeCrawlerRequests: null,
      edgeProbeRequests: null,
      edgeServerErrors: null,
      claritySessions: 80,
      clarityHumanSessions: 56,
      clarityBotSessions: 24,
      insightEvents: null,
      insightEntries: null,
      insightContactActions: null,
      insightAttentionSnapshots: null,
      insightCampaignEntries: null,
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
        frustration: [{ label: "Rage clicks", value: 2, sessionShare: 0.01 }],
      },
    });
    expect(report).toContain("human sessions  7");
    expect(report).toContain("Rage clicks");
    expect(report).toContain("Clarity dashboard");
  });
});

describe("classifyUserAgent", () => {
  it("names the AI and search crawlers that matter to a job search", () => {
    expect(
      classifyUserAgent(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.4; +https://openai.com/gptbot)",
      ),
    ).toEqual({ kind: "crawler", label: "GPTBot (OpenAI)" });
    expect(
      classifyUserAgent("Claude-User (claude-code/2.1.257; +https://support.anthropic.com/)"),
    ).toEqual({ kind: "crawler", label: "Claude-User (Anthropic)" });
    expect(
      classifyUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)").label,
    ).toBe("Googlebot");
  });

  it("falls back to the generic bot token for crawlers it has no label for", () => {
    expect(classifyUserAgent("PipericBot/1.0 (+https://piperic.com/bot)")).toEqual({
      kind: "crawler",
      label: "PipericBot",
    });
  });

  it("treats headless browsers, HTTP libraries, and URL-shaped agents as automation", () => {
    expect(
      classifyUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0 Safari/537.36",
      ),
    ).toEqual({ kind: "automation", label: "Headless Chrome" });
    expect(classifyUserAgent("Go-http-client/1.1")).toEqual({
      kind: "automation",
      label: "Go-http-client",
    });
    expect(classifyUserAgent("http://bradleyberkman.com/wp-admin/install.php?step=1")).toEqual({
      kind: "automation",
      label: "URL-shaped user agent",
    });
    expect(classifyUserAgent("")).toEqual({ kind: "automation", label: "empty user agent" });
  });

  it("leaves a real browser alone, including the LinkedIn in-app one", () => {
    expect(
      classifyUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]",
      ).kind,
    ).toBe("browser");
  });
});

describe("isProbePath", () => {
  it("recognises WordPress and PHP probes and double-slash prefixes", () => {
    for (const path of [
      "/wp-admin/install.php",
      "//blog/wp-includes/wlwmanifest.xml",
      "/wp/wp-json/Batch/v1",
      "/.env",
      "/phpmyadmin/index.php",
    ]) {
      expect(isProbePath(path), path).toBe(true);
    }
  });

  it("leaves the portfolio's own routes alone", () => {
    for (const path of [
      "/",
      "/index/real-estate",
      "/privacy",
      "/_portfolio-preview/login",
      "/api/portfolio-chat/session",
      "/.well-known/security.txt",
      "/glyph-textures/map.svg",
    ]) {
      expect(isProbePath(path), path).toBe(false);
    }
  });
});

describe("mergeDayGroups", () => {
  it("sums the same value across day-sized queries and survives a missing day", () => {
    const merged = mergeDayGroups(
      [
        [{ count: 3, dimensions: { userAgent: "a" } }, { count: 1, dimensions: { userAgent: "b" } }],
        undefined,
        [{ count: "4", dimensions: { userAgent: "a" } }],
      ],
      "userAgent",
    );
    expect([...merged.entries()]).toEqual([
      ["a", 7],
      ["b", 1],
    ]);
  });
});

describe("summarizeEdgeDetail", () => {
  const detail = summarizeEdgeDetail({
    userAgents: new Map([
      ["Mozilla/5.0 (Macintosh) Safari/605.1.15", 600],
      ["Mozilla/5.0 (compatible; GPTBot/1.4; +https://openai.com/gptbot)", 160],
      ["Mozilla/5.0 (compatible; Googlebot/2.1)", 25],
      ["http://bradleyberkman.com/wp-admin/install.php?step=1", 100],
      ["Go-http-client/1.1", 40],
    ]),
    paths: new Map([
      ["/", 500],
      ["/wp-admin/install.php", 90],
      ["//wp/wp-includes/wlwmanifest.xml", 10],
    ]),
    statuses: new Map([
      ["200", 700],
      ["303", 100],
      ["404", 100],
      ["500", 7],
    ]),
    serverErrorPaths: new Map([["/api/portfolio-chat/session", 7]]),
  });

  it("splits requests into browsers, crawlers, and automation", () => {
    expect(detail.browserRequests).toBe(600);
    expect(detail.crawlerRequests).toBe(185);
    expect(detail.automationRequests).toBe(140);
    expect(detail.classified).toBe(925);
    expect(detail.crawlers[0]).toEqual({ value: "GPTBot (OpenAI)", requests: 160 });
  });

  it("counts probes by path, not by user agent", () => {
    expect(detail.probeRequests).toBe(100);
    expect(detail.probePaths.map((row) => row.value)).toEqual([
      "/wp-admin/install.php",
      "//wp/wp-includes/wlwmanifest.xml",
    ]);
  });

  it("buckets status codes and keeps the server error paths", () => {
    expect(detail.statusClasses).toEqual({ "2xx": 700, "3xx": 100, "4xx": 100, "5xx": 7 });
    expect(detail.serverErrors).toBe(7);
    expect(detail.serverErrorPaths).toEqual([
      { value: "/api/portfolio-chat/session", requests: 7 },
    ]);
  });

  it("renders the section and points 5xx at the Workers Logs", () => {
    const text = formatEdgeDetail(detail).join("\n");
    expect(text).toContain("GPTBot (OpenAI)");
    expect(text).toContain("vulnerability probes  100 requests");
    expect(text).toContain("5xx      7");
    expect(text).toContain("/api/portfolio-chat/session");
    expect(text).toContain("Workers Logs");
    expect(text).toContain("not that any answer cited it");
  });

  it("says when the detail query failed instead of rendering zeros", () => {
    expect(formatEdgeDetail({ error: "1d only" }).join("\n")).toContain(
      "Crawlers and scanners: unavailable.",
    );
    expect(formatEdgeDetail(undefined)).toEqual([]);
  });
});

describe("historyRow edge columns", () => {
  it("carries the edge totals and nulls them when the detail failed", () => {
    const edge = {
      daily: [{ requests: 10, cachedRequests: 1, threats: 0, uniques: 2 }],
      detail: { crawlerRequests: 3, probeRequests: 1, serverErrors: 0 },
    };
    const row = historyRow({ capturedAt: "x", window: {}, cloudflare: { shape: {}, edge } });
    expect(row).toMatchObject({
      edgeRequests: 10,
      edgeCrawlerRequests: 3,
      edgeProbeRequests: 1,
      edgeServerErrors: 0,
    });
    const failed = historyRow({
      capturedAt: "x",
      window: {},
      cloudflare: { shape: {}, edge: { ...edge, detail: { error: "no" } } },
    });
    expect(failed.edgeCrawlerRequests).toBeNull();
    expect(failed.edgeRequests).toBe(10);
  });
});

describe("deriveBelievable", () => {
  const dimensions = {
    requestPath: [
      { value: "/", pageloads: 3000, visits: 52, share: 0.9 },
      { value: "/_portfolio-preview/login", pageloads: 45, visits: 33, share: 0.01 },
    ],
    refererHost: [
      { value: "www.linkedin.com", pageloads: 15, visits: 15, share: 0.1 },
      { value: "127.0.0.1", pageloads: 4, visits: 4, share: 0.01 },
      { value: "localhost:3000", pageloads: 1, visits: 1, share: 0.01 },
    ],
    userAgentBrowser: [
      { value: "Chrome", pageloads: 210, visits: 33, share: 0.1 },
      { value: "ChromeHeadless", pageloads: 25, visits: 14, share: 0.01 },
    ],
  };
  const clarity = {
    traffic: { sessions: 454, humanSessions: 441, botSessions: 13 },
    breakdowns: {
      sources: [
        { value: "www.linkedin.com  ·  Referral", sessions: 130 },
        { value: "127.0.0.1  ·  Referral", sessions: 4 },
      ],
    },
  };

  it("removes the preview login, localhost, and headless visits from Cloudflare", () => {
    const believable = deriveBelievable({ shape: { visits: 89 }, dimensions, clarity });
    expect(believable.cloudflareExcluded).toBe(33 + 4 + 1 + 14);
    expect(believable.cloudflareVisits).toBe(89 - 52);
  });

  it("removes only localhost from Clarity, which already excludes enrolled browsers", () => {
    const believable = deriveBelievable({ shape: { visits: 89 }, dimensions, clarity });
    expect(believable.clarityExcluded).toBe(4);
    expect(believable.claritySessions).toBe(437);
  });

  it("nulls a side that did not run instead of reporting zero", () => {
    expect(deriveBelievable({ shape: undefined, dimensions: {}, clarity: null })).toEqual({
      cloudflareVisits: null,
      cloudflareExcluded: 0,
      claritySessions: null,
      clarityExcluded: 0,
    });
  });
});

describe("summarizeInsightEvents", () => {
  it("shapes the four Analytics Engine answers and coerces the counts", () => {
    const summary = summarizeInsightEvents({
      actions: [
        { action: "content_attention", events: "40" },
        { action: "content_open", events: 12 },
        { action: "entry", events: "9" },
        { action: "contact_action", events: 2 },
      ],
      contacts: [{ kind: "email", events: "2" }],
      attention: [
        {
          content_id: "record-9q",
          content_kind: "record",
          snapshots: "30",
          active_seconds_p50: "47.5",
          active_seconds_max: 180,
          completion_p50: 63,
          completion_max: "100",
        },
      ],
      campaigns: [{ campaign: "a1b2c3d4e5f6", events: "20", entries: "3" }],
    });

    expect(summary).toEqual({
      events: 63,
      actions: [
        { action: "content_attention", events: 40 },
        { action: "content_open", events: 12 },
        { action: "entry", events: 9 },
        { action: "contact_action", events: 2 },
      ],
      entries: 9,
      contactActions: 2,
      contacts: [{ kind: "email", events: 2 }],
      attentionSnapshots: 30,
      attention: [
        {
          contentId: "record-9q",
          contentKind: "record",
          snapshots: 30,
          activeSecondsP50: 48,
          activeSecondsMax: 180,
          completionP50: 63,
          completionMax: 100,
        },
      ],
      campaigns: [{ campaign: "a1b2c3d4e5f6", events: 20, entries: 3 }],
    });
  });

  it("reads an empty dataset as zero events, not as a failure", () => {
    expect(summarizeInsightEvents({})).toMatchObject({
      events: 0,
      actions: [],
      contacts: [],
      attention: [],
      campaigns: [],
    });
  });
});

describe("summarizePerformanceByDevice", () => {
  it("keeps one row per device, largest sample first, in milliseconds", () => {
    const rows = summarizePerformanceByDevice([
      { count: 20, dimensions: { deviceType: "desktop" }, quantiles: { pageLoadTimeP75: 900_000 } },
      { count: 80, dimensions: { deviceType: "mobile" }, quantiles: { pageLoadTimeP75: 2_100_000 } },
      { count: 5, dimensions: {}, quantiles: {} },
    ]);
    expect(rows.map((row) => row.device)).toEqual(["mobile", "desktop"]);
    expect(rows[0].pageLoadTime.p75).toBe(2100);
  });
});

describe("formatDailyTrend", () => {
  it("lines up loads, visits, and edge requests by date and marks a missing edge day", () => {
    const lines = formatDailyTrend(
      [
        { date: "2026-09-09", pageloads: 1800, visits: 40 },
        { date: "2026-09-10", pageloads: 600, visits: 12 },
      ],
      [{ date: "2026-09-09", requests: 11052 }],
    );
    expect(lines[1]).toContain("2026-09-09");
    expect(lines[1]).toContain("11052");
    expect(lines[2]).toContain("     -");
  });

  it("renders nothing when there is no daily data", () => {
    expect(formatDailyTrend([], [])).toEqual([]);
  });
});

describe("formatHistory", () => {
  it("prints one row per run, oldest first, with dashes for missing columns", () => {
    const text = formatHistory([
      {
        capturedAt: "2026-09-11T16:00:00.000Z",
        windowStart: "2026-09-05T00:00:00.000Z",
        windowEnd: "2026-09-11T23:59:59.000Z",
        cloudflareVisits: 89,
        believableVisits: 37,
        clarityHumanSessions: 441,
        edgeRequests: 24524,
      },
      { capturedAt: "2026-09-10T16:00:00.000Z", cloudflareVisits: 70 },
    ]).join("\n");
    const rows = text.split("\n").filter((line) => line.startsWith("  2026-"));
    expect(rows[0]).toContain("2026-09-10");
    expect(rows[1]).toContain("7d");
    expect(rows[1]).toContain("24524");
    expect(rows[0]).toContain("-");
  });

  it("says so when there is no history", () => {
    expect(formatHistory([]).join("\n")).toContain("No history yet");
  });
});

describe("formatInsightEvents", () => {
  it("degrades to one note when the query failed, and to another when the sink is silent", () => {
    expect(formatInsightEvents(undefined)).toEqual([]);
    const failed = formatInsightEvents({ error: "Authentication error (10000)" }).join("\n");
    expect(failed).toContain("Portfolio signals (first-party): unavailable.");
    expect(failed).toContain("Authentication error (10000)");
    expect(failed).toContain("Account Analytics Read");

    const silent = formatInsightEvents(summarizeInsightEvents({})).join("\n");
    expect(silent).toContain("Portfolio signals (first-party): no events in this window.");
    expect(silent).toContain("PORTFOLIO_INSIGHT_EVENTS_SINK");
  });

  it("renders the signals Clarity's export cannot", () => {
    const lines = formatInsightEvents(
      summarizeInsightEvents({
        actions: [
          { action: "content_attention", events: 40 },
          { action: "contact_action", events: 2 },
          { action: "entry", events: 9 },
        ],
        contacts: [{ kind: "email", events: 2 }],
        attention: [
          {
            content_id: "record-9q",
            content_kind: "record",
            snapshots: 30,
            active_seconds_p50: 47,
            active_seconds_max: 180,
            completion_p50: 63,
            completion_max: 100,
          },
        ],
        campaigns: [{ campaign: "a1b2c3d4e5f6", events: 20, entries: 3 }],
      }),
    ).join("\n");

    expect(lines).toContain("Portfolio signals (first-party)");
    expect(lines).toContain("events   51");
    expect(lines).toContain("content_attention");
    expect(lines).toMatch(/email\s+2/u);
    expect(lines).toMatch(/record-9q\s+record\s+30 snapshots\s+p50\s+47s\s+max\s+180s\s+read\s+63%\s+max\s+100%/u);
    expect(lines).toMatch(/a1b2c3d4e5f6\s+3 entries\s+20 events/u);
    expect(lines).toContain("running totals");
  });
});

describe("formatReport with first-party signals", () => {
  const base = {
    capturedAt: "2026-09-09T21:00:00.000Z",
    window: { start: "2026-09-03T00:00:00.000Z", end: "2026-09-09T23:59:59.000Z" },
  };

  it("adds the first-party section after the other sources", () => {
    const report = formatReport({
      ...base,
      clarity: { error: "429 today" },
      insights: summarizeInsightEvents({
        actions: [{ action: "entry", events: 4 }],
      }),
    });
    expect(report.indexOf("Clarity: 429 today")).toBeLessThan(
      report.indexOf("Portfolio signals (first-party)"),
    );
    expect(report).toContain("events   4");
  });

  it("shows the failure note in place of the section", () => {
    const report = formatReport({ ...base, insights: { error: "no permission" } });
    expect(report).toContain("Portfolio signals (first-party): unavailable.");
  });
});

describe("historyRow first-party columns", () => {
  it("carries the totals and nulls them when the query failed", () => {
    const row = historyRow({
      capturedAt: "x",
      window: {},
      insights: summarizeInsightEvents({
        actions: [
          { action: "content_attention", events: 40 },
          { action: "contact_action", events: 2 },
          { action: "entry", events: 9 },
        ],
        contacts: [{ kind: "email", events: 2 }],
        attention: [{ content_id: "record-9q", content_kind: "record", snapshots: 40 }],
        campaigns: [
          { campaign: "a1b2c3d4e5f6", events: 20, entries: 3 },
          { campaign: "f6e5d4c3b2a1", events: 1, entries: 1 },
        ],
      }),
    });
    expect(row).toMatchObject({
      insightEvents: 51,
      insightEntries: 9,
      insightContactActions: 2,
      insightAttentionSnapshots: 40,
      insightCampaignEntries: 4,
    });

    const failed = historyRow({ capturedAt: "x", window: {}, insights: { error: "no" } });
    expect(failed.insightEvents).toBeNull();
    expect(failed.insightCampaignEntries).toBeNull();
    expect(historyRow({ capturedAt: "x", window: {} }).insightEvents).toBeNull();
  });
});

// Owns fixed-column decoding, chronological order, v1 compatibility, and the
// truncation signal for the event-level Analytics Engine read, until the
// Analytics Engine sink is removed.
describe("event-level insight rows", () => {
  const range = { start: "2026-09-05T00:00:00.000Z", end: "2026-09-11T23:59:59.000Z" };

  it("selects every fixed column in chronological order, capped, inside the escaped window", () => {
    const query = insightEventQuery(range);
    const window = insightWindowClause(range);
    expect(window).toBe(
      "timestamp >= toDateTime('2026-09-05 00:00:00') AND timestamp <= toDateTime('2026-09-11 23:59:59')",
    );
    expect(query).toContain(`WHERE ${window}`);
    expect(query).toMatch(/FROM portfolio_insights\b/u);
    const columns = [
      "blob1 AS action",
      "blob2 AS content_id",
      "blob3 AS content_kind",
      "blob4 AS campaign",
      "blob5 AS contact_kind",
      "blob6 AS source",
      "blob7 AS target_id",
      "blob8 AS target_kind",
      "blob9 AS country",
      "blob10 AS device",
      "blob11 AS schema",
      "blob12 AS session_id",
      "blob13 AS region_code",
      "blob14 AS city",
      "blob15 AS metro_code",
      "double1 AS active_seconds",
      "double2 AS completion_percent",
    ];
    for (const column of columns) expect(query).toContain(column);
    expect(query).toMatch(/SELECT\s+timestamp,/u);
    expect(query).toMatch(/ORDER BY timestamp ASC\s+LIMIT 10000\s+FORMAT JSON/u);
    expect(INSIGHT_EVENT_LIMIT).toBe(10_000);
  });

  it("escapes a quote that reaches the window", () => {
    expect(insightWindowClause({ start: "2026-09-0'T00:00:00.000Z", end: range.end })).toContain(
      "toDateTime('2026-09-0'' 00:00:00')",
    );
  });

  it("decodes a v2 row into its journey and city fields", () => {
    expect(
      normalizeInsightEvents([
        {
          timestamp: "2026-09-11 14:30:00.000",
          action: "content_open",
          content_id: "record-9q",
          schema: "v2",
          session_id: "session-a",
          region_code: "NY",
          city: "New York",
          metro_code: "501",
          active_seconds: 0,
          completion_percent: 0,
        },
      ])[0],
    ).toMatchObject({
      sessionId: "session-a",
      regionCode: "NY",
      city: "New York",
      metroCode: "501",
    });

    expect(
      normalizeInsightEvents([
        {
          timestamp: "2026-09-11 14:31:05",
          action: "contact_action",
          content_id: "",
          content_kind: "",
          campaign: "a1b2c3d4e5f6",
          contact_kind: "email",
          source: "guide",
          target_id: "evidence-2",
          target_kind: "document",
          country: "DE",
          device: "mobile",
          schema: "v2",
          session_id: "session-a",
          region_code: "BE",
          city: "Berlin",
          metro_code: "27612",
          active_seconds: "12.5",
          completion_percent: "40",
        },
      ]),
    ).toEqual([
      {
        timestamp: "2026-09-11T14:31:05.000Z",
        action: "contact_action",
        contentId: "",
        contentKind: "",
        campaign: "a1b2c3d4e5f6",
        contactKind: "email",
        source: "guide",
        targetId: "evidence-2",
        targetKind: "document",
        country: "DE",
        device: "mobile",
        schema: "v2",
        sessionId: "session-a",
        regionCode: "BE",
        city: "Berlin",
        metroCode: "27612",
        activeSeconds: 12.5,
        completionPercent: 40,
      },
    ]);
  });

  it("keeps v1 rows with empty journey and city fields, even if later blobs hold stray values", () => {
    const [plain, stray] = normalizeInsightEvents([
      {
        timestamp: "2026-09-10 08:00:00",
        action: "entry",
        country: "US",
        device: "desktop",
        schema: "v1",
        session_id: "",
        region_code: "",
        city: "",
        metro_code: "",
      },
      {
        timestamp: "2026-09-10 08:00:01",
        action: "entry",
        schema: "v1",
        session_id: "not-a-v1-column",
        region_code: "CA",
        city: "Irvine",
        metro_code: "803",
      },
    ]);
    expect(plain).toMatchObject({
      schema: "v1",
      country: "US",
      device: "desktop",
      sessionId: "",
      regionCode: "",
      city: "",
      metroCode: "",
    });
    expect(stray).toMatchObject({ sessionId: "", regionCode: "", city: "", metroCode: "" });
  });

  it("drops rows with invalid timestamps, unknown schemas, or no action", () => {
    const valid = { action: "entry", schema: "v2", timestamp: "2026-09-10 08:00:00" };
    const events = normalizeInsightEvents([
      valid,
      { ...valid, timestamp: "" },
      { ...valid, timestamp: null },
      { ...valid, timestamp: "yesterday" },
      { ...valid, timestamp: "2026-13-40 25:61:00" },
      { ...valid, schema: "v3" },
      { ...valid, schema: "" },
      { ...valid, action: "" },
      null,
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].timestamp).toBe("2026-09-10T08:00:00.000Z");
  });

  it("clamps active seconds at zero and completion to 0 through 100", () => {
    const row = (active_seconds: unknown, completion_percent: unknown) => ({
      timestamp: "2026-09-10 08:00:00",
      action: "content_attention",
      schema: "v2",
      active_seconds,
      completion_percent,
    });
    const values = normalizeInsightEvents([
      row(-5, -3),
      row("abc", 140),
      row(Number.POSITIVE_INFINITY, "63"),
      row(null, undefined),
      row(3_600, 100),
    ]).map((event) => [event.activeSeconds, event.completionPercent]);
    expect(values).toEqual([
      [0, 0],
      [0, 100],
      [0, 63],
      [0, 0],
      [3_600, 100],
    ]);
  });

  it("returns events in chronological order whatever order the rows arrive in", () => {
    const events = normalizeInsightEvents([
      { timestamp: "2026-09-10 08:00:02", action: "content_open", schema: "v2" },
      { timestamp: "2026-09-10 08:00:00", action: "entry", schema: "v2" },
      { timestamp: "2026-09-10T08:00:01.000Z", action: "content_attention", schema: "v1" },
    ]);
    expect(events.map((event) => event.action)).toEqual([
      "entry",
      "content_attention",
      "content_open",
    ]);
  });

  it("marks a response truncated exactly when it fills the row cap", () => {
    const rows = (count: number) =>
      Array.from({ length: count }, () => ({
        timestamp: "2026-09-10 08:00:00",
        action: "entry",
        schema: "v2",
      }));
    expect(readInsightEventRows(rows(INSIGHT_EVENT_LIMIT)).truncated).toBe(true);
    const partial = readInsightEventRows(rows(INSIGHT_EVENT_LIMIT - 1));
    expect(partial.truncated).toBe(false);
    expect(partial.events).toHaveLength(INSIGHT_EVENT_LIMIT - 1);
    // The cap counts rows returned, not rows kept, so dropped rows cannot hide it.
    const capped = rows(INSIGHT_EVENT_LIMIT);
    capped[0] = { ...capped[0], timestamp: "bad" };
    expect(readInsightEventRows(capped)).toMatchObject({ truncated: true });
    expect(readInsightEventRows(undefined)).toEqual({ events: [], truncated: false });
  });

  it("warns in the terminal report when the event-level read was truncated", () => {
    const insights = {
      ...summarizeInsightEvents({ actions: [{ action: "entry", events: 4 }] }),
      raw: { events: [], truncated: true },
    };
    expect(formatInsightEvents(insights).join("\n")).toContain(
      "Event-level read hit the 10000-row cap",
    );
    const complete = { ...insights, raw: { events: [], truncated: false } };
    expect(formatInsightEvents(complete).join("\n")).not.toContain("row cap");
  });
});
