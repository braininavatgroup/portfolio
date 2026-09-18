// The live insight sources, as plain HTTPS reads: Cloudflare's GraphQL
// analytics API (Web Analytics RUM and zone edge counts), Clarity's export
// API, the Analytics Engine SQL API over the first-party `portfolio_insights`
// dataset, and the read-only Airtable projection of assigned links.
//
// Nothing here touches a filesystem, a Keychain, or `process`: the caller
// supplies each token. That is what lets the same fetchers run from the CLI on
// the Mac and from the scheduled Worker at the edge, so the two runs read the
// same rows through the same code rather than through two implementations.
//
// Every fetcher returns a parsed value or throws. None of them mutate anything
// remote; each request is a GET or a read-only query.

import { fetchPortfolioAssignments } from "./portfolio-insights-airtable.mjs";
import {
  clarityBreakdowns,
  clarityFrustration,
  clarityTraffic,
  deriveTrafficShape,
  insightEventQuery,
  insightWindowClause,
  INSIGHT_DATASET,
  mergeDayGroups,
  rankDimension,
  summarizeClarity,
  summarizeDaily,
  summarizeEdgeDetail,
  summarizeInsightEvents,
  summarizePerformance,
  summarizePerformanceByDevice,
} from "./portfolio-insights-report.mjs";

export const CLOUDFLARE_ACCOUNT_TAG = "d459e1fdd68165fbc952d009070658d7";
const CLOUDFLARE_ZONE_TAG = "624bf95296a4ce1f2a927e5013537bc2";
const RUM_SITE_TAG = "bc27c8ff1dab471ea19546ac65ac42e2";
export const CLARITY_PROJECT = "yatoiqtrjm";
export const SITE_HOST = "bradleyberkman.com";
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
export const liveFetchers = Object.freeze({
  cloudflare: (token, range) => fetchCloudflare(token, range),
  clarity: (token, days) => fetchClarity(token, days),
  insightAggregates: (token, range) => fetchInsightAggregates(token, range),
  // Raw rows; the run decodes them with readInsightEventRows.
  insightEvents: (token, range) => analyticsEngineSql(token, insightEventQuery(range)),
  airtable: (token) => fetchPortfolioAssignments({ token }),
});
