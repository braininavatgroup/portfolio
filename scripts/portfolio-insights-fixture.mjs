#!/usr/bin/env node
// Fixture sources for the portfolio insights run. No network, no token, no
// Keychain: every source is an injected function returning what the live
// fetcher would have parsed, so the dashboard can be generated and inspected
// anywhere.
//
//   node scripts/portfolio-insights-fixture.mjs            # into a new temp directory
//   node scripts/portfolio-insights-fixture.mjs <directory>
//
// The fixture runs twice: a prior week, then the current week with Clarity
// answering 429, so the page shows assigned and anonymous activity, an idle
// assigned link, hostile strings, cities, evidence, contact, small samples,
// and findings that compare two windows. The people, companies, and codes are
// invented. The tokens are placeholders the fetchers never use.
//
// The command line builds the degraded variant, which additionally seeds three
// earlier aggregate runs for the trend marks, leaves Cloudflare stale and
// Clarity unavailable, and duplicates one campaign code, so one page carries
// all three source states and both campaign-code paths: the neutral unmapped
// note and the red configuration error. The plain two-run form is what the run
// tests pin; see `buildFixtureDashboard`.

import { realpathSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { runInsights } from "./portfolio-insights.mjs";
import { ensurePrivateDirectory, writePrivateFile } from "./portfolio-insights-storage.mjs";
import {
  deriveTrafficShape,
  parseArguments,
  rankDimension,
  summarizeDaily,
  summarizeEdgeDetail,
  summarizeInsightEvents,
  summarizePerformance,
} from "./portfolio-insights-report.mjs";

export const FIXTURE_TOKENS = Object.freeze({
  CLOUDFLARE_API_TOKEN: "fixture-cloudflare-placeholder",
  CLARITY_API_TOKEN: "fixture-clarity-placeholder",
  PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN: "fixture-airtable-placeholder",
});

export const FIXTURE_PRIOR_RUN = "2026-09-04T11:10:00.000Z";
export const FIXTURE_CURRENT_RUN = "2026-09-11T11:10:00.000Z";

/** Stands in for content/portfolio-content.json; labels are deliberately hostile. */
export const FIXTURE_CONTENT = {
  records: {
    "record-9q": {
      label: 'Record <9Q> & "quotes"',
      kind: "Case study",
      visuals: { "evidence-7": {}, "evidence-8": {} },
    },
    "record-4k": { label: "Record 4K", kind: "Essay", visuals: {} },
  },
  threads: { "thread-2": { title: "Thread <two>", visuals: [] } },
};

/** @param {number} ms */
const analyticsEngineTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

/**
 * One Analytics Engine row as the event-level query returns it.
 * @param {Record<string, string | number> & { at: string, action: string }} fields
 */
export function eventRow({
  at,
  action,
  session = "",
  campaign = "",
  content = "",
  kind = "",
  contact = "",
  source = "",
  target = "",
  targetKind = "",
  country = "US",
  device = "desktop",
  region = "NY",
  city = "New York",
  metro = "501",
  active = 0,
  completion = 0,
  schema = "v2",
}) {
  return {
    timestamp: at,
    action,
    content_id: content,
    content_kind: kind,
    campaign,
    contact_kind: contact,
    source,
    target_id: target,
    target_kind: targetKind,
    country,
    device,
    schema,
    session_id: session,
    region_code: region,
    city,
    metro_code: metro,
    active_seconds: active,
    completion_percent: completion,
  };
}

/**
 * One tab session, a minute between steps.
 * @param {string} sessionId
 * @param {string} start ISO time
 * @param {Array<Record<string, string | number>>} steps
 * @param {Record<string, string | number>} [common]
 */
function tab(sessionId, start, steps, common = {}) {
  const base = Date.parse(start);
  return steps.map((step, index) =>
    eventRow({
      ...common,
      ...step,
      session: sessionId,
      at: analyticsEngineTime(base + index * 60_000),
      action: String(step.action),
    }),
  );
}

/** @param {string} content @param {string} [kind] */
const read = (content, kind = "record", completion = 88) => [
  { action: "content_open", content, kind, source: "graph" },
  { action: "content_attention", content, kind, active: 95, completion },
];

const evidence = { action: "evidence_open", content: "record-9q", kind: "record", target: "evidence-7", targetKind: "pdf" };

/** The prior week: London readers who opened the evidence. */
export function priorEventRows() {
  const london = { country: "GB", region: "ENG", city: "London", metro: "" };
  return [1, 2, 3, 4, 5, 6].flatMap((n) =>
    tab(
      `tab-prior-${n}`,
      `2026-08-3${n % 2}T1${n}:00:00Z`,
      [{ action: "entry", source: "linkedin" }, ...read("record-9q"), ...(n <= 4 ? [evidence] : [])],
      london,
    ),
  );
}

/** The current week: assigned, anonymous, hostile, unknown, sessionless, and quarantined rows. */
export function currentEventRows() {
  return [
    // Alex's link: two sessions 27 hours apart, the second on another network.
    ...tab(
      "tab-alex-1",
      "2026-09-09T15:00:00Z",
      [{ action: "entry", source: "email" }, ...read("record-9q"), evidence, { action: "contact_action", contact: "email" }],
      { campaign: "alexcode01" },
    ),
    ...tab(
      "tab-alex-2",
      "2026-09-10T18:00:00Z",
      [{ action: "entry", source: "email" }, { action: "content_open", content: "thread-2", kind: "thread" }],
      { campaign: "alexcode01", city: "Brooklyn" },
    ),
    // A hostile Airtable name and a refused Airtable URL.
    ...tab("tab-sam-1", "2026-09-10T09:00:00Z", [{ action: "entry" }, ...read("record-4k", "record", 40)], {
      campaign: "samcode03",
      country: "GB",
      region: "ENG",
      city: "London",
      metro: "",
    }),
    // Five anonymous New York readers who never open the evidence.
    ...[1, 2, 3, 4, 5].flatMap((n) =>
      tab(`tab-ny-${n}`, `2026-09-0${5 + (n % 5)}T1${n}:00:00Z`, [{ action: "entry", source: "linkedin" }, ...read("record-9q")]),
    ),
    // A hostile city on mobile that reaches contact from a thread.
    ...tab(
      "tab-paris",
      "2026-09-08T08:00:00Z",
      [{ action: "entry", source: "direct" }, { action: "content_open", content: "thread-2", kind: "thread" }, { action: "contact_action", contact: "linkedin" }],
      { country: "FR", region: "IDF", city: "<b>Paris</b>", metro: "", device: "mobile" },
    ),
    // No network location at all.
    ...tab("tab-unknown", "2026-09-11T06:00:00Z", [{ action: "entry" }], { country: "", region: "", city: "", metro: "" }),
    // A v1 row with no session: counted, never joined.
    eventRow({ at: "2026-09-07 10:00:00", action: "entry", schema: "v1" }),
    // Two codes in one tab: quarantined.
    ...tab("tab-mixed", "2026-09-07T12:00:00Z", [
      { action: "entry", campaign: "alexcode01" },
      { action: "content_open", content: "record-9q", kind: "record", campaign: "samcode03" },
    ]),
    // A code no Action carries.
    ...tab("tab-stray", "2026-09-06T12:00:00Z", [{ action: "entry" }], { campaign: "straycode9" }),
  ];
}

/** What `fetchClarity` parses, with a hostile page URL. */
export function fixtureClarity(sessions = 454) {
  return {
    days: 3,
    project: "yatoiqtrjm",
    metrics: {},
    traffic: { sessions, humanSessions: sessions - 13, botSessions: 13, users: Math.round(sessions * 0.7) },
    frustration: [
      { label: "Dead clicks", value: 16, sessionShare: 0.031 },
      { label: "Rage clicks", value: 2, sessionShare: 0.004 },
    ],
    breakdowns: {
      sources: [
        { value: "www.linkedin.com  ·  Referral", sessions: 130 },
        { value: "(no referrer)  ·  Direct", sessions: 90 },
      ],
      pages: [
        { value: "/", sessions: 300 },
        { value: "/?view=graph#<script>", sessions: 3 },
      ],
      devices: [
        { value: "Mobile", sessions: 250 },
        { value: "PC", sessions: 204 },
      ],
      engagement: { totalSeconds: 142, activeSeconds: 61 },
      averageScrollDepth: 54,
    },
  };
}

/** What `fetchCloudflare` parses, built with the report's own reducers. */
export function fixtureCloudflare() {
  const group = (dimension, value, count, visits) => ({ dimensions: { [dimension]: value }, count, sum: { visits } });
  const daily = summarizeDaily([
    { dimensions: { date: "2026-09-09" }, count: 180, sum: { visits: 11 } },
    { dimensions: { date: "2026-09-10" }, count: 235, sum: { visits: 14 } },
    { dimensions: { date: "2026-09-11" }, count: 55, sum: { visits: 1 } },
  ]);
  const referrers = rankDimension(
    [group("refererHost", "www.linkedin.com", 15, 15), group("refererHost", "bradleyberkman.com", 400, 0)],
    "refererHost",
  );
  const navigation = rankDimension(
    [group("navigationType", "routing-apis", 380, 0), group("navigationType", "navigate", 90, 26)],
    "navigationType",
  );
  const quantiles = {
    firstContentfulPaintP50: 520_000,
    firstContentfulPaintP75: 760_000,
    firstContentfulPaintP95: 1_900_000,
    pageLoadTimeP50: 900_000,
    pageLoadTimeP75: 1_268_000,
    pageLoadTimeP95: 3_992_000,
  };
  return {
    daily,
    dimensions: {
      requestPath: rankDimension([group("requestPath", "/", 300, 20)], "requestPath"),
      refererHost: referrers,
      countryName: rankDimension([group("countryName", "United States", 320, 21)], "countryName"),
      deviceType: rankDimension([group("deviceType", "mobile", 250, 15)], "deviceType"),
      userAgentBrowser: rankDimension([group("userAgentBrowser", "Chrome", 260, 17)], "userAgentBrowser"),
      userAgentOS: rankDimension([group("userAgentOS", "iOS", 200, 12)], "userAgentOS"),
      navigationType: navigation,
    },
    performance: summarizePerformance({ count: 194, quantiles }),
    performanceByDevice: [{ device: "mobile", ...summarizePerformance({ count: 98, quantiles }) }],
    shape: deriveTrafficShape({ daily, referrers, navigation, site: "bradleyberkman.com" }),
    edge: {
      daily: [
        { date: "2026-09-10", requests: 2828, cachedRequests: 2100, threats: 0, uniques: 310 },
        { date: "2026-09-11", requests: 739, cachedRequests: 540, threats: 0, uniques: 120 },
      ],
      detail: summarizeEdgeDetail({
        userAgents: new Map([
          ["Mozilla/5.0 (compatible; GPTBot/1.2)", 161],
          ["Mozilla/5.0 (iPhone) Safari", 2400],
          ["python-requests/2.32", 30],
        ]),
        paths: new Map([
          ["/", 2600],
          ["/wp-login.php", 12],
        ]),
        statuses: new Map([
          ["200", 3400],
          ["404", 150],
          ["503", 9],
        ]),
        serverErrorPaths: new Map([["/api/chat", 9]]),
      }),
    },
  };
}

/** What the four aggregate Analytics Engine queries summarise to. */
export function fixtureAggregates() {
  return summarizeInsightEvents({
    actions: [
      { action: "entry", events: 14 },
      { action: "content_open", events: 12 },
      { action: "content_attention", events: 8 },
      { action: "contact_action", events: 2 },
      { action: "evidence_open", events: 1 },
    ],
    contacts: [
      { kind: "email", events: 1 },
      { kind: "linkedin", events: 1 },
    ],
    attention: [{ content_id: "record-9q", content_kind: "record", snapshots: 6, active_seconds_p50: 95, active_seconds_max: 95, completion_p50: 88, completion_max: 88 }],
    campaigns: [
      { campaign: "alexcode01", events: 7, entries: 2 },
      { campaign: "samcode03", events: 3, entries: 1 },
    ],
  });
}

/** Invented Airtable assignments: a named link, unassigned outreach, and a hostile one. */
export function fixtureAssignments() {
  const people = "https://airtable.com/app0LM9NfGL4ZHi3j/tblrJTH1gruJDCAVx/";
  return [
    {
      actionRecordId: "recAlexAction",
      campaignCode: "alexcode01",
      sentAt: "2026-09-08T14:00:00.000Z",
      channel: "Email",
      portfolioUrl: "https://bradleyberkman.com/?campaign=alexcode01",
      action: "Send portfolio",
      state: "Done",
      person: { name: "Alex Rivera", airtableUrl: `${people}recAlexPerson` },
      company: "Acme <b>Labs</b>",
      job: { title: "Staff Engineer", stage: "Interviewing", outcome: null },
    },
    {
      actionRecordId: "recOutreachAction",
      campaignCode: "nobodycode02",
      sentAt: "2026-09-07T10:00:00.000Z",
      channel: "LinkedIn",
      portfolioUrl: "https://bradleyberkman.com/?campaign=nobodycode02",
      action: "Cold outreach",
      state: "Done",
      person: null,
      company: null,
      job: null,
    },
    {
      actionRecordId: "recSamAction",
      campaignCode: "samcode03",
      sentAt: "2026-09-09T12:00:00.000Z",
      channel: "Referral",
      portfolioUrl: "https://bradleyberkman.com/?campaign=samcode03",
      action: "Referral follow-up",
      state: "Waiting",
      person: { name: '<Sam & "Co">', airtableUrl: "https://airtable.com.evil.example/app0LM9NfGL4ZHi3j/rec1" },
      company: "Evil'); DROP TABLE",
      job: { title: "Design <i>Lead</i>", stage: "Applied", outcome: null },
    },
  ];
}

/**
 * `runInsights` dependencies backed by the fixtures above. `fetchers`
 * replaces individual sources; `events` replaces the event-level rows; any
 * other key (`storage`, `env`, `readKeychain`) replaces that dependency.
 * @param {{ directory: string, now: string } & Record<string, any>} options
 */
export function fixtureDependencies({ directory, now, events = currentEventRows(), fetchers = {}, ...rest }) {
  return {
    directory,
    now: () => new Date(now),
    env: { ...FIXTURE_TOKENS },
    readKeychain: async () => {
      throw new Error("fixtures never read the Keychain");
    },
    readContent: async () => FIXTURE_CONTENT,
    fetchers: {
      clarity: async () => fixtureClarity(),
      cloudflare: async () => fixtureCloudflare(),
      insightAggregates: async () => fixtureAggregates(),
      insightEvents: async () => events,
      airtable: async () => fixtureAssignments(),
      ...fetchers,
    },
    ...rest,
  };
}

/**
 * A run's result as tests read it: the snapshot is loosely shaped JSON.
 * @typedef {{ exitCode: number, output: string, snapshot: Record<string, any>, dashboardPath: string }} FixtureRun
 */

/**
 * `runInsights` with command-line flags over fixture dependencies.
 * @param {string[]} argv
 * @param {{ directory: string, now: string } & Record<string, any>} dependencies
 * @returns {Promise<FixtureRun>}
 */
export async function runFixture(argv, dependencies) {
  const result = await runInsights(parseArguments(argv), /** @type {any} */ (fixtureDependencies(dependencies)));
  return /** @type {FixtureRun} */ (/** @type {unknown} */ (result));
}

/**
 * The degraded page has to show both campaign-code paths at once, because they
 * read differently on purpose: `straycode9` in the event rows belongs to no
 * Action (a neutral note, kept anonymous) while these two Actions both claim
 * `dupecode04` (a configuration error to fix). Only the degraded variant adds
 * the duplicate, so the two-run fixture the run tests pin keeps its three
 * clean assignments.
 */
const ambiguousAssignments = async () => {
  const duplicate = (suffix) => ({
    actionRecordId: `recDuplicate${suffix}`,
    campaignCode: "dupecode04",
    sentAt: "2026-09-05T09:00:00.000Z",
    channel: "Email",
    portfolioUrl: "https://bradleyberkman.com/?campaign=dupecode04",
    action: "Send portfolio",
    state: "Done",
    person: { name: `Dana Quinn ${suffix}`, airtableUrl: "https://airtable.com/app0LM9NfGL4ZHi3j/tblrJTH1gruJDCAVx/recDana" },
    company: "Quinn Studio",
    job: null,
  });
  return [...fixtureAssignments(), duplicate("A"), duplicate("B")];
};

const clarityQuotaSpent = async () => {
  throw new Error("Clarity returned 429: the project's 10 requests for today are spent.");
};
const cloudflareRefused = async () => {
  throw new Error("Cloudflare returned 403: the token is missing Account Analytics Read.");
};

/**
 * Three earlier runs as `history.jsonl` keeps them: aggregate only, with no
 * names, companies, campaign codes, or session IDs. They give the trend marks
 * something to draw before the two real runs below add their own points.
 * @returns {Array<Record<string, any>>}
 */
export function fixtureHistoryRows() {
  /** @param {[string, number]} entry */
  const content = ([contentId, sessions]) => ({
    contentId,
    sessions,
    attentionSessions: sessions,
    evidenceSessions: 0,
    contactSessions: 0,
    medianActiveSeconds: 95,
    medianCompletionPercent: 88,
  });
  const run = (capturedAt, believable, rows) => ({
    capturedAt,
    believableSessions: believable.sessions,
    believableVisits: believable.visits,
    edgeRequests: believable.edgeRequests,
    sources: { clarity: "fresh", cloudflare: "fresh", insights: "fresh", journeys: "fresh", airtable: "fresh" },
    intelligence: {
      version: 1,
      window: null,
      journeys: "available",
      sessions: rows.sessions,
      evidenceSessions: rows.evidence,
      contactSessions: rows.contact,
      content: rows.content.map(content),
      locations: [],
      sources: [],
      devices: [],
      clarity: null,
      cloudflare: null,
    },
  });
  return [
    run(
      "2026-08-21T11:10:00.000Z",
      { sessions: 310, visits: 18, edgeRequests: 2404 },
      { sessions: 4, evidence: 1, contact: 0, content: [["record-9q", 2]] },
    ),
    run(
      "2026-08-25T11:10:00.000Z",
      { sessions: 372, visits: 24, edgeRequests: 2915 },
      { sessions: 7, evidence: 3, contact: 1, content: [["record-9q", 4], ["thread-2", 1]] },
    ),
    run(
      "2026-08-28T11:10:00.000Z",
      { sessions: 401, visits: 29, edgeRequests: 3186 },
      { sessions: 9, evidence: 4, contact: 1, content: [["record-9q", 5], ["thread-2", 2]] },
    ),
  ];
}

/**
 * The prior week, then the current week with Clarity's quota spent.
 *
 * `degraded` is what the command line builds, so one page shows every state a
 * reader has to recognise: Analytics Engine and Airtable fresh, Cloudflare
 * stale after its last-known-good snapshot, and Clarity unavailable because no
 * run of this fixture ever reached it. It also seeds the earlier aggregate runs
 * the trend marks read. The default stays the two-run fixture the run tests
 * pin, where every source writes a snapshot.
 *
 * @param {string} directory
 * @param {{ degraded?: boolean }} [options]
 * @returns {Promise<FixtureRun>}
 */
export async function buildFixtureDashboard(directory, { degraded = false } = {}) {
  if (degraded) {
    await ensurePrivateDirectory(directory);
    await writePrivateFile(
      join(directory, "history.jsonl"),
      `${fixtureHistoryRows().map((row) => JSON.stringify(row)).join("\n")}\n`,
    );
  }
  await runFixture([], {
    directory,
    now: FIXTURE_PRIOR_RUN,
    events: priorEventRows(),
    // Clarity never answers in a degraded run, so it never writes a snapshot
    // and stays unavailable rather than falling back to a stale one.
    ...(degraded ? { fetchers: { clarity: clarityQuotaSpent, airtable: ambiguousAssignments } } : {}),
  });
  return runFixture([], {
    directory,
    now: FIXTURE_CURRENT_RUN,
    fetchers: degraded
      ? { clarity: clarityQuotaSpent, cloudflare: cloudflareRefused, airtable: ambiguousAssignments }
      : { clarity: clarityQuotaSpent },
  });
}

async function main() {
  const directory = process.argv[2]
    ? resolve(process.argv[2])
    : join(await mkdtemp(join(tmpdir(), "portfolio-insights-fixture-")), "insights");
  const result = await buildFixtureDashboard(directory, { degraded: true });
  process.stdout.write(`${result.dashboardPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
