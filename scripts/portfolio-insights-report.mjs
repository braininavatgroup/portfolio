// Shaping and formatting for `npm run insights`. Everything here is pure so the
// report's arithmetic — which is the part that is easy to get quietly wrong —
// is testable without a network call or a token.
//
// Two vocabularies meet in this file and they do not mean the same thing:
//
//   Cloudflare Web Analytics counts a *pageload beacon*. The portfolio is a
//   single-page app, so one human reading one page fires many beacons. A
//   *visit* is the subset of pageloads whose referrer is outside the site, so
//   visits, not pageloads, are the honest Cloudflare number.
//
//   Clarity counts a *session* of an eligible visitor who did not opt out, and
//   drops bot sessions into their own bucket. Its totals are not expected to
//   match Cloudflare's and the two are never added together.

/**
 * @typedef {{ date: string, pageloads: number, visits: number }} DailyRow
 * @typedef {{ value: string, pageloads: number, visits: number, share: number }} DimensionRow
 * @typedef {Record<string, Array<Record<string, string | number>>>} ClarityMetrics
 */

/** Navigation types Cloudflare reports for in-app route changes, not entries. */
const SOFT_NAVIGATION_TYPES = new Set([
  "routing-apis",
  "soft-navigation",
  "unknown",
]);

export function parseArguments(argv) {
  const options = {
    days: 7,
    json: false,
    clarity: true,
    cloudflare: true,
    insights: true,
    airtable: true,
    snapshot: true,
    history: false,
    dashboard: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--history") options.history = true;
    else if (argument === "--dashboard") options.dashboard = true;
    else if (argument === "--no-clarity") options.clarity = false;
    else if (argument === "--no-cloudflare") options.cloudflare = false;
    else if (argument === "--no-insights") options.insights = false;
    else if (argument === "--no-airtable") options.airtable = false;
    else if (argument === "--no-snapshot") options.snapshot = false;
    else if (argument === "--days") {
      const value = Number.parseInt(argv[(index += 1)] ?? "", 10);
      if (!Number.isFinite(value) || value < 1 || value > 30) {
        throw new Error("--days takes a whole number of days from 1 to 30.");
      }
      options.days = value;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

/** UTC calendar window, inclusive of both ends, ending on `now`'s day. */
export function windowForDays(days, now = new Date()) {
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function rumCount(group) {
  return Number(group?.count ?? 0);
}

function rumVisits(group) {
  return Number(group?.sum?.visits ?? 0);
}

/** @returns {DailyRow[]} */
export function summarizeDaily(groups = []) {
  return groups
    .map((group) => ({
      date: group?.dimensions?.date ?? "",
      pageloads: rumCount(group),
      visits: rumVisits(group),
    }))
    .filter((row) => row.date)
    .sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Rank one dimension by pageloads, carrying visits alongside. `share` is the
 * dimension's share of pageloads, which is the only total Cloudflare reports
 * for every row; visit share is left out because rows with zero visits would
 * make it meaningless.
 *
 * @returns {DimensionRow[]}
 */
export function rankDimension(groups = [], dimension, limit = 10) {
  const total = groups.reduce((sum, group) => sum + rumCount(group), 0);
  return groups
    .map((group) => ({
      value: String(group?.dimensions?.[dimension] ?? "").trim() || "(none)",
      pageloads: rumCount(group),
      visits: rumVisits(group),
      share: total > 0 ? rumCount(group) / total : 0,
    }))
    .sort((left, right) => right.pageloads - left.pageloads)
    .slice(0, limit);
}

/**
 * The launch question in one object: did anyone arrive from somewhere else?
 *
 * `externalVisits` deliberately excludes the site's own host and the empty
 * referrer host is kept, because a direct open — a pasted campaign link, a
 * QR code, a mail client that strips the referrer — is a real arrival.
 */
export function deriveTrafficShape(
  /** @type {{ daily?: DailyRow[], referrers?: DimensionRow[], navigation?: DimensionRow[], site?: string }} */
  { daily = [], referrers = [], navigation = [], site = "bradleyberkman.com" } = {},
) {
  const pageloads = daily.reduce((sum, row) => sum + row.pageloads, 0);
  const visits = daily.reduce((sum, row) => sum + row.visits, 0);
  const selfHosts = new Set([site, `www.${site}`]);

  const external = referrers.filter(
    (row) => row.value !== "(none)" && !selfHosts.has(row.value),
  );
  const selfReferred = referrers
    .filter((row) => selfHosts.has(row.value))
    .reduce((sum, row) => sum + row.pageloads, 0);
  const softNavigations = navigation
    .filter((row) => SOFT_NAVIGATION_TYPES.has(row.value))
    .reduce((sum, row) => sum + row.pageloads, 0);

  return {
    pageloads,
    visits,
    pageloadsPerVisit: visits > 0 ? pageloads / visits : 0,
    selfReferredShare: pageloads > 0 ? selfReferred / pageloads : 0,
    softNavigationShare: pageloads > 0 ? softNavigations / pageloads : 0,
    externalReferrers: external,
    externalVisits: external.reduce((sum, row) => sum + row.visits, 0),
  };
}

/** Cloudflare reports web-vitals timings in microseconds; humans read ms. */
export function microsecondsToMilliseconds(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value / 1000)
    : null;
}

/** Vitals for each device class, largest sample first. */
export function summarizePerformanceByDevice(groups = []) {
  return groups
    .filter((group) => group?.dimensions?.deviceType)
    .map((group) => ({ device: group.dimensions.deviceType, ...summarizePerformance(group) }))
    .sort((left, right) => right.samples - left.samples);
}

/**
 * The visits and sessions that are plausibly people who are not Bradley,
 * a reviewer, or a test run. Cloudflare RUM has no opt-out, so this is the
 * closest thing to a human count it can give; Clarity already drops the
 * enrolled browsers and buckets bots, so only localhost referrals remain.
 */
export function deriveBelievable(
  /** @type {{ shape?: { visits?: number } | null, dimensions?: Record<string, DimensionRow[]>, clarity?: { traffic?: { humanSessions?: number }, breakdowns?: { sources?: Array<{ value: string, sessions: number }> } } | null }} */
  { shape, dimensions = {}, clarity } = {},
) {
  const visitsWhere = (rows, predicate) =>
    (rows ?? []).filter(predicate).reduce((sum, row) => sum + row.visits, 0);
  const cloudflareVisits = shape?.visits ?? null;
  const cloudflareExcluded =
    visitsWhere(dimensions.requestPath, (row) => row.value.startsWith("/_portfolio-preview/")) +
    visitsWhere(dimensions.refererHost, (row) => /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/u.test(row.value)) +
    visitsWhere(dimensions.userAgentBrowser, (row) => /headless/iu.test(row.value));
  const claritySessions = clarity?.traffic?.humanSessions ?? null;
  const clarityExcluded = (clarity?.breakdowns?.sources ?? [])
    .filter((row) => /^(?:127\.0\.0\.1|localhost)\b/u.test(row.value))
    .reduce((sum, row) => sum + row.sessions, 0);
  return {
    cloudflareVisits:
      cloudflareVisits === null ? null : Math.max(0, cloudflareVisits - cloudflareExcluded),
    cloudflareExcluded,
    claritySessions:
      claritySessions === null ? null : Math.max(0, claritySessions - clarityExcluded),
    clarityExcluded,
  };
}

export function summarizePerformance(group) {
  const quantiles = group?.quantiles ?? {};
  return {
    samples: Number(group?.count ?? 0),
    firstContentfulPaint: {
      p50: microsecondsToMilliseconds(quantiles.firstContentfulPaintP50),
      p75: microsecondsToMilliseconds(quantiles.firstContentfulPaintP75),
      p95: microsecondsToMilliseconds(quantiles.firstContentfulPaintP95),
    },
    pageLoadTime: {
      p50: microsecondsToMilliseconds(quantiles.pageLoadTimeP50),
      p75: microsecondsToMilliseconds(quantiles.pageLoadTimeP75),
      p95: microsecondsToMilliseconds(quantiles.pageLoadTimeP95),
    },
  };
}

/**
 * Clarity answers with an array of `{ metricName, information: [...] }`, where
 * every row of `information` also repeats whichever dimensions were asked for.
 * Fold that into `{ metricName: rows }` and coerce the counts, which arrive as
 * strings often enough that summing them raw silently concatenates.
 *
 * @returns {ClarityMetrics}
 */
export function summarizeClarity(payloads = []) {
  const metrics = new Map();
  for (const payload of payloads) {
    if (!Array.isArray(payload)) continue;
    for (const entry of payload) {
      const name = entry?.metricName;
      if (!name || !Array.isArray(entry.information)) continue;
      const rows = metrics.get(name) ?? [];
      for (const row of entry.information) rows.push(coerceNumbers(row));
      metrics.set(name, rows);
    }
  }
  return Object.fromEntries(metrics);
}

function coerceNumbers(row) {
  const output = {};
  for (const [key, value] of Object.entries(row ?? {})) {
    const numeric =
      typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))
        ? Number(value)
        : value;
    output[key] = numeric;
  }
  return output;
}

/**
 * Clarity's Traffic metric carries the session counts. Sum across whatever
 * dimension split came back, then subtract bots so the headline is the human
 * number the dashboard leads with.
 *
 * @param {ClarityMetrics} metrics
 */
/**
 * Clarity's export returns, for every metric, one project-wide row plus one
 * row per value of each requested dimension. Dimension keys are capitalised
 * (`Url`, `Source`, `Channel`, `Device`, `Country/Region`…); the totals row has
 * none. Summing every row would count the project several times over.
 */
function isTotalRow(row) {
  return !Object.keys(row ?? {}).some((key) => /^[A-Z]/u.test(key));
}

function totalRow(metrics, metricName) {
  return (metrics[metricName] ?? []).find(isTotalRow) ?? null;
}

/** Rows of one metric that carry the given dimension key. */
function dimensionRows(metrics, metricName, dimension) {
  return (metrics[metricName] ?? []).filter((row) => row && dimension in row);
}

export function clarityTraffic(metrics = {}) {
  const total = totalRow(metrics, "Traffic") ?? {};
  const sessions = Number(total.totalSessionCount ?? 0);
  const botSessions = Number(total.totalBotSessionCount ?? 0);
  return {
    sessions,
    botSessions,
    users: Number(total.distinctUserCount ?? total.distantUserCount ?? 0),
    humanSessions: Math.max(0, sessions - botSessions),
  };
}

/**
 * Frustration signals from the project-wide row of each metric. `subTotal`
 * is the number of occurrences; `sessionsWithMetricPercentage` says how many
 * sessions had at least one. `sessionsCount` is the project's session total
 * and says nothing about the metric, so it is never used as a count here.
 */
export function clarityFrustration(metrics = {}) {
  const named = [
    ["Dead clicks", "DeadClickCount"],
    ["Rage clicks", "RageClickCount"],
    ["Excessive scroll", "ExcessiveScroll"],
    ["Quickback clicks", "QuickbackClick"],
    ["Script errors", "ScriptErrorCount"],
    ["Error clicks", "ErrorClickCount"],
  ];
  const rows = [];
  for (const [label, metricName] of named) {
    const total = totalRow(metrics, metricName);
    if (!total) continue;
    rows.push({
      label,
      value: Number(total.subTotal ?? total.count ?? 0),
      sessionShare: Number(total.sessionsWithMetricPercentage ?? 0) / 100,
    });
  }
  return rows;
}

/** Tracking parameters that make one page look like many URLs. */
const TRACKING_PARAMETERS = /^(?:utm_|fbclid$|gclid$|trk$|ref$|igsh$|mc_)/iu;

/**
 * Reduce a Clarity URL to the page it names: path, meaningful query, hash.
 * Campaign and click identifiers are dropped so the same page from ten
 * shares reads as one row.
 */
export function normalizeClarityUrl(value) {
  if (value === null || value === undefined || value === "") return "(none)";
  try {
    const url = new URL(String(value));
    const keep = [...url.searchParams.entries()].filter(([key]) => !TRACKING_PARAMETERS.test(key));
    const query = keep.length ? `?${new URLSearchParams(keep).toString()}` : "";
    return `${url.pathname}${query}${url.hash}`;
  } catch {
    return String(value);
  }
}

/** Sessions by source and channel, by page, and by device, from the Traffic rows. */
export function clarityBreakdowns(metrics = {}) {
  const sessionsOf = (row) => Number(row.totalSessionCount ?? 0);
  const tally = (rows, keyOf) => {
    const map = new Map();
    for (const row of rows) {
      const key = keyOf(row);
      map.set(key, (map.get(key) ?? 0) + sessionsOf(row));
    }
    return [...map.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([value, sessions]) => ({ value, sessions }))
      .filter((row) => row.sessions > 0);
  };

  const engagement = totalRow(metrics, "EngagementTime") ?? {};
  const scroll = totalRow(metrics, "ScrollDepth") ?? {};
  return {
    sources: tally(dimensionRows(metrics, "Traffic", "Source"), (row) => {
      const source = String(row.Source ?? "").trim() || "(no referrer)";
      return `${source}  ·  ${row.Channel ?? "?"}`;
    }),
    pages: tally(dimensionRows(metrics, "Traffic", "Url"), (row) => normalizeClarityUrl(row.Url)),
    devices: tally(dimensionRows(metrics, "Traffic", "Device"), (row) => String(row.Device ?? "?")),
    engagement: {
      totalSeconds: Number(engagement.totalTime ?? 0),
      activeSeconds: Number(engagement.activeTime ?? 0),
    },
    averageScrollDepth: Number(scroll.averageScrollDepth ?? 0),
  };
}

/** One flat row per run, appended to history so retention windows stop mattering. */
export function historyRow(snapshot) {
  const shape = snapshot.cloudflare?.shape ?? {};
  const edge = snapshot.cloudflare?.edge ?? {};
  const detail = edge.detail?.error ? {} : (edge.detail ?? {});
  const traffic = snapshot.clarity?.traffic ?? {};
  return {
    capturedAt: snapshot.capturedAt,
    windowStart: snapshot.window?.start ?? null,
    windowEnd: snapshot.window?.end ?? null,
    cloudflarePageloads: shape.pageloads ?? null,
    cloudflareVisits: shape.visits ?? null,
    cloudflareExternalVisits: shape.externalVisits ?? null,
    believableVisits: snapshot.believable?.cloudflareVisits ?? null,
    believableSessions: snapshot.believable?.claritySessions ?? null,
    edgeRequests: edge.daily?.reduce((sum, row) => sum + row.requests, 0) ?? null,
    edgeCrawlerRequests: detail.crawlerRequests ?? null,
    edgeProbeRequests: detail.probeRequests ?? null,
    edgeServerErrors: detail.serverErrors ?? null,
    claritySessions: traffic.sessions ?? null,
    clarityHumanSessions: traffic.humanSessions ?? null,
    clarityBotSessions: traffic.botSessions ?? null,
    ...insightHistoryColumns(snapshot.insights),
  };
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

/** @param {DimensionRow[]} rows */
function table(rows, { label, limit = 8 }) {
  if (rows.length === 0) return [`  ${label}: no rows`];
  const width = Math.max(...rows.slice(0, limit).map((row) => row.value.length));
  return [
    `  ${label}`,
    ...rows.slice(0, limit).map((row) =>
      `    ${row.value.padEnd(width)}  ${String(row.pageloads).padStart(6)} loads  ` +
      `${String(row.visits).padStart(5)} visits  ${percent(row.share).padStart(6)}`,
    ),
  ];
}

// ── Lead: the dashboard's findings, first ───────────────────────────────────

const LEAD_SOURCES = [
  ["insights", "Analytics Engine events"],
  ["airtable", "Airtable assignments"],
  ["clarity", "Clarity"],
  ["cloudflare", "Cloudflare Web Analytics"],
];

/** @param {unknown} value @returns {string | null} "YYYY-MM-DD HH:MM UTC" */
function leadStamp(value) {
  if (typeof value !== "string" || value === "") return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : `${time.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** @param {{ status: string, capturedAt: string | null, error?: string }} state */
function leadFreshness(state) {
  if (state.status === "fresh") return `fresh · captured ${leadStamp(state.capturedAt) ?? "at an unknown time"}`;
  if (state.status === "stale") {
    const reason = state.error ? ` · latest attempt failed: ${state.error}` : "";
    return `stale · last good ${leadStamp(state.capturedAt) ?? "at an unknown time"}${reason}`;
  }
  return `unavailable · ${state.error ?? "no data collected"}`;
}

/**
 * What the dashboard's "What changed" section says, for the terminal: each
 * source's freshness, configuration errors, the row-cap warning, then the
 * findings with their count, denominator, and windows.
 *
 * @param {Record<string, any>} snapshot
 * @param {{ configurationErrors?: string[] }} [extra]
 */
export function formatLead(snapshot, { configurationErrors = [] } = {}) {
  const range = snapshot.window ?? {};
  const sources = snapshot.sources ?? {};
  const lines = [
    "",
    `Portfolio findings · ${String(range.start ?? "").slice(0, 10)} → ${String(range.end ?? "").slice(0, 10)} (UTC)`,
    "",
    "  Sources",
  ];
  for (const [name, label] of LEAD_SOURCES) {
    if (sources[name]) lines.push(`    ${label.padEnd(26)}${leadFreshness(sources[name])}`);
  }
  lines.push("");

  if (configurationErrors.length > 0) {
    lines.push(
      "  Configuration error: affected links stay unattributed",
      ...configurationErrors.map((problem) => `    ${problem}`),
      "    Fix the campaign code on the Airtable Action. The report never guesses which link owns an ambiguous code.",
      "",
    );
  }
  if (sources.insights?.value?.raw?.truncated) {
    lines.push(
      `  Event data is truncated: Analytics Engine returned its ${INSIGHT_EVENT_LIMIT.toLocaleString("en-US")}-row cap`,
      "  for this window, so journeys and content measures cover only the earliest events.",
      "",
    );
  }

  lines.push("  What changed");
  const intelligence = snapshot.intelligence;
  const findings = Array.isArray(intelligence?.findings) ? intelligence.findings : [];
  if (!intelligence) {
    lines.push(
      sources.insights?.status === "unavailable"
        ? `    No findings: they need Analytics Engine journey data, which is unavailable (${sources.insights.error ?? "no data collected"}).`
        : "    No findings: this snapshot predates journey reporting.",
    );
  } else if (findings.length === 0) {
    lines.push("    Nothing needs a decision in this window.");
  } else {
    const count = (value) => Number(value ?? 0).toLocaleString("en-US");
    for (const finding of findings) {
      lines.push(
        `    - ${finding.message}`,
        `      ${count(finding.count)} of ${count(finding.denominator)} · ${finding.currentWindow} compared with ${finding.comparisonWindow}`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function formatReport(snapshot) {
  const lines = [];
  const { cloudflare, clarity, window: range } = snapshot;

  lines.push(
    "",
    `Portfolio insights · ${range.start.slice(0, 10)} → ${range.end.slice(0, 10)} (UTC)`,
    "",
  );

  const believable = snapshot.believable;
  if (believable && (believable.cloudflareVisits !== null || believable.claritySessions !== null)) {
    lines.push("  Believable humans (Bradley's devices, reviewers, localhost and headless runs removed)");
    if (believable.claritySessions !== null) {
      lines.push(
        `    Clarity sessions     ${String(believable.claritySessions).padStart(5)}` +
          `  (last ${clarity?.days ?? 3} days; ${believable.clarityExcluded} excluded)`,
      );
    }
    if (believable.cloudflareVisits !== null) {
      lines.push(
        `    Cloudflare visits    ${String(believable.cloudflareVisits).padStart(5)}` +
          `  (whole window; ${believable.cloudflareExcluded} excluded; undercounts, see runbook)`,
      );
    }
    lines.push("");
  }

  if (cloudflare?.error) {
    lines.push(`  Cloudflare: ${cloudflare.error}`, "");
  } else if (cloudflare) {
    const shape = cloudflare.shape;
    lines.push(
      "  Cloudflare Web Analytics",
      `    visits            ${shape.visits}`,
      `    external visits   ${shape.externalVisits}  (arrivals from another site)`,
      `    pageload beacons  ${shape.pageloads}  ` +
        `(${shape.pageloadsPerVisit.toFixed(1)} per visit; ` +
        `${percent(shape.softNavigationShare)} in-app route changes)`,
      "",
    );
    lines.push(...formatDailyTrend(cloudflare.daily, cloudflare.edge?.daily));
    if (shape.externalReferrers.length === 0) {
      lines.push(
        "    No external referrers in this window: nothing has linked in yet,",
        "    or a wide window sampled the few that did away. Re-check at --days 7.",
        "",
      );
    } else {
      lines.push(...table(shape.externalReferrers, { label: "external referrers" }), "");
    }
    for (const [label, key] of [
      ["pages", "requestPath"],
      ["countries", "countryName"],
      ["devices", "deviceType"],
      ["browsers", "userAgentBrowser"],
    ]) {
      lines.push(...table(cloudflare.dimensions?.[key] ?? [], { label }), "");
    }
    if (cloudflare.edge?.error) {
      lines.push(
        "  Edge requests: unavailable.",
        `    ${cloudflare.edge.error}`,
        "    Crawler and bot traffic needs a token with Zone Analytics Read.",
        "",
      );
    } else if (cloudflare.edge?.daily?.length) {
      const edge = cloudflare.edge.daily;
      const requests = edge.reduce((sum, row) => sum + row.requests, 0);
      const cached = edge.reduce((sum, row) => sum + row.cachedRequests, 0);
      const uniques = edge.reduce((sum, row) => sum + row.uniques, 0);
      lines.push(
        "  Edge requests (every client, including crawlers that run no JavaScript)",
        `    requests   ${requests}`,
        `    cached     ${percent(requests > 0 ? cached / requests : 0)}`,
        `    unique IPs ${uniques}`,
        "",
      );
      lines.push(...formatEdgeDetail(cloudflare.edge.detail));
    }

    const perf = cloudflare.performance;
    if (perf?.samples) {
      lines.push(
        `  Web vitals (${perf.samples} samples)`,
        `    first contentful paint  p50 ${perf.firstContentfulPaint.p50}ms  ` +
          `p75 ${perf.firstContentfulPaint.p75}ms  p95 ${perf.firstContentfulPaint.p95}ms`,
        `    page load               p50 ${perf.pageLoadTime.p50}ms  ` +
          `p75 ${perf.pageLoadTime.p75}ms  p95 ${perf.pageLoadTime.p95}ms`,
      );
      for (const row of cloudflare.performanceByDevice ?? []) {
        lines.push(
          `    ${row.device.padEnd(10)} (${String(row.samples).padStart(4)})  ` +
            `FCP p75 ${String(row.firstContentfulPaint.p75).padStart(5)}ms  ` +
            `load p75 ${String(row.pageLoadTime.p75).padStart(5)}ms  ` +
            `p95 ${String(row.pageLoadTime.p95).padStart(5)}ms`,
        );
      }
      lines.push("");
    }
  }

  if (clarity?.error) {
    lines.push(`  Clarity: ${clarity.error}`, "");
  } else if (clarity) {
    const traffic = clarity.traffic;
    lines.push(
      `  Clarity · last ${clarity.days} day(s), the most the export API returns`,
      `    sessions        ${traffic.sessions}`,
      `    human sessions  ${traffic.humanSessions}`,
      `    bot sessions    ${traffic.botSessions}`,
      "",
    );
    const breakdowns = clarity.breakdowns;
    if (breakdowns) {
      const sessionTable = (rows, label, limit = 10) => {
        if (rows.length === 0) return [];
        const width = Math.min(60, Math.max(...rows.slice(0, limit).map((row) => row.value.length)));
        return [
          `  Clarity ${label}`,
          ...rows.slice(0, limit).map(
            (row) =>
              `    ${row.value.slice(0, width).padEnd(width)}  ${String(row.sessions).padStart(5)} sessions`,
          ),
          "",
        ];
      };
      lines.push(
        ...sessionTable(breakdowns.sources, "sources (session entry)"),
        ...sessionTable(breakdowns.pages, "pages (tracking parameters stripped)", 12),
        ...sessionTable(breakdowns.devices, "devices"),
        "  Clarity engagement",
        `    time per session  ${breakdowns.engagement.totalSeconds}s total, ` +
          `${breakdowns.engagement.activeSeconds}s active`,
        `    scroll depth      ${breakdowns.averageScrollDepth}% average`,
        "",
      );
    }
    const frustration = clarity.frustration ?? [];
    if (frustration.length > 0) {
      lines.push("  Clarity frustration signals (count, share of sessions)");
      for (const row of frustration) {
        lines.push(
          `    ${row.label.padEnd(22)} ${String(row.value).padStart(5)}  ` +
            `${percent(row.sessionShare ?? 0).padStart(6)}`,
        );
      }
      lines.push("");
    }
    lines.push(
      "  Reader time, evidence opens, Guide navigation and contact actions are",
      "  custom Clarity events. The export API has no dimension for them, so read",
      "  those in the Clarity dashboard.",
      "",
    );
  }

  lines.push(...formatInsightEvents(snapshot.insights));

  return lines.join("\n");
}


// ── Edge request detail ──────────────────────────────────────────────────────
//
// Cloudflare's free plan answers `httpRequestsAdaptiveGroups` one UTC day at a
// time, so the script fetches each day separately and hands the rows here to
// be merged. Everything below is pure so the classification — which decides
// whether a request reads as a crawler, a scanner, or a person — is testable.

/** Recognised crawlers, most specific first. The label is what the report shows. */
const CRAWLER_SIGNATURES = [
  ["GPTBot", "GPTBot (OpenAI)"],
  ["OAI-SearchBot", "OAI-SearchBot (OpenAI)"],
  ["ChatGPT-User", "ChatGPT-User (OpenAI)"],
  ["ClaudeBot", "ClaudeBot (Anthropic)"],
  ["Claude-User", "Claude-User (Anthropic)"],
  ["Claude-SearchBot", "Claude-SearchBot (Anthropic)"],
  ["anthropic-ai", "anthropic-ai"],
  ["PerplexityBot", "PerplexityBot"],
  ["Perplexity-User", "Perplexity-User"],
  ["Google-Extended", "Google-Extended"],
  ["Googlebot", "Googlebot"],
  ["GoogleOther", "GoogleOther"],
  ["bingbot", "Bingbot"],
  ["Applebot", "Applebot"],
  ["Amazonbot", "Amazonbot"],
  ["Bytespider", "Bytespider (ByteDance)"],
  ["CCBot", "CCBot (Common Crawl)"],
  ["meta-externalagent", "Meta external agent"],
  ["facebookexternalhit", "Facebook link preview"],
  ["LinkedInBot", "LinkedIn link preview"],
  ["Twitterbot", "Twitter link preview"],
  ["Slackbot", "Slack link preview"],
  ["Discordbot", "Discord link preview"],
  ["DuckDuckBot", "DuckDuckBot"],
  ["YandexBot", "YandexBot"],
  ["Baiduspider", "Baiduspider"],
  ["AhrefsBot", "AhrefsBot"],
  ["SemrushBot", "SemrushBot"],
  ["MJ12bot", "MJ12bot (Majestic)"],
  ["DotBot", "DotBot (Moz)"],
  ["PetalBot", "PetalBot"],
];

/** Automation that is neither a named crawler nor a browser someone is using. */
const AUTOMATION_SIGNATURES = [
  [/HeadlessChrome/iu, "Headless Chrome"],
  [/Go-http-client/iu, "Go-http-client"],
  [/python-requests|python-urllib|aiohttp/iu, "Python HTTP"],
  [/^curl\//iu, "curl"],
  [/^wget\//iu, "wget"],
  [/okhttp/iu, "okhttp"],
  [/node-fetch|undici|axios/iu, "Node HTTP"],
  [/Scrapy/iu, "Scrapy"],
];

/**
 * Paths nobody types into a portfolio: WordPress, PHP, dotfiles, admin panels.
 * A request here is a vulnerability scanner regardless of its user agent.
 */
const PROBE_PATH_PATTERN =
  /^\/\/|\/wp-|wlwmanifest|\.php(?:$|\?)|\/\.env|\/\.git|phpmyadmin|\/xmlrpc|\/cgi-bin|\/vendor\/|\.aspx?(?:$|\?)|\/\.well-known\/(?!security)|\/actuator|\/console(?:$|\/)|\/manager\/html|\/owa\//iu;

/**
 * @param {string} userAgent
 * @returns {{ kind: "crawler" | "automation" | "browser", label: string }}
 */
export function classifyUserAgent(userAgent) {
  const value = String(userAgent ?? "");
  for (const [needle, label] of CRAWLER_SIGNATURES) {
    if (value.toLowerCase().includes(needle.toLowerCase())) {
      return { kind: "crawler", label };
    }
  }
  // A user agent that is itself a URL or a path is a scanner announcing itself.
  if (/^https?:\/\//iu.test(value) || value.startsWith("/")) {
    return { kind: "automation", label: "URL-shaped user agent" };
  }
  const generic = value.match(/([A-Za-z0-9_.-]+(?:bot|crawler|spider))\b/iu);
  if (generic) return { kind: "crawler", label: generic[1] };
  for (const [pattern, label] of AUTOMATION_SIGNATURES) {
    if (pattern.test(value)) return { kind: "automation", label };
  }
  if (value.trim() === "") return { kind: "automation", label: "empty user agent" };
  return { kind: "browser", label: "browser" };
}

/** @param {string} path */
export function isProbePath(path) {
  return PROBE_PATH_PATTERN.test(String(path ?? ""));
}

/**
 * Merge rows from one dimension across several day-sized queries.
 * @param {Array<Array<{ count: number | string, dimensions: Record<string, string | number> }> | undefined>} days
 * @param {string} dimension
 * @returns {Map<string, number>}
 */
export function mergeDayGroups(days, dimension) {
  const totals = new Map();
  for (const rows of days) {
    for (const row of rows ?? []) {
      const key = String(row?.dimensions?.[dimension] ?? "");
      totals.set(key, (totals.get(key) ?? 0) + Number(row?.count ?? 0));
    }
  }
  return totals;
}

function ranked(map, limit) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([value, requests]) => ({ value, requests }));
}

/**
 * Turn merged edge dimensions into the crawler, scanner, and error picture.
 *
 * @param {{
 *   userAgents: Map<string, number>,
 *   paths: Map<string, number>,
 *   statuses: Map<string, number>,
 *   serverErrorPaths: Map<string, number>,
 * }} merged
 */
export function summarizeEdgeDetail(merged) {
  const crawlers = new Map();
  const automation = new Map();
  let crawlerRequests = 0;
  let automationRequests = 0;
  let browserRequests = 0;
  for (const [userAgent, count] of merged.userAgents) {
    const { kind, label } = classifyUserAgent(userAgent);
    if (kind === "crawler") {
      crawlers.set(label, (crawlers.get(label) ?? 0) + count);
      crawlerRequests += count;
    } else if (kind === "automation") {
      automation.set(label, (automation.get(label) ?? 0) + count);
      automationRequests += count;
    } else {
      browserRequests += count;
    }
  }

  let probeRequests = 0;
  const probePaths = new Map();
  for (const [path, count] of merged.paths) {
    if (!isProbePath(path)) continue;
    probeRequests += count;
    probePaths.set(path, count);
  }

  const statuses = [...merged.statuses.entries()]
    .map(([status, requests]) => ({ status: Number(status), requests }))
    .sort((left, right) => right.requests - left.requests);
  const statusRequests = statuses.reduce((sum, row) => sum + row.requests, 0);
  const classes = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  for (const row of statuses) {
    const bucket = `${Math.floor(row.status / 100)}xx`;
    if (bucket in classes) classes[bucket] += row.requests;
  }

  return {
    // The user agent split covers only the rows the query returned; a long
    // tail of rare agents beyond the per-day limit is not counted anywhere.
    classified: crawlerRequests + automationRequests + browserRequests,
    crawlerRequests,
    automationRequests,
    browserRequests,
    crawlers: ranked(crawlers, 15),
    automation: ranked(automation, 8),
    probeRequests,
    probePaths: ranked(probePaths, 6),
    statusRequests,
    statusClasses: classes,
    serverErrors: classes["5xx"],
    serverErrorPaths: ranked(merged.serverErrorPaths, 6),
  };
}

/** @param {Array<{ value: string, requests: number }>} rows */
function requestTable(rows, { label, indent = "    ", width = 34 }) {
  if (rows.length === 0) return [];
  return [
    `${indent}${label}`,
    ...rows.map(
      (row) =>
        `${indent}  ${row.value.slice(0, width).padEnd(width)}  ` +
        `${String(row.requests).padStart(6)} requests`,
    ),
  ];
}

/** Lines for the crawler / scanner / status section of the report. */
export function formatEdgeDetail(detail) {
  if (!detail) return [];
  if (detail.error) {
    return [`  Crawlers and scanners: unavailable.`, `    ${detail.error}`, ""];
  }
  const lines = [];
  const pct = (part) =>
    percent(detail.classified > 0 ? part / detail.classified : 0).padStart(6);
  lines.push(
    "  Crawlers and scanners (edge requests by user agent)",
    `    browsers     ${String(detail.browserRequests).padStart(6)}  ${pct(detail.browserRequests)}`,
    `    crawlers     ${String(detail.crawlerRequests).padStart(6)}  ${pct(detail.crawlerRequests)}`,
    `    automation   ${String(detail.automationRequests).padStart(6)}  ${pct(detail.automationRequests)}  (headless, scripts, URL-shaped agents)`,
  );
  lines.push(...requestTable(detail.crawlers, { label: "named crawlers" }));
  lines.push(...requestTable(detail.automation, { label: "automation" }));
  if (detail.probeRequests > 0) {
    lines.push(
      `    vulnerability probes  ${detail.probeRequests} requests to paths this site has never had`,
      ...requestTable(detail.probePaths, { label: "probed paths", width: 44 }),
    );
  } else {
    lines.push("    vulnerability probes  none");
  }
  lines.push(
    "    A crawler request proves access to a URL, not that any answer cited it.",
    "",
  );

  const c = detail.statusClasses;
  lines.push(
    "  Edge response status",
    `    2xx ${String(c["2xx"]).padStart(6)}   3xx ${String(c["3xx"]).padStart(6)}   ` +
      `4xx ${String(c["4xx"]).padStart(6)}   5xx ${String(c["5xx"]).padStart(6)}`,
  );
  if (detail.serverErrors > 0) {
    lines.push(
      ...requestTable(detail.serverErrorPaths, { label: "server errors (5xx) by path", width: 44 }),
      "    Read the Workers Logs for these in the Cloudflare dashboard.",
    );
  }
  lines.push("");
  return lines;
}

// ── Trend and history ────────────────────────────────────────────────────────

/** Day-by-day pageloads, visits, and edge requests for the window. */
export function formatDailyTrend(daily = [], edgeDaily = []) {
  if (!daily?.length) return [];
  const edgeByDate = new Map((edgeDaily ?? []).map((row) => [row.date, row.requests]));
  const lines = ["  daily trend                loads  visits  edge requests"];
  for (const row of daily) {
    const edge = edgeByDate.get(row.date);
    lines.push(
      `    ${row.date}             ${String(row.pageloads).padStart(6)}  ` +
        `${String(row.visits).padStart(6)}  ${edge === undefined ? "     -" : String(edge).padStart(6)}`,
    );
  }
  lines.push("");
  return lines;
}

/**
 * One line per past run from history.jsonl, oldest first. Each row is what a
 * run saw over its own window, so overlapping windows are expected; the
 * useful read is the direction of the believable columns over time.
 */
export function formatHistory(rows = []) {
  const parsed = rows.filter((row) => row && row.capturedAt).sort((a, b) =>
    String(a.capturedAt).localeCompare(String(b.capturedAt)),
  );
  if (parsed.length === 0) {
    return ["", "  No history yet. Every `npm run insights` run appends one row.", ""];
  }
  const cell = (value, width = 7) => String(value ?? "-").padStart(width);
  const lines = [
    "",
    "Portfolio insights history (one row per run; each covers its own window)",
    "",
    "  captured           window  visits  believ  ext   clarity  believ  edge     crawl  probe  5xx",
  ];
  for (const row of parsed) {
    const days =
      row.windowStart && row.windowEnd
        ? Math.round((new Date(row.windowEnd) - new Date(row.windowStart)) / 86_400_000)
        : null;
    lines.push(
      `  ${String(row.capturedAt).slice(0, 16).replace("T", " ")}  ` +
        `${cell(days === null ? "-" : `${days}d`, 6)}${cell(row.cloudflareVisits)}` +
        `${cell(row.believableVisits)}${cell(row.cloudflareExternalVisits, 5)}` +
        `${cell(row.clarityHumanSessions, 9)}${cell(row.believableSessions)}` +
        `${cell(row.edgeRequests, 8)}${cell(row.edgeCrawlerRequests, 6)}` +
        `${cell(row.edgeProbeRequests, 6)}${cell(row.edgeServerErrors, 5)}`,
    );
  }
  lines.push("");
  return lines;
}

// ── First-party portfolio signals ────────────────────────────────────────────
//
// The worker's own insight sink writes one Analytics Engine row per
// `portfolio_*` event, which is how Reader attention, evidence opens, Guide
// navigation, contact actions and campaign codes become readable here at all;
// Clarity's export API has no dimension for any of them. The SQL lives in
// `portfolio-insights.mjs`; the rows it returns are shaped and printed below.
// The blob layout is documented in `lib/server/portfolio-insight-sink.ts`.

function count(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * @param {{
 *   actions?: Array<{ action: string, events: number | string }>,
 *   contacts?: Array<{ kind: string, events: number | string }>,
 *   attention?: Array<Record<string, number | string>>,
 *   campaigns?: Array<{ campaign: string, events: number | string, entries: number | string }>,
 * }} answers
 */
export function summarizeInsightEvents({
  actions = [],
  contacts = [],
  attention = [],
  campaigns = [],
} = {}) {
  const actionRows = actions
    .map((row) => ({ action: String(row.action ?? ""), events: count(row.events) }))
    .filter((row) => row.action)
    .sort((left, right) => right.events - left.events);
  const eventsFor = (action) =>
    actionRows.find((row) => row.action === action)?.events ?? 0;
  const attentionRows = attention
    .map((row) => ({
      contentId: String(row.content_id ?? ""),
      contentKind: String(row.content_kind ?? ""),
      snapshots: count(row.snapshots),
      activeSecondsP50: Math.round(count(row.active_seconds_p50)),
      activeSecondsMax: Math.round(count(row.active_seconds_max)),
      completionP50: Math.round(count(row.completion_p50)),
      completionMax: Math.round(count(row.completion_max)),
    }))
    .filter((row) => row.contentId);
  return {
    events: actionRows.reduce((sum, row) => sum + row.events, 0),
    actions: actionRows,
    entries: eventsFor("entry"),
    contactActions: eventsFor("contact_action"),
    contacts: contacts
      .map((row) => ({ kind: String(row.kind ?? ""), events: count(row.events) }))
      .filter((row) => row.kind)
      .sort((left, right) => right.events - left.events),
    attentionSnapshots: attentionRows.reduce((sum, row) => sum + row.snapshots, 0),
    attention: attentionRows,
    campaigns: campaigns
      .map((row) => ({
        campaign: String(row.campaign ?? ""),
        events: count(row.events),
        entries: count(row.entries),
      }))
      .filter((row) => row.campaign)
      .sort((left, right) => right.entries - left.entries || right.events - left.events),
  };
}

// ── Event-level rows ─────────────────────────────────────────────────────────
//
// The aggregate answers above say how much happened; journeys need each event
// in order. One capped read returns every fixed column, oldest first, and the
// normalizer below decodes it into `InsightEvent`s.

export const INSIGHT_DATASET = "portfolio_insights";

/** The most rows one event-level read returns. A full page means the window held more. */
export const INSIGHT_EVENT_LIMIT = 10_000;

/** SQL string literal; the only values interpolated are ISO dates and names this file owns. */
function sqlString(value) {
  return `'${String(value).replace(/'/gu, "''")}'`;
}

/**
 * The escaped UTC window every Analytics Engine query filters on.
 * @param {{ start: string, end: string }} range
 */
export function insightWindowClause(range) {
  const start = range.start.slice(0, 19).replace("T", " ");
  const end = range.end.slice(0, 19).replace("T", " ");
  return `timestamp >= toDateTime(${sqlString(start)}) AND timestamp <= toDateTime(${sqlString(end)})`;
}

/** Fixed positions from `lib/server/portfolio-insight-sink.ts`, v1 and v2 alike. */
const INSIGHT_EVENT_COLUMNS = [
  ["blob1", "action"],
  ["blob2", "content_id"],
  ["blob3", "content_kind"],
  ["blob4", "campaign"],
  ["blob5", "contact_kind"],
  ["blob6", "source"],
  ["blob7", "target_id"],
  ["blob8", "target_kind"],
  ["blob9", "country"],
  ["blob10", "device"],
  ["blob11", "schema"],
  ["blob12", "session_id"],
  ["blob13", "region_code"],
  ["blob14", "city"],
  ["blob15", "metro_code"],
  ["double1", "active_seconds"],
  ["double2", "completion_percent"],
];

/**
 * Every event in the window, oldest first, capped at `INSIGHT_EVENT_LIMIT`.
 * @param {{ start: string, end: string }} range
 */
export function insightEventQuery(range) {
  const columns = INSIGHT_EVENT_COLUMNS.map(([column, alias]) => `${column} AS ${alias}`);
  return `
      SELECT timestamp,
        ${columns.join(",\n        ")}
      FROM ${INSIGHT_DATASET}
      WHERE ${insightWindowClause(range)}
      ORDER BY timestamp ASC
      LIMIT ${INSIGHT_EVENT_LIMIT} FORMAT JSON`;
}

/**
 * @typedef {{
 *   timestamp: string, action: string, contentId: string, contentKind: string,
 *   campaign: string, contactKind: string, source: string, targetId: string,
 *   targetKind: string, country: string, device: string, schema: "v1" | "v2",
 *   sessionId: string, regionCode: string, city: string, metroCode: string,
 *   activeSeconds: number, completionPercent: number,
 * }} InsightEvent
 */

const EVENT_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z?$/u;

/** Analytics Engine answers `YYYY-MM-DD hh:mm:ss[.fff]` in UTC; return ISO or null. */
function eventTimestamp(value) {
  const match = EVENT_TIMESTAMP_PATTERN.exec(String(value ?? "").trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction = "0"] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(fraction.padEnd(3, "0").slice(0, 3)),
    ),
  );
  // Date.UTC rolls an impossible date forward; reject it instead.
  const exact =
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day) &&
    date.getUTCHours() === Number(hour) &&
    date.getUTCMinutes() === Number(minute) &&
    date.getUTCSeconds() === Number(second);
  return exact ? date.toISOString() : null;
}

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

