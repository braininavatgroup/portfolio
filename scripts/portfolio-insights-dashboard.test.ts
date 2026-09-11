// Owns: section order, assigned-link attribution wording, per-source
// freshness, empty and unavailable states, escaping, and the Clarity/Airtable
// link allowlist of the local decision dashboard. Retire with the HTML
// dashboard.
import { describe, expect, it } from "vitest";

import {
  CLARITY_PROJECT_URL,
  headlineTiles,
  historySeries,
  renderDashboard,
  safeExternalLink,
} from "./portfolio-insights-dashboard.mjs";
import { buildPortfolioIntelligence } from "./portfolio-insights-intelligence.mjs";

const window = { start: "2026-09-04T00:00:00.000Z", end: "2026-09-11T23:59:59.000Z" };

const clarityValue = {
  days: 3,
  traffic: { sessions: 454, humanSessions: 441, botSessions: 13 },
  breakdowns: {
    sources: [{ value: "www.linkedin.com  ·  Referral", sessions: 130 }],
    pages: [{ value: "/?view=graph#<script>", sessions: 3 }],
  },
  frustration: [{ label: "Dead clicks", value: 16, sessionShare: 0.031 }],
};

const cloudflareValue = {
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
};

const event = (timestamp: string, action: string, extra: Record<string, unknown> = {}) => ({
  timestamp,
  action,
  contentId: "",
  contentKind: "",
  campaign: "",
  contactKind: "",
  source: "",
  targetId: "",
  targetKind: "",
  country: "US",
  device: "desktop",
  schema: "v2",
  sessionId: "session-a",
  regionCode: "NY",
  city: "New York",
  metroCode: "501",
  activeSeconds: 0,
  completionPercent: 0,
  ...extra,
});

const alex = {
  actionRecordId: "recAction1",
  campaignCode: "alex-code-01",
  sentAt: "2026-09-08T14:00:00.000Z",
  channel: "Email",
  portfolioUrl: "https://example.test/?c=alex-code-01",
  action: "Send portfolio",
  state: "Done",
  person: { name: "<Alex & Co>", airtableUrl: "https://airtable.com/app0LM9NfGL4ZHi3j/tblPeople/recPerson1" },
  company: "Acme <b>Labs</b>",
  job: { title: "Staff Engineer", stage: "Interviewing", outcome: null },
};

const assignedJourney = {
  sessionId: "session-a",
  campaignCode: "alex-code-01",
  assignment: alex,
  entryAt: "2026-09-10T15:00:00.000Z",
  // Deliberately out of order: the dashboard must order by timestamp.
  events: [
    event("2026-09-10T15:04:00.000Z", "contact_action", { contactKind: "email" }),
    event("2026-09-10T15:00:00.000Z", "entry", { source: "email" }),
    event("2026-09-10T15:02:00.000Z", "evidence_open", { contentId: "record-9q", targetId: "evidence-7", targetKind: "pdf" }),
    event("2026-09-10T15:01:00.000Z", "content_open", { contentId: "record-9q" }),
  ],
  contentIds: ["record-9q"],
  evidenceIds: ["evidence-7"],
  contactKinds: ["email"],
  geo: { country: "US", regionCode: "NY", city: "New York", metroCode: "501" },
  device: "desktop",
};

const anonymousJourney = {
  sessionId: "session-b",
  campaignCode: null,
  assignment: null,
  entryAt: "2026-09-11T09:00:00.000Z",
  events: [
    event("2026-09-11T09:00:00.000Z", "entry", { sessionId: "session-b", city: "", regionCode: "", metroCode: "" }),
    event("2026-09-11T09:01:00.000Z", "content_open", { sessionId: "session-b", contentId: "thread-<2>", city: "" }),
  ],
  contentIds: ["thread-<2>"],
  evidenceIds: [],
  contactKinds: [],
  geo: { country: "", regionCode: "", city: "", metroCode: "" },
  device: "mobile",
};

