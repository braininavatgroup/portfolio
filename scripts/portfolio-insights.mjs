#!/usr/bin/env node
// Read the launch signals and rebuild the private portfolio dashboard:
// Cloudflare edge and Web Analytics, Clarity, the first-party Analytics Engine
// sink, and a read-only Airtable projection of assigned links.
//
//   npm run insights                   # last 7 days, every source
//   npm run insights -- --days 30      # a longer Cloudflare window
//   npm run insights -- --json         # the run's snapshot
//   npm run insights -- --no-clarity   # skip Clarity's 10-requests-a-day budget
//   npm run insights -- --no-insights  # skip the first-party Analytics Engine sink
//   npm run insights -- --no-airtable  # render without assigned-link identity
//   npm run insights -- --no-snapshot  # read only; write nothing
//   npm run insights -- --history      # every past run, one row each
//   npm run insights -- --dashboard    # also open dashboard.html
//   npm run insights:dashboard         # rebuild the page from disk, no requests
//
// Each source resolves on its own. A fetch that parses replaces that source's
// last-known-good file; a failed one leaves it and the run shows the saved
// value as stale, with its own timestamp. `--no-<source>` skips the request
// and shows the saved value, except `--no-airtable`, which drops identity.
// An Airtable configuration error (duplicate or malformed code, or a linked
// field carrying more than one record) never falls back to the saved copy:
// every link stays unattributed until it is fixed. A code no Action carries is
// not an error — it is an old, retired, or forwarded link, so it stays
// anonymous and is reported as a neutral note instead.
//
// Writes, in order, inside the insight directory (0700, every file 0600):
// source snapshots, the run's event-level rows (raw-events-*.json, deleted
// once the window they cover began 180 days ago), one aggregate history row,
// the dashboard, then the prune. The directory is $PORTFOLIO_INSIGHTS_DIR when
// set, otherwise ~/Library/Application Support/biv/portfolio-insights, the
// scheduled job's own, so every run shares one history and one prune.
// Tokens come from the environment or the login
// Keychain entries `npm run setup:insights` writes and are never printed or
// written to disk. Nothing here mutates anything remote.
//
// The run exits non-zero only when no source, current or saved, can fill a
// dashboard; a partial run is a successful run.

import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { chmod, readFile, stat, truncate } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  AirtableConfigurationError,
  fetchPortfolioAssignments,
  resolveAirtableToken,
} from "./portfolio-insights-airtable.mjs";
import { renderDashboard } from "./portfolio-insights-dashboard.mjs";
import {
  buildPortfolioIntelligence,
  contentCatalogFromPortfolioContent,
  summarizeForHistory,
} from "./portfolio-insights-intelligence.mjs";
import {
  clarityBreakdowns,
  clarityFrustration,
  deriveBelievable,
  formatHistory,
  clarityTraffic,
  deriveTrafficShape,
  formatLead,
  formatReport,
  historyRow,
  INSIGHT_DATASET,
  INSIGHT_EVENT_LIMIT,
  insightEventQuery,
  insightWindowClause,
  mergeDayGroups,
  parseArguments,
  rankDimension,
  readInsightEventRows,
  summarizeClarity,
  summarizeDaily,
  summarizeEdgeDetail,
  summarizeInsightEvents,
  summarizePerformance,
  summarizePerformanceByDevice,
  windowForDays,
} from "./portfolio-insights-report.mjs";
import * as privateStorage from "./portfolio-insights-storage.mjs";

const execFileAsync = promisify(execFile);

const KEYCHAIN_SERVICE = "biv-portfolio-insights";
// Older entries written by hand before `setup:insights` existed. Read as a
// fallback so a token that already works keeps working.
const LEGACY_KEYCHAIN_ENTRIES = {
  "cloudflare-api-token": [{ service: "biv-cloudflare-analytics", account: "api-token" }],
};
const CLOUDFLARE_ACCOUNT_TAG = "d459e1fdd68165fbc952d009070658d7";
const CLOUDFLARE_ZONE_TAG = "624bf95296a4ce1f2a927e5013537bc2";
const RUM_SITE_TAG = "bc27c8ff1dab471ea19546ac65ac42e2";
const CLARITY_PROJECT = "yatoiqtrjm";
const SITE_HOST = "bradleyberkman.com";
const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const CLARITY_ENDPOINT =
  "https://www.clarity.ms/export-data/api/v1/project-live-insights";

