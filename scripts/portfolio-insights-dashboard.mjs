// Renders the private portfolio decision dashboard as one self-contained HTML
// page: no scripts, no forms, no remote resources, no automatic requests.
// Its only network behaviour is an explicit click on an allowlisted Clarity
// or Airtable link. Pure functions so the layout can be tested without a
// browser; `renderDashboard` is the entry.
//
// Section order is a product contract: What changed, Assigned links, Content
// resonance, Journeys, Audience, Observe in Clarity, then collapsed
// Diagnostics (crawler counts and infrastructure totals). Assigned-link copy
// says "Activity from <name>'s assigned link" — a campaign code identifies an
// Airtable Action, not the person who opened the link.
//
// Information design, so the page can be read at a glance:
//
//   1. One freshness strip at the top carries every source's window and its
//      full state sentence. A section then carries a compact badge per source
//      and adds a reason line only for a source that is not fresh, so a
//      healthy run shows no grey text under its headings at all.
//   2. A decision strip leads with the counts that drive a decision, each with
//      its change against the previous run and a sparkline where the aggregate
//      history supports one.
//   3. The Clarity filter steps are printed once per page; each row repeats
//      only its own filter and value.
//   4. "not enough data for a pattern" is said at most once per section.
//   5. Charts are inline SVG with no scripts, so there is no hover or tooltip
//      channel: every value is direct-labelled or reachable in a table twin.
//
// Every interpolated string passes through `escapeHtml`; every href passes
// through `safeExternalLink`.

const PALETTE = {
  light: { series1: "#2a78d6", series2: "#eb6834", series3: "#1baf7a", good: "#006300", muted: "#898781" },
  dark: { series1: "#3987e5", series2: "#d95926", series3: "#199e70", good: "#0ca30c", muted: "#898781" },
};

export const CLARITY_PROJECT_URL = "https://clarity.microsoft.com/projects/view/yatoiqtrjm/";
export const AIRTABLE_BASE_URL = "https://airtable.com/app0LM9NfGL4ZHi3j/";
const LINK_PREFIXES = { clarity: CLARITY_PROJECT_URL, airtable: AIRTABLE_BASE_URL };

/** Findings, content comparisons, and pattern tables need at least this many sessions. */
const PATTERN_MINIMUM = 5;
const SMALL_SAMPLE = "not enough data for a pattern";
const ANONYMOUS_JOURNEY_LIMIT = 25;
/** A sparkline reads as a shape, not a series of points, past about a dozen runs. */
const SPARK_RUNS = 12;

const SOURCE_ORDER = ["insights", "airtable", "clarity", "cloudflare"];

const SOURCE_LABELS = {
  insights: "Analytics Engine events",
  airtable: "Airtable assignments",
  clarity: "Clarity",
  cloudflare: "Cloudflare Web Analytics",
};

/** The badge voice: short enough to sit beside a heading. */
const SOURCE_BADGE_LABELS = {
  insights: "Events",
  airtable: "Airtable",
  clarity: "Clarity",
  cloudflare: "Cloudflare",
};

const CONFIGURATION_ERROR = /duplicate campaign code|malformed campaign code|has a malformed \w+ link|expected at most one/iu;

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/gu, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}

const number = (value) =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? "–"
    : Number(value).toLocaleString("en-US");