const intelligence = {
  findings: [
    {
      kind: "assigned-link",
      message: "Activity from <Alex & Co>'s assigned link returned after 26 hours",
      count: 2,
      denominator: 2,
      currentWindow: "2026-09-04 → 2026-09-11",
      comparisonWindow: "2026-08-28 → 2026-09-03",
    },
    {
      // Below the five-session floor and not an assigned link: must be dropped.
      kind: "content",
      message: "Tiny sample content claim",
      count: 1,
      denominator: 3,
      currentWindow: "2026-09-04 → 2026-09-11",
      comparisonWindow: "2026-08-28 → 2026-09-03",
    },
    {
      kind: "geography",
      message: "New York produced 5 eligible sessions and was absent before",
      count: 5,
      denominator: 9,
      currentWindow: "2026-09-04 → 2026-09-11",
      comparisonWindow: "2026-08-28 → 2026-09-03",
    },
  ],
  assignedLinks: [
    { assignment: alex, journeys: [assignedJourney] },
    {
      assignment: { ...alex, actionRecordId: "recAction2", campaignCode: "nobody-code-02", person: null, company: null, job: null },
      journeys: [],
    },
    {
      assignment: {
        ...alex,
        actionRecordId: "recAction3",
        campaignCode: "sam-code-03",
        person: { name: "Sam", airtableUrl: "https://airtable.com.evil.example/app0LM9NfGL4ZHi3j/rec1" },
      },
      journeys: [],
    },
  ],
  anonymousJourneys: [anonymousJourney],
  content: [
    {
      contentId: "record-9q",
      label: "Record <9Q>",
      kind: "record",
      sessions: 5,
      medianActiveSeconds: 42,
      medianCompletionPercent: 80,
      attentionSessions: 4,
      evidenceOpenRate: 0.4,
      evidenceSessions: 2,
      contactActionRate: 0.2,
      contactSessions: 1,
      commonEntrySource: "linkedin",
      commonNextContent: "thread-<2>",
      assignedShare: 0.2,
      anonymousShare: 0.8,
      comparison: "Evidence opens rose from 1 of 6 to 2 of 5 sessions against 2026-08-28 → 2026-09-03",
    },
    {
      contentId: "thread-<2>",
      label: "thread-<2>",
      kind: "thread",
      sessions: 2,
      // No attention snapshot for this item: the medians are missing, not zero.
      medianActiveSeconds: null,
      medianCompletionPercent: null,
      attentionSessions: 0,
      evidenceOpenRate: 0,
      evidenceSessions: 0,
      contactActionRate: 0,
      contactSessions: 0,
      commonEntrySource: "direct",
      commonNextContent: null,
      assignedShare: 0,
      anonymousShare: 1,
      comparison: "Held attention better than every other thread",
    },
  ],
  audience: {
    sources: [{ value: "linkedin", sessions: 4 }, { value: "direct", sessions: 3 }],
    devices: [{ value: "desktop", sessions: 5 }, { value: "mobile", sessions: 2 }],
    locations: [
      { country: "US", regionCode: "NY", city: "New York", metroCode: "501", sessions: 5 },
      { country: "", regionCode: "", city: "", metroCode: "", sessions: 2 },
    ],
  },
  // Task 5's shape: resolved labels on entries and exits, IDs on transitions
  // and paths, plus a label map and top-level counts that are not tables.
  journeyPatterns: {
    entries: [
      { contentId: "record-9q", label: "Record <9Q>", sessions: 5 },
      { contentId: null, label: "(no content opened)", sessions: 1 },
    ],
    transitions: [{ from: "record-9q", to: "thread-<2>", sessions: 2 }],
    exits: [{ contentId: "thread-<2>", label: "thread-<2>", sessions: 2 }],
    reachingEvidence: [{ path: ["record-9q"], sessions: 1 }],
    reachingContact: [{ path: ["record-9q", "thread-<2>"], sessions: 1 }],
    openingPaths: [{ path: ["record-9q", "thread-<2>"], sessions: 2, contactSessions: 1 }],
    labels: { "record-9q": "Record <9Q>" },
    sessions: 7,
    evidenceSessions: 1,
    contactSessions: 1,
  },
  diagnostics: {
    quarantinedSessions: 1,
    link: "https://evil.example/diag",
    configurationErrors: ["unmapped campaign code: stray-code-9"],
    sources: { clarity: "stale", cloudflare: "fresh" },
  },
};