// Clarity allows ten requests per project per day. Four leaves room to re-run.
const CLARITY_REQUESTS = [
  {},
  { dimension1: "URL" },
  { dimension1: "Source", dimension2: "Channel" },
  { dimension1: "Country/Region", dimension2: "Device" },
];

const RUM_DIMENSIONS = [
  "requestPath",
  "refererHost",
  "countryName",
  "deviceType",
  "userAgentBrowser",
  "userAgentOS",
  "navigationType",
];

/** @param {string} service @param {string} account */
async function readKeychainPassword(service, account) {
  const { stdout } = await execFileAsync("/usr/bin/security", [
    "find-generic-password",
    "-s",
    service,
    "-a",
    account,
    "-w",
  ]);
  return stdout;
}

/**
 * @param {{ env: Record<string, string | undefined>, readKeychain: (service: string, account: string) => Promise<string> }} access
 * @param {string} environmentVariable
 * @param {string} account
 */
async function resolveToken({ env, readKeychain }, environmentVariable, account) {
  const fromEnvironment = env[environmentVariable]?.trim();
  if (fromEnvironment) return fromEnvironment;
  const entries = [
    { service: KEYCHAIN_SERVICE, account },
    ...(LEGACY_KEYCHAIN_ENTRIES[account] ?? []),
  ];
  for (const entry of entries) {
    try {
      const stored = (await readKeychain(entry.service, entry.account)).trim();
      if (stored) return stored;
    } catch {
      // Try the next entry; the missing-token message is the same either way.
    }
  }
  return null;
}

async function graphql(token, query, variables) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }
  return payload.data;
}

// Pageloads and performance are separate datasets with separate filter input
// types, so the document declares one variable for each even though this run
// passes the same window to both.
function rumDocument() {
  const groups = RUM_DIMENSIONS.map(
    (dimension) => `
          ${dimension}: rumPageloadEventsAdaptiveGroups(
            limit: 20
            filter: $filter
            orderBy: [count_DESC]
          ) { dimensions { ${dimension} } count sum { visits } }`,
  ).join("");

  return `
    query PortfolioRum(
      $account: String!
      $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!
      $performanceFilter: AccountRumPerformanceEventsAdaptiveGroupsFilter_InputObject!
    ) {
      viewer {
        accounts(filter: { accountTag: $account }) {
          daily: rumPageloadEventsAdaptiveGroups(
            limit: 100
            filter: $filter
            orderBy: [date_ASC]
          ) { dimensions { date } count sum { visits } }${groups}
          performance: rumPerformanceEventsAdaptiveGroups(limit: 1, filter: $performanceFilter) {
            count
            quantiles {
              firstContentfulPaintP50 firstContentfulPaintP75 firstContentfulPaintP95
              pageLoadTimeP50 pageLoadTimeP75 pageLoadTimeP95
            }
          }
          performanceByDevice: rumPerformanceEventsAdaptiveGroups(
            limit: 5
            filter: $performanceFilter
            orderBy: [count_DESC]
          ) {
            count
            dimensions { deviceType }
            quantiles {
              firstContentfulPaintP50 firstContentfulPaintP75 firstContentfulPaintP95
              pageLoadTimeP50 pageLoadTimeP75 pageLoadTimeP95
            }
          }
        }
      }
    }`;
}

async function fetchCloudflare(token, range) {
  const filter = {
    siteTag: RUM_SITE_TAG,
    datetime_geq: range.start,
    datetime_leq: range.end,
  };
  const data = await graphql(token, rumDocument(), {
    account: CLOUDFLARE_ACCOUNT_TAG,
    filter,
    performanceFilter: filter,
  });
  const account = data?.viewer?.accounts?.[0] ?? {};

  const dimensions = Object.fromEntries(
    RUM_DIMENSIONS.map((dimension) => [
      dimension,
      rankDimension(account[dimension] ?? [], dimension),
    ]),
  );
  const daily = summarizeDaily(account.daily ?? []);

  return {
    daily,
    dimensions,
    performance: summarizePerformance(account.performance?.[0]),
    performanceByDevice: summarizePerformanceByDevice(account.performanceByDevice ?? []),
    shape: deriveTrafficShape({
      daily,
      referrers: dimensions.refererHost,
      navigation: dimensions.navigationType,
      site: SITE_HOST,
    }),
    edge: await fetchEdge(token, range),
  };
}