/** "1 session", "2 sessions": a formatted count with its agreeing noun. */
const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${number(count)} ${Number(count) === 1 ? singular : pluralForm}`;

/** @param {unknown} value @returns {string | null} "YYYY-MM-DD HH:MM UTC" */
function stamp(value) {
  if (typeof value !== "string" || value === "") return null;
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return null;
  return `${time.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** @param {unknown} window */
function windowLabel(window) {
  const range = /** @type {{ start?: unknown; end?: unknown } | null} */ (window);
  if (typeof range?.start !== "string" || typeof range?.end !== "string") return null;
  return `${range.start.slice(0, 10)} → ${range.end.slice(0, 10)}`;
}

const list = (value) => (Array.isArray(value) ? value : []);

const finite = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/**
 * The href to print for an external link, or null. Only the configured
 * Clarity project and Airtable base are allowed, checked on the parsed URL so
 * credentials, ports, lookalike or percent-encoded hosts, and dot-segment
 * escapes out of the prefix all fail.
 * @param {string} url
 * @param {"clarity" | "airtable"} kind
 * @returns {string | null}
 */
export function safeExternalLink(url, kind) {
  const prefix = Object.hasOwn(LINK_PREFIXES, kind) ? LINK_PREFIXES[kind] : null;
  if (!prefix || typeof url !== "string") return null;
  // new URL silently strips tabs and newlines and treats "\" as "/"; refuse them.
  if (/[\s\\\p{Cc}]/u.test(url)) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const expected = new URL(prefix);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return null;
  if (parsed.origin !== expected.origin || !parsed.href.startsWith(prefix)) return null;
  return parsed.href;
}

/** An allowlisted anchor, or nothing when the URL is refused. */
function externalLink(url, kind, text) {
  const href = safeExternalLink(url, kind);
  return href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(text)}</a>`
    : "";
}

// ---------------------------------------------------------------- Clarity

/**
 * The filter steps, printed once per page. Clarity documents no URL that keeps
 * filters, so a row supplies only its own filter and value and the reader
 * applies these steps by hand. When a documented pre-filtered URL exists, this
 * block and `clarityFilterFor` are the two places to change.
 */
export const CLARITY_STEPS = Object.freeze([
  "Filters → Custom tags → pick the tag and value from the table below → Apply.",
  "For a network location instead: Filters → User info → Location → Country/Region → State → City → Apply.",
  "Heatmaps → pick the page URL → View Heatmap → Heatmaps types switcher → Click / Scroll / Attention. Set the device first.",
  "Recordings → keep the same filters to list the matching recordings.",
]);

/**
 * One row's filter and the value to type into it.
 * @param {{ kind: "campaign", code: string }
 *   | { kind: "content", contentId: string }
 *   | { kind: "location", country: string, regionCode: string, city: string }} target
 * @returns {{ filter: string, value: string }}
 */
export function clarityFilterFor(target) {
  if (target.kind === "campaign") {
    return { filter: "Custom tags → portfolio_campaign", value: target.code };
  }
  if (target.kind === "content") {
    return { filter: "Custom tags → portfolio_content_id", value: target.contentId };
  }
  return {
    filter: "User info → Location → Country/Region → State → City",
    value: `${target.country || "Unknown"} → ${target.regionCode || "any"} → ${target.city}`,
  };
}

/** The newest snapshot's traffic totals, each with a one-line meaning. */
export function headlineTiles(snapshot) {
  if (!snapshot) return [];
  const believable = snapshot.believable ?? {};
  const clarity = snapshot.clarity?.error ? null : snapshot.clarity;
  const edge = snapshot.cloudflare?.edge;
  const detail = edge?.detail?.error ? null : edge?.detail;
  const edgeRequests = edge?.daily?.reduce((sum, row) => sum + row.requests, 0) ?? null;
  const linkedin = (clarity?.breakdowns?.sources ?? [])
    .filter((row) => /linkedin/iu.test(row.value))
    .reduce((sum, row) => sum + row.sessions, 0);
  return [
    {
      label: "Believable sessions",
      value: believable.claritySessions,
      note: `Clarity, last ${plural(clarity?.days ?? 3, "day")}, localhost removed`,
    },
    {
      label: "Believable visits",
      value: believable.cloudflareVisits,
      note: "Cloudflare, whole window; undercounts by design",
    },
    { label: "From LinkedIn", value: clarity ? linkedin : null, note: "Clarity sessions" },
    { label: "Edge requests", value: edgeRequests, note: "everything, including crawlers" },
    { label: "Crawler requests", value: detail?.crawlerRequests ?? null, note: "named crawlers" },
    { label: "Server errors", value: detail?.serverErrors ?? null, note: "5xx at the edge" },
  ];
}

/**
 * History rows reduced to what the curve needs, oldest first, one per day.
 * @param {Array<Record<string, any>>} rows
 */
export function historySeries(rows = []) {
  const byDay = new Map();
  for (const row of rows) {
    if (!row?.capturedAt) continue;
    byDay.set(String(row.capturedAt).slice(0, 10), row); // the last run of a day wins
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, row]) => ({
      x: day,
      label: day.slice(5),
      believableSessions: row.believableSessions ?? null,
      believableVisits: row.believableVisits ?? null,
      edgeRequests: row.edgeRequests ?? null,
    }));
}

/**
 * The runs whose aggregate summary actually observed journeys, oldest first,
 * one per day. A run without journey data recorded zero sessions by
 * construction, not by observation, so it must not become a point on a trend.
 * @param {Array<Record<string, any>>} history
 * @returns {Array<{ day: string, summary: Record<string, any> }>}
 */
function historyRuns(history = []) {
  const byDay = new Map();
  for (const row of list(history)) {
    const summary = row?.intelligence;
    if (!summary || summary.version !== 1 || summary.journeys !== "available") continue;
    const day = String(row.capturedAt ?? "").slice(0, 10);
    if (day) byDay.set(day, summary); // the last run of a day wins
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, summary]) => ({ day, summary }));
}

/**
 * One content item's sessions per run, oldest first. A run that read journeys
 * and saw nothing for this item contributes an observed zero, which is a real
 * point on the curve; a run that never read journeys contributes no point.
 * @param {Array<Record<string, any>>} history
 * @param {string} contentId
 */
export function contentTrend(history = [], contentId) {
  return historyRuns(history).map(({ day, summary }) => ({
    day,
    sessions: Number(list(summary.content).find((row) => row?.contentId === contentId)?.sessions ?? 0),
  }));
}

/** Sum of a history summary's per-content session counts. */
const contentOpensOf = (summary) =>
  list(summary?.content).reduce((sum, row) => sum + (Number(row?.sessions) || 0), 0);

/**
 * The counts that drive a decision, each with the change against the previous
 * run where the aggregate history supports one. Assigned-link measures have no
 * trend on purpose: history keeps no campaign codes, so nothing about one link
 * survives a run.
 *
 * @param {{ intelligence: Record<string, any> | null, eventsKnown: boolean,
 *   history?: Array<Record<string, any>>, today?: string }} input
 */
export function decisionTiles({ intelligence, eventsKnown, history = [], today = "" }) {
  const links = list(intelligence?.assignedLinks);
  const active = links.filter((row) => list(row?.journeys).length > 0).length;
  const linkSessions = links.reduce((sum, row) => sum + list(row?.journeys).length, 0);
  const patterns = intelligence?.journeyPatterns;

  const runs = historyRuns(history);
  const earlier = runs.filter(({ day }) => day < String(today).slice(0, 10));
  const previous = earlier.length ? earlier[earlier.length - 1] : null;

  /** A measure with a live value, a comparison, and a curve. */
  const trended = (label, value, note, read) => {
    const series = runs.map(({ summary }) => read(summary));
    // An offline rebuild has no row for today; end the curve on the live value.
    if (value !== null && (runs.length === 0 || runs[runs.length - 1].day !== String(today).slice(0, 10))) {
      series.push(value);
    }
    const before = previous ? read(previous.summary) : null;
    return {
      label,
      value,
      note,
      delta: value !== null && before !== null ? value - before : null,
      comparedWith: previous?.day ?? null,
      series: series.slice(-SPARK_RUNS),
    };
  };

  const known = (value) => (eventsKnown ? value : null);
  return [
    {
      label: "Assigned links active",
      value: known(active),
      display: eventsKnown ? `${number(active)} of ${number(links.length)}` : null,
      note: "assigned links with activity in this window",
      delta: null,
      comparedWith: null,
      series: [],
    },
    {
      label: "Link sessions",
      value: known(linkSessions),
      note: "tab sessions on an assigned link",
      delta: null,
      comparedWith: null,
      series: [],
    },
    trended(
      "Content opens",
      known(intelligence ? contentOpensOf({ content: intelligence.content }) : null),
      "content items opened, counted once per tab session",
      contentOpensOf,
    ),
    trended(
      "Evidence opens",
      known(finite(patterns?.evidenceSessions)),
      "tab sessions that opened a piece of evidence",
      (summary) => finite(summary.evidenceSessions),
    ),
    trended(
      "Contact actions",
      known(finite(patterns?.contactSessions)),
      "tab sessions that reached a contact action",
      (summary) => finite(summary.contactSessions),
    ),
  ];
}

// ---------------------------------------------------------------- sources

/**
 * One source's state. Snapshots from before source-wise storage carry the
 * value at the top level with an optional `error`; those are read as fresh at
 * the snapshot's own time, or unavailable with their error.
 * @param {Record<string, any> | null} snapshot
 * @param {"clarity" | "cloudflare" | "insights" | "airtable"} name
 * @returns {{ status: "fresh" | "stale" | "unavailable"; capturedAt: string | null; value: any; error?: string }}
 */
function sourceState(snapshot, name) {
  if (!snapshot) return { status: "unavailable", capturedAt: null, value: null, error: "no snapshot yet" };
  const state = snapshot.sources?.[name];
  if (state && ["fresh", "stale", "unavailable"].includes(state.status)) {
    return {
      status: state.status,
      capturedAt: typeof state.capturedAt === "string" ? state.capturedAt : null,
      value: state.status === "unavailable" ? null : state.value,
      ...(state.error ? { error: String(state.error) } : {}),
    };
  }
  const legacy = snapshot[name];
  if (legacy === undefined || legacy === null) {
    return { status: "unavailable", capturedAt: null, value: null, error: "not collected in this run" };
  }
  if (legacy.error) return { status: "unavailable", capturedAt: null, value: null, error: String(legacy.error) };
  return { status: "fresh", capturedAt: snapshot.capturedAt ?? null, value: legacy };
}

/** A usable value: present, not an error object, not an unavailable source. */
function usable(state) {
  return state.status !== "unavailable" && state.value && !state.value.error ? state.value : null;
}

/** The full state sentence, for the freshness strip and the degraded sections. */
function freshness(state) {
  if (state.status === "fresh") return `Fresh — captured ${stamp(state.capturedAt) ?? "at an unknown time"}`;
  if (state.status === "stale") {
    const reason = state.error ? ` · latest attempt failed: ${state.error}` : "";
    return `Stale — last good data ${stamp(state.capturedAt) ?? "at an unknown time"}${reason}`;
  }
  return `Unavailable — ${state.error ?? "no data collected"}`;
}

/**
 * The short form that rides beside a heading: "Fresh 16:00", "Stale 09-10 07:10",
 * "Unavailable". The clock alone would be ambiguous for data captured on an
 * earlier day, so a stale snapshot from another day keeps its date.
 * @param {{ status: string, capturedAt: string | null }} state
 * @param {string} [now]
 */
export function sourceBadge(state, now = "") {
  if (state.status === "unavailable") return "Unavailable";
  const label = state.status === "fresh" ? "Fresh" : "Stale";
  const at = state.capturedAt ? new Date(state.capturedAt) : null;
  if (!at || Number.isNaN(at.getTime())) return `${label} — time unknown`;
  const iso = at.toISOString();
  const sameDay = String(now).slice(0, 10) === iso.slice(0, 10);
  return `${label} ${sameDay ? iso.slice(11, 16) : `${iso.slice(5, 10)} ${iso.slice(11, 16)}`}`;
}

function sourceWindow(name, state, snapshot) {
  if (name === "airtable") return "current link assignments";
  if (name === "clarity") return `last ${plural(usable(state)?.days ?? 3, "day")}`;
  return windowLabel(snapshot?.window) ?? "no window";
}

/** The one strip at the top: every source, its window, and its full state. */
function freshnessStrip(context) {
  const items = SOURCE_ORDER.map((name) => {
    const state = context.sources[name];
    return (
      `<li data-status="${state.status}">` +
      `<span class="badge" data-status="${state.status}">${escapeHtml(sourceBadge(state, context.generatedAt))}</span>` +
      `<span class="strip-name">${escapeHtml(SOURCE_LABELS[name])}</span>` +
      `<span class="strip-note">${escapeHtml(sourceWindow(name, state, context.snapshot))} · ${escapeHtml(freshness(state))}</span>` +
      `</li>`
    );
  }).join("");
  return `<ul class="freshness">${items}</ul>`;
}

/**
 * A section's sources: a badge each, and a reason line only for a source that
 * is not fresh. A healthy run therefore carries no grey text under a heading.
 */
function sectionSources(names, context) {
  const badges = names
    .map((name) => {
      const state = context.sources[name];
      return (
        `<span class="badge" data-status="${state.status}">` +
        `${escapeHtml(SOURCE_BADGE_LABELS[name])} · ${escapeHtml(sourceBadge(state, context.generatedAt))}</span>`
      );
    })
    .join("");
  const reasons = names
    .filter((name) => context.sources[name].status !== "fresh")
    .map(
      (name) =>
        `<p class="source-note">${escapeHtml(SOURCE_LABELS[name])} · ${escapeHtml(freshness(context.sources[name]))}</p>`,
    )
    .join("");
  return `<p class="badges">${badges}</p>${reasons}`;
}

function unavailableReason(state) {
  return state.error ?? "no data collected";
}

/**
 * Why an event-derived section has nothing to show. When intelligence exists
 * but insights has no usable value, an empty list would falsely claim an
 * empty window, so the section names the insights status and reason instead.
 */
function missingEvents(context, subject) {
  if (context.eventsKnown) return `${subject} unavailable — this snapshot predates journey reporting.`;
  const state = context.sources.insights;
  const status = state.status === "stale" ? "stale with no usable value" : "unavailable";
  return `Event data unavailable — Analytics Engine events are ${status} (${unavailableReason(state)}), so ${subject.toLowerCase()} cannot be shown.`;
}

// ---------------------------------------------------------------- helpers

function dataTable(columns, rows) {
  const head = columns.map((column, index) => `<th${index ? ' class="num"' : ""}>${escapeHtml(column)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cellValue, index) =>
              `<td${index ? ' class="num"' : ""}>${escapeHtml(typeof cellValue === "number" ? number(cellValue) : cellValue)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function empty(text) {
  return `<p class="empty">${escapeHtml(text)}</p>`;
}

function note(text) {
  return `<p class="note">${escapeHtml(text)}</p>`;
}

/**
 * "40% (2 of 5)": a session rate with its count and denominator. The count is
 * the reducer's own session count when it supplies one, not a rounded product.
 */
function rate(value, sessions, count) {
  if (!Number.isFinite(value) || !Number.isFinite(sessions) || sessions <= 0) return "–";
  const sessionsWith = Number.isFinite(count) ? count : Math.round(value * sessions);
  return `${Math.round(value * 100)}% (${number(sessionsWith)} of ${number(sessions)})`;
}

function share(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : "–";
}

function geoLabel(geo) {
  const parts = [geo?.city, geo?.regionCode, geo?.country].filter((part) => typeof part === "string" && part);
  return parts.length ? parts.join(", ") : "Unknown";
}

function eventText(event, labelFor) {
  const content = event.contentId ? labelFor(event.contentId) : "";
  switch (event.action) {
    case "entry":
      return `Entered${event.source ? ` from ${event.source}` : ""}${content ? ` at ${content}` : ""}`;
    case "content_open":
      return `Opened ${content || "unknown content"}`;
    case "content_attention":
      return `Attention on ${content || "unknown content"}: ${number(event.activeSeconds)}s active, ${number(event.completionPercent)}% complete`;
    case "evidence_open":
    case "guide_evidence":
      return `Opened evidence ${event.targetId || "item"}${event.targetKind ? ` (${event.targetKind})` : ""}${content ? ` from ${content}` : ""}`;
    case "contact_action":
      return `Contact action: ${event.contactKind || "unspecified"}`;
    default:
      return `${event.action || "event"}${content ? ` · ${content}` : ""}`;
  }
}

function journeyEvents(journey, labelFor) {
  const events = list(journey.events)
    .filter((event) => event && typeof event.timestamp === "string")
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (events.length === 0) return empty("No events recorded for this tab session.");
  return `<ol class="events">${events
    .map((event) => `<li><time>${escapeHtml(stamp(event.timestamp) ?? event.timestamp)}</time> ${escapeHtml(eventText(event, labelFor))}</li>`)
    .join("")}</ol>`;
}

function journeyHeading(journey, index) {
  const entered = stamp(journey.entryAt) ?? "unknown time";
  return `Tab session ${index + 1} · entered ${entered} · ${geoLabel(journey.geo)} · ${journey.device || "unknown device"}`;
}

function cell(label, value) {
  return `<span class="cell"><span class="cell-label">${escapeHtml(label)}</span><span class="cell-value">${escapeHtml(value)}</span></span>`;
}

function section(id, title, sourceNames, body, context) {
  return (
    `<section class="panel" id="${id}"><div class="panel-head"><h2>${escapeHtml(title)}</h2>` +
    `${sectionSources(sourceNames, context)}</div>${body}</section>`
  );
}

// ---------------------------------------------------------------- charts

/**
 * A trend mark: one line in the de-emphasis ink with the newest run in the
 * accent. There is no hover channel on this page, so the values ride in the
 * label and in the row the mark sits on.
 * @param {{ values: Array<number | null>, label: string, width?: number, height?: number }} input
 */
function svgSparkline({ values, label, width = 96, height = 28 }) {
  const points = list(values).filter((value) => Number.isFinite(value));
  if (points.length < 2) return "";
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const round = (value) => Math.round(value * 10) / 10;
  const x = (index) => round(6 + (index / (points.length - 1)) * (width - 12));
  const y = (value) => round(height - 6 - ((value - min) / span) * (height - 12));
  const d = points.map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`).join(" ");
  const lastIndex = points.length - 1;
  return (
    `<svg class="spark" viewBox="0 0 ${width} ${height}" style="min-width:${width}px" role="img" ` +
    `aria-label="${escapeHtml(`${label}: ${points.map((value) => number(value)).join(", ")}`)}">` +
    `<path class="spark-line" d="${d}"/>` +
    `<circle class="spark-end" cx="${x(lastIndex)}" cy="${y(points[lastIndex])}" r="4"/></svg>`
  );
}