const hostile = {
  capturedAt: "2026-09-11T16:00:00.000Z",
  window,
  sources: {
    clarity: { status: "stale", capturedAt: "2026-09-10T07:10:00.000Z", value: clarityValue, error: "Clarity returned 429" },
    cloudflare: { status: "fresh", capturedAt: "2026-09-11T16:00:00.000Z", value: cloudflareValue },
    insights: {
      status: "fresh",
      capturedAt: "2026-09-11T16:00:00.000Z",
      value: { events: 7, raw: { events: [], truncated: true } },
    },
    airtable: {
      status: "stale",
      capturedAt: "2026-09-10T07:10:00.000Z",
      value: [alex],
      error: "duplicate campaign code: dup-code-01",
    },
  },
  intelligence,
};

const html = renderDashboard({
  snapshot: hostile,
  history: [{ capturedAt: "2026-09-11T16:00:00Z", believableSessions: 437, believableVisits: 38, edgeRequests: 3567 }],
  generatedAt: "2026-09-11T16:30:00.000Z",
});

const headings = (page: string) =>
  [...page.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gu)].map((match) => match[1]);
const sectionOf = (page: string, title: string) => {
  const start = page.indexOf(`>${title}</h2>`);
  const next = page.indexOf("<h2", start + 1);
  return page.slice(start, next === -1 ? undefined : next);
};