/**
 * Edge request counts, which answer the crawler question Web Analytics cannot:
 * a bot that never runs JavaScript still shows up here. Needs Zone Analytics
 * Read, so a token without it degrades to a note rather than failing the run.
 */
async function fetchEdge(token, range) {
  const query = `
    query PortfolioEdge($zone: String!, $start: Date!, $end: Date!) {
      viewer {
        zones(filter: { zoneTag: $zone }) {
          httpRequests1dGroups(
            limit: 30
            filter: { date_geq: $start, date_leq: $end }
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            sum { requests cachedRequests bytes threats }
            uniq { uniques }
          }
        }
      }
    }`;
  try {
    const data = await graphql(token, query, {
      zone: CLOUDFLARE_ZONE_TAG,
      start: range.start.slice(0, 10),
      end: range.end.slice(0, 10),
    });
    const groups = data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];
    return {
      daily: groups.map((group) => ({
        date: group.dimensions.date,
        requests: group.sum.requests,
        cachedRequests: group.sum.cachedRequests,
        threats: group.sum.threats,
        uniques: group.uniq.uniques,
      })),
      detail: await fetchEdgeDetail(token, range).catch((error) => ({
        error: String(error.message ?? error),
      })),
    };
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
}

// The free plan answers httpRequestsAdaptiveGroups one UTC day at a time and
// returns the top rows only, so the tail of rare user agents is not counted.
const EDGE_DETAIL_ROW_LIMIT = 50;

/** Each UTC day in the window as an inclusive [start, end) pair. */
function utcDays(range) {
  const days = [];
  const cursor = new Date(range.start);
  const end = new Date(range.end);
  while (cursor <= end) {
    const start = cursor.toISOString();
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    days.push({ start, end: cursor.toISOString() });
  }
  return days;
}

/**
 * Who is actually making the edge requests: named crawlers, automation,
 * vulnerability probes, and where the server errors landed.
 */
async function fetchEdgeDetail(token, range) {
  const query = `
    query PortfolioEdgeDetail($zone: String!, $start: Time!, $end: Time!, $limit: Int!) {
      viewer {
        zones(filter: { zoneTag: $zone }) {
          userAgents: httpRequestsAdaptiveGroups(
            limit: $limit
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [count_DESC]
          ) { count dimensions { userAgent } }
          paths: httpRequestsAdaptiveGroups(
            limit: $limit
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [count_DESC]
          ) { count dimensions { clientRequestPath } }
          statuses: httpRequestsAdaptiveGroups(
            limit: $limit
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [count_DESC]
          ) { count dimensions { edgeResponseStatus } }
          serverErrors: httpRequestsAdaptiveGroups(
            limit: $limit
            filter: { datetime_geq: $start, datetime_lt: $end, edgeResponseStatus_geq: 500 }
            orderBy: [count_DESC]
          ) { count dimensions { clientRequestPath } }
        }
      }
    }`;
  const perDay = [];
  for (const day of utcDays(range)) {
    const data = await graphql(token, query, {
      zone: CLOUDFLARE_ZONE_TAG,
      start: day.start,
      end: day.end,
      limit: EDGE_DETAIL_ROW_LIMIT,
    });
    perDay.push(data?.viewer?.zones?.[0] ?? {});
  }
  return summarizeEdgeDetail({
    userAgents: mergeDayGroups(perDay.map((day) => day.userAgents), "userAgent"),
    paths: mergeDayGroups(perDay.map((day) => day.paths), "clientRequestPath"),
    statuses: mergeDayGroups(perDay.map((day) => day.statuses), "edgeResponseStatus"),
    serverErrorPaths: mergeDayGroups(perDay.map((day) => day.serverErrors), "clientRequestPath"),
  });
}

async function fetchClarity(token, days) {
  const payloads = [];
  for (const dimensions of CLARITY_REQUESTS) {
    const url = new URL(CLARITY_ENDPOINT);
    url.searchParams.set("numOfDays", String(days));
    for (const [key, value] of Object.entries(dimensions)) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    if (response.status === 429) {
      throw new Error(
        "Clarity returned 429: the project's 10 requests for today are spent. " +
          "Re-run tomorrow, or use --no-clarity for the Cloudflare half.",
      );
    }
    if (!response.ok) {
      throw new Error(`Clarity returned ${response.status} ${response.statusText}.`);
    }
    payloads.push(await response.json());
  }
  const metrics = summarizeClarity(payloads);
  return {
    days,
    project: CLARITY_PROJECT,
    metrics,
    traffic: clarityTraffic(metrics),
    frustration: clarityFrustration(metrics),
    breakdowns: clarityBreakdowns(metrics),
  };
}