function svgLine({ points, width = 720, height = 200, series, id }) {
  const pad = { top: 12, right: 16, bottom: 28, left: 44 };
  const xs = points.map((p) => p.x);
  const drawn = series.filter((s) => points.some((p) => finite(p[s.key]) !== null));
  const ys = drawn.flatMap((s) => points.map((p) => p[s.key]).filter((v) => v !== null && v !== undefined));
  const maxY = Math.max(1, ...ys);
  const x = (i) => pad.left + (xs.length === 1 ? 0 : (i / (xs.length - 1)) * (width - pad.left - pad.right));
  const y = (v) => pad.top + (1 - v / maxY) * (height - pad.top - pad.bottom);
  const ticks = [0, 0.5, 1].map((t) => Math.round(maxY * t));
  const grid = ticks
    .map(
      (t) =>
        `<line class="grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y(t)}" y2="${y(t)}"/>` +
        `<text class="tick" x="${pad.left - 6}" y="${y(t) + 4}" text-anchor="end">${number(t)}</text>`,
    )
    .join("");
  const paths = drawn
    .map((s) => {
      const d = points
        .map((p, i) => (p[s.key] === null || p[s.key] === undefined ? null : `${x(i)},${y(p[s.key])}`))
        .filter(Boolean)
        .map((c, i) => `${i === 0 ? "M" : "L"}${c}`)
        .join(" ");
      const last = [...points].reverse().find((p) => p[s.key] !== null && p[s.key] !== undefined);
      const lastIndex = points.lastIndexOf(last);
      // Label the newest point; hang it to the right while the curve is short
      // enough that "end" anchoring would run off the left edge.
      const hangRight = lastIndex < 2 || x(lastIndex) < width / 3;
      const label = last
        ? `<text class="direct" x="${x(lastIndex) + (hangRight ? 10 : -4)}" y="${Math.max(12, y(last[s.key]) - 8)}" text-anchor="${hangRight ? "start" : "end"}">${escapeHtml(s.label)} ${number(last[s.key])}</text>`
        : "";
      const markers = points
        .map((p, i) =>
          p[s.key] === null || p[s.key] === undefined
            ? ""
            : `<circle class="marker" style="--c:var(--${s.color})" cx="${x(i)}" cy="${y(p[s.key])}" r="4"><title>${escapeHtml(p.label)}: ${escapeHtml(s.label)} ${number(p[s.key])}</title></circle>`,
        )
        .join("");
      return `<path class="series" style="--c:var(--${s.color})" d="${d}"/>${markers}${label}`;
    })
    .join("");
  const xLabels = points
    .map((p, i) =>
      i === 0 || i === points.length - 1 || points.length <= 8
        ? `<text class="tick" x="${x(i)}" y="${height - 8}" text-anchor="middle">${escapeHtml(p.label)}</text>`
        : "",
    )
    .join("");
  // A legend is the dependable identity channel for two or more series; one
  // series needs none, because the title already says what is plotted.
  const legend =
    drawn.length > 1
      ? `<div class="legend">${drawn.map((s) => `<span><i style="--c:var(--${s.color})"></i>${escapeHtml(s.label)}</span>`).join("")}</div>`
      : "";
  // Never narrower than the viewBox, so 11px labels never scale below 11px;
  // .chart-scroll scrolls the chart sideways instead.
  return `${legend}<svg class="chart" viewBox="0 0 ${width} ${height}" style="min-width:${width}px" role="img" aria-labelledby="${id}-title">${grid}${paths}${xLabels}</svg>`;
}