/** The sink's own bound: finite and not negative, otherwise zero. */
function nonNegative(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

/**
 * Decode event-level rows. Rows without a valid timestamp, an action, or a
 * known schema are dropped. v1 rows predate the journey columns, so their
 * blobs 12 to 15 are read as empty whatever they hold. The result is sorted
 * by timestamp; the sort is stable, so ties keep the order the query returned.
 *
 * @param {Array<Record<string, unknown> | null | undefined> | null | undefined} rows
 * @returns {InsightEvent[]}
 */
export function normalizeInsightEvents(rows = []) {
  /** @type {InsightEvent[]} */
  const events = [];
  for (const row of rows ?? []) {
    if (!row || typeof row !== "object") continue;
    // Any other schema value names a layout whose columns this reader cannot
    // know, so the row is dropped rather than decoded by guesswork.
    const schema = text(row.schema);
    if (schema !== "v1" && schema !== "v2") continue;
    const timestamp = eventTimestamp(row.timestamp);
    const action = text(row.action);
    if (!timestamp || !action) continue;
    const journey = schema === "v2";
    events.push({
      timestamp,
      action,
      contentId: text(row.content_id),
      contentKind: text(row.content_kind),
      campaign: text(row.campaign),
      contactKind: text(row.contact_kind),
      source: text(row.source),
      targetId: text(row.target_id),
      targetKind: text(row.target_kind),
      country: text(row.country),
      device: text(row.device),
      schema,
      sessionId: journey ? text(row.session_id) : "",
      regionCode: journey ? text(row.region_code) : "",
      city: journey ? text(row.city) : "",
      metroCode: journey ? text(row.metro_code) : "",
      activeSeconds: nonNegative(row.active_seconds),
      completionPercent: Math.min(100, nonNegative(row.completion_percent)),
    });
  }
  return events.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

/**
 * The event-level answer as the snapshot carries it. `truncated` counts rows
 * returned, not rows kept, so rows the normalizer drops cannot hide the cap.
 *
 * @param {unknown} rows
 * @returns {{ events: InsightEvent[], truncated: boolean }}
 */
export function readInsightEventRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    events: normalizeInsightEvents(list),
    truncated: list.length === INSIGHT_EVENT_LIMIT,
  };
}