describe("renderDashboard decision sections", () => {
  it("orders the decision sections and collapses diagnostics last", () => {
    expect(headings(html).slice(0, 7)).toEqual([
      "What changed",
      "Assigned links",
      "Content resonance",
      "Journeys",
      "Audience",
      "Observe in Clarity",
      "Diagnostics",
    ]);
    const diagnostics = html.match(/<details class="diagnostics"[^>]*>/u)?.[0];
    expect(diagnostics).toBeDefined();
    expect(diagnostics).not.toContain("open");
    expect(html.indexOf('<details class="diagnostics"')).toBeLessThan(html.indexOf(">Diagnostics</h2>"));
    // Crawler and infrastructure totals live only inside diagnostics.
    expect(html.indexOf("GPTBot (OpenAI)")).toBeGreaterThan(html.indexOf(">Diagnostics</h2>"));
  });

  it("uses the assigned-link attribution contract and never claims a person visited", () => {
    expect(html).toContain("Activity from &lt;Alex &amp; Co&gt;&#39;s assigned link");
    expect(html).toContain("Assigned company");
    expect(html).toContain("Link sessions");
    expect(html).toContain("Unassigned outreach");
    expect(html).not.toMatch(/\bvisited\b|\breturning\b|new visitors?|new vs/iu);
    expect(html).not.toMatch(/(Alex|&lt;Alex &amp; Co&gt;) (read|opened|viewed)/u);
  });

  it("renders an assigned row's fields and its event-ordered tab journey", () => {
    const section = sectionOf(html, "Assigned links");
    for (const label of ["Recipient", "Assigned company", "Job", "Stage", "Sent", "Latest activity", "Link sessions", "Content opened", "Evidence opened", "Contact actions", "Outcome"]) {
      expect(section).toContain(label);
    }
    expect(section).toContain("Acme &lt;b&gt;Labs&lt;/b&gt;");
    expect(section).toContain("Interviewing");
    const journey = section.slice(section.indexOf("<ol"));
    const order = ["15:00", "15:01", "15:02", "15:04"].map((time) => journey.indexOf(time));
    expect(order.every((position) => position > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows each section's source window and freshness, and labels stale data", () => {
    for (const title of ["What changed", "Assigned links", "Content resonance", "Journeys", "Audience", "Observe in Clarity"]) {
      expect(sectionOf(html, title)).toMatch(/class="sources"/u);
    }
    expect(html).toContain("Stale — last good data 2026-09-10 07:10 UTC");
    expect(html).toContain("Fresh — captured 2026-09-11 16:00 UTC");
    expect(html).toContain("2026-09-04 → 2026-09-11");
    expect(sectionOf(html, "Observe in Clarity")).toContain("Clarity returned 429");
  });

  it("puts configuration errors and truncation on the first screen", () => {
    const first = sectionOf(html, "What changed");
    expect(first).toMatch(/role="alert"[\s\S]*duplicate campaign code: dup-code-01/u);
    expect(first).toMatch(/role="alert"[\s\S]*unmapped campaign code: stray-code-9/u);
    expect(first).toContain("10,000");
  });

  it("prints findings with count, denominator, and both windows", () => {
    const first = sectionOf(html, "What changed");
    expect(first).toContain("5 of 9");
    expect(first).toContain("2026-08-28 → 2026-09-03");
  });

  it("drops a non-assigned-link finding whose denominator is below five", () => {
    const first = sectionOf(html, "What changed");
    expect(first).not.toContain("Tiny sample content claim");
    // Assigned-link findings are about one link, so a small denominator is expected.
    expect(first).toContain("returned after 26 hours");
  });

  it("withholds a pattern below five sessions and prints raw measures without a score", () => {
    const content = sectionOf(html, "Content resonance");
    expect(content).toContain("Evidence opens rose from 1 of 6 to 2 of 5");
    expect(content).toContain("not enough data for a pattern");
    expect(content).not.toContain("Held attention better than every other thread");
    expect(content).toContain("40% (2 of 5)");
    expect(content).toContain("20% (1 of 5)");
    expect(content).not.toMatch(/score/iu);
  });

  it("renders a missing median as missing, never as zero", () => {
    const content = sectionOf(html, "Content resonance");
    // Anchor on the row start: the record row's "Next content" cell also names this thread.
    const threadRow = content.slice(content.indexOf("<tr><td>thread-&lt;2&gt;</td>") + "<tr>".length);
    expect(threadRow).toMatch(/^<td>thread-&lt;2&gt;<\/td><td>thread<\/td><td>2<\/td><td>No attention data<\/td><td>No attention data<\/td>/u);
    expect(content).not.toMatch(/>0s<|>0%</u);
  });

  it("labels geography as network location and groups missing values as Unknown", () => {
    const audience = sectionOf(html, "Audience");
    expect(audience).toContain("Network location reported for this request");
    expect(audience).toContain("New York");
    expect(audience).toContain("Unknown");
  });

  it("renders journey patterns with content labels", () => {
    const journeys = sectionOf(html, "Journeys");
    expect(journeys).toContain("Record &lt;9Q&gt; → thread-&lt;2&gt;");
    expect(journeys).toContain("(no content opened)");
    for (const title of ["Common entry points", "Content transitions", "Exits", "Paths that reach evidence", "Paths that reach contact", "Opening paths"]) {
      expect(journeys).toContain(`<h3>${title}</h3>`);
    }
    expect(journeys).toContain("Reached contact");
    expect(journeys).not.toMatch(/<h3>(labels|sessions|evidence Sessions|contact Sessions)<\/h3>/u);
    expect(journeys).toContain("Anonymous tab sessions");
  });

  it("links each observation to the Clarity project with exact manual filter steps", () => {
    const observe = sectionOf(html, "Observe in Clarity");
    expect(observe).toContain(`href="${CLARITY_PROJECT_URL}"`);
    expect(CLARITY_PROJECT_URL).toBe("https://clarity.microsoft.com/projects/view/yatoiqtrjm/");
    for (const text of ["portfolio_campaign", "alex-code-01", "portfolio_content_id", "record-9q", "City", "New York", "Click / Scroll / Attention", "Recordings", "Segments"]) {
      expect(observe).toContain(text);
    }
  });

  it("is self-contained: no scripts, forms, external resources, or disallowed links", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<script|<form|<iframe|<img|<link|\ssrc=|@import|url\(/iu);
    expect(html).not.toContain("evil.example");
    const hrefs = [...html.matchAll(/href="([^"]*)"/gu)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith(CLARITY_PROJECT_URL) || href.startsWith("https://airtable.com/app0LM9NfGL4ZHi3j/")).toBe(true);
    }
    const anchors = html.match(/<a\s[^>]*>/gu) ?? [];
    for (const anchor of anchors) expect(anchor).toMatch(/target="_blank" rel="noreferrer"/u);
    expect(html).toContain('href="https://airtable.com/app0LM9NfGL4ZHi3j/tblPeople/recPerson1"');
  });

  it("agrees count and noun wherever it prints a count", () => {
    // Paths reaching evidence total one session; the reducer diagnostics carry
    // a one-item array; the anonymous journey has two events.
    expect(sectionOf(html, "Journeys")).toContain("1 session: not enough data for a pattern.");
    expect(sectionOf(html, "Journeys")).toContain("2 sessions: not enough data for a pattern.");
    expect(sectionOf(html, "Journeys")).toContain("· 2 events");
    expect(html).toContain("<td>1 item</td>");
    expect(html).not.toMatch(/\b1 (sessions|events|items|days)\b/u);
    const oneDay = renderDashboard({
      snapshot: { capturedAt: "2026-09-11T16:00:00.000Z", window, clarity: { ...clarityValue, days: 1 } },
      history: [],
      generatedAt: "2026-09-11T16:30:00.000Z",
    });
    expect(oneDay).toContain("last 1 day");
    expect(oneDay).not.toMatch(/\b1 days\b/u);
  });

  it("keeps every chart at least as wide as its viewBox so 11px labels never shrink", () => {
    // A viewBox scales its text by rendered width / viewBox width; below 1 the
    // 11px labels drop under the 11px floor. The chart scrolls in its container instead.
    const svgs = [...html.matchAll(/<svg\b[^>]*>/gu)].map((match) => match[0]);
    expect(svgs.length).toBeGreaterThan(4);
    for (const svg of svgs) {
      const viewBoxWidth = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) /u)?.[1];
      expect(viewBoxWidth, svg).toBeDefined();
      expect(svg, svg).toContain(`min-width:${viewBoxWidth}px`);
    }
    expect(html).toMatch(/\.chart-scroll \{[^}]*overflow-x: auto/u);
    expect(html).toMatch(/\.multiples > \.fig \{[^}]*min-width: 0/u);
  });

  it("escapes every source string", () => {
    expect(html).not.toContain("<Alex");
    expect(html).not.toContain("<b>Labs");
    expect(html).not.toContain("<9Q>");
    expect(html).not.toContain("#<script>");
  });
});