function svgBars({ rows, width = 720, color = "series1", id }) {
  const rowHeight = 22;
  const labelWidth = 260;
  const height = rows.length * rowHeight + 8;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const bars = rows
    .map((r, i) => {
      const w = Math.max(2, ((width - labelWidth - 80) * r.value) / max);
      const yPos = 4 + i * rowHeight;
      return (
        `<text class="label" x="${labelWidth - 8}" y="${yPos + 15}" text-anchor="end">${escapeHtml(r.label.length > 44 ? `${r.label.slice(0, 43)}…` : r.label)}</text>` +
        `<rect class="bar" style="--c:var(--${color})" x="${labelWidth}" y="${yPos + 3}" width="${w}" height="${rowHeight - 6}" rx="3"><title>${escapeHtml(r.label)}: ${number(r.value)}</title></rect>` +
        `<text class="direct" x="${labelWidth + w + 6}" y="${yPos + 15}">${number(r.value)}</text>`
      );
    })
    .join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" style="min-width:${width}px" role="img" aria-labelledby="${id}-title">${bars}</svg>`;
}

function svgColumns({ rows, width = 360, height = 130, color = "series1", id }) {
  const pad = { top: 18, bottom: 22, left: 6, right: 6 };
  const max = Math.max(1, ...rows.map((r) => r.value));
  const gap = 2;
  const slot = (width - pad.left - pad.right) / Math.max(1, rows.length);
  const columns = rows
    .map((r, i) => {
      const h = ((height - pad.top - pad.bottom) * r.value) / max;
      const xPos = pad.left + i * slot + gap / 2;
      const yPos = height - pad.bottom - h;
      return (
        `<rect class="bar" style="--c:var(--${color})" x="${xPos}" y="${yPos}" width="${slot - gap}" height="${h}" rx="3"><title>${escapeHtml(r.label)}: ${number(r.value)}</title></rect>` +
        `<text class="direct" x="${xPos + (slot - gap) / 2}" y="${yPos - 4}" text-anchor="middle">${number(r.value)}</text>` +
        (i === 0 || i === rows.length - 1 || rows.length <= 5
          ? `<text class="tick" x="${xPos + (slot - gap) / 2}" y="${height - 6}" text-anchor="middle">${escapeHtml(r.label.slice(5))}</text>`
          : "")
      );
    })
    .join("");
  return `<svg class="chart columns" viewBox="0 0 ${width} ${height}" style="min-width:${width}px" role="img" aria-labelledby="${id}-title">${columns}</svg>`;
}

function table(columns, rows) {
  const head = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((cellValue, i) => `<td class="${i === 0 ? "" : "num"}">${escapeHtml(typeof cellValue === "number" ? number(cellValue) : cellValue)}</td>`).join("")}</tr>`)
    .join("");
  return `<details><summary>Table</summary><div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></details>`;
}

function figure({ id, title, note: caption, chart, tableHtml }) {
  return (
    `<figure class="fig"><figcaption><h3 id="${id}-title">${escapeHtml(title)}</h3>` +
    (caption ? `<p class="note">${escapeHtml(caption)}</p>` : "") +
    `</figcaption>${chart ? `<div class="chart-scroll">${chart}</div>` : ""}${tableHtml}</figure>`
  );
}

// ---------------------------------------------------------------- strip

function decisionStrip(context) {
  const tiles = decisionTiles({
    intelligence: context.intelligence,
    eventsKnown: context.eventsKnown,
    history: context.history,
    today: context.generatedAt,
  });
  const body = tiles
    .map((tile) => {
      const value = tile.display ?? (tile.value === null ? "Unavailable" : number(tile.value));
      const direction = tile.delta === null ? "none" : tile.delta > 0 ? "up" : tile.delta < 0 ? "down" : "flat";
      const deltaText =
        tile.delta === null
          ? ""
          : tile.delta === 0
            ? `No change since the ${tile.comparedWith} run`
            : `${tile.delta > 0 ? "+" : "−"}${number(Math.abs(tile.delta))} since the ${tile.comparedWith} run`;
      return (
        `<div class="tile"><div class="tile-label">${escapeHtml(tile.label)}</div>` +
        `<div class="tile-value"${tile.value === null ? ' data-missing="true"' : ""}>${escapeHtml(value)}</div>` +
        (deltaText ? `<div class="tile-delta" data-direction="${direction}">${escapeHtml(deltaText)}</div>` : "") +
        svgSparkline({ values: tile.series, label: `${tile.label} per run` }) +
        `<div class="note">${escapeHtml(tile.note)}</div></div>`
      );
    })
    .join("");
  const caveat = context.eventsKnown
    ? ""
    : note(missingEvents(context, "The counts that drive a decision"));
  return `<div class="tiles decision">${body}</div>${caveat}`;
}

// ---------------------------------------------------------------- sections

const FINDING_KINDS = {
  "assigned-link": "Assigned link",
  content: "Content",
  geography: "Geography",
  frustration: "Frustration",
  error: "Server errors",
  performance: "Performance",
};

function whatChanged(context) {
  const { intelligence, configurationErrors, truncated } = context;
  const parts = [];
  if (configurationErrors.length) {
    parts.push(
      `<div class="alert" role="alert"><strong>Configuration error — affected links stay unattributed</strong>` +
        `<ul>${configurationErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>` +
        `<p>Fix the campaign code on the Airtable Action. The dashboard never guesses which link owns an ambiguous code.</p></div>`,
    );
  }
  if (truncated) {
    parts.push(
      `<div class="alert" data-level="warning"><strong>Event data is truncated.</strong> ` +
        `Analytics Engine returned its 10,000-row cap for this window, so journeys and content measures cover only the earliest events.</div>`,
    );
  }
  // Defensive floor: a finding needs five eligible sessions. Assigned-link
  // findings describe one link, so their small denominators are expected.
  const findings = list(intelligence?.findings).filter(
    (finding) => finding && (finding.kind === "assigned-link" || Number(finding.denominator) >= PATTERN_MINIMUM),
  );
  if (!intelligence || !context.eventsKnown) parts.push(empty(missingEvents(context, "Findings")));
  if (intelligence) {
    parts.push(
      findings.length === 0
        ? context.eventsKnown
          ? empty("Nothing needs a decision in this window.")
          : ""
        : `<ul class="findings">${findings
            .map(
              (finding) =>
                `<li><p class="claim"><span class="kind">${escapeHtml(FINDING_KINDS[finding.kind] ?? finding.kind)}</span>${escapeHtml(finding.message)}</p>` +
                `<p class="note finding-basis">${escapeHtml(`${number(finding.count)} of ${number(finding.denominator)} · ${finding.currentWindow} compared with ${finding.comparisonWindow}`)}</p></li>`,
            )
            .join("")}</ul>`,
    );
  }
  return section("what-changed", "What changed", SOURCE_ORDER, parts.join(""), context);
}

function assignedLinks(context) {
  const { intelligence, sources, labelFor, configurationErrors } = context;
  const parts = [
    note(
      "A campaign code identifies the Airtable Action a link was assigned to, not the person who opened it. Links can be forwarded, opened by a security scanner, or used on a shared device.",
    ),
  ];
  if (configurationErrors.length) parts.push(note("The configuration errors under What changed keep some link activity unattributed."));
  if (sources.airtable.status === "unavailable") {
    parts.push(empty(`Identity resolution unavailable — ${unavailableReason(sources.airtable)}. Link activity stays anonymous under Journeys.`));
  }
  if (!intelligence) {
    if (sources.airtable.status !== "unavailable") parts.push(empty(missingEvents(context, "Link activity")));
    return section("assigned-links", "Assigned links", ["airtable", "insights"], parts.join(""), context);
  }
  const rows = list(intelligence.assignedLinks).filter((row) => row?.assignment);
  const { eventsKnown } = context;
  if (rows.length === 0 && sources.airtable.status !== "unavailable") parts.push(empty("No assigned links to show for this window."));
  for (const { assignment, journeys: rawJourneys } of rows) {
    const journeys = list(rawJourneys)
      .slice()
      .sort((a, b) => String(a.entryAt ?? "").localeCompare(String(b.entryAt ?? "")));
    const name = assignment.person?.name;
    const title = name ? `Activity from ${name}'s assigned link` : "Unassigned outreach";
    const timestamps = journeys.flatMap((journey) => list(journey.events).map((event) => event?.timestamp)).filter((time) => typeof time === "string");
    const latest = timestamps.sort().at(-1);
    const contentIds = [...new Set(journeys.flatMap((journey) => list(journey.contentIds)))];
    const evidenceIds = [...new Set(journeys.flatMap((journey) => list(journey.evidenceIds)))];
    const contactKinds = journeys.flatMap((journey) => list(journey.contactKinds));
    const activity = (value) => (eventsKnown ? value : "Unavailable");
    const sent = stamp(assignment.sentAt);
    // The numbers that decide whether this link needs anything, first.
    const metrics = [
      cell("Link sessions", activity(number(journeys.length))),
      cell("Content opened", activity(number(contentIds.length))),
      cell("Evidence opened", activity(number(evidenceIds.length))),
      cell("Contact actions", activity(contactKinds.length ? `${number(contactKinds.length)} (${[...new Set(contactKinds)].join(", ")})` : "0")),
      cell("Latest activity", activity(latest ? stamp(latest) ?? latest : "No link activity in this window")),
    ].join("");
    // Who and where it came from, quieter.
    const identity = [
      cell("Recipient", name || "Unassigned outreach"),
      cell("Assigned company", assignment.company || "Not linked"),
      cell("Job", assignment.job?.title || "Not linked"),
      cell("Stage", assignment.job?.stage || "–"),
      cell("Sent", sent ? `${sent}${assignment.channel ? ` · ${assignment.channel}` : ""}` : "Not recorded"),
      cell("Outcome", assignment.job?.outcome || "None recorded"),
    ].join("");
    const state = !eventsKnown ? "unknown" : journeys.length > 0 ? "active" : "idle";
    const stateText = !eventsKnown ? "Activity unavailable" : journeys.length > 0 ? plural(journeys.length, "link session") : "No activity yet";
    const airtable = name ? externalLink(assignment.person?.airtableUrl, "airtable", "Open the Person in Airtable") : "";
    const detail = [
      `<p class="note">Campaign code <code>${escapeHtml(assignment.campaignCode)}</code>${assignment.action ? ` · Action: ${escapeHtml(assignment.action)}` : ""}${assignment.state ? ` · ${escapeHtml(assignment.state)}` : ""}${airtable ? ` · ${airtable}` : ""}</p>`,
      contentIds.length ? `<p>Content: ${escapeHtml(contentIds.map(labelFor).join(", "))}</p>` : "",
      evidenceIds.length ? `<p>Evidence: ${escapeHtml(evidenceIds.join(", "))}</p>` : "",
      journeys.length
        ? journeys.map((journey, index) => `<div class="journey"><h4>${escapeHtml(journeyHeading(journey, index))}</h4>${journeyEvents(journey, labelFor)}</div>`).join("")
        : empty(eventsKnown ? "No link sessions in this window." : "Link sessions unavailable without Analytics Engine data."),
    ].join("");
    parts.push(
      `<details class="assignment" data-state="${state}"><summary>` +
        `<span class="row-head"><span class="row-title">${escapeHtml(title)}</span>` +
        `<span class="badge" data-state="${state}">${escapeHtml(stateText)}</span></span>` +
        `<span class="cells metrics">${metrics}</span><span class="cells identity">${identity}</span>` +
        `</summary>${detail}</details>`,
    );
  }
  return section("assigned-links", "Assigned links", ["airtable", "insights"], parts.join(""), context);
}

