#!/usr/bin/env node
// Read the launch signals: Cloudflare edge and Web Analytics, plus Clarity.
//
//   npm run insights                  # last 7 days, both sources
//   npm run insights -- --days 30     # a longer Cloudflare window
//   npm run insights -- --json        # the raw snapshot
//   npm run insights -- --no-clarity  # skip Clarity's 10-requests-a-day budget
//
// Tokens come from CLOUDFLARE_API_TOKEN and CLARITY_API_TOKEN if set, otherwise
// from the macOS login Keychain entries `scripts/setup-portfolio-insights.sh`
// writes. Neither token is ever printed or written to disk.
//
// Every run appends a rollup to .context/insights/history.jsonl, which is
// gitignored. That file exists because both sources forget: Cloudflare's free
// plan keeps about ten days of Web Analytics and Clarity's export API returns
// at most three. A daily run is what turns them into a launch time series.
//
// Nothing here mutates anything. It reads production analytics and writes only
// inside .context/.

import { execFile } from "node:child_process";
import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import {
  clarityBreakdowns,
  clarityFrustration,
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
  summarizePerformance,
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

function missingToken(name, account, where) {
  return {
    error:
      `no token. Set ${name}, or run \`npm run setup:insights\` to store one ` +
      `in the Keychain (${KEYCHAIN_SERVICE} / ${account}). Mint it at ${where}.`,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
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

  if (options.snapshot) await recordSnapshot(snapshot);

  process.stdout.write(
    options.json ? `${JSON.stringify(snapshot, null, 2)}\n` : formatReport(snapshot),
  );
}

async function recordSnapshot(snapshot) {
  const directory = new URL("../.context/insights/", import.meta.url);
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
