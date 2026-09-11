import { describe, expect, it } from "vitest";

import {
  NOT_ENOUGH_DATA,
  buildPortfolioIntelligence,
  contentCatalogFromPortfolioContent,
  deriveFindings,
  groupJourneys,
  summarizeAudience,
  summarizeContent,
  summarizeForHistory,
} from "./portfolio-insights-intelligence.mjs";
import type {
  Finding,
  HistorySummary,
  InsightEvent,
  PortfolioAssignment,
} from "./portfolio-insights-intelligence.mjs";

// ── Fixtures ────────────────────────────────────────────────────────────────

const BASE = Date.parse("2026-09-10T12:00:00.000Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const CURRENT = { start: "2026-09-10T00:00:00.000Z", end: "2026-09-16T23:59:59.000Z", label: "Sep 10–16" };
const PRIOR = { start: "2026-09-03T00:00:00.000Z", end: "2026-09-09T23:59:59.000Z", label: "Sep 3–9" };

const catalog = contentCatalogFromPortfolioContent({
  records: {
    kickoff: { label: "Campaign Kickoff", kind: "Solutions", visuals: { "kickoff-sequence": {} } },
    bradley: { label: "Bradley Berkman", kind: "About", visuals: {} },
  },
  threads: { philosophy: { title: "Philosophy", visuals: {} } },
});

type Step = Partial<InsightEvent> & { action: string };

function event(overrides: Step): InsightEvent {
  return {
    timestamp: new Date(BASE).toISOString(),
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
    ...overrides,
  };
}

/** One tab session: steps one minute apart from `startMs`. */
function session(
  sessionId: string,
  startMs: number,
  steps: Step[],
  shared: Partial<InsightEvent> = {},
): InsightEvent[] {
  return steps.map((step, index) =>
    event({ sessionId, timestamp: new Date(startMs + index * MINUTE).toISOString(), ...shared, ...step }),
  );
}

/** `count` sessions built by `steps(index)`, ten minutes apart. */
function sessions(
  prefix: string,
  count: number,
  steps: (index: number) => Step[],
  shared: Partial<InsightEvent> = {},
  startMs = BASE,
): InsightEvent[] {
  return Array.from({ length: count }, (_, index) =>
    session(`${prefix}-${String(index).padStart(3, "0")}`, startMs + index * 10 * MINUTE, steps(index), shared),
  ).flat();
}

const entry = (source = "direct"): Step => ({ action: "entry", source });
const open = (contentId: string, source = "world", contentKind = "record"): Step => ({
  action: "content_open",
  contentId,
  contentKind,
  source,
});
const attention = (contentId: string, activeSeconds: number, completionPercent: number): Step => ({
  action: "content_attention",
  contentId,
  contentKind: "record",
  activeSeconds,
  completionPercent,
});
const evidence = (contentId: string, targetId = `${contentId}-visual`): Step => ({
  action: "evidence_open",
  contentId,
  contentKind: "record",
  targetId,
  targetKind: "image",
});
const contact = (contactKind = "email"): Step => ({ action: "contact_action", contactKind });

function assignment(code: string, name: string | null = "Alex Rivera"): PortfolioAssignment {
  return {
    actionRecordId: `rec${code}`,
    campaignCode: code,
    sentAt: "2026-09-09T15:00:00.000Z",
    channel: "Email",
    portfolioUrl: `https://bradleyberkman.com/?c=${code}`,
    action: "Send portfolio link",
    state: "Done",
    person: name ? { name, airtableUrl: "https://airtable.com/app0LM9NfGL4ZHi3j/tblPeople/recPerson" } : null,
    company: name ? "Acme Studio" : null,
    job: name ? { title: "Product Designer", stage: "Applied", outcome: null } : null,
  };
}

const fresh = (value: unknown) => ({ status: "fresh" as const, capturedAt: "2026-09-16T08:00:00.000Z", value });

function build(
  events: InsightEvent[] | null,
  {
    assignments = [] as PortfolioAssignment[] | null,
    previous = null as HistorySummary | null,
    clarity = undefined as unknown,
    cloudflare = undefined as unknown,
    window = CURRENT,
  } = {},
) {
  return buildPortfolioIntelligence({
    events,
    assignments,
    contentCatalog: catalog,
    clarity,
    cloudflare,
    previous,
    window,
  });
}

/** The prior window's aggregate history, produced the same way a real run keeps it. */
function priorHistory(events: InsightEvent[] | null, sources: { clarity?: unknown; cloudflare?: unknown } = {}) {
  return summarizeForHistory(build(events, { window: PRIOR, ...sources }));
}

function findingsOf(findings: Finding[], kind: Finding["kind"]) {
  return findings.filter((finding) => finding.kind === kind);
}

// ── Journey ownership ───────────────────────────────────────────────────────

describe("groupJourneys", () => {
  it("orders each session's events by time when they arrive out of order", () => {
    const ordered = session("session-a", BASE, [entry(), open("kickoff"), attention("kickoff", 12, 40), open("bradley")]);
    const [journey] = groupJourneys([...ordered].reverse());

    expect(journey.events.map((item) => item.action)).toEqual([
      "entry",
      "content_open",
      "content_attention",
      "content_open",
    ]);
    expect(journey.entryAt).toBe(new Date(BASE).toISOString());
    expect(journey.contentIds).toEqual(["kickoff", "bradley"]);
  });

  it("orders journeys by their first event, not by input order", () => {
    const later = session("session-late", BASE + HOUR, [entry()]);
    const earlier = session("session-early", BASE, [entry()]);
    expect(groupJourneys([...later, ...earlier]).map((journey) => journey.sessionId)).toEqual([
      "session-early",
      "session-late",
    ]);
  });

  it("quarantines a session whose events carry two different campaign codes", () => {
    const events = [
      ...session("session-q", BASE, [entry("campaign"), open("kickoff")], { campaign: "alpha-code1" }),
      ...session("session-q", BASE + 5 * MINUTE, [open("bradley")], { campaign: "bravo-code2" }),
    ];
    expect(groupJourneys(events)).toEqual([]);

    const intelligence = build(events, { assignments: [assignment("alpha-code1"), assignment("bravo-code2", "Sam Lee")] });
    expect(intelligence.assignedLinks.every((link) => link.journeys.length === 0)).toBe(true);
    expect(intelligence.anonymousJourneys).toEqual([]);
    expect(intelligence.diagnostics).toMatchObject({ quarantinedSessions: 1, quarantinedEvents: 3 });
  });

  it("keeps a session whose empty-campaign events sit beside one code", () => {
    const events = [
      ...session("session-a", BASE, [entry("campaign")], { campaign: "alpha-code1" }),
      ...session("session-a", BASE + MINUTE, [open("kickoff")]),
    ];
    const [journey] = groupJourneys(events);
    expect(journey.campaignCode).toBe("alpha-code1");
    expect(journey.events).toHaveLength(2);
  });

  it("keeps two tab sessions on one campaign code as separate journeys under one assignment", () => {
    const events = [
      ...session("session-a", BASE, [entry("campaign"), open("kickoff")], { campaign: "alpha-code1" }),
      ...session("session-b", BASE + 2 * HOUR, [entry("campaign"), open("bradley")], { campaign: "alpha-code1" }),
    ];
    const intelligence = build(events, { assignments: [assignment("alpha-code1")] });

    expect(intelligence.assignedLinks).toHaveLength(1);
    expect(intelligence.assignedLinks[0].journeys.map((journey) => journey.sessionId)).toEqual([
      "session-a",
      "session-b",
    ]);
    expect(intelligence.assignedLinks[0].journeys.every((journey) => journey.events.length === 2)).toBe(true);
  });

  it("never merges v1 or sessionless events into a journey, even with a matching campaign code", () => {
    const events = [
      ...session("session-a", BASE, [entry("campaign"), open("kickoff")], { campaign: "alpha-code1" }),
      event({ action: "evidence_open", contentId: "kickoff", campaign: "alpha-code1", schema: "v1", sessionId: "", timestamp: new Date(BASE + MINUTE).toISOString() }),
      event({ action: "contact_action", contactKind: "email", campaign: "alpha-code1", schema: "v2", sessionId: "", timestamp: new Date(BASE + 2 * MINUTE).toISOString() }),
      event({ action: "content_open", contentId: "bradley", schema: "v1", sessionId: "", timestamp: new Date(BASE + 3 * MINUTE).toISOString() }),
    ];
    const intelligence = build(events, { assignments: [assignment("alpha-code1")] });
    const [link] = intelligence.assignedLinks;

    expect(link.journeys).toHaveLength(1);
    expect(link.journeys[0].events.map((item) => item.action)).toEqual(["entry", "content_open"]);
    expect(link.journeys[0].evidenceIds).toEqual([]);
    expect(link.journeys[0].contactKinds).toEqual([]);
    expect(intelligence.anonymousJourneys).toEqual([]);
    expect(intelligence.diagnostics).toMatchObject({ sessionlessEvents: 3, sessions: 1 });
  });

  it("drops events outside the journey vocabulary or with unreadable timestamps", () => {
    const events = [
      ...session("session-a", BASE, [entry(), open("kickoff")]),
      event({ action: "chat_open", timestamp: new Date(BASE + MINUTE).toISOString() }),
      event({ action: "content_open", contentId: "bradley", timestamp: "not a time" }),
    ];
    const intelligence = build(events);
    expect(intelligence.anonymousJourneys[0].events).toHaveLength(2);
    expect(intelligence.diagnostics).toMatchObject({ unsupportedEvents: 1, invalidEvents: 1 });
  });
});

describe("campaign assignment", () => {
  it("attaches an assignment only on an exact campaign code match", () => {
    const events = [
      ...session("session-a", BASE, [entry("campaign")], { campaign: "alpha-code1" }),
      ...session("session-b", BASE + HOUR, [entry("campaign")], { campaign: "alpha-code12" }),
      ...session("session-c", BASE + 2 * HOUR, [entry("direct")]),
    ];
    const intelligence = build(events, { assignments: [assignment("alpha-code1")] });

    expect(intelligence.assignedLinks[0].journeys.map((journey) => journey.sessionId)).toEqual(["session-a"]);
    expect(intelligence.anonymousJourneys.map((journey) => journey.sessionId)).toEqual(["session-b", "session-c"]);
    expect(intelligence.anonymousJourneys.every((journey) => journey.assignment === null)).toBe(true);
    expect(intelligence.diagnostics).toMatchObject({
      identityResolution: "available",
      unmappedCampaignCodes: ["alpha-code12"],
      unmappedCampaignSessions: 1,
      configurationErrors: ["unmapped campaign code: alpha-code12"],
    });
  });

  it("keeps every coded session anonymous when Airtable is unavailable", () => {
    const events = session("session-a", BASE, [entry("campaign")], { campaign: "alpha-code1" });
    const intelligence = build(events, { assignments: null });

    expect(intelligence.assignedLinks).toEqual([]);
    expect(intelligence.anonymousJourneys).toHaveLength(1);
    expect(intelligence.diagnostics).toMatchObject({
      identityResolution: "unavailable",
      unmappedCampaignCodes: [],
      unresolvedCampaignSessions: 1,
    });
  });

  it("refuses to guess between duplicate campaign codes", () => {
    const events = session("session-a", BASE, [entry("campaign")], { campaign: "alpha-code1" });
    const intelligence = build(events, { assignments: [assignment("alpha-code1"), assignment("alpha-code1", "Sam Lee")] });

    expect(intelligence.assignedLinks).toEqual([]);
    expect(intelligence.anonymousJourneys).toHaveLength(1);
    expect(intelligence.diagnostics).toMatchObject({
      duplicateCampaignCodes: ["alpha-code1"],
      configurationErrors: ["duplicate campaign code: alpha-code1"],
    });
  });
});

// ── Content resonance ───────────────────────────────────────────────────────

describe("summarizeContent", () => {
  it("counts one session per denominator however many events it sends", () => {
    const events = session("session-a", BASE, [
      open("kickoff"),
      open("kickoff"),
      evidence("kickoff", "kickoff-sequence"),
      evidence("kickoff", "kickoff-sequence"),
      open("kickoff"),
    ]);
    const [row] = summarizeContent(groupJourneys(events), catalog);
    expect(row).toMatchObject({ contentId: "kickoff", sessions: 1, evidenceSessions: 1, evidenceOpenRate: 1 });
  });

  it("takes each session's maximum attention snapshot before the median", () => {
    const events = [
      // Running snapshots: the last is not always the largest after a reorder.
      ...session("session-a", BASE, [open("kickoff"), attention("kickoff", 10, 20), attention("kickoff", 40, 60), attention("kickoff", 30, 50)]),
      ...session("session-b", BASE + HOUR, [open("kickoff"), attention("kickoff", 5, 100)]),
      ...session("session-c", BASE + 2 * HOUR, [open("kickoff"), attention("kickoff", 100, 10)]),
      ...session("session-d", BASE + 3 * HOUR, [open("kickoff")]),
    ];
    const [row] = summarizeContent(groupJourneys(events), catalog);

    // Event-level medians would be 30s and 50%; session maxima give 40s and 60%.
    expect(row).toMatchObject({
      sessions: 4,
      attentionSessions: 3,
      medianActiveSeconds: 40,
      medianCompletionPercent: 60,
    });
  });

  it("reports no median, not zero, when no session sent an attention snapshot", () => {
    const [row] = summarizeContent(groupJourneys(session("session-a", BASE, [open("kickoff")])), catalog);
    expect(row).toMatchObject({ attentionSessions: 0, medianActiveSeconds: null, medianCompletionPercent: null });
  });

  it("uses sessions for rates, counts contact only after the content, and names common neighbours", () => {
    const events = [
      ...session("session-a", BASE, [entry("campaign"), open("kickoff", "guide"), evidence("kickoff"), evidence("kickoff"), open("bradley"), contact()], { campaign: "alpha-code1" }),
      ...session("session-b", BASE + HOUR, [entry(), open("kickoff", "guide"), open("bradley"), contact("linkedin")]),
      ...session("session-c", BASE + 2 * HOUR, [entry(), contact(), open("kickoff", "url"), open("philosophy", "world", "thread")]),
      ...session("session-d", BASE + 3 * HOUR, [entry(), open("kickoff", "world")]),
    ];
    const journeys = build(events, { assignments: [assignment("alpha-code1")] });
    const row = journeys.content.find((item) => item.contentId === "kickoff");

    expect(row).toMatchObject({
      label: "Campaign Kickoff",
      kind: "Solutions",
      sessions: 4,
      evidenceSessions: 1,
      evidenceOpenRate: 0.25,
      contactSessions: 2,
      contactActionRate: 0.5,
      commonEntrySource: "guide",
      commonNextContent: "bradley",
      assignedShare: 0.25,
      anonymousShare: 0.75,
      comparison: NOT_ENOUGH_DATA,
    });
  });

  it("prints the exact small-sample sentence below five sessions and a comparison at five", () => {
    expect(NOT_ENOUGH_DATA).toBe("not enough data for a pattern");
    const four = sessions("s", 4, () => [entry(), open("kickoff")]);
    expect(summarizeContent(groupJourneys(four), catalog)[0].comparison).toBe("not enough data for a pattern");

    const five = sessions("s", 5, (index) => (index === 0 ? [entry(), open("kickoff"), contact()] : [entry(), open("kickoff")]));
    const sentence = summarizeContent(groupJourneys(five), catalog)[0].comparison;
    expect(sentence).not.toBe(NOT_ENOUGH_DATA);
    expect(sentence).toContain("5 sessions");
    expect(sentence).toContain("20%");
  });

  it("keeps unknown content visible by its ID and the event's kind", () => {
    const [row] = summarizeContent(groupJourneys(session("session-a", BASE, [open("retired-item", "url", "thread")])), catalog);
    expect(row).toMatchObject({ contentId: "retired-item", label: "retired-item", kind: "thread" });
  });

  it("labels threads from their title", () => {
    const [row] = summarizeContent(groupJourneys(session("session-a", BASE, [open("philosophy", "url", "thread")])), catalog);
    expect(row).toMatchObject({ label: "Philosophy", kind: "Thread" });
  });
});

describe("contentCatalogFromPortfolioContent", () => {
  it("reads labels, kinds, and evidence counts from records and threads", () => {
    expect(catalog["record:kickoff"]).toEqual({ label: "Campaign Kickoff", kind: "Solutions", contentKind: "record", evidenceCount: 1 });
    expect(catalog["thread:philosophy"]).toEqual({ label: "Philosophy", kind: "Thread", contentKind: "thread", evidenceCount: 0 });
  });
});

// ── Audience and aggregate journeys ─────────────────────────────────────────

describe("summarizeAudience", () => {
  it("counts sessions by entry source, device, and network location, grouping missing geography as Unknown", () => {
    const events = [
      ...session("session-a", BASE, [entry("campaign")], { campaign: "alpha-code1", device: "mobile" }),
      ...session("session-b", BASE + HOUR, [entry()], { device: "mobile" }),
      ...session("session-c", BASE + 2 * HOUR, [entry(), open("kickoff")], { country: "DE", regionCode: "", city: "", metroCode: "" }),
      ...session("session-d", BASE + 3 * HOUR, [open("kickoff")], { country: "", regionCode: "", city: "", metroCode: "" }),
    ];
    const audience = summarizeAudience(groupJourneys(events));

    expect(audience.sources).toEqual([
      { value: "direct", sessions: 2 },
      { value: "campaign", sessions: 1 },
      { value: "unknown", sessions: 1 },
    ]);
    expect(audience.devices).toEqual([
      { value: "desktop", sessions: 2 },
      { value: "mobile", sessions: 2 },
    ]);
    expect(audience.locations).toEqual([
      { country: "US", regionCode: "NY", city: "New York", metroCode: "501", sessions: 2 },
      { country: "DE", regionCode: "Unknown", city: "Unknown", metroCode: "Unknown", sessions: 1 },
      { country: "Unknown", regionCode: "Unknown", city: "Unknown", metroCode: "Unknown", sessions: 1 },
    ]);
  });
});

describe("journey patterns", () => {
  it("counts entries, transitions, exits, and the paths that reach evidence or contact", () => {
    const events = [
      ...session("session-a", BASE, [entry(), open("kickoff"), open("bradley"), evidence("bradley"), contact()]),
      ...session("session-b", BASE + HOUR, [entry(), open("kickoff"), open("bradley"), open("bradley")]),
      ...session("session-c", BASE + 2 * HOUR, [entry(), open("bradley"), contact()]),
      ...session("session-d", BASE + 3 * HOUR, [entry()]),
    ];
    const { journeyPatterns } = build(events);

    expect(journeyPatterns).toMatchObject({ sessions: 4, evidenceSessions: 1, contactSessions: 2 });
    expect(journeyPatterns.entries).toEqual([
      { contentId: "kickoff", label: "Campaign Kickoff", sessions: 2 },
      { contentId: "bradley", label: "Bradley Berkman", sessions: 1 },
      { contentId: null, label: "(no content opened)", sessions: 1 },
    ]);
    expect(journeyPatterns.transitions).toEqual([{ from: "kickoff", to: "bradley", sessions: 2 }]);
    expect(journeyPatterns.exits).toEqual([
      { contentId: "bradley", label: "Bradley Berkman", sessions: 3 },
      { contentId: null, label: "(no content opened)", sessions: 1 },
    ]);
    expect(journeyPatterns.reachingEvidence).toEqual([{ path: ["kickoff", "bradley"], sessions: 1 }]);
    expect(journeyPatterns.reachingContact).toEqual([
      { path: ["bradley"], sessions: 1 },
      { path: ["kickoff", "bradley"], sessions: 1 },
    ]);
    expect(journeyPatterns.labels).toMatchObject({ kickoff: "Campaign Kickoff", bradley: "Bradley Berkman" });
  });
});

// ── Findings ────────────────────────────────────────────────────────────────

describe("assigned-link findings", () => {
  function returning(gapMs: number, name: string | null = "Alex Rivera") {
    const events = [
      ...session("session-a", BASE, [entry("campaign"), open("kickoff")], { campaign: "alpha-code1" }),
      // session-a's last event is one minute after BASE.
      ...session("session-b", BASE + MINUTE + gapMs, [entry("campaign"), open("bradley")], { campaign: "alpha-code1" }),
    ];
    return build(events, { assignments: [assignment("alpha-code1", name)] }).findings;
  }

  it("reports a link that returned at least 24 hours after earlier activity, in assigned-link wording", () => {
    const [finding] = findingsOf(returning(24 * HOUR), "assigned-link");
    expect(finding).toEqual({
      kind: "assigned-link",
      message:
        "Activity from Alex Rivera's assigned link returned after 24 hours: 1 of 2 link sessions began at least 24 hours after earlier activity on the link.",
      count: 1,
      denominator: 2,
      currentWindow: "Sep 10–16",
      comparisonWindow: "earlier activity on the same link in Sep 10–16",
    });
    expect(finding.message).not.toMatch(/visited|read /iu);
  });

  it("stays silent one minute short of 24 hours", () => {
    expect(findingsOf(returning(24 * HOUR - MINUTE), "assigned-link")).toEqual([]);
  });

  it("names a person-less Action as unassigned outreach", () => {
    const [finding] = findingsOf(returning(30 * HOUR, null), "assigned-link");
    expect(finding.message).toMatch(/^Activity from an unassigned outreach link returned after 30 hours/u);
  });
});

describe("content findings", () => {
  const evidenceSessions = (prefix: string, count: number, withEvidence: number, startMs = BASE) =>
    sessions(prefix, count, (index) => (index < withEvidence ? [entry(), open("kickoff"), evidence("kickoff")] : [entry(), open("kickoff")]), {}, startMs);

  it("reports a material change of at least 15 points in evidence-open rate against the prior window", () => {
    const previous = priorHistory(evidenceSessions("p", 10, 2)); // 20%
    const findings = findingsOf(build(evidenceSessions("c", 20, 7), { previous }).findings, "content"); // 35%
    const change = findings.find((finding) => finding.message.includes("evidence-open rate"));

    expect(change).toEqual({
      kind: "content",
      message: "Campaign Kickoff evidence-open rate rose from 20% (2 of 10 sessions) to 35% (7 of 20 sessions).",
      count: 7,
      denominator: 20,
      currentWindow: "Sep 10–16",
      comparisonWindow: "Sep 3–9",
    });
  });

  it("stays silent at 14 points", () => {
    const previous = priorHistory(evidenceSessions("p", 10, 2)); // 20%
    const findings = build(evidenceSessions("c", 50, 17), { previous }).findings; // 34%
    expect(findings.filter((finding) => finding.message.includes("evidence-open rate"))).toEqual([]);
  });

  it("stays silent when the prior window had fewer than five sessions", () => {
    const previous = priorHistory(evidenceSessions("p", 4, 0));
    const findings = build(evidenceSessions("c", 20, 10), { previous }).findings;
    expect(findings.filter((finding) => finding.message.includes("evidence-open rate"))).toEqual([]);
  });

  const reads = (completion: number, count = 5) =>
    sessions("r", count, () => [entry(), open("kickoff"), attention("kickoff", 90, completion)]);

  it("reports strong completion with weak evidence opening", () => {
    const finding = build(reads(80)).findings.find((item) => item.message.includes("rarely opened"));
    expect(finding).toEqual({
      kind: "content",
      message:
        "Campaign Kickoff holds attention but its evidence is rarely opened: median completion 80% across 5 sessions with attention, evidence opened in 0 of 5 sessions (0%).",
      count: 0,
      denominator: 5,
      currentWindow: "Sep 10–16",
      comparisonWindow: "fixed thresholds in Sep 10–16: median completion at least 75%, evidence-open rate below 20%",
    });
  });

  it("stays silent at 74% completion, at a 20% evidence rate, or for content without evidence", () => {
    expect(build(reads(74)).findings.filter((item) => item.message.includes("rarely opened"))).toEqual([]);

    const oneOpened = sessions("r", 5, (index) =>
      index === 0
        ? [entry(), open("kickoff"), attention("kickoff", 90, 80), evidence("kickoff")]
        : [entry(), open("kickoff"), attention("kickoff", 90, 80)],
    );
    expect(build(oneOpened).findings.filter((item) => item.message.includes("rarely opened"))).toEqual([]);

    const noEvidence = sessions("r", 5, () => [entry(), open("bradley"), attention("bradley", 90, 95)]);
    expect(build(noEvidence).findings.filter((item) => item.message.includes("rarely opened"))).toEqual([]);
  });

  const pathSessions = (otherCount: number, otherContacts: number) => [
    ...sessions("path", 5, (index) =>
      index < 2 ? [entry(), open("kickoff"), open("bradley"), contact()] : [entry(), open("kickoff"), open("bradley")],
    ),
    ...sessions(
      "other",
      otherCount,
      (index) => (index < otherContacts ? [entry(), open("bradley"), contact()] : [entry(), open("bradley")]),
      {},
      BASE + 2 * 24 * HOUR,
    ),
  ];

  it("reports a path that reaches contact at least 15 points above the site baseline", () => {
    // Path: 2 of 5 (40%). Site: 5 of 20 (25%).
    const finding = build(pathSessions(15, 3)).findings.find((item) => item.message.includes("reached a contact action"));
    expect(finding).toEqual({
      kind: "content",
      message:
        "Sessions that opened Campaign Kickoff → Bradley Berkman reached a contact action in 2 of 5 (40%), against 25% of all 20 sessions.",
      count: 2,
      denominator: 5,
      currentWindow: "Sep 10–16",
      comparisonWindow: "site baseline in Sep 10–16",
    });
  });

  it("stays silent at 14 points above the baseline", () => {
    // Path: 2 of 5 (40%). Site: 13 of 50 (26%).
    expect(build(pathSessions(45, 11)).findings.filter((item) => item.message.includes("reached a contact action"))).toEqual([]);
  });
});

describe("geography findings", () => {
  const cityEvents = (prefix: string, count: number, city: string, regionCode: string, startMs = BASE) =>
    sessions(prefix, count, () => [entry(), open("kickoff")], { city, regionCode, metroCode: "" }, startMs);

  it("reports a city with five sessions that had none in the prior window", () => {
    const previous = priorHistory(cityEvents("p", 5, "New York", "NY"));
    const events = [...cityEvents("a", 5, "Austin", "TX"), ...cityEvents("n", 3, "New York", "NY", BASE + 24 * HOUR)];
    const [finding] = findingsOf(build(events, { previous }).findings, "geography");

    expect(finding).toEqual({
      kind: "geography",
      message:
        "5 of 8 sessions came from a network location reported as Austin, TX, US, which had no sessions in Sep 3–9.",
      count: 5,
      denominator: 8,
      currentWindow: "Sep 10–16",
      comparisonWindow: "Sep 3–9",
    });
  });

  it("stays silent at four sessions, for a city already present, or for Unknown", () => {
    const previous = priorHistory(cityEvents("p", 5, "New York", "NY"));
    expect(findingsOf(build(cityEvents("a", 4, "Austin", "TX"), { previous }).findings, "geography")).toEqual([]);
    expect(findingsOf(build(cityEvents("n", 6, "New York", "NY"), { previous }).findings, "geography")).toEqual([]);
    expect(findingsOf(build(cityEvents("u", 6, "", ""), { previous }).findings, "geography")).toEqual([]);
  });

  it("draws no comparison without a prior window", () => {
    expect(findingsOf(build(cityEvents("a", 6, "Austin", "TX")).findings, "geography")).toEqual([]);
  });

  // Protects against: a prior run with no journey data (sink not yet active,
  // Analytics Engine outage) recorded as `sessions: 0` and read as "no sessions".
  it("draws no comparison when the prior window had no journey data", () => {
    const previous = priorHistory(null);
    expect(previous).toMatchObject({ journeys: "unavailable", sessions: 0, locations: [] });
    expect(findingsOf(build(cityEvents("a", 6, "Austin", "TX"), { previous }).findings, "geography")).toEqual([]);
  });

  it("requires an available prior window, with at least five sessions, before comparing", () => {
    const available = priorHistory(cityEvents("p", 5, "New York", "NY"));
    expect(available.journeys).toBe("available");
    expect(findingsOf(build(cityEvents("a", 5, "Austin", "TX"), { previous: available }).findings, "geography")).toHaveLength(1);

    const quiet = priorHistory(cityEvents("p", 4, "New York", "NY"));
    expect(quiet.journeys).toBe("available");
    expect(findingsOf(build(cityEvents("a", 6, "Austin", "TX"), { previous: quiet }).findings, "geography")).toEqual([]);

    const empty = priorHistory([]);
    expect(findingsOf(build(cityEvents("a", 6, "Austin", "TX"), { previous: empty }).findings, "geography")).toEqual([]);
  });

  // Protects against: history written before `journeys` existed being trusted.
  // Retire once no stored history row predates the field.
  it("treats a legacy history row without journey availability as unavailable", () => {
    const legacy: Partial<HistorySummary> = { ...priorHistory(cityEvents("p", 5, "New York", "NY")) };
    delete legacy.journeys;
    const events = cityEvents("a", 6, "Austin", "TX");
    expect(findingsOf(build(events, { previous: legacy as HistorySummary }).findings, "geography")).toEqual([]);
  });
});

describe("source regression findings", () => {
  const claritySnapshot = (sessionsCount: number, share: number) => ({
    days: 3,
    traffic: { sessions: sessionsCount, humanSessions: sessionsCount, botSessions: 0 },
    frustration: [{ label: "Rage clicks", value: 12, sessionShare: share }],
  });
  const cloudflareSnapshot = ({
    serverErrors = 0,
    statusRequests = 100,
    fcp = 1000,
    load = 2000,
    samples = 20,
  }: { serverErrors?: number; statusRequests?: number; fcp?: number | null; load?: number | null; samples?: number } = {}) => ({
    edge: { daily: [], detail: { serverErrors, statusRequests } },
    performance: { samples, firstContentfulPaint: { p50: null, p75: fcp, p95: null }, pageLoadTime: { p50: null, p75: load, p95: null } },
  });

  it("reports a Clarity frustration signal whose session share rose at least 10 points", () => {
    const previous = priorHistory([], { clarity: fresh(claritySnapshot(50, 0.1)) });
    const [finding] = findingsOf(build([], { previous, clarity: fresh(claritySnapshot(40, 0.2)) }).findings, "frustration");
    expect(finding).toEqual({
      kind: "frustration",
      message: "Rage clicks appeared in 20% of Clarity sessions (8 of 40), up from 10% in Sep 3–9.",
      count: 8,
      denominator: 40,
      currentWindow: "Sep 10–16",
      comparisonWindow: "Sep 3–9",
    });
  });

  it("stays silent at a 9-point rise, and when Clarity is stale or unavailable", () => {
    const previous = priorHistory([], { clarity: fresh(claritySnapshot(50, 0.1)) });
    expect(findingsOf(build([], { previous, clarity: fresh(claritySnapshot(40, 0.19)) }).findings, "frustration")).toEqual([]);
    const stale = { status: "stale", capturedAt: "2026-09-15T08:00:00.000Z", value: claritySnapshot(40, 0.5) };
    expect(findingsOf(build([], { previous, clarity: stale }).findings, "frustration")).toEqual([]);
    const unavailable = { status: "unavailable", capturedAt: null, value: null, error: "Clarity returned 429" };
    const intelligence = build([], { previous, clarity: unavailable });
    expect(findingsOf(intelligence.findings, "frustration")).toEqual([]);
    expect(intelligence.diagnostics).toMatchObject({ sources: { clarity: "unavailable" } });
  });

  it("never treats a missing prior Clarity window as zero", () => {
    const previous = priorHistory([], { clarity: { status: "unavailable", capturedAt: null, value: null } });
    expect(findingsOf(build([], { previous, clarity: fresh(claritySnapshot(40, 0.9)) }).findings, "frustration")).toEqual([]);
  });

  it("reports a Cloudflare 5xx rate that rose at least one point with at least five errors", () => {
    const previous = priorHistory([], { cloudflare: fresh(cloudflareSnapshot({ serverErrors: 4 })) });
    const [finding] = findingsOf(build([], { previous, cloudflare: fresh(cloudflareSnapshot({ serverErrors: 5 })) }).findings, "error");
    expect(finding).toEqual({
      kind: "error",
      message: "Server errors (5xx) were 5.0% of edge responses (5 of 100), up from 4.0% in Sep 3–9.",
      count: 5,
      denominator: 100,
      currentWindow: "Sep 10–16",
      comparisonWindow: "Sep 3–9",
    });
  });

  it("stays silent just under one point, under five errors, or when the edge query failed", () => {
    const previous = priorHistory([], { cloudflare: fresh(cloudflareSnapshot({ serverErrors: 4 })) });
    expect(findingsOf(build([], { previous, cloudflare: fresh(cloudflareSnapshot({ serverErrors: 5, statusRequests: 101 })) }).findings, "error")).toEqual([]);

    const quiet = priorHistory([], { cloudflare: fresh(cloudflareSnapshot({ serverErrors: 0 })) });
    expect(findingsOf(build([], { previous: quiet, cloudflare: fresh(cloudflareSnapshot({ serverErrors: 4 })) }).findings, "error")).toEqual([]);

    const failed = fresh({ edge: { error: "no Zone Analytics Read" }, performance: null });
    expect(findingsOf(build([], { previous, cloudflare: failed }).findings, "error")).toEqual([]);
  });

  // Protects against: a near-empty prior window (0 of 4 responses) standing in
  // as a real 0% baseline for a rate comparison.
  it("stays silent when the prior window had fewer than five edge responses", () => {
    const thin = priorHistory([], { cloudflare: fresh(cloudflareSnapshot({ serverErrors: 0, statusRequests: 4 })) });
    expect(findingsOf(build([], { previous: thin, cloudflare: fresh(cloudflareSnapshot({ serverErrors: 5 })) }).findings, "error")).toEqual([]);

    const enough = priorHistory([], { cloudflare: fresh(cloudflareSnapshot({ serverErrors: 0, statusRequests: 5 })) });
    expect(findingsOf(build([], { previous: enough, cloudflare: fresh(cloudflareSnapshot({ serverErrors: 5 })) }).findings, "error")).toHaveLength(1);
  });

  it("reports a Web Vitals p75 that regressed by at least 20% and 100 ms", () => {
    const previous = priorHistory([], { cloudflare: fresh(cloudflareSnapshot({ fcp: 1000, samples: 20 })) });
    const [finding] = findingsOf(
      build([], { previous, cloudflare: fresh(cloudflareSnapshot({ fcp: 1200, samples: 30 })) }).findings,
      "performance",
    );
    expect(finding).toEqual({
      kind: "performance",
      message: "First contentful paint p75 rose from 1000 ms in Sep 3–9 to 1200 ms across 30 samples.",
      count: 30,
      denominator: 30,
      currentWindow: "Sep 10–16",
      comparisonWindow: "Sep 3–9",
    });
  });

  it("stays silent at 19.9%, under 100 ms, under five samples, or with a missing value", () => {
    const previous = priorHistory([], { cloudflare: fresh(cloudflareSnapshot({ fcp: 1000 })) });
    const performanceOf = (snapshot: ReturnType<typeof cloudflareSnapshot>, prior: HistorySummary = previous) =>
      findingsOf(build([], { previous: prior, cloudflare: fresh(snapshot) }).findings, "performance");

    expect(performanceOf(cloudflareSnapshot({ fcp: 1199 }))).toEqual([]);
    const fast = priorHistory([], { cloudflare: fresh(cloudflareSnapshot({ fcp: 400 })) });
    expect(performanceOf(cloudflareSnapshot({ fcp: 480 }), fast)).toEqual([]);
    expect(performanceOf(cloudflareSnapshot({ fcp: 2000, samples: 4 }))).toEqual([]);
    expect(performanceOf(cloudflareSnapshot({ fcp: null }))).toEqual([]);
  });
});

describe("deriveFindings", () => {
  it("draws no conclusion from an empty window", () => {
    const intelligence = build([], { previous: priorHistory([]) });
    expect(intelligence.findings).toEqual([]);
    expect(intelligence.content).toEqual([]);
    expect(deriveFindings(intelligence, null)).toEqual([]);
  });
});

// ── Aggregate history ───────────────────────────────────────────────────────

describe("summarizeForHistory", () => {
  it("keeps aggregates and drops names, companies, codes, sessions, and event sequences", () => {
    const events = [
      ...session("session-secret-a", BASE, [entry("campaign"), open("kickoff"), evidence("kickoff"), contact()], { campaign: "alpha-code1" }),
      ...session("session-secret-b", BASE + HOUR, [entry(), open("bradley")]),
    ];
    const history = summarizeForHistory(build(events, { assignments: [assignment("alpha-code1")] }));
    const serialized = JSON.stringify(history);

    for (const forbidden of ["Alex Rivera", "Acme Studio", "Product Designer", "alpha-code1", "session-secret", "airtable.com", "recalpha", "timestamp"]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(history).toMatchObject({
      window: CURRENT,
      journeys: "available",
      sessions: 2,
      contactSessions: 1,
      evidenceSessions: 1,
    });
    expect(history.content.find((row) => row.contentId === "kickoff")).toMatchObject({ sessions: 1, evidenceSessions: 1 });
  });
});