// ── First-party portfolio signals ────────────────────────────────────────────

const ANALYTICS_ENGINE_ENDPOINT =
  `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_TAG}/analytics_engine/sql`;
const INSIGHT_ROW_LIMIT = 25;

/**
 * The four aggregate questions the report asks the sink. Column positions
 * follow the blob layout in `lib/server/portfolio-insight-sink.ts`: blob1
 * action, blob2 content_id, blob3 content_kind, blob4 campaign, blob5
 * contact_kind, double1 active seconds, double2 completion. Rows are sampled
 * at volume, so every count is `SUM(_sample_interval)` and every quantile is
 * sample-weighted. The event-level read is `insightEventQuery` in the report
 * module, beside the normalizer that decodes it.
 */
function insightQueries(range) {
  const inWindow = insightWindowClause(range);
  return {
    actions: `
      SELECT blob1 AS action, SUM(_sample_interval) AS events
      FROM ${INSIGHT_DATASET}
      WHERE ${inWindow}
      GROUP BY action ORDER BY events DESC LIMIT ${INSIGHT_ROW_LIMIT} FORMAT JSON`,
    contacts: `
      SELECT blob5 AS kind, SUM(_sample_interval) AS events
      FROM ${INSIGHT_DATASET}
      WHERE ${inWindow} AND blob1 = 'contact_action'
      GROUP BY kind ORDER BY events DESC LIMIT ${INSIGHT_ROW_LIMIT} FORMAT JSON`,
    attention: `
      SELECT blob2 AS content_id, blob3 AS content_kind,
        SUM(_sample_interval) AS snapshots,
        quantileExactWeighted(0.5)(double1, _sample_interval) AS active_seconds_p50,
        max(double1) AS active_seconds_max,
        quantileExactWeighted(0.5)(double2, _sample_interval) AS completion_p50,
        max(double2) AS completion_max
      FROM ${INSIGHT_DATASET}
      WHERE ${inWindow} AND blob1 = 'content_attention'
      GROUP BY content_id, content_kind ORDER BY snapshots DESC LIMIT ${INSIGHT_ROW_LIMIT} FORMAT JSON`,
    campaigns: `
      SELECT blob4 AS campaign,
        SUM(_sample_interval) AS events,
        sumIf(_sample_interval, blob1 = 'entry') AS entries
      FROM ${INSIGHT_DATASET}
      WHERE ${inWindow} AND blob4 != ''
      GROUP BY campaign ORDER BY entries DESC LIMIT ${INSIGHT_ROW_LIMIT} FORMAT JSON`,
  };
}

async function analyticsEngineSql(token, query) {
  const response = await fetch(ANALYTICS_ENGINE_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: query,
  });
  const text = await response.text();
  if (!response.ok) {
    // Errors come back as plain text or as the API's JSON envelope.
    let message = text.trim();
    try {
      const payload = JSON.parse(text);
      message = payload.errors?.map((error) => error.message).join("; ") || message;
    } catch {
      // Plain text stays as it is.
    }
    throw new Error(`Analytics Engine returned ${response.status}: ${message || response.statusText}`);
  }
  const payload = JSON.parse(text);
  // An answer without a data array did not parse; it is a failure, not an empty window.
  if (!Array.isArray(payload?.data)) throw new Error("Analytics Engine answered without a data array");
  return payload.data;
}

/**
 * The aggregate answers: counts the terminal and history read. Needs Account
 * Analytics Read on the Cloudflare token, the same row Web Analytics uses. A
 * dataset that has never been written to answers with an error rather than an
 * empty table. Kept apart from the event-level read so one failing never
 * erases the other.
 */
async function fetchInsightAggregates(token, range) {
  const answers = {};
  for (const [name, query] of Object.entries(insightQueries(range))) {
    answers[name] = await analyticsEngineSql(token, query);
  }
  return {
    source: "analytics-engine",
    dataset: INSIGHT_DATASET,
    ...summarizeInsightEvents(answers),
  };
}