describe("renderDashboard empty and unavailable states", () => {
  const unavailable = {
    capturedAt: "2026-09-11T16:00:00.000Z",
    window,
    sources: {
      clarity: { status: "unavailable", capturedAt: null, value: null, error: "no token" },
      cloudflare: { status: "unavailable", capturedAt: null, value: null, error: "Cloudflare returned 403" },
      insights: { status: "unavailable", capturedAt: null, value: null, error: "dataset not activated" },
      airtable: { status: "unavailable", capturedAt: null, value: null, error: "Airtable Actions request failed: HTTP 401" },
    },
  };
  const page = renderDashboard({ snapshot: unavailable, history: [], generatedAt: "2026-09-11T16:30:00.000Z" });

  it("keeps every section, says why each source is missing, and never prints zero", () => {
    expect(headings(page).slice(0, 7)).toEqual([
      "What changed", "Assigned links", "Content resonance", "Journeys", "Audience", "Observe in Clarity", "Diagnostics",
    ]);
    expect(page).toContain("Unavailable — dataset not activated");
    expect(page).toContain("Unavailable — Airtable Actions request failed: HTTP 401");
    expect(sectionOf(page, "Assigned links")).toContain("Identity resolution unavailable");
    expect(page).not.toMatch(/>0(%|\s*<)/u);
  });

  it("renders a valid empty window without fabricating a trend", () => {
    const empty = renderDashboard({
      snapshot: {
        ...unavailable,
        sources: {
          ...unavailable.sources,
          insights: { status: "fresh", capturedAt: "2026-09-11T16:00:00.000Z", value: { raw: { events: [], truncated: false } } },
          airtable: { status: "fresh", capturedAt: "2026-09-11T16:00:00.000Z", value: [] },
        },
        intelligence: {
          findings: [], assignedLinks: [], anonymousJourneys: [], content: [],
          audience: { sources: [], devices: [], locations: [] }, diagnostics: {},
        },
      },
      history: [],
      generatedAt: "2026-09-11T16:30:00.000Z",
    });
    expect(empty).toContain("Nothing needs a decision in this window");
    expect(empty).not.toContain("10,000");
    expect(empty).not.toContain('role="alert"');
  });

  it("still renders every section when there is no snapshot", () => {
    const none = renderDashboard({ snapshot: null, history: [], generatedAt: "2026-09-11T16:30:00.000Z" });
    expect(none).toContain("no snapshot yet");
    expect(headings(none)).toContain("Observe in Clarity");
  });

  it("places a pre-intelligence snapshot's Clarity and Cloudflare material in the new sections", () => {
    const legacy = renderDashboard({
      snapshot: { capturedAt: "2026-09-11T16:00:00.000Z", window, clarity: clarityValue, cloudflare: cloudflareValue, insights: { error: "dataset missing" } },
      history: [],
      generatedAt: "2026-09-11T16:30:00.000Z",
    });
    expect(sectionOf(legacy, "Content resonance")).toContain("/?view=graph#&lt;script&gt;");
    expect(sectionOf(legacy, "Audience")).toContain("www.linkedin.com");
    expect(legacy).toContain("Unavailable — dataset missing");
    expect(legacy).toContain("GPTBot (OpenAI)");
    expect(legacy).not.toContain("#<script>");
  });
});