/** One content item: its measures, its trend, and its claim on a second line. */
function contentRows(rows, context) {
  const { labelFor, history } = context;
  const columns = ["Content", "Sessions", "Trend", "Median active", "Median done", "Evidence opened", "Contact action", "Assigned / anon"];
  const head = columns.map((column, index) => `<th${index ? ' class="num"' : ""}>${escapeHtml(column)}</th>`).join("");
  const body = rows
    .map((row) => {
      const label = row.label || row.contentId;
      const trend = contentTrend(history, row.contentId);
      const spark = svgSparkline({ values: trend.map((point) => point.sessions), label: `${label} sessions per run` });
      const measures = [
        `<td><span class="cell-strong">${escapeHtml(label)}</span><span class="cell-sub">${escapeHtml(row.kind || "–")}</span></td>`,
        `<td class="num">${escapeHtml(number(row.sessions))}</td>`,
        `<td class="num">${spark || `<span class="muted">${escapeHtml(trend.length === 1 ? "first run" : "–")}</span>`}</td>`,
        // A null median means no session sent an attention snapshot: missing, not zero.
        `<td class="num">${escapeHtml(Number.isFinite(row.medianActiveSeconds) ? `${number(row.medianActiveSeconds)}s` : "No attention data")}</td>`,
        `<td class="num">${escapeHtml(Number.isFinite(row.medianCompletionPercent) ? `${number(row.medianCompletionPercent)}%` : "No attention data")}</td>`,
        `<td class="num">${escapeHtml(rate(row.evidenceOpenRate, row.sessions, row.evidenceSessions))}</td>`,
        `<td class="num">${escapeHtml(rate(row.contactActionRate, row.sessions, row.contactSessions))}</td>`,
        `<td class="num">${escapeHtml(`${share(row.assignedShare)} / ${share(row.anonymousShare)}`)}</td>`,
      ].join("");
      const context_ = [
        row.commonEntrySource ? `Common entry: ${row.commonEntrySource}` : "",
        row.commonNextContent ? `Next content: ${labelFor(row.commonNextContent)}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      // Below the floor a row carries no claim; the section says why, once.
      const claim = (row.sessions ?? 0) < PATTERN_MINIMUM ? "" : row.comparison || "No comparison window";
      const second =
        claim || context_
          ? `<tr class="detail"><td colspan="${columns.length}">` +
            (claim ? `<span class="claim">${escapeHtml(claim)}</span>` : "") +
            (context_ ? `<span class="note">${escapeHtml(context_)}</span>` : "") +
            `</td></tr>`
          : "";
      return `<tr>${measures}</tr>${second}`;
    })
    .join("");
  return `<div class="scroll"><table class="content"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function contentResonance(context) {
  const { intelligence, clarity } = context;
  if (!intelligence || !context.eventsKnown) {
    const parts = [empty(missingEvents(context, "Per-content measures"))];
    const pages = list(clarity?.breakdowns?.pages).slice(0, 12);
    if (pages.length) {
      parts.push(
        `<h3>Clarity sessions per page</h3>` +
          note(`Clarity, last ${plural(clarity.days ?? 3, "day")}, tracking parameters stripped. A different measure from link sessions.`) +
          dataTable(["Page", "Clarity sessions"], pages.map((row) => [row.value, row.sessions])),
      );
    }
    return section("content-resonance", "Content resonance", ["insights", "clarity"], parts.join(""), context);
  }
  const rows = list(intelligence.content);
  const thin = rows.filter((row) => (row.sessions ?? 0) < PATTERN_MINIMUM);
  const body = rows.length
    ? note("Raw measures per record or thread. The trend is that item's sessions in each past run, so a flat run is an observed zero, not a gap.") +
      (thin.length
        ? note(`${plural(thin.length, "row")} below ${PATTERN_MINIMUM} eligible sessions, so ${thin.length === 1 ? "it shows" : "they show"} counts only: ${SMALL_SAMPLE}.`)
        : "") +
      contentRows(rows, context)
    : empty("No portfolio content was opened in this window.");
  return section("content-resonance", "Content resonance", ["insights", "airtable"], body, context);
}

const PATTERN_TITLES = {
  entries: "Common entry points",
  transitions: "Content transitions",
  exits: "Exits",
  reachingEvidence: "Paths that reach evidence",
  reachingContact: "Paths that reach contact",
  openingPaths: "Opening paths",
};

function patternLabel(row, labelFor) {
  if (typeof row.label === "string" && row.label) return row.label;
  if (typeof row.value === "string" && row.value) return labelFor(row.value);
  if (row.from !== undefined && row.to !== undefined) return `${labelFor(String(row.from))} → ${labelFor(String(row.to))}`;
  if (Array.isArray(row.path)) return row.path.map((step) => labelFor(String(step))).join(" → ");
  if (typeof row.contentId === "string") return labelFor(row.contentId);
  return "Unknown";
}

function journeysSection(context) {
  const { intelligence, labelFor } = context;
  if (!intelligence || !context.eventsKnown) {
    const body = empty(missingEvents(context, "Journeys"));
    return section("journeys", "Journeys", ["insights"], body, context);
  }
  const groups = [];
  let thinGroups = 0;
  const patterns = intelligence.journeyPatterns;
  if (patterns && typeof patterns === "object") {
    for (const [key, rows] of Object.entries(patterns)) {
      if (!Array.isArray(rows)) continue;
      const title = PATTERN_TITLES[key] ?? key.replace(/([a-z])([A-Z])/gu, "$1 $2");
      const objects = rows.filter((row) => row && typeof row === "object");
      // Opening paths also say how many of those tab sessions reached contact.
      const withContact = objects.some((row) => Number.isFinite(row.contactSessions));
      const counted = objects.map((row) => [
        patternLabel(row, labelFor),
        Number(row.sessions ?? row.count ?? 0),
        ...(withContact ? [Number.isFinite(row.contactSessions) ? row.contactSessions : "–"] : []),
      ]);
      const total = counted.reduce((sum, [, sessions]) => sum + Number(sessions), 0);
      if (counted.length > 0 && total < PATTERN_MINIMUM) thinGroups += 1;
      groups.push(
        `<h3>${escapeHtml(title)}</h3>` +
          (counted.length === 0
            ? empty("None in this window.")
            : dataTable(["Path", "Tab sessions", ...(withContact ? ["Reached contact"] : [])], counted)),
      );
    }
  } else {
    groups.push(note("Aggregate entry, transition, and exit patterns are not in this snapshot."));
  }
  const parts = thinGroups
    ? [note(`${plural(thinGroups, "group")} below ${PATTERN_MINIMUM} tab sessions, so ${thinGroups === 1 ? "it shows" : "they show"} counts only: ${SMALL_SAMPLE}.`)]
    : [];
  parts.push(...groups);
  const anonymous = list(intelligence.anonymousJourneys)
    .slice()
    .sort((a, b) => String(b.entryAt ?? "").localeCompare(String(a.entryAt ?? "")));
  parts.push(
    `<h3>Anonymous tab sessions</h3>` +
      note("Direct and unmapped traffic stays anonymous. One entry per browser tab; a tab session is not a person.") +
      (anonymous.length === 0
        ? empty("No anonymous tab sessions in this window.")
        : (anonymous.length > ANONYMOUS_JOURNEY_LIMIT ? note(`Newest ${ANONYMOUS_JOURNEY_LIMIT} of ${number(anonymous.length)}.`) : "") +
          anonymous
            .slice(0, ANONYMOUS_JOURNEY_LIMIT)
            .map(
              (journey, index) =>
                `<details class="journey"><summary>${escapeHtml(`${journeyHeading(journey, index)} · ${plural(list(journey.events).length, "event")}`)}</summary>${journeyEvents(journey, labelFor)}</details>`,
            )
            .join("")),
  );
  return section("journeys", "Journeys", ["insights"], parts.join(""), context);
}

function audience(context) {
  const { intelligence, clarity } = context;
  const parts = [];
  if (!intelligence || !context.eventsKnown) {
    parts.push(empty(missingEvents(context, "Location, source, and device")));
  } else {
    const data = intelligence.audience ?? {};
    const locations = list(data.locations);
    const total = locations.reduce((sum, row) => sum + Number(row.sessions ?? 0), 0);
    parts.push(
      `<h3>Network location reported for this request</h3>` +
        note("Approximate, from the network that made each request. A VPN, mobile gateway, or corporate network can place it far away; it does not mean residence or physical presence.") +
        (locations.length === 0
          ? empty("No located tab sessions in this window.")
          : (total < PATTERN_MINIMUM ? note(`${plural(total, "session")}: ${SMALL_SAMPLE}.`) : "") +
            dataTable(
              ["Country", "Region", "City", "Metro", "Tab sessions"],
              locations.map((row) => [row.country || "Unknown", row.regionCode || "Unknown", row.city || "Unknown", row.metroCode || "–", row.sessions]),
            )),
    );
    for (const [key, title] of [["sources", "Entry source"], ["devices", "Device"]]) {
      const rows = list(data[key]);
      parts.push(
        `<h3>${escapeHtml(title)}</h3>` +
          (rows.length ? dataTable([title, "Tab sessions"], rows.map((row) => [row.value || "Unknown", row.sessions])) : empty("None in this window.")),
      );
    }
  }
  const claritySources = list(clarity?.breakdowns?.sources).slice(0, 10);
  if (claritySources.length) {
    parts.push(
      `<h3>Clarity session sources</h3>` +
        note(`Clarity sessions, last ${plural(clarity.days ?? 3, "day")}. A separate measure; never added to tab sessions.`) +
        dataTable(["Source", "Clarity sessions"], claritySources.map((row) => [row.value, row.sessions])),
    );
  }
  return section("audience", "Audience", ["insights", "clarity"], parts.join(""), context);
}

/** The filter values, one row each. The steps above them are printed once. */
function observationTable(rows) {
  return dataTable(["Row", "Clarity filter", "Value"], rows);
}

function observeInClarity(context) {
  const { intelligence } = context;
  const projectLink = externalLink(CLARITY_PROJECT_URL, "clarity", "Open the Clarity project");
  const parts = [
    note("Clarity keeps the click, scroll, and attention maps and the recordings. No documented Clarity URL carries filters, so these steps are applied by hand, once, and each row below supplies only its own filter value."),
    `<div class="steps">${projectLink}<ol>${CLARITY_STEPS.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></div>`,
    note("Optional shortcut: save a Segment per campaign in Clarity (Segments → <name>) and pick it instead of repeating the filter."),
  ];
  if (!intelligence || !context.eventsKnown) {
    const example = [
      ["Assigned link", ...Object.values(clarityFilterFor({ kind: "campaign", code: "<campaign code>" }))],
      ["Content", ...Object.values(clarityFilterFor({ kind: "content", contentId: "<content id>" }))],
      ["Network location", ...Object.values(clarityFilterFor({ kind: "location", country: "<country>", regionCode: "<state>", city: "<city>" }))],
    ];
    parts.push(empty(missingEvents(context, "Observation rows")), observationTable(example));
    return section("observe-in-clarity", "Observe in Clarity", ["clarity"], parts.join(""), context);
  }
  const groups = [];
  const links = list(intelligence.assignedLinks).filter((row) => row?.assignment?.campaignCode && list(row.journeys).length);
  if (links.length) {
    groups.push(
      `<h3>Assigned links</h3>` +
        observationTable(
          links.map(({ assignment }) => {
            const { filter, value } = clarityFilterFor({ kind: "campaign", code: assignment.campaignCode });
            return [
              assignment.person?.name ? `Activity from ${assignment.person.name}'s assigned link` : "Unassigned outreach",
              filter,
              value,
            ];
          }),
        ),
    );
  }
  const content = list(intelligence.content).filter((row) => row?.contentId);
  if (content.length) {
    groups.push(
      `<h3>Content</h3>` +
        observationTable(
          content.map((row) => {
            const { filter, value } = clarityFilterFor({ kind: "content", contentId: row.contentId });
            return [row.label || row.contentId, filter, value];
          }),
        ),
    );
  }
  const locations = list(intelligence.audience?.locations);
  const cities = locations.filter((row) => row?.city);
  if (cities.length) {
    groups.push(
      `<h3>Network locations</h3>` +
        observationTable(
          cities.map((row) => {
            const { filter, value } = clarityFilterFor({
              kind: "location",
              country: row.country,
              regionCode: row.regionCode,
              city: row.city,
            });
            return [geoLabel(row), filter, value];
          }),
        ),
    );
  }
  if (locations.length > cities.length) parts.push(note("Sessions without a reported city cannot be isolated by location in Clarity."));
  parts.push(...(groups.length ? groups : [empty("No content or locations to observe in this window.")]));
  return section("observe-in-clarity", "Observe in Clarity", ["clarity"], parts.join(""), context);
}

// ---------------------------------------------------------------- diagnostics

function diagnostics(context, history) {
  const { snapshot, sources, clarity, intelligence, truncated } = context;
  const cf = usable(sources.cloudflare);
  const detail = cf?.edge?.detail?.error ? null : cf?.edge?.detail;
  const parts = [
    dataTable(
      ["Source", "Status", "Data from", "Detail"],
      SOURCE_ORDER.map((name) => [
        SOURCE_LABELS[name],
        sources[name].status,
        stamp(sources[name].capturedAt) ?? "never",
        sources[name].error ?? (name === "insights" && truncated ? "row cap reached" : "–"),
      ]),
    ),
  ];

  const tiles = headlineTiles(snapshot ? { believable: snapshot.believable, clarity: clarity ?? { error: "unavailable" }, cloudflare: cf ?? undefined } : null);
  if (tiles.length) {
    parts.push(
      `<div class="tiles">${tiles
        .map(
          (t) =>
            `<div class="tile"><div class="tile-label">${escapeHtml(t.label)}</div><div class="tile-value">${number(t.value)}</div><div class="note">${escapeHtml(t.note)}</div></div>`,
        )
        .join("")}</div>`,
    );
  }

  const curve = historySeries(history);
  if (curve.length > 0) {
    const series = [
      { key: "believableSessions", label: "Clarity sessions", color: "series1" },
      { key: "believableVisits", label: "Cloudflare visits", color: "series2" },
    ];
    parts.push(
      figure({
        id: "curve",
        title: "Believable humans, by run",
        note: "Each point is what that day's run saw over its own window (Clarity 3 days, Cloudflare 7). The direction matters more than the level.",
        chart: svgLine({ points: curve, series, id: "curve" }),
        tableHtml: table(
          ["Day", "Clarity sessions", "Cloudflare visits", "Edge requests"],
          curve.map((p) => [p.x, p.believableSessions ?? "–", p.believableVisits ?? "–", p.edgeRequests ?? "–"]),
        ),
      }),
    );
  }

  if (cf?.daily?.length) {
    const edgeByDate = new Map((cf.edge?.daily ?? []).map((r) => [r.date, r.requests]));
    const multiples = [
      { key: "visits", title: "Visits per day", rows: cf.daily.map((r) => ({ label: r.date, value: r.visits })), color: "series2" },
      { key: "pageloads", title: "Pageload beacons per day", rows: cf.daily.map((r) => ({ label: r.date, value: r.pageloads })), color: "series1" },
      { key: "edge", title: "Edge requests per day", rows: cf.daily.map((r) => ({ label: r.date, value: edgeByDate.get(r.date) ?? 0 })), color: "series3" },
    ];
    parts.push(
      `<div class="multiples">${multiples
        .map((m) =>
          figure({
            id: `daily-${m.key}`,
            title: m.title,
            chart: svgColumns({ rows: m.rows, id: `daily-${m.key}`, color: m.color }),
            tableHtml: table(["Day", m.title], m.rows.map((r) => [r.label, r.value])),
          }),
        )
        .join("")}</div>`,
    );
  }

  const ranked = [];
  if (detail?.crawlers?.length) {
    ranked.push({ id: "crawlers", title: "Who is crawling", note: "Edge requests by named crawler. Access, not citation.", rows: detail.crawlers.slice(0, 12).map((r) => ({ label: r.value, value: r.requests })), color: "series3", unit: "Requests" });
  }
  if (cf?.shape?.externalReferrers?.length) {
    ranked.push({ id: "referrers", title: "External referrers", note: "Cloudflare visits by referring site; sampled, undercounts", rows: cf.shape.externalReferrers.slice(0, 10).map((r) => ({ label: r.value, value: r.visits })), color: "series2", unit: "Visits" });
  }
  for (const r of ranked) {
    parts.push(
      figure({
        id: r.id,
        title: r.title,
        note: r.note,
        chart: svgBars({ rows: r.rows, id: r.id, color: r.color }),
        tableHtml: table(["Item", r.unit], r.rows.map((row) => [row.label, row.value])),
      }),
    );
  }

  const perf = cf?.performance;
  if (perf?.samples) {
    const rows = [
      ["all", perf.samples, perf.firstContentfulPaint?.p75, perf.pageLoadTime?.p75, perf.pageLoadTime?.p95],
      ...(cf.performanceByDevice ?? []).map((d) => [d.device, d.samples, d.firstContentfulPaint?.p75, d.pageLoadTime?.p75, d.pageLoadTime?.p95]),
    ];
    parts.push(
      figure({
        id: "vitals",
        title: "Web vitals (ms)",
        note: "Cloudflare RUM. p75 is what most visitors get; p95 is the slow tail.",
        chart: "",
        tableHtml: table(["Device", "Samples", "FCP p75", "Load p75", "Load p95"], rows).replace("<details>", "<details open>"),
      }),
    );
  }

  if (clarity?.frustration?.length) {
    parts.push(
      figure({
        id: "frustration",
        title: "Frustration signals",
        note: `Clarity, last ${plural(clarity.days ?? 3, "day")}: count and share of sessions with at least one`,
        chart: "",
        tableHtml: table(
          ["Signal", "Count", "Sessions"],
          clarity.frustration.map((f) => [f.label, f.value, `${((f.sessionShare ?? 0) * 100).toFixed(1)}%`]),
        ).replace("<details>", "<details open>"),
      }),
    );
  }

  // Reducer diagnostics: counts only. Strings and objects stay in the JSON
  // snapshot so no unvetted text or URL reaches the page.
  const reducer = intelligence?.diagnostics && typeof intelligence.diagnostics === "object" ? intelligence.diagnostics : {};
  const reducerRows = Object.entries(reducer)
    .map(([key, value]) => {
      if (typeof value === "number" && Number.isFinite(value)) return [key, value];
      if (typeof value === "boolean") return [key, value ? "yes" : "no"];
      if (Array.isArray(value)) return [key, plural(value.length, "item")];
      return null;
    })
    .filter(Boolean);
  if (reducerRows.length) parts.push(`<h3>Journey reducer</h3>` + dataTable(["Measure", "Value"], reducerRows));

  if (cf?.edge?.error) parts.push(note(`Edge: ${cf.edge.error}`));
  if (cf?.edge?.detail?.error) parts.push(note(`Edge detail: ${cf.edge.detail.error}`));
  parts.push(
    note("Believable = Bradley's enrolled browsers, reviewers, localhost and headless runs removed. Cloudflare and Clarity count differently and are never added. Regenerated by every npm run insights run."),
  );
  return `<details class="diagnostics"><summary><h2>Diagnostics</h2> <span class="note">Crawler counts, infrastructure totals, and source detail</span></summary>${parts.join("")}</details>`;
}

// ---------------------------------------------------------------- page

/**
 * @param {{ snapshot: Record<string, any> | null, history?: Array<Record<string, any>>, generatedAt?: string }} input
 */
export function renderDashboard({ snapshot, history = [], generatedAt = new Date().toISOString() }) {
  const sources = {
    insights: sourceState(snapshot, "insights"),
    airtable: sourceState(snapshot, "airtable"),
    clarity: sourceState(snapshot, "clarity"),
    cloudflare: sourceState(snapshot, "cloudflare"),
  };
  const intelligence = snapshot?.intelligence && typeof snapshot.intelligence === "object" ? snapshot.intelligence : null;
  const insights = usable(sources.insights);
  const labels = new Map(list(intelligence?.content).filter((row) => row?.contentId).map((row) => [row.contentId, row.label || row.contentId]));
  const configurationErrors = [
    ...new Set([
      ...String(sources.airtable.error ?? "")
        .split("; ")
        .filter((problem) => CONFIGURATION_ERROR.test(problem)),
      ...list(intelligence?.diagnostics?.configurationErrors).filter((problem) => typeof problem === "string" && problem),
    ]),
  ];
  const context = {
    snapshot,
    sources,
    intelligence,
    history,
    generatedAt,
    clarity: usable(sources.clarity),
    // Computed once: without a usable insights value, event-derived sections
    // say the data is unavailable rather than claim an empty window.
    eventsKnown: insights !== null,
    truncated: insights?.raw?.truncated === true,
    configurationErrors,
    labelFor: (/** @type {string} */ id) => labels.get(id) ?? id,
  };
  const window = windowLabel(snapshot?.window) ?? "no snapshot yet";
  const generated = stamp(generatedAt) ?? generatedAt;

  const body = [
    whatChanged(context),
    assignedLinks(context),
    contentResonance(context),
    journeysSection(context),
    audience(context),
    observeInClarity(context),
    diagnostics(context, history),
  ].join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>Portfolio intelligence · ${escapeHtml(window)}</title>
<style>
:root { color-scheme: light dark;
  --surface-1: #fcfcfb; --surface-2: #f2f1ee; --surface-3: #e8e7e2;
  --text-primary: #0b0b0b; --text-secondary: #52514e; --grid: #e2e1dc;
  --series1: ${PALETTE.light.series1}; --series2: ${PALETTE.light.series2}; --series3: ${PALETTE.light.series3};
  --good: ${PALETTE.light.good}; --muted: ${PALETTE.light.muted}; }
@media (prefers-color-scheme: dark) { :root {
  --surface-1: #1a1a19; --surface-2: #242423; --surface-3: #2f2f2d;
  --text-primary: #ffffff; --text-secondary: #c3c2b7; --grid: #34342f;
  --series1: ${PALETTE.dark.series1}; --series2: ${PALETTE.dark.series2}; --series3: ${PALETTE.dark.series3};
  --good: ${PALETTE.dark.good}; --muted: ${PALETTE.dark.muted}; } }
* { box-sizing: border-box; }
body { background: var(--surface-1); color: var(--text-primary); font-family: system-ui, -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin: 0 auto; max-width: 1080px; padding: 24px; }

/* One type scale: display, section, sub, claim, body, small, label. */
h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 0; }
h2 { display: inline; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
h3 { font-size: 13px; font-weight: 600; letter-spacing: 0.06em; margin: 20px 0 4px; text-transform: uppercase; }
h4 { font-size: 13px; font-weight: 600; margin: 10px 0 2px; }
.claim { font-size: 15px; font-weight: 500; line-height: 1.45; margin: 0; }
.note, .tick, .legend, .cell-label, .tile-label, .strip-note, .source-note, .cell-sub, .muted { color: var(--text-secondary); font-size: 12px; }
.note { margin: 4px 0; } .empty { color: var(--text-secondary); margin: 8px 0; }
a { color: inherit; text-decoration-color: var(--series1); text-underline-offset: 2px; }
a:focus-visible, summary:focus-visible { border-radius: 6px; outline: 2px solid var(--series1); outline-offset: 2px; }
code { font-size: 12px; }

header { align-items: baseline; display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; margin-bottom: 12px; }

/* The one freshness strip. */
.freshness { display: grid; gap: 8px 16px; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); list-style: none; margin: 0 0 20px; padding: 0; }
.freshness li { border-top: 2px solid var(--grid); padding-top: 6px; }
.freshness li[data-status="stale"] { border-top-color: var(--series2); }
.freshness li[data-status="unavailable"] { border-top-color: var(--text-primary); }
.strip-name { display: block; font-size: 12px; font-weight: 600; }
.strip-note { display: block; overflow-wrap: anywhere; }
.badge { border: 1px solid var(--grid); border-radius: 999px; display: inline-block; font-size: 11px; font-weight: 500; padding: 1px 8px; white-space: nowrap; }
.badge[data-status="stale"] { border-color: var(--series2); color: var(--text-primary); }
.badge[data-status="unavailable"] { background: var(--surface-3); border-color: var(--text-secondary); color: var(--text-primary); }
.badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 0; }
.source-note { margin: 4px 0 0; overflow-wrap: anywhere; }

/* The decision strip: the counts that lead. */
.tiles { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin: 0 0 24px; }
.tile { background: var(--surface-2); border-radius: 8px; min-width: 0; padding: 12px 14px; }
.tile-label { font-weight: 500; }
.tile-value { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin: 2px 0; }
.tile-value[data-missing="true"] { font-size: 15px; font-weight: 500; padding: 7px 0; }
.tile-delta { font-size: 12px; font-weight: 500; }
.tile-delta[data-direction="up"] { color: var(--good); }
.tile-delta[data-direction="down"], .tile-delta[data-direction="flat"] { color: var(--text-secondary); }
.spark { display: block; height: 28px; margin: 4px 0; width: 96px; }
.spark-line { fill: none; stroke: var(--muted); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
.spark-end { fill: var(--series1); stroke: var(--surface-2); stroke-width: 2; }

.panel { background: var(--surface-2); border-radius: 8px; margin: 0 0 20px; padding: 16px 18px; }
.panel-head { border-bottom: 1px solid var(--grid); margin-bottom: 12px; padding-bottom: 10px; }
.alert { background: var(--surface-1); border-left: 4px solid var(--series2); border-radius: 4px; margin: 8px 0 12px; padding: 10px 12px; }
.alert ul { margin: 6px 0; padding-left: 20px; } .alert p { margin: 0; }
.alert[data-level="warning"] { border-left-color: var(--text-secondary); }
.findings { list-style: none; margin: 8px 0; padding: 0; }
.findings li { border-top: 1px solid var(--grid); padding: 10px 0; }
.finding-basis { margin: 3px 0 0; }
.kind { border: 1px solid var(--grid); border-radius: 4px; color: var(--text-secondary); display: inline-block; font-size: 11px; font-weight: 500; margin-right: 8px; padding: 0 6px; vertical-align: 1px; }

.assignment { border-top: 1px solid var(--grid); margin: 0; padding: 12px 0; }
.assignment > summary { color: var(--text-primary); font-size: 14px; }
.row-head { align-items: baseline; display: flex; flex-wrap: wrap; gap: 8px; }
.row-title { font-size: 15px; font-weight: 600; }
.badge[data-state="idle"] { border-color: var(--text-secondary); color: var(--text-secondary); }
.badge[data-state="active"] { border-color: var(--series1); }
.cells { display: grid; gap: 6px 14px; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); margin: 8px 0 0 18px; }
.cells.identity { border-top: 1px solid var(--grid); margin-top: 10px; padding-top: 8px; }
.cell { display: flex; flex-direction: column; min-width: 0; }
.cells.metrics .cell-value { font-size: 15px; font-weight: 600; }
.cell-value { font-size: 13px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.journey { margin: 4px 0 8px; }
.events { margin: 4px 0 8px; padding-left: 22px; }
.events li { font-size: 13px; margin: 2px 0; }
time { color: var(--text-secondary); font-variant-numeric: tabular-nums; margin-right: 8px; }

.steps { background: var(--surface-1); border-radius: 8px; margin: 8px 0; padding: 10px 14px; }
.steps ol { font-size: 13px; margin: 6px 0 0; padding-left: 20px; }
.steps li { margin: 3px 0; }

.scroll { overflow-x: auto; }
table { border-collapse: collapse; font-variant-numeric: tabular-nums; margin-top: 6px; width: 100%; }
table.content { min-width: 880px; }
th, td { border-bottom: 1px solid var(--grid); font-size: 12px; padding: 6px 8px; text-align: left; vertical-align: top; }
th { color: var(--text-secondary); font-size: 11px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
td.num, th.num { text-align: right; }
.content td.num .spark { margin-left: auto; }
.cell-strong { display: block; font-size: 13px; font-weight: 600; }
.cell-sub { display: block; }
tr.detail td { border-bottom: 1px solid var(--grid); padding-top: 0; }
tr.detail .claim { display: block; font-size: 13px; font-weight: 500; }
tr.detail .note { display: block; }

details { margin-top: 8px; } summary { color: var(--text-secondary); cursor: pointer; font-size: 12px; }
.diagnostics { background: var(--surface-2); border-radius: 8px; padding: 16px 18px; }
.diagnostics > summary { color: var(--text-primary); }
.fig { background: var(--surface-1); border-radius: 8px; margin: 0 0 16px; padding: 12px 14px; }
.fig h3 { margin-top: 0; }
.multiples { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 392px), 1fr)); }
.multiples > .fig { min-width: 0; }
.chart-scroll { overflow-x: auto; }
.chart { display: block; height: auto; margin-top: 8px; width: 100%; }
.grid { stroke: var(--grid); stroke-width: 1; }
.tick { fill: var(--text-secondary); font-size: 11px; }
.label { fill: var(--text-primary); font-size: 12px; }
.direct { fill: var(--text-primary); font-size: 11px; font-variant-numeric: tabular-nums; }
.series { fill: none; stroke: var(--c); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
.marker { fill: var(--c); stroke: var(--surface-1); stroke-width: 2; }
.bar { fill: var(--c); }
.legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 6px; }
.legend i { background: var(--c); border-radius: 2px; display: inline-block; height: 10px; margin-right: 5px; vertical-align: -1px; width: 10px; }
@media (max-width: 640px) {
  body { padding: 12px; }
  .panel, .diagnostics { padding: 12px; }
  .cells { grid-template-columns: 1fr; margin-left: 0; }
  .cell { flex-direction: row; gap: 12px; justify-content: space-between; }
  .cell-value { text-align: right; }
  .tiles { grid-template-columns: 1fr 1fr; }
  .freshness { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<header><h1>Portfolio intelligence</h1><span class="note">${escapeHtml(window)} · generated ${escapeHtml(generated)}</span></header>
${freshnessStrip(context)}
${decisionStrip(context)}
${body}
</body>
</html>
`;
}