/** The live sources. Each returns a parsed value or throws. */
const liveFetchers = Object.freeze({
  cloudflare: (token, range) => fetchCloudflare(token, range),
  clarity: (token, days) => fetchClarity(token, days),
  insightAggregates: (token, range) => fetchInsightAggregates(token, range),
  // Raw rows; the run decodes them with readInsightEventRows.
  insightEvents: (token, range) => analyticsEngineSql(token, insightEventQuery(range)),
  airtable: (token) => fetchPortfolioAssignments({ token }),
});

// ── The run ──────────────────────────────────────────────────────────────────

const SKIP_FLAGS = {
  clarity: "--no-clarity",
  cloudflare: "--no-cloudflare",
  insights: "--no-insights",
  airtable: "--no-airtable",
};

/** Findings that come from this run's Clarity and Cloudflare signals, not from event rows. */
const SOURCE_FINDING_KINDS = new Set(["frustration", "error", "performance"]);

const ANALYTICS_ENGINE_CAPABILITY =
  "Analytics Engine unavailable (needs Account Analytics Read on the Cloudflare token " +
  "and a deployment with PORTFOLIO_INSIGHT_EVENTS_SINK=analytics-engine)";

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function missingToken(name, account, where) {
  return new Error(
    `no token. Set ${name}, or run \`npm run setup:insights\` to store one ` +
      `in the Keychain (${KEYCHAIN_SERVICE} / ${account}). Mint it at ${where}.`,
  );
}

/** @param {string} directory */
async function readHistory(directory) {
  let text;
  try {
    text = await readFile(join(directory, "history.jsonl"), "utf8");
  } catch {
    return [];
  }
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    });
}

/** The last run's aggregate intelligence summary, which findings compare against. */
function previousSummary(rows) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const summary = rows[index]?.intelligence;
    if (summary && typeof summary === "object" && summary.version === 1) return summary;
  }
  return null;
}

async function readPortfolioContent() {
  return JSON.parse(await readFile(new URL("../content/portfolio-content.json", import.meta.url), "utf8"));
}

/**
 * Where runs keep their files: $PORTFOLIO_INSIGHTS_DIR when set, otherwise
 * the scheduled job's directory, so a manual run never leaves raw events in a
 * checkout where no prune reaches them. Must match HISTORY_DIR in
 * scripts/schedule-portfolio-insights.sh.
 * @param {Record<string, string | undefined>} [env]
 */
export function defaultInsightsDirectory(env = process.env) {
  if (env.PORTFOLIO_INSIGHTS_DIR) return resolve(env.PORTFOLIO_INSIGHTS_DIR);
  return join(env.HOME || homedir(), "Library", "Application Support", "biv", "portfolio-insights");
}

/**
 * One source's state for this run. A skipped source shows its saved value
 * (unless `useSaved` is false). A fetch that answers is written as the new
 * last-known-good only after it returned a parsed value; a request failure
 * leaves the file alone and falls back to it.
 *
 * A configuration error (`isConfigurationError`) is not a request failure:
 * the saved value rests on the same broken configuration, so the file is
 * replaced by the problems. A stored configuration error then outranks any
 * saved value through skips, rebuilds, and outages, and the source stays
 * unavailable with those problems until a fetch parses cleanly.
 */
async function resolveSourceState({
  name,
  fetch,
  directory,
  capturedAt,
  record,
  storage,
  useSaved = true,
  isConfigurationError = () => false,
  onConfigurationErrors = () => {},
  describe = messageOf,
}) {
  const saved = useSaved ? await storage.readSourceSnapshot(directory, name) : null;
  const blocked = saved?.configurationErrors?.length ? saved.configurationErrors : null;
  const refuse = (problems) => {
    onConfigurationErrors(problems);
    return { status: "unavailable", capturedAt: null, value: null, error: problems.join("; ") };
  };
  if (!fetch) {
    if (blocked) return refuse(blocked);
    return storage.resolveSourceResult({
      previous: saved,
      error: saved ? undefined : `not requested (${SKIP_FLAGS[name]})`,
      capturedAt,
    });
  }
  let fresh;
  try {
    fresh = await fetch();
    if (fresh === undefined || fresh === null) throw new Error(`${name} answered nothing`);
  } catch (error) {
    if (isConfigurationError(error)) {
      const listed = Array.isArray(error?.problems) ? error.problems.filter((problem) => typeof problem === "string" && problem) : [];
      const problems = listed.length > 0 ? listed : [messageOf(error)];
      if (record) await storage.writeSourceConfigurationError(directory, name, problems, capturedAt);
      return refuse(problems);
    }
    if (blocked) return refuse(blocked);
    return storage.resolveSourceResult({ previous: saved, error: describe(error), capturedAt });
  }
  if (record) await storage.writeSourceSnapshot(directory, name, fresh, capturedAt);
  return storage.resolveSourceResult({ fresh, previous: saved, capturedAt });
}

