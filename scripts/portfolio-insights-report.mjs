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
    snapshot: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--no-clarity") options.clarity = false;
    else if (argument === "--no-cloudflare") options.cloudflare = false;
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
export function clarityTraffic(metrics = {}) {
  const rows = metrics.Traffic ?? [];
  const totals = rows.reduce(
    (/** @type {{sessions: number, botSessions: number, users: number}} */ accumulator, row) => ({
      sessions: accumulator.sessions + Number(row.totalSessionCount ?? 0),
      botSessions: accumulator.botSessions + Number(row.totalBotSessionCount ?? 0),
      users: Math.max(
        accumulator.users,
        Number(row.distantUserCount ?? row.distinctUserCount ?? 0),
      ),
    }),
    { sessions: 0, botSessions: 0, users: 0 },
  );
  return { ...totals, humanSessions: Math.max(0, totals.sessions - totals.botSessions) };
}

/** One flat row per run, appended to history so retention windows stop mattering. */
export function historyRow(snapshot) {
  const shape = snapshot.cloudflare?.shape ?? {};
  const traffic = snapshot.clarity?.traffic ?? {};
  return {
    capturedAt: snapshot.capturedAt,
    windowStart: snapshot.window?.start ?? null,
    windowEnd: snapshot.window?.end ?? null,
    cloudflarePageloads: shape.pageloads ?? null,
    cloudflareVisits: shape.visits ?? null,
    cloudflareExternalVisits: shape.externalVisits ?? null,
    claritySessions: traffic.sessions ?? null,
    clarityHumanSessions: traffic.humanSessions ?? null,
    clarityBotSessions: traffic.botSessions ?? null,
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

export function formatReport(snapshot) {
  const lines = [];
  const { cloudflare, clarity, window: range } = snapshot;

  lines.push(
    "",
    `Portfolio insights · ${range.start.slice(0, 10)} → ${range.end.slice(0, 10)} (UTC)`,
    "",
  );

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
    }

    const perf = cloudflare.performance;
    if (perf?.samples) {
      lines.push(
        `  Web vitals (${perf.samples} samples)`,
        `    first contentful paint  p50 ${perf.firstContentfulPaint.p50}ms  ` +
          `p75 ${perf.firstContentfulPaint.p75}ms  p95 ${perf.firstContentfulPaint.p95}ms`,
        `    page load               p50 ${perf.pageLoadTime.p50}ms  ` +
          `p75 ${perf.pageLoadTime.p75}ms  p95 ${perf.pageLoadTime.p95}ms`,
        "",
      );
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
    const frustration = clarity.frustration ?? [];
    if (frustration.length > 0) {
      lines.push("  Clarity frustration signals");
      for (const row of frustration) lines.push(`    ${row.label.padEnd(22)} ${row.value}`);
      lines.push("");
    }
    lines.push(
      "  Reader time, evidence opens, Guide navigation and contact actions are",
      "  custom Clarity events. The export API has no dimension for them, so read",
      "  those in the Clarity dashboard.",
      "",
    );
  }

  return lines.join("\n");
}

/**
 * Pull the frustration metrics Clarity returns alongside Traffic, if present.
 *
 * @param {ClarityMetrics} metrics
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
    const entries = metrics[metricName];
    if (!Array.isArray(entries) || entries.length === 0) continue;
    const total = entries.reduce(
      (sum, entry) =>
        sum +
        Number(
          entry.sessionsCount ?? entry.subTotal ?? entry.count ?? entry.pagesViews ?? 0,
        ),
      0,
    );
    rows.push({ label, value: total });
  }
  return rows;
}