describe("renderDashboard when event data is missing but intelligence exists", () => {
  const withoutEvents = (insights: Record<string, unknown>) =>
    renderDashboard({
      snapshot: {
        capturedAt: "2026-09-11T16:00:00.000Z",
        window,
        sources: {
          clarity: { status: "fresh", capturedAt: "2026-09-11T16:00:00.000Z", value: clarityValue },
          cloudflare: { status: "fresh", capturedAt: "2026-09-11T16:00:00.000Z", value: cloudflareValue },
          insights,
          airtable: { status: "fresh", capturedAt: "2026-09-11T16:00:00.000Z", value: [alex] },
        },
        intelligence: {
          findings: [],
          assignedLinks: [{ assignment: alex, journeys: [] }],
          anonymousJourneys: [],
          content: [],
          audience: { sources: [], devices: [], locations: [] },
          diagnostics: { configurationErrors: ["unmapped campaign code: stray-code-9"] },
        },
      },
      history: [],
      generatedAt: "2026-09-11T16:30:00.000Z",
    });

  it.each([
    ["unavailable", { status: "unavailable", capturedAt: null, value: null, error: "dataset not activated" }, "unavailable (dataset not activated)"],
    [
      "stale with no usable value",
      { status: "stale", capturedAt: "2026-09-10T07:10:00.000Z", value: null, error: "Analytics Engine returned 500" },
      "stale with no usable value (Analytics Engine returned 500)",
    ],
  ])("says event data is unavailable when insights is %s instead of claiming an empty window", (_label, insights, reason) => {
    const page = withoutEvents(insights);
    for (const claim of [
      "Nothing needs a decision in this window",
      "No portfolio content was opened in this window",
      "No anonymous tab sessions in this window",
      "No located tab sessions",
      "None in this window",
      "No content or locations to observe",
    ]) {
      expect(page).not.toContain(claim);
    }
    for (const title of ["What changed", "Content resonance", "Journeys", "Audience", "Observe in Clarity"]) {
      expect(sectionOf(page, title)).toContain(`Event data unavailable — Analytics Engine events are ${reason}`);
    }
    // Identity and configuration still render; only activity is unknown.
    const assigned = sectionOf(page, "Assigned links");
    expect(assigned).toContain("Activity from &lt;Alex &amp; Co&gt;&#39;s assigned link");
    expect(assigned).toContain("Unavailable");
    expect(assigned).not.toContain("No link sessions in this window");
    expect(sectionOf(page, "What changed")).toMatch(/role="alert"[\s\S]*unmapped campaign code: stray-code-9/u);
  });
});