/**
 * The event-level rows journeys come from. Fresh when the read decodes;
 * otherwise the newest raw-events file inside retention, shown as stale;
 * otherwise unavailable, and `events` is null so nothing reads it as zero.
 */
async function resolveEvents({ fetch, directory, capturedAt, storage }) {
  let error;
  if (fetch) {
    try {
      const rows = await fetch();
      if (!Array.isArray(rows)) throw new Error("Analytics Engine answered without event rows");
      const { events, truncated } = readInsightEventRows(rows);
      return { status: "fresh", capturedAt, events, truncated };
    } catch (failure) {
      error = `${ANALYTICS_ENGINE_CAPABILITY}: ${messageOf(failure)}`.slice(0, 300);
    }
  }
  const latest = await storage.readLatestRawEvents(directory, capturedAt);
  if (latest) {
    return {
      status: "stale",
      capturedAt: latest.capturedAt,
      events: latest.events,
      // Raw files written before the flag was stored fall back to a full page.
      truncated: typeof latest.truncated === "boolean" ? latest.truncated : latest.events.length >= INSIGHT_EVENT_LIMIT,
      ...(error ? { error } : {}),
    };
  }
  return {
    status: "unavailable",
    capturedAt: null,
    events: null,
    truncated: false,
    error: error ?? `not requested (${SKIP_FLAGS.insights})`,
  };
}

/** A source's value for display, or null. */
const shown = (state) => (state.status !== "unavailable" ? state.value : null);
/** A source's value only when this run measured it, for history. */
const measured = (state) => (state.status === "fresh" ? state.value : null);

/**
 * One insights run: resolve every source, derive intelligence, write the
 * files in their safe order, and return the terminal output and exit code.
 *
 * @param {ReturnType<typeof parseArguments>} options
 * @param {{
 *   directory?: string | URL,
 *   now?: () => Date,
 *   env?: Record<string, string | undefined>,
 *   readKeychain?: (service: string, account: string) => Promise<string>,
 *   fetchers?: Partial<typeof liveFetchers>,
 *   readContent?: () => Promise<unknown>,
 *   storage?: typeof privateStorage,
 * }} [dependencies]
 */
