import { describe, expect, it } from "vitest";

import { headlineTiles, historySeries, renderDashboard } from "./portfolio-insights-dashboard.mjs";

const snapshot = {
  capturedAt: "2026-09-11T16:00:00.000Z",
  window: { start: "2026-09-05T00:00:00.000Z", end: "2026-09-11T23:59:59.000Z" },
  believable: { cloudflareVisits: 38, cloudflareExcluded: 51, claritySessions: 437, clarityExcluded: 4 },
  cloudflare: {
    daily: [
      { date: "2026-09-10", pageloads: 235, visits: 14 },
      { date: "2026-09-11", pageloads: 55, visits: 1 },
    ],
    shape: { externalReferrers: [{ value: "www.linkedin.com", pageloads: 15, visits: 15, share: 0.4 }] },
    performance: { samples: 194, firstContentfulPaint: { p75: 760 }, pageLoadTime: { p75: 1268, p95: 3992 } },
    performanceByDevice: [{ device: "mobile", samples: 98, firstContentfulPaint: { p75: 706 }, pageLoadTime: { p75: 1133, p95: 4474 } }],
    edge: {
      daily: [{ date: "2026-09-10", requests: 2828 }, { date: "2026-09-11", requests: 739 }],
      detail: { crawlerRequests: 310, serverErrors: 9, crawlers: [{ value: "GPTBot (OpenAI)", requests: 161 }] },
    },
  },
  clarity: {
    days: 3,
    traffic: { sessions: 454, humanSessions: 441, botSessions: 13 },
    breakdowns: {
      sources: [{ value: "www.linkedin.com  ·  Referral", sessions: 130 }, { value: "(no referrer)  ·  Other", sessions: 177 }],
      pages: [{ value: "/", sessions: 176 }, { value: "/?view=graph#<script>", sessions: 3 }],
    },
    frustration: [{ label: "Dead clicks", value: 16, sessionShare: 0.031 }],
  },
};

describe("headlineTiles", () => {
  it("leads with believable sessions and sums LinkedIn sources", () => {
    const tiles = headlineTiles(snapshot);
    expect(tiles[0]).toMatchObject({ label: "Believable sessions", value: 437 });
    expect(tiles.find((t) => t.label === "From LinkedIn")?.value).toBe(130);
    expect(tiles.find((t) => t.label === "Edge requests")?.value).toBe(3567);
    expect(tiles.find((t) => t.label === "Server errors")?.value).toBe(9);
  });

  it("nulls a tile whose source failed rather than showing zero", () => {
    const tiles = headlineTiles({ ...snapshot, clarity: { error: "429" } });
    expect(tiles.find((t) => t.label === "From LinkedIn")?.value).toBeNull();
  });
});

describe("historySeries", () => {
  it("keeps the last run of each day, oldest first", () => {
    const points = historySeries([
      { capturedAt: "2026-09-11T10:00:00Z", believableSessions: 400 },
      { capturedAt: "2026-09-10T07:10:00Z", believableSessions: 300, believableVisits: 30 },
      { capturedAt: "2026-09-11T16:00:00Z", believableSessions: 437, believableVisits: 38 },
      { capturedAt: null },
    ]);
    expect(points.map((p) => p.x)).toEqual(["2026-09-10", "2026-09-11"]);
    expect(points[1]).toMatchObject({ believableSessions: 437, believableVisits: 38 });
  });
});

describe("renderDashboard", () => {
  const html = renderDashboard({
    snapshot,
    history: [{ capturedAt: "2026-09-11T16:00:00Z", believableSessions: 437, believableVisits: 38, edgeRequests: 3567 }],
    generatedAt: "2026-09-11T16:30:00.000Z",
  });

  it("is a self-contained page with the headline, curve, daily multiples, and ranked lists", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<script/u);
    expect(html).not.toMatch(/https?:\/\//u);
    expect(html).toContain("Believable sessions");
    expect(html).toContain("Believable humans, by run");
    expect(html).toContain("Edge requests per day");
    expect(html).toContain("Who is crawling");
    expect(html).toContain("GPTBot (OpenAI)");
    expect(html).toContain("Web vitals");
    expect(html).toContain("4,474");
  });

  it("escapes every value it prints", () => {
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("gives every chart a legend or single-series title and a table view", () => {
    const figures = html.match(/<figure/gu)?.length ?? 0;
    const tables = html.match(/<details/gu)?.length ?? 0;
    expect(figures).toBeGreaterThan(4);
    expect(tables).toBe(figures);
    expect(html).toContain('class="legend"');
  });

  it("still renders when there is no snapshot", () => {
    const empty = renderDashboard({ snapshot: null, history: [], generatedAt: "2026-09-11T16:30:00.000Z" });
    expect(empty).toContain("no snapshot yet");
    expect(empty).not.toContain("<figure");
  });
});