function insightHistoryColumns(insights) {
  const ready = insights && !insights.error ? insights : null;
  return {
    insightEvents: ready?.events ?? null,
    insightEntries: ready?.entries ?? null,
    insightContactActions: ready?.contactActions ?? null,
    insightAttentionSnapshots: ready?.attentionSnapshots ?? null,
    insightCampaignEntries: ready
      ? ready.campaigns.reduce((sum, row) => sum + row.entries, 0)
      : null,
  };
}

/** Lines for the first-party section of the report. */
export function formatInsightEvents(insights) {
  if (!insights) return [];
  if (insights.error) {
    return [
      "  Portfolio signals (first-party): unavailable.",
      `    ${insights.error}`,
      "    Reading the sink needs a token with Account Analytics Read, and a",
      "    deployment with PORTFOLIO_INSIGHT_EVENTS_SINK set to analytics-engine.",
      "",
    ];
  }
  if (insights.events === 0) {
    return [
      "  Portfolio signals (first-party): no events in this window.",
      "    The sink stays dormant until PORTFOLIO_INSIGHT_EVENTS_SINK is",
      "    analytics-engine in a deployed candidate. Until then these signals",
      "    are dashboard-only in Clarity.",
      "",
    ];
  }

  const lines = [
    "  Portfolio signals (first-party)",
    `    events   ${insights.events}`,
    `    entries  ${insights.entries}`,
  ];
  const width = Math.max(...insights.actions.map((row) => row.action.length));
  for (const row of insights.actions) {
    lines.push(`      ${row.action.padEnd(width)}  ${String(row.events).padStart(6)}`);
  }
  lines.push("");

  if (insights.contacts.length > 0) {
    lines.push(`  Contact actions  ${insights.contactActions}`);
    const kindWidth = Math.max(...insights.contacts.map((row) => row.kind.length));
    for (const row of insights.contacts) {
      lines.push(`    ${row.kind.padEnd(kindWidth)}  ${String(row.events).padStart(5)}`);
    }
    lines.push("");
  }

  if (insights.attention.length > 0) {
    const idWidth = Math.min(40, Math.max(...insights.attention.map((row) => row.contentId.length)));
    lines.push("  Reader attention by item (snapshots are running totals per open, so");
    lines.push("  p50 and max describe a read; they are not summed)");
    for (const row of insights.attention) {
      lines.push(
        `    ${row.contentId.slice(0, idWidth).padEnd(idWidth)}  ${row.contentKind.padEnd(6)}  ` +
          `${String(row.snapshots).padStart(4)} snapshots  ` +
          `p50 ${String(row.activeSecondsP50).padStart(4)}s  max ${String(row.activeSecondsMax).padStart(5)}s  ` +
          `read ${String(row.completionP50).padStart(3)}%  max ${String(row.completionMax).padStart(3)}%`,
      );
    }
    lines.push("");
  }

  if (insights.campaigns.length > 0) {
    lines.push("  Campaign codes (join to the private tracker; nothing here names anyone)");
    const codeWidth = Math.max(...insights.campaigns.map((row) => row.campaign.length));
    for (const row of insights.campaigns) {
      lines.push(
        `    ${row.campaign.padEnd(codeWidth)}  ${String(row.entries).padStart(4)} entries  ` +
          `${String(row.events).padStart(5)} events`,
      );
    }
    lines.push("");
  }

  if (insights.raw?.truncated) {
    lines.push(
      `  Event-level read hit the ${INSIGHT_EVENT_LIMIT}-row cap: journeys cover only the`,
      "  earliest events in the window. A shorter --days reads the rest.",
      "",
    );
  }

  lines.push(
    "  Rows are sampled at high volume; counts are sample-weighted sums.",
    "  Attention rows exclude sessions that opted out or never became eligible.",
    "",
  );
  return lines;
}
