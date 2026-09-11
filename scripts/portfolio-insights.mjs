#!/usr/bin/env node
// Read the launch signals: Cloudflare edge and Web Analytics, plus Clarity.
//
//   npm run insights                  # last 7 days, both sources
//   npm run insights -- --days 30     # a longer Cloudflare window
//   npm run insights -- --json        # the raw snapshot
//   npm run insights -- --no-clarity  # skip Clarity's 10-requests-a-day budget
//   npm run insights -- --history     # every past run, one row each
//   npm run insights -- --dashboard   # also rewrite dashboard.html and open it
//   npm run insights -- --no-insights # skip the first-party Analytics Engine sink
//
// Tokens come from CLOUDFLARE_API_TOKEN and CLARITY_API_TOKEN if set, otherwise
// from the macOS login Keychain entries `scripts/setup-portfolio-insights.sh`
// writes. Neither token is ever printed or written to disk.
//
// Every run appends a rollup to .context/insights/history.jsonl, which is
// gitignored (or to $PORTFOLIO_INSIGHTS_DIR when set, which is how the
// scheduled run keeps one history across checkouts). That file exists because both sources forget: Cloudflare's free
// plan keeps about ten days of Web Analytics and Clarity's export API returns
// at most three. A daily run is what turns them into a launch time series.
//
// Nothing here mutates anything. It reads production analytics and writes only
// inside .context/.