// Seam: the dashboard renders what the real reducer produces, not only this
// file's hand-written fixture. Retire with either module.
describe("renderDashboard with the real journey reducer", () => {
  type ReducerInput = Parameters<typeof buildPortfolioIntelligence>[0];
  const capturedAt = "2026-09-11T16:00:00.000Z";
  const build = (events: unknown) =>
    buildPortfolioIntelligence({
      events,
      assignments: [alex],
      contentCatalog: {},
      clarity: null,
      cloudflare: null,
      window,
    } as unknown as ReducerInput);
  const render = (intelligence: unknown, insights: Record<string, unknown>) =>
    renderDashboard({
      snapshot: {
        capturedAt,
        window,
        sources: {
          clarity: { status: "fresh", capturedAt, value: clarityValue },
          cloudflare: { status: "fresh", capturedAt, value: cloudflareValue },
          insights,
          airtable: { status: "fresh", capturedAt, value: [alex] },
        },
        intelligence,
      },
      history: [],
      generatedAt: "2026-09-11T16:30:00.000Z",
    });

  it("renders an assigned tab session from reducer output", () => {
    const events = [
      event("2026-09-10T15:00:00.000Z", "entry", { campaign: "alex-code-01", source: "email" }),
      event("2026-09-10T15:01:00.000Z", "content_open", { campaign: "alex-code-01", contentId: "record-9q" }),
    ];
    const page = render(build(events), { status: "fresh", capturedAt, value: { raw: { events, truncated: false } } });
    expect(headings(page).slice(0, 7)).toEqual([
      "What changed", "Assigned links", "Content resonance", "Journeys", "Audience", "Observe in Clarity", "Diagnostics",
    ]);
    const assigned = sectionOf(page, "Assigned links");
    expect(assigned).toContain("Activity from &lt;Alex &amp; Co&gt;&#39;s assigned link");
    expect(assigned).toMatch(/Link sessions<\/span><span class="cell-value">1</u);
    expect(page).not.toContain("<Alex");
    expect(page).not.toMatch(/<script|<form/iu);
  });

  it("marks event data unavailable when the reducer ran without events", () => {
    const page = render(build(null), { status: "unavailable", capturedAt: null, value: null, error: "dataset not activated" });
    expect(page).not.toContain("Nothing needs a decision in this window");
    expect(page).not.toContain("No anonymous tab sessions in this window");
    expect(sectionOf(page, "Journeys")).toContain("Event data unavailable — Analytics Engine events are unavailable (dataset not activated)");
    expect(sectionOf(page, "Assigned links")).toContain("Activity from &lt;Alex &amp; Co&gt;&#39;s assigned link");
  });
});

describe("safeExternalLink", () => {
  it("accepts only the configured Clarity project and Airtable base", () => {
    expect(safeExternalLink("https://clarity.microsoft.com/projects/view/yatoiqtrjm/", "clarity")).toBe(CLARITY_PROJECT_URL);
    expect(safeExternalLink("https://airtable.com/app0LM9NfGL4ZHi3j/tblX/recY", "airtable")).toBe("https://airtable.com/app0LM9NfGL4ZHi3j/tblX/recY");
  });

  it.each([
    ["http://clarity.microsoft.com/projects/view/yatoiqtrjm/", "clarity"],
    ["https://user:pw@clarity.microsoft.com/projects/view/yatoiqtrjm/", "clarity"],
    ["https://clarity.microsoft.com.evil.example/projects/view/yatoiqtrjm/", "clarity"],
    ["https://evil.example/projects/view/yatoiqtrjm/", "clarity"],
    ["https://clarity.microsoft.com:8443/projects/view/yatoiqtrjm/", "clarity"],
    ["https://clarity.microsoft.com%2eevil.example/projects/view/yatoiqtrjm/", "clarity"],
    ["https://evil.example%2F@clarity.microsoft.com/projects/view/yatoiqtrjm/", "clarity"],
    ["https://clarity.microsoft.com/projects/view/otherproj/", "clarity"],
    ["https://clarity.microsoft.com/projects/view/yatoiqtrjm/../otherproj/", "clarity"],
    ["https://airtable.com/app0LM9NfGL4ZHi3j/%2e%2e/appOther/", "airtable"],
    ["https://airtable.com/app0LM9NfGL4ZHi3jX/", "airtable"],
    ["https:\\\\evil.example/app0LM9NfGL4ZHi3j/", "airtable"],
    [" https://airtable.com/app0LM9NfGL4ZHi3j/rec", "airtable"],
    ["javascript:alert(1)//https://airtable.com/app0LM9NfGL4ZHi3j/", "airtable"],
    ["https://airtable.com/app0LM9NfGL4ZHi3j/rec", "clarity"],
    ["https://clarity.microsoft.com/projects/view/yatoiqtrjm/", "other"],
  ])("rejects %s as %s", (url, kind) => {
    expect(safeExternalLink(url, kind as "clarity" | "airtable")).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(safeExternalLink(null as unknown as string, "clarity")).toBeNull();
    expect(safeExternalLink(42 as unknown as string, "airtable")).toBeNull();
  });
});

describe("headlineTiles", () => {
  it("nulls a tile whose source failed rather than showing zero", () => {
    const tiles = headlineTiles({ clarity: { error: "429" }, cloudflare: cloudflareValue });
    expect(tiles.find((t) => t.label === "From LinkedIn")?.value).toBeNull();
    expect(tiles.find((t) => t.label === "Server errors")?.value).toBe(9);
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