export async function runInsights(options, dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const readKeychain = dependencies.readKeychain ?? readKeychainPassword;
  const fetchers = { ...liveFetchers, ...dependencies.fetchers };
  const readContent = dependencies.readContent ?? readPortfolioContent;
  const storage = dependencies.storage ?? privateStorage;
  const now = dependencies.now ?? (() => new Date());
  const rawDirectory = dependencies.directory ?? defaultInsightsDirectory(env);
  const directory = rawDirectory instanceof URL ? fileURLToPath(rawDirectory) : rawDirectory;

  if (options.history) {
    const rows = await readHistory(directory);
    return {
      exitCode: 0,
      output: options.json ? `${JSON.stringify(rows, null, 2)}\n` : `${formatHistory(rows).join("\n")}\n`,
      snapshot: null,
      dashboardPath: null,
    };
  }

  const started = now();
  const capturedAt = started.toISOString();
  const range = windowForDays(options.days, started);
  // --dashboard with neither Cloudflare nor Clarity rebuilds the page from
  // what is on disk: no source is requested and no run is recorded.
  const offline = options.dashboard && !options.cloudflare && !options.clarity;
  const record = options.snapshot && !offline;
  if (record) await storage.ensurePrivateDirectory(directory);

  const access = { env, readKeychain };
  const cloudflareToken = async () =>
    (await resolveToken(access, "CLOUDFLARE_API_TOKEN", "cloudflare-api-token")) ??
    Promise.reject(missingToken("CLOUDFLARE_API_TOKEN", "cloudflare-api-token", "https://dash.cloudflare.com/profile/api-tokens"));
  const clarityToken = async () =>
    (await resolveToken(access, "CLARITY_API_TOKEN", "clarity-api-token")) ??
    Promise.reject(
      missingToken("CLARITY_API_TOKEN", "clarity-api-token", `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT}/settings`),
    );
  const airtableToken = async () =>
    (await resolveAirtableToken({ env, readKeychain })) ??
    Promise.reject(missingToken("PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN", "airtable-read-token", "https://airtable.com/create/tokens"));

  const shared = { directory, capturedAt, record, storage };
  const clarity = await resolveSourceState({
    ...shared,
    name: "clarity",
    // Clarity's export API reaches back three days at most, whatever --days says.
    fetch: options.clarity ? async () => fetchers.clarity(await clarityToken(), Math.min(3, options.days)) : null,
  });
  const cloudflare = await resolveSourceState({
    ...shared,
    name: "cloudflare",
    fetch: options.cloudflare ? async () => fetchers.cloudflare(await cloudflareToken(), range) : null,
  });
  const readInsights = options.insights && !offline;
  const insights = await resolveSourceState({
    ...shared,
    name: "insights",
    fetch: readInsights ? async () => fetchers.insightAggregates(await cloudflareToken(), range) : null,
    describe: (error) => `${ANALYTICS_ENGINE_CAPABILITY}: ${messageOf(error)}`,
  });
  /** @type {string[]} */
  let airtableProblems = [];
  const airtable = await resolveSourceState({
    ...shared,
    name: "airtable",
    fetch: options.airtable && !offline ? async () => fetchers.airtable(await airtableToken()) : null,
    // --no-airtable means no identity at all, not yesterday's identity.
    useSaved: options.airtable,
    // A duplicate or malformed code makes every saved join suspect too.
    isConfigurationError: (error) => error instanceof AirtableConfigurationError,
    onConfigurationErrors: (problems) => {
      airtableProblems = problems;
    },
  });
  const events = await resolveEvents({
    ...shared,
    fetch: readInsights ? async () => fetchers.insightEvents(await cloudflareToken(), range) : null,
  });

  const history = await readHistory(directory);
  let catalog = {};
  try {
    catalog = contentCatalogFromPortfolioContent(await readContent());
  } catch {
    // Labels fall back to content IDs.
  }
  const reportWindow = { ...range, label: `${range.start.slice(0, 10)} → ${range.end.slice(0, 10)}` };
  const derive = (eventRows) =>
    buildPortfolioIntelligence({
      events: eventRows,
      assignments: airtable,
      contentCatalog: catalog,
      clarity,
      cloudflare,
      previous: previousSummary(history),
      window: reportWindow,
    });
  const intelligence = derive(events.events);
  // History records journeys only when this run read them; stale or missing
  // rows go in as `events: null`, which summarizes as unavailable, never zero.
  const recordedIntelligence = events.status === "fresh" ? intelligence : derive(null);
  // Stale journeys still show, labelled with the raw file's capture time, but
  // they are not evidence about this window: only findings from this run's
  // Clarity and Cloudflare signals survive.
  const shownIntelligence =
    events.status === "fresh"
      ? intelligence
      : { ...intelligence, findings: intelligence.findings.filter((finding) => SOURCE_FINDING_KINDS.has(finding.kind)) };

  const aggregate = shown(insights);
  const raw = events.events ? { truncated: events.truncated, eventCount: events.events.length } : null;
  const insightsError = events.error ?? (insights.error ? `aggregate counts: ${insights.error}` : undefined);
  const cloudflareValue = shown(cloudflare);
  const clarityValue = shown(clarity);
  const legacy = (state) => shown(state) ?? { error: state.error ?? "unavailable" };

  const snapshot = {
    capturedAt,
    site: SITE_HOST,
    window: range,
    sources: {
      clarity,
      cloudflare,
      // Journeys are what the dashboard's Analytics Engine sections show, so
      // this state follows the event-level read; aggregate counts ride along.
      insights: {
        status: events.status,
        capturedAt: events.capturedAt,
        value: raw ? { ...(aggregate ?? {}), raw } : null,
        ...(insightsError ? { error: insightsError } : {}),
      },
      airtable,
    },
    clarity: legacy(clarity),
    cloudflare: legacy(cloudflare),
    insights: aggregate ? { ...aggregate, ...(raw ? { raw } : {}) } : { error: insights.error ?? "unavailable" },
    believable: deriveBelievable({
      shape: cloudflareValue?.shape,
      dimensions: cloudflareValue?.dimensions,
      clarity: clarityValue,
    }),
    intelligence: events.status === "unavailable" ? null : shownIntelligence,
  };
  const configurationErrors = [
    ...new Set([...airtableProblems, ...(snapshot.intelligence?.diagnostics?.configurationErrors ?? [])]),
  ];
  // Not an error: a code no Action carries is an old, retired, or forwarded
  // link. Its activity is already anonymous; the lead only names it.
  const unmappedCampaigns = snapshot.intelligence?.diagnostics?.unmappedCampaigns ?? [];

  // The history row holds only what this run measured, in aggregate.
  const measuredCloudflare = measured(cloudflare);
  const measuredClarity = measured(clarity);
  const row = {
    ...historyRow({
      capturedAt,
      window: range,
      cloudflare: measuredCloudflare ?? undefined,
      clarity: measuredClarity ?? undefined,
      insights: measured(insights) ?? undefined,
      believable: deriveBelievable({
        shape: measuredCloudflare?.shape,
        dimensions: measuredCloudflare?.dimensions,
        clarity: measuredClarity,
      }),
    }),
    sources: {
      clarity: clarity.status,
      cloudflare: cloudflare.status,
      insights: insights.status,
      journeys: events.status,
      airtable: airtable.status,
    },
    intelligence: summarizeForHistory(recordedIntelligence),
  };

  // Write order: source snapshots (above) → raw events → history → dashboard → prune.
  if (record && events.status === "fresh") {
    await storage.writeRawEvents(directory, events.events, capturedAt, {
      truncated: events.truncated,
      windowStart: range.start,
    });
  }
  if (record) {
    let existing = "";
    try {
      existing = await readFile(join(directory, "history.jsonl"), "utf8");
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
    }
    const separator = existing && !existing.endsWith("\n") ? "\n" : "";
    await storage.writePrivateFile(join(directory, "history.jsonl"), `${existing}${separator}${JSON.stringify(row)}\n`);
  }
  let dashboardPath = null;
  if (record || options.dashboard) {
    await storage.ensurePrivateDirectory(directory);
    dashboardPath = join(directory, "dashboard.html");
    const page = renderDashboard({ snapshot, history: record ? [...history, row] : history, generatedAt: capturedAt });
    await storage.writePrivateFile(dashboardPath, page);
  }
  // Only after history and the dashboard both landed: an aborted run keeps
  // every raw file it may not have summarised yet.
  if (record) await storage.pruneRawSnapshots(directory, started);

  const useful =
    [clarity, cloudflare, insights].some((state) => state.status !== "unavailable") || events.status !== "unavailable";
  let output;
  if (options.json) output = `${JSON.stringify(snapshot, null, 2)}\n`;
  else if (offline) output = `${dashboardPath}\n`;
  else output = `${formatLead(snapshot, { configurationErrors, unmappedCampaigns })}${formatReport(snapshot)}`;
  return { exitCode: useful ? 0 : 1, output, snapshot, dashboardPath };
}