import { execFile } from "node:child_process";
import { mkdir, appendFile, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { renderDashboard } from "./portfolio-insights-dashboard.mjs";
import { promisify } from "node:util";

import {
  clarityBreakdowns,
  clarityFrustration,
  deriveBelievable,
  formatHistory,
  clarityTraffic,
  deriveTrafficShape,
  formatReport,
  historyRow,
  mergeDayGroups,
  parseArguments,
  rankDimension,
  summarizeClarity,
  summarizeDaily,
  summarizeEdgeDetail,
  summarizeInsightEvents,
  summarizePerformance,
  summarizePerformanceByDevice,
  windowForDays,
} from "./portfolio-insights-report.mjs";

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

async function readKeychain(account, service = KEYCHAIN_SERVICE) {
  const { stdout } = await execFileAsync("/usr/bin/security", [
    "find-generic-password",
    "-s",
    service,
    "-a",
    account,
    "-w",
  ]);
  return stdout.trim();
}

async function resolveToken(environmentVariable, account) {
  const fromEnvironment = process.env[environmentVariable]?.trim();
  if (fromEnvironment) return fromEnvironment;
  const entries = [
    { service: KEYCHAIN_SERVICE, account },
    ...(LEGACY_KEYCHAIN_ENTRIES[account] ?? []),
  ];
  for (const entry of entries) {
    try {
      const stored = await readKeychain(entry.account, entry.service);
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
const INSIGHT_DATASET = "portfolio_insights";
const INSIGHT_ROW_LIMIT = 25;

/** SQL string literal; the only values interpolated are ISO dates and names this file owns. */
function sqlString(value) {
  return `'${String(value).replace(/'/gu, "''")}'`;
}

/**
 * The four questions the report asks the sink. Column positions follow the
 * blob layout in `lib/server/portfolio-insight-sink.ts`: blob1 action, blob2
 * content_id, blob3 content_kind, blob4 campaign, blob5 contact_kind, double1
 * active seconds, double2 completion. Rows are sampled at volume, so every
 * count is `SUM(_sample_interval)` and every quantile is sample-weighted.
 */
function insightQueries(range) {
  const start = range.start.slice(0, 19).replace("T", " ");
  const end = range.end.slice(0, 19).replace("T", " ");
  const inWindow =
    `timestamp >= toDateTime(${sqlString(start)}) AND timestamp <= toDateTime(${sqlString(end)})`;
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
  return Array.isArray(payload?.data) ? payload.data : [];
}

/**
 * The worker's own insight events, read from Analytics Engine. Needs Account
 * Analytics Read on the Cloudflare token, the same row Web Analytics uses.
 * A dataset that has never been written to answers with an error rather than
 * an empty table, which the report shows as the same one-line note.
 */
async function fetchInsightEvents(token, range) {
  const queries = insightQueries(range);
  const answers = {};
  for (const [name, query] of Object.entries(queries)) {
    answers[name] = await analyticsEngineSql(token, query);
  }
  return {
    source: "analytics-engine",
    dataset: INSIGHT_DATASET,
    ...summarizeInsightEvents(answers),
  };
}

function missingToken(name, account, where) {
  return {
    error:
      `no token. Set ${name}, or run \`npm run setup:insights\` to store one ` +
      `in the Keychain (${KEYCHAIN_SERVICE} / ${account}). Mint it at ${where}.`,
  };
}

// A scheduled run points this at a directory that outlives any one checkout,
// so worktrees can come and go without losing the launch curve.
const HISTORY_DIRECTORY = process.env.PORTFOLIO_INSIGHTS_DIR
  ? new URL(`${process.env.PORTFOLIO_INSIGHTS_DIR.replace(/\/?$/u, "/")}`, "file://")
  : new URL("../.context/insights/", import.meta.url);

async function readHistory() {
  try {
    const text = await readFile(new URL("history.jsonl", HISTORY_DIRECTORY), "utf8");
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
  } catch {
    return [];
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.dashboard && !options.cloudflare && !options.clarity) {
    // --dashboard alone: rebuild from what is already on disk and open it.
    const page = await writeDashboard();
    await execFileAsync("open", [page]).catch(() => {});
    process.stdout.write(`${page}\n`);
    return;
  }
  if (options.history) {
    const rows = await readHistory();
    process.stdout.write(
      options.json ? `${JSON.stringify(rows, null, 2)}\n` : `${formatHistory(rows).join("\n")}\n`,
    );
    return;
  }
  const range = windowForDays(options.days);
  const snapshot = {
    capturedAt: new Date().toISOString(),
    site: SITE_HOST,
    window: range,
  };

  if (options.cloudflare) {
    const token = await resolveToken("CLOUDFLARE_API_TOKEN", "cloudflare-api-token");
    snapshot.cloudflare = token
      ? await fetchCloudflare(token, range).catch((error) => ({
          error: String(error.message ?? error),
        }))
      : missingToken(
          "CLOUDFLARE_API_TOKEN",
          "cloudflare-api-token",
          "https://dash.cloudflare.com/profile/api-tokens",
        );
  }

  if (options.clarity) {
    const token = await resolveToken("CLARITY_API_TOKEN", "clarity-api-token");
    // Clarity's export API reaches back three days at most, whatever --days says.
    snapshot.clarity = token
      ? await fetchClarity(token, Math.min(3, options.days)).catch((error) => ({
          error: String(error.message ?? error),
        }))
      : missingToken(
          "CLARITY_API_TOKEN",
          "clarity-api-token",
          `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT}/settings`,
        );
  }

  snapshot.believable = deriveBelievable({
    shape: snapshot.cloudflare?.shape,
    dimensions: snapshot.cloudflare?.dimensions,
    clarity: snapshot.clarity?.error ? null : snapshot.clarity,
  });
  if (options.insights) {
    const token = await resolveToken("CLOUDFLARE_API_TOKEN", "cloudflare-api-token");
    snapshot.insights = token
      ? await fetchInsightEvents(token, range).catch((error) => ({
          error: String(error.message ?? error),
        }))
      : missingToken(
          "CLOUDFLARE_API_TOKEN",
          "cloudflare-api-token",
          "https://dash.cloudflare.com/profile/api-tokens",
        );
  }

  if (options.snapshot) await recordSnapshot(snapshot);
  if (options.snapshot || options.dashboard) {
    const page = await writeDashboard(snapshot);
    if (options.dashboard) {
      await execFileAsync("open", [page]).catch(() => {
        process.stderr.write(`Dashboard written to ${page}\n`);
      });
    }
  }

  process.stdout.write(
    options.json ? `${JSON.stringify(snapshot, null, 2)}\n` : formatReport(snapshot),
  );
}

/** Rewrites dashboard.html beside the history from this snapshot, or the newest one. */
async function writeDashboard(snapshot = null) {
  await mkdir(HISTORY_DIRECTORY, { recursive: true });
  let latest = snapshot;
  if (!latest) {
    const names = (await readdir(HISTORY_DIRECTORY).catch(() => []))
      .filter((name) => name.startsWith("snapshot-") && name.endsWith(".json"))
      .sort();
    const newest = names.at(-1);
    if (newest) {
      latest = JSON.parse(await readFile(new URL(newest, HISTORY_DIRECTORY), "utf8"));
    }
  }
  const target = new URL("dashboard.html", HISTORY_DIRECTORY);
  await writeFile(target, renderDashboard({ snapshot: latest, history: await readHistory() }));
  return fileURLToPath(target);
}

async function recordSnapshot(snapshot) {
  const directory = HISTORY_DIRECTORY;
  await mkdir(directory, { recursive: true });
  const stamp = snapshot.capturedAt.replace(/[:.]/gu, "-");
  await writeFile(
    new URL(`snapshot-${stamp}.json`, directory),
    `${JSON.stringify(snapshot, null, 2)}\n`,
  );
  await appendFile(
    new URL("history.jsonl", directory),
    `${JSON.stringify(historyRow(snapshot))}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message ?? error}\n`);
  process.exitCode = 1;
});