/** The scheduled job's log starts over past this size. */
export const LOG_LIMIT_BYTES = 1_048_576;

/**
 * The launchd log repeats the terminal report, which names assigned links.
 * Keep it owner-only and start it over once it passes `limit` bytes. launchd
 * holds the file open for appending, so this run's output lands at the start
 * of the emptied file.
 * @param {string | undefined} path
 * @param {number} [limit]
 * @returns {Promise<boolean>} whether the log was emptied
 */
export async function capLog(path, limit = LOG_LIMIT_BYTES) {
  if (!path) return false;
  let size;
  try {
    size = (await stat(path)).size;
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return false;
    throw error;
  }
  await chmod(path, 0o600);
  if (size <= limit) return false;
  await truncate(path, 0);
  return true;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  // The installer sets PORTFOLIO_INSIGHTS_LOG to the job's own log; a manual
  // run has none. A log that cannot be capped never stops the report.
  await capLog(process.env.PORTFOLIO_INSIGHTS_LOG).catch(() => false);
  const result = await runInsights(options);
  process.stdout.write(result.output);
  if (options.dashboard && result.dashboardPath) {
    const page = result.dashboardPath;
    await execFileAsync("open", [page]).catch(() => {
      process.stderr.write(`Dashboard written to ${page}\n`);
    });
  }
  process.exitCode = result.exitCode;
}

// Run only as the entry point, so tests and the fixture can import runInsights.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${messageOf(error)}\n`);
    process.exitCode = 1;
  });
}
