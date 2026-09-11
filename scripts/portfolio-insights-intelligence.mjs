// Journeys, content outcomes, audience rows, and findings for the private
// portfolio dashboard. Everything here is pure and deterministic: no network,
// no clock, no LLM. The decisions it makes are the ones most easily gotten
// quietly wrong, so each is a named rule with a named threshold.
//
// Ownership rules:
//
//   A journey is one v2 tab session (`sessionId`). Events are ordered by time
//   within it whatever order they arrive in.
//
//   v1 rows and rows without a session ID never join a journey. They are left
//   out of journeys, content, audience, and findings entirely and counted in
//   `diagnostics.sessionlessEvents`; the terminal's aggregate totals still
//   include them.
//
//   A session whose events carry two different non-empty campaign codes is
//   quarantined: it belongs to neither link and is counted, not shown.
//
//   An Airtable assignment attaches only on an exact campaign-code match. An
//   unmapped or duplicated code stays anonymous and becomes a configuration
//   error that names the code and nothing else.
//
// Attribution language: a campaign code identifies the Action a link was
// assigned to, not the person who opened it. Findings say "Activity from
// <name>'s assigned link" and never that a person visited or read anything.

/**
 * @typedef {{
 *   timestamp: string, action: string, contentId: string, contentKind: string,
 *   campaign: string, contactKind: string, source: string, targetId: string,
 *   targetKind: string, country: string, device: string, schema: "v1" | "v2",
 *   sessionId: string, regionCode: string, city: string, metroCode: string,
 *   activeSeconds: number, completionPercent: number,
 * }} InsightEvent
 * @typedef {{
 *   actionRecordId: string, campaignCode: string, sentAt: string | null,
 *   channel: string, portfolioUrl: string, action: string, state: string,
 *   person: { name: string, airtableUrl: string } | null,
 *   company: string | null,
 *   job: { title: string, stage: string, outcome: string | null } | null,
 * }} PortfolioAssignment
 * @typedef {{ status: "fresh" | "stale" | "unavailable", capturedAt: string | null, value: unknown, error?: string }} SourceState
 * @typedef {{ start: string, end: string, label: string }} ReportWindow
 * @typedef {{ country: string, regionCode: string, city: string, metroCode: string }} Geo
 * @typedef {{
 *   sessionId: string, campaignCode: string | null,
 *   assignment: PortfolioAssignment | null, entryAt: string,
 *   events: InsightEvent[], contentIds: string[], evidenceIds: string[],
 *   contactKinds: string[], geo: Geo, device: string,
 * }} Journey
 * @typedef {{
 *   contentId: string, label: string, kind: string, sessions: number,
 *   attentionSessions: number,
 *   medianActiveSeconds: number | null, medianCompletionPercent: number | null,
 *   evidenceSessions: number, evidenceOpenRate: number,
 *   contactSessions: number, contactActionRate: number,
 *   commonEntrySource: string, commonNextContent: string | null,
 *   assignedShare: number, anonymousShare: number, comparison: string,
 * }} ContentSummary
 * @typedef {{
 *   sources: Array<{ value: string, sessions: number }>,
 *   devices: Array<{ value: string, sessions: number }>,
 *   locations: Array<Geo & { sessions: number }>,
 * }} AudienceSummary
 * @typedef {{
 *   kind: "assigned-link" | "content" | "geography" | "frustration" | "error" | "performance",
 *   message: string, count: number, denominator: number,
 *   currentWindow: string, comparisonWindow: string,
 * }} Finding
 * @typedef {{ label: string, kind: string, contentKind: "record" | "thread", evidenceCount: number }} CatalogEntry
 * @typedef {Record<string, CatalogEntry>} ContentCatalog Keyed `record:<id>` and `thread:<id>`.
 * @typedef {{
 *   sessions: number, evidenceSessions: number, contactSessions: number,
 *   labels: Record<string, string>,
 *   entries: Array<{ contentId: string | null, label: string, sessions: number }>,
 *   transitions: Array<{ from: string, to: string, sessions: number }>,
 *   exits: Array<{ contentId: string | null, label: string, sessions: number }>,
 *   reachingEvidence: Array<{ path: string[], sessions: number }>,
 *   reachingContact: Array<{ path: string[], sessions: number }>,
 *   openingPaths: Array<{ path: string[], sessions: number, contactSessions: number }>,
 * }} JourneyPatterns
 * @typedef {{ sessions: number, frustration: Array<{ label: string, value: number, sessionShare: number }> }} ClaritySignals
 * @typedef {{
 *   serverErrors: number | null, statusRequests: number | null,
 *   performance: { samples: number, firstContentfulPaintP75: number | null, pageLoadTimeP75: number | null } | null,
 * }} CloudflareSignals
 * @typedef {{ clarity: ClaritySignals | null, cloudflare: CloudflareSignals | null }} SourceSignals
 * @typedef {{
 *   findings: Finding[],
 *   assignedLinks: Array<{ assignment: PortfolioAssignment, journeys: Journey[] }>,
 *   anonymousJourneys: Journey[],
 *   content: ContentSummary[],
 *   audience: AudienceSummary,
 *   journeyPatterns: JourneyPatterns,
 *   signals: SourceSignals,
 *   window: ReportWindow,
 *   diagnostics: Record<string, unknown>,
 * }} PortfolioIntelligence
 * @typedef {{
 *   window?: ReportWindow,
 *   assignedLinks?: Array<{ assignment: PortfolioAssignment, journeys: Journey[] }>,
 *   content?: ContentSummary[],
 *   audience?: AudienceSummary,
 *   journeyPatterns?: JourneyPatterns,
 *   signals?: SourceSignals,
 *   contentCatalog?: ContentCatalog,
 *   diagnostics?: Record<string, unknown>,
 * }} FindingInput
 * @typedef {{
 *   version: 1,
 *   window: ReportWindow | null,
 *   journeys: "available" | "unavailable",
 *   sessions: number, evidenceSessions: number, contactSessions: number,
 *   content: Array<{
 *     contentId: string, sessions: number, attentionSessions: number,
 *     evidenceSessions: number, contactSessions: number,
 *     medianActiveSeconds: number | null, medianCompletionPercent: number | null,
 *   }>,
 *   locations: Array<Geo & { sessions: number }>,
 *   sources: Array<{ value: string, sessions: number }>,
 *   devices: Array<{ value: string, sessions: number }>,
 *   clarity: ClaritySignals | null,
 *   cloudflare: CloudflareSignals | null,
 * }} HistorySummary Aggregate-only; safe to keep indefinitely.
 */

// ── Rules ────────────────────────────────────────────────────────────────────

/** Fewest eligible sessions (or samples) behind any pattern or finding. */
export const MIN_PATTERN_SESSIONS = 5;
export const NOT_ENOUGH_DATA = "not enough data for a pattern";
/** A later link session this long after the link's earlier activity is a return. */
export const RETURN_GAP_HOURS = 24;
/** Evidence-open rate change against the prior window, in percentage points. */
export const MATERIAL_RATE_CHANGE_POINTS = 15;
/** Strong completion with weak evidence: median completion floor and evidence-rate ceiling. */
export const STRONG_COMPLETION_PERCENT = 75;
export const WEAK_EVIDENCE_RATE_PERCENT = 20;
/** An opening path's contact rate above the site baseline, in percentage points. */
export const PATH_CONTACT_LIFT_POINTS = 15;
/** Rise in the share of Clarity sessions showing one frustration signal, in points. */
export const FRUSTRATION_RISE_POINTS = 10;
/** 5xx findings need this many errors and a rate rise of this many points. */
export const SERVER_ERROR_MIN_COUNT = 5;
export const SERVER_ERROR_RISE_POINTS = 1;
/** Web Vitals p75 regression: at least this ratio and this many milliseconds. */
export const VITALS_REGRESSION_PERCENT = 20;
export const VITALS_REGRESSION_MS = 100;

const JOURNEY_ACTIONS = new Set([
  "entry",
  "content_open",
  "content_attention",
  "evidence_open",
  "guide_evidence",
  "contact_action",
]);
const SOURCE_STATUSES = new Set(["fresh", "stale", "unavailable"]);
const UNKNOWN = "Unknown";
const NO_CONTENT_LABEL = "(no content opened)";
const HOUR_MS = 3_600_000;

// ── Small helpers ────────────────────────────────────────────────────────────

/** @returns {value is Record<string, any>} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** @param {unknown} value */
function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** @template T @param {T[]} values */
function unique(values) {
  return [...new Set(values)];
}

/**
 * A rate as percentage points, rounded to 0.0001 so float noise cannot move a
 * value across a threshold (0.35 - 0.2 is exactly 15) while 0.95 stays 0.95.
 */
function points(rate) {
  return Math.round(rate * 1_000_000) / 10_000;
}

function percent(rate) {
  return `${Math.round(rate * 100)}%`;
}

/** @param {number[]} values */
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value * 10) / 10;
}

/**
 * Count occurrences, most first, ties alphabetical.
 * @param {string[]} values
 * @returns {Array<{ value: string, sessions: number }>}
 */
function tally(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, sessions]) => ({ value, sessions }))
    .sort((left, right) => right.sessions - left.sessions || left.value.localeCompare(right.value));
}

/** @param {string[]} values */
function mostCommon(values) {
  return tally(values)[0]?.value ?? null;
}

// ── Content catalog ──────────────────────────────────────────────────────────

function evidenceCount(visuals) {
  if (Array.isArray(visuals)) return visuals.length;
  return isRecord(visuals) ? Object.keys(visuals).length : 0;
}

/**
 * Labels, kinds, and evidence counts from `content/portfolio-content.json`.
 * Evidence blocks in the Reader are the item's `visuals`, keyed by the same
 * ID an `evidence_open` event carries.
 *
 * @param {unknown} json
 * @returns {ContentCatalog}
 */
export function contentCatalogFromPortfolioContent(json) {
  /** @type {ContentCatalog} */
  const catalog = {};
  const source = isRecord(json) ? json : {};
  for (const [id, record] of Object.entries(isRecord(source.records) ? source.records : {})) {
    catalog[`record:${id}`] = {
      label: text(record?.label) || id,
      kind: text(record?.kind) || "Record",
      contentKind: "record",
      evidenceCount: evidenceCount(record?.visuals),
    };
  }
  for (const [id, thread] of Object.entries(isRecord(source.threads) ? source.threads : {})) {
    catalog[`thread:${id}`] = {
      label: text(thread?.title) || id,
      kind: "Thread",
      contentKind: "thread",
      evidenceCount: evidenceCount(thread?.visuals),
    };
  }
  return catalog;
}

/**
 * @param {ContentCatalog} catalog
 * @param {string} id
 * @param {string} [contentKind]
 */
function catalogEntry(catalog, id, contentKind = "") {
  return (
    catalog[`${contentKind}:${id}`] ?? catalog[`record:${id}`] ?? catalog[`thread:${id}`] ?? null
  );
}

// ── Journeys ─────────────────────────────────────────────────────────────────

/** @param {InsightEvent} event */
function evidenceKey(event) {
  return text(event.targetId) || `${text(event.contentId) || "unknown"}:${text(event.targetKind) || "evidence"}`;
}

/**
 * @param {string} sessionId
 * @param {InsightEvent[]} events Already in time order.
 * @param {string | null} campaignCode
 * @returns {Journey}
 */
function journeyFrom(sessionId, events, campaignCode) {
  // One event's geography, never a mix of fields from several requests.
  const located =
    events.find((event) => text(event.country) || text(event.regionCode) || text(event.city)) ?? events[0];
  return {
    sessionId,
    campaignCode,
    assignment: null,
    entryAt: new Date(Date.parse(events[0].timestamp)).toISOString(),
    events,
    contentIds: unique(events.map((event) => text(event.contentId)).filter(Boolean)),
    evidenceIds: unique(events.filter((event) => event.action === "evidence_open").map(evidenceKey)),
    contactKinds: unique(
      events.filter((event) => event.action === "contact_action").map((event) => text(event.contactKind) || "unknown"),
    ),
    geo: {
      country: text(located.country) || UNKNOWN,
      regionCode: text(located.regionCode) || UNKNOWN,
      city: text(located.city) || UNKNOWN,
      metroCode: text(located.metroCode) || UNKNOWN,
    },
    device: text(events.find((event) => text(event.device))?.device) || "unknown",
  };
}

/**
 * Journeys plus the counts of everything that was kept out of them.
 * @param {InsightEvent[] | null | undefined} events
 */
export function partitionJourneys(events) {
  const diagnostics = {
    events: 0,
    invalidEvents: 0,
    unsupportedEvents: 0,
    sessionlessEvents: 0,
    quarantinedSessions: 0,
    quarantinedEvents: 0,
  };
  /** @type {Map<string, Array<{ event: InsightEvent, at: number, index: number }>>} */
  const bySession = new Map();
  (Array.isArray(events) ? events : []).forEach((event, index) => {
    diagnostics.events += 1;
    const at = isRecord(event) ? Date.parse(event.timestamp) : Number.NaN;
    if (!Number.isFinite(at)) diagnostics.invalidEvents += 1;
    else if (!JOURNEY_ACTIONS.has(event.action)) diagnostics.unsupportedEvents += 1;
    else if (event.schema !== "v2" || !text(event.sessionId)) diagnostics.sessionlessEvents += 1;
    else {
      const sessionId = text(event.sessionId);
      const rows = bySession.get(sessionId) ?? [];
      rows.push({ event, at, index });
      bySession.set(sessionId, rows);
    }
  });

  /** @type {Journey[]} */
  const journeys = [];
  for (const [sessionId, rows] of bySession) {
    rows.sort((left, right) => left.at - right.at || left.index - right.index);
    const codes = unique(rows.map((row) => text(row.event.campaign)).filter(Boolean));
    if (codes.length > 1) {
      diagnostics.quarantinedSessions += 1;
      diagnostics.quarantinedEvents += rows.length;
      continue;
    }
    journeys.push(journeyFrom(sessionId, rows.map((row) => row.event), codes[0] ?? null));
  }
  journeys.sort(
    (left, right) =>
      Date.parse(left.entryAt) - Date.parse(right.entryAt) || left.sessionId.localeCompare(right.sessionId),
  );
  return { journeys, diagnostics };
}

/**
 * One journey per v2 tab session, events in time order, assignment unset.
 * @param {InsightEvent[] | null | undefined} events
 * @returns {Journey[]}
 */
export function groupJourneys(events) {
  return partitionJourneys(events).journeys;
}

/** @param {Journey} journey */
function lastEventAt(journey) {
  return Date.parse(journey.events[journey.events.length - 1].timestamp);
}

/** @param {Journey} journey */
function entrySourceOf(journey) {
  return text(journey.events.find((event) => event.action === "entry")?.source) || "unknown";
}

/** @param {Journey} journey */
function hasAction(journey, action) {
  return journey.events.some((event) => event.action === action);
}

/**
 * The content a session opened, in order, repeated opens of the same item
 * collapsed. Attention and evidence events do not move the reader.
 * @param {InsightEvent[]} events
 */
function openedPath(events) {
  /** @type {string[]} */
  const path = [];
  for (const event of events) {
    const id = text(event.contentId);
    if (event.action === "content_open" && id && path[path.length - 1] !== id) path.push(id);
  }
  return path;
}

// ── Content resonance ────────────────────────────────────────────────────────

/**
 * One row per record or thread that an eligible session touched. Every rate
 * and share divides by sessions, never events. Attention is each session's
 * largest snapshot before any median. Contact counts only when it came at or
 * after the session's first event for this content.
 *
 * @param {Journey[]} journeys
 * @param {ContentCatalog} [catalog]
 * @returns {ContentSummary[]}
 */
export function summarizeContent(journeys, catalog = {}) {
  const siteSessions = journeys.length;
  const siteContact = journeys.filter((journey) => hasAction(journey, "contact_action")).length;
  /** @type {Map<string, { kind: string, rows: Array<{ assigned: boolean, entrySource: string, next: string | null, active: number | null, completion: number | null, evidence: boolean, contact: boolean }> }>} */
  const byContent = new Map();

  for (const journey of journeys) {
    /** @type {Map<string, { kind: string, firstIndex: number, entrySource: string | null, active: number | null, completion: number | null, evidence: boolean }>} */
    const seen = new Map();
    journey.events.forEach((event, index) => {
      const id = text(event.contentId);
      if (!id) return;
      let measure = seen.get(id);
      if (!measure) {
        measure = { kind: text(event.contentKind), firstIndex: index, entrySource: null, active: null, completion: null, evidence: false };
        seen.set(id, measure);
      }
      if (event.action === "content_open" && measure.entrySource === null) {
        measure.entrySource = text(event.source) || "unknown";
      }
      if (event.action === "content_attention") {
        const active = finiteOrNull(event.activeSeconds);
        const completion = finiteOrNull(event.completionPercent);
        if (active !== null) measure.active = Math.max(measure.active ?? 0, active);
        if (completion !== null) measure.completion = Math.max(measure.completion ?? 0, completion);
      }
      if (event.action === "evidence_open") measure.evidence = true;
    });

    for (const [id, measure] of seen) {
      const after = journey.events.slice(measure.firstIndex);
      const next = after.find(
        (event) => event.action === "content_open" && text(event.contentId) && text(event.contentId) !== id,
      );
      const content = byContent.get(id) ?? { kind: measure.kind, rows: [] };
      content.rows.push({
        assigned: journey.assignment !== null,
        entrySource: measure.entrySource ?? "unknown",
        next: next ? text(next.contentId) : null,
        active: measure.active,
        completion: measure.completion,
        evidence: measure.evidence,
        contact: after.some((event) => event.action === "contact_action"),
      });
      byContent.set(id, content);
    }
  }

  const baseline = siteSessions > 0 ? siteContact / siteSessions : 0;
  return [...byContent.entries()]
    .map(([contentId, { kind, rows }]) => {
      const entry = catalogEntry(catalog, contentId, kind);
      const sessions = rows.length;
      const attended = rows.filter((row) => row.active !== null || row.completion !== null);
      const evidenceSessions = rows.filter((row) => row.evidence).length;
      const contactSessions = rows.filter((row) => row.contact).length;
      const assigned = rows.filter((row) => row.assigned).length;
      const evidenceOpenRate = evidenceSessions / sessions;
      const contactActionRate = contactSessions / sessions;
      return {
        contentId,
        label: entry?.label ?? contentId,
        kind: entry?.kind ?? (kind || "unknown"),
        sessions,
        attentionSessions: attended.length,
        medianActiveSeconds: median(attended.flatMap((row) => (row.active === null ? [] : [row.active]))),
        medianCompletionPercent: median(attended.flatMap((row) => (row.completion === null ? [] : [row.completion]))),
        evidenceSessions,
        evidenceOpenRate,
        contactSessions,
        contactActionRate,
        commonEntrySource: mostCommon(rows.map((row) => row.entrySource)) ?? "unknown",
        commonNextContent: mostCommon(rows.flatMap((row) => (row.next ? [row.next] : []))),
        assignedShare: assigned / sessions,
        anonymousShare: (sessions - assigned) / sessions,
        comparison:
          sessions < MIN_PATTERN_SESSIONS
            ? NOT_ENOUGH_DATA
            : `${sessions} sessions opened this; ${percent(evidenceOpenRate)} opened its evidence and ` +
              `${percent(contactActionRate)} took a contact action afterward, against ` +
              `${percent(baseline)} contact across all ${siteSessions} sessions.`,
      };
    })
    .sort((left, right) => right.sessions - left.sessions || left.label.localeCompare(right.label));
}

// ── Audience ─────────────────────────────────────────────────────────────────

/**
 * Sessions by entry source, device, and the network location reported for
 * the request. Missing geography is `Unknown`; nothing is inferred.
 *
 * @param {Journey[]} journeys
 * @returns {AudienceSummary}
 */
export function summarizeAudience(journeys) {
  /** @type {Map<string, Geo & { sessions: number }>} */
  const locations = new Map();
  for (const { geo } of journeys) {
    const key = JSON.stringify([geo.country, geo.regionCode, geo.city, geo.metroCode]);
    const row = locations.get(key) ?? { ...geo, sessions: 0 };
    row.sessions += 1;
    locations.set(key, row);
  }
  const unknownLast = (row) => (row.country === UNKNOWN ? 1 : 0);
  return {
    sources: tally(journeys.map(entrySourceOf)),
    devices: tally(journeys.map((journey) => journey.device)),
    locations: [...locations.values()].sort(
      (left, right) =>
        right.sessions - left.sessions ||
        unknownLast(left) - unknownLast(right) ||
        [left.country, left.regionCode, left.city, left.metroCode]
          .join("|")
          .localeCompare([right.country, right.regionCode, right.city, right.metroCode].join("|")),
    ),
  };
}

// ── Aggregate journeys ───────────────────────────────────────────────────────

/**
 * @param {Array<{ path: string[] }>} rows
 * @returns {Array<{ path: string[], sessions: number }>}
 */
function tallyPaths(rows) {
  return tally(rows.map((row) => JSON.stringify(row.path))).map(({ value, sessions }) => ({
    path: /** @type {string[]} */ (JSON.parse(value)),
    sessions,
  }));
}

/**
 * Common entries, transitions, exits, and the opened-content paths that led
 * to evidence or contact. Content IDs are resolved through `labels`.
 *
 * @param {Journey[]} journeys
 * @param {ContentCatalog} [catalog]
 * @returns {JourneyPatterns}
 */
export function summarizeJourneyPatterns(journeys, catalog = {}) {
  const paths = journeys.map((journey) => ({ journey, path: openedPath(journey.events) }));
  /** @type {Record<string, string>} */
  const labels = {};
  for (const { path } of paths) {
    for (const id of path) labels[id] = catalogEntry(catalog, id)?.label ?? id;
  }
  // Sessions that opened nothing sort after content with the same count.
  const endpoint = (rows) =>
    tally(rows.map((id) => id ?? ""))
      .map(({ value, sessions }) => {
        const contentId = value || null;
        return { contentId, label: contentId === null ? NO_CONTENT_LABEL : labels[contentId], sessions };
      })
      .sort(
        (left, right) =>
          right.sessions - left.sessions || Number(left.contentId === null) - Number(right.contentId === null),
      );
  const pathBefore = (journey, action) => {
    const index = journey.events.findIndex((event) => event.action === action);
    return index < 0 ? null : { path: openedPath(journey.events.slice(0, index)) };
  };

  const transitions = tally(
    paths.flatMap(({ path }) =>
      unique(path.slice(1).map((to, index) => JSON.stringify([path[index], to]))),
    ),
  ).map(({ value, sessions }) => {
    const [from, to] = /** @type {[string, string]} */ (JSON.parse(value));
    return { from, to, sessions };
  });

  /** @type {Map<string, { path: string[], sessions: number, contactSessions: number }>} */
  const opening = new Map();
  for (const { journey, path } of paths) {
    const prefix = path.slice(0, 2);
    const key = JSON.stringify(prefix);
    const row = opening.get(key) ?? { path: prefix, sessions: 0, contactSessions: 0 };
    row.sessions += 1;
    if (hasAction(journey, "contact_action")) row.contactSessions += 1;
    opening.set(key, row);
  }

  return {
    sessions: journeys.length,
    evidenceSessions: journeys.filter((journey) => hasAction(journey, "evidence_open")).length,
    contactSessions: journeys.filter((journey) => hasAction(journey, "contact_action")).length,
    labels,
    entries: endpoint(paths.map(({ path }) => path[0] ?? null)),
    transitions,
    exits: endpoint(paths.map(({ path }) => path[path.length - 1] ?? null)),
    reachingEvidence: tallyPaths(journeys.flatMap((journey) => pathBefore(journey, "evidence_open") ?? [])),
    reachingContact: tallyPaths(journeys.flatMap((journey) => pathBefore(journey, "contact_action") ?? [])),
    openingPaths: [...opening.values()].sort(
      (left, right) =>
        right.sessions - left.sessions || JSON.stringify(left.path).localeCompare(JSON.stringify(right.path)),
    ),
  };
}

// ── Sources ──────────────────────────────────────────────────────────────────

/**
 * A SourceState, or a bare snapshot value from the pre-source-state CLI.
 * @param {unknown} input
 * @returns {SourceState}
 */
function resolveSource(input) {
  if (isRecord(input) && SOURCE_STATUSES.has(input.status) && "value" in input) {
    return {
      status: input.status,
      capturedAt: typeof input.capturedAt === "string" ? input.capturedAt : null,
      value: input.value,
    };
  }
  if (!isRecord(input) || input.error) return { status: "unavailable", capturedAt: null, value: null };
  return { status: "fresh", capturedAt: null, value: input };
}

/**
 * Only a fresh, error-free value may produce a finding. A stale value is the
 * last-known-good of another window; comparing it again would repeat an old
 * finding under a new window's label.
 * @param {SourceState} state
 */
function findingValue(state) {
  return state.status === "fresh" && isRecord(state.value) && !state.value.error ? state.value : null;
}

/** @param {SourceState} state @returns {ClaritySignals | null} */
function claritySignals(state) {
  const value = findingValue(state);
  const sessions = finiteOrNull(value?.traffic?.sessions);
  if (!value || sessions === null) return null;
  return {
    sessions,
    frustration: (Array.isArray(value.frustration) ? value.frustration : [])
      .filter((row) => isRecord(row) && text(row.label) && finiteOrNull(row.sessionShare) !== null)
      .map((row) => ({ label: text(row.label), value: finiteOrNull(row.value) ?? 0, sessionShare: row.sessionShare })),
  };
}

/** @param {SourceState} state @returns {CloudflareSignals | null} */
function cloudflareSignals(state) {
  const value = findingValue(state);
  if (!value) return null;
  const edge = isRecord(value.edge) && !value.edge.error ? value.edge : null;
  const detail = edge && isRecord(edge.detail) && !edge.detail.error ? edge.detail : null;
  const performance = isRecord(value.performance) ? value.performance : null;
  const samples = finiteOrNull(performance?.samples);
  return {
    serverErrors: finiteOrNull(detail?.serverErrors),
    statusRequests: finiteOrNull(detail?.statusRequests),
    performance:
      performance && samples !== null && samples > 0
        ? {
            samples,
            firstContentfulPaintP75: finiteOrNull(performance.firstContentfulPaint?.p75),
            pageLoadTimeP75: finiteOrNull(performance.pageLoadTime?.p75),
          }
        : null,
  };
}

/**
 * @param {unknown} input
 * @returns {PortfolioAssignment[] | null} Null when identity resolution is unavailable.
 */
function resolveAssignments(input) {
  if (Array.isArray(input)) return input;
  const state = isRecord(input) && SOURCE_STATUSES.has(input.status) ? input : null;
  return state && state.status !== "unavailable" && Array.isArray(state.value) ? state.value : null;
}

// ── Aggregate history ────────────────────────────────────────────────────────

/**
 * The part of a run that may be kept indefinitely: counts by content,
 * location, source, and device, plus the source signals findings compare.
 * No names, companies, jobs, campaign codes, session IDs, or event sequences.
 *
 * `journeys` says whether the run had journey data at all. When it did not,
 * the session counts below are zero by construction, not an observed zero,
 * and no later run may compare against them. A row without the field
 * predates it and is read as unavailable.
 *
 * @param {FindingInput} intelligence
 * @returns {HistorySummary}
 */
export function summarizeForHistory(intelligence) {
  const patterns = intelligence.journeyPatterns;
  const reportWindow = intelligence.window;
  return {
    version: 1,
    window: reportWindow
      ? { start: reportWindow.start, end: reportWindow.end, label: reportWindow.label }
      : null,
    journeys: intelligence.diagnostics?.journeySource === "available" ? "available" : "unavailable",
    sessions: patterns?.sessions ?? 0,
    evidenceSessions: patterns?.evidenceSessions ?? 0,
    contactSessions: patterns?.contactSessions ?? 0,
    content: (intelligence.content ?? []).map((row) => ({
      contentId: row.contentId,
      sessions: row.sessions,
      attentionSessions: row.attentionSessions,
      evidenceSessions: row.evidenceSessions,
      contactSessions: row.contactSessions,
      medianActiveSeconds: row.medianActiveSeconds,
      medianCompletionPercent: row.medianCompletionPercent,
    })),
    locations: (intelligence.audience?.locations ?? []).map((row) => ({ ...row })),
    sources: (intelligence.audience?.sources ?? []).map((row) => ({ ...row })),
    devices: (intelligence.audience?.devices ?? []).map((row) => ({ ...row })),
    clarity: intelligence.signals?.clarity ?? null,
    cloudflare: intelligence.signals?.cloudflare ?? null,
  };
}

// ── Findings ─────────────────────────────────────────────────────────────────

/** @param {PortfolioAssignment} assignment */
function linkSubject(assignment) {
  const name = text(assignment.person?.name);
  return name ? `Activity from ${name}'s assigned link` : "Activity from an unassigned outreach link";
}

/**
 * @param {FindingInput["assignedLinks"]} links
 * @param {string} currentWindow
 * @returns {Finding[]}
 */
function assignedLinkFindings(links = [], currentWindow) {
  const findings = [];
  for (const { assignment, journeys } of links) {
    const ordered = [...journeys].sort((left, right) => Date.parse(left.entryAt) - Date.parse(right.entryAt));
    let latest = Number.NEGATIVE_INFINITY;
    let returned = 0;
    let longestGap = 0;
    for (const journey of ordered) {
      const gap = Date.parse(journey.entryAt) - latest;
      // The link's first session in the window has nothing earlier to return to.
      if (Number.isFinite(latest) && gap >= RETURN_GAP_HOURS * HOUR_MS) {
        returned += 1;
        longestGap = Math.max(longestGap, gap);
      }
      latest = Math.max(latest, lastEventAt(journey));
    }
    if (returned === 0) continue;
    findings.push({
      kind: /** @type {const} */ ("assigned-link"),
      message:
        `${linkSubject(assignment)} returned after ${Math.floor(longestGap / HOUR_MS)} hours: ` +
        `${returned} of ${ordered.length} link sessions began at least ${RETURN_GAP_HOURS} hours ` +
        "after earlier activity on the link.",
      count: returned,
      denominator: ordered.length,
      currentWindow,
      comparisonWindow: `earlier activity on the same link in ${currentWindow}`,
    });
  }
  return findings;
}

/**
 * Findings from the declared rules only. Each needs at least five eligible
 * sessions or samples on every side of its comparison, except a returning
 * assigned link, which reports one link's own sessions. A missing prior
 * window or unavailable source yields no finding, never a comparison with zero.
 *
 * @param {FindingInput} current
 * @param {HistorySummary | null | undefined} previous
 * @returns {Finding[]}
 */
export function deriveFindings(current, previous) {
  const currentWindow = current.window?.label ?? "current window";
  const priorWindow = previous?.window?.label ?? "prior window";
  const now = summarizeForHistory(current);
  const labels = new Map((current.content ?? []).map((row) => [row.contentId, row.label]));
  const labelOf = (id) => labels.get(id) ?? current.journeyPatterns?.labels?.[id] ?? id;
  /** @type {Finding[]} */
  const findings = [...assignedLinkFindings(current.assignedLinks, currentWindow)];

  if (previous) {
    const before = new Map((previous.content ?? []).map((row) => [row.contentId, row]));
    for (const row of now.content) {
      const prior = before.get(row.contentId);
      if (!prior || row.sessions < MIN_PATTERN_SESSIONS || prior.sessions < MIN_PATTERN_SESSIONS) continue;
      const rate = row.evidenceSessions / row.sessions;
      const priorRate = prior.evidenceSessions / prior.sessions;
      const change = points(rate - priorRate);
      if (Math.abs(change) < MATERIAL_RATE_CHANGE_POINTS) continue;
      findings.push({
        kind: "content",
        message:
          `${labelOf(row.contentId)} evidence-open rate ${change > 0 ? "rose" : "fell"} from ` +
          `${percent(priorRate)} (${prior.evidenceSessions} of ${prior.sessions} sessions) to ` +
          `${percent(rate)} (${row.evidenceSessions} of ${row.sessions} sessions).`,
        count: row.evidenceSessions,
        denominator: row.sessions,
        currentWindow,
        comparisonWindow: priorWindow,
      });
    }
  }

  const catalog = current.contentCatalog ?? {};
  for (const row of current.content ?? []) {
    const hasEvidence = (catalogEntry(catalog, row.contentId)?.evidenceCount ?? 0) > 0;
    if (
      !hasEvidence ||
      row.sessions < MIN_PATTERN_SESSIONS ||
      row.attentionSessions < MIN_PATTERN_SESSIONS ||
      row.medianCompletionPercent === null ||
      row.medianCompletionPercent < STRONG_COMPLETION_PERCENT ||
      points(row.evidenceOpenRate) >= WEAK_EVIDENCE_RATE_PERCENT
    ) {
      continue;
    }
    findings.push({
      kind: "content",
      message:
        `${row.label} holds attention but its evidence is rarely opened: median completion ` +
        `${Math.round(row.medianCompletionPercent)}% across ${row.attentionSessions} sessions with attention, ` +
        `evidence opened in ${row.evidenceSessions} of ${row.sessions} sessions (${percent(row.evidenceOpenRate)}).`,
      count: row.evidenceSessions,
      denominator: row.sessions,
      currentWindow,
      comparisonWindow:
        `fixed thresholds in ${currentWindow}: median completion at least ${STRONG_COMPLETION_PERCENT}%, ` +
        `evidence-open rate below ${WEAK_EVIDENCE_RATE_PERCENT}%`,
    });
  }

  const patterns = current.journeyPatterns;
  if (patterns && patterns.sessions >= MIN_PATTERN_SESSIONS) {
    const baseline = patterns.contactSessions / patterns.sessions;
    for (const row of patterns.openingPaths) {
      if (row.path.length === 0 || row.sessions < MIN_PATTERN_SESSIONS) continue;
      const rate = row.contactSessions / row.sessions;
      if (points(rate - baseline) < PATH_CONTACT_LIFT_POINTS) continue;
      findings.push({
        kind: "content",
        message:
          `Sessions that opened ${row.path.map(labelOf).join(" → ")} reached a contact action in ` +
          `${row.contactSessions} of ${row.sessions} (${percent(rate)}), against ${percent(baseline)} ` +
          `of all ${patterns.sessions} sessions.`,
        count: row.contactSessions,
        denominator: row.sessions,
        currentWindow,
        comparisonWindow: `site baseline in ${currentWindow}`,
      });
    }
  }

  if (previous) {
    // "No sessions" is only a claim when the prior window had journey data
    // and enough of it; a missing or thin prior window is not a zero.
    const priorJourneysUsable =
      previous.journeys === "available" && (previous.sessions ?? 0) >= MIN_PATTERN_SESSIONS;
    const cityKey = (row) => JSON.stringify([row.country, row.regionCode, row.city]);
    const priorCities = new Set(
      (previous.locations ?? []).filter((row) => row.sessions > 0 && row.city !== UNKNOWN).map(cityKey),
    );
    /** @type {Map<string, Geo & { sessions: number }>} */
    const cities = new Map();
    for (const row of priorJourneysUsable ? now.locations : []) {
      if (row.city === UNKNOWN) continue;
      const key = cityKey(row);
      const city = cities.get(key) ?? { ...row, metroCode: UNKNOWN, sessions: 0 };
      city.sessions += row.sessions;
      cities.set(key, city);
    }
    for (const [key, row] of cities) {
      if (row.sessions < MIN_PATTERN_SESSIONS || priorCities.has(key)) continue;
      const place = [row.city, row.regionCode, row.country].filter((part) => part !== UNKNOWN).join(", ");
      findings.push({
        kind: "geography",
        message:
          `${row.sessions} of ${now.sessions} sessions came from a network location reported as ${place}, ` +
          `which had no sessions in ${priorWindow}.`,
        count: row.sessions,
        denominator: now.sessions,
        currentWindow,
        comparisonWindow: priorWindow,
      });
    }

    const clarity = now.clarity;
    const priorClarity = previous.clarity;
    if (clarity && priorClarity && clarity.sessions >= MIN_PATTERN_SESSIONS && priorClarity.sessions >= MIN_PATTERN_SESSIONS) {
      const priorSignals = new Map(priorClarity.frustration.map((row) => [row.label, row]));
      for (const row of clarity.frustration) {
        const prior = priorSignals.get(row.label);
        if (!prior || points(row.sessionShare - prior.sessionShare) < FRUSTRATION_RISE_POINTS) continue;
        const affected = Math.round(row.sessionShare * clarity.sessions);
        findings.push({
          kind: "frustration",
          message:
            `${row.label} appeared in ${percent(row.sessionShare)} of Clarity sessions ` +
            `(${affected} of ${clarity.sessions}), up from ${percent(prior.sessionShare)} in ${priorWindow}.`,
          count: affected,
          denominator: clarity.sessions,
          currentWindow,
          comparisonWindow: priorWindow,
        });
      }
    }

    const edge = now.cloudflare;
    const priorEdge = previous.cloudflare;
    // The prior rate needs a real denominator: 0 of 4 responses is not a 0% baseline.
    if (
      edge?.serverErrors != null && edge.statusRequests &&
      priorEdge?.serverErrors != null && priorEdge.statusRequests != null &&
      priorEdge.statusRequests >= MIN_PATTERN_SESSIONS &&
      edge.serverErrors >= SERVER_ERROR_MIN_COUNT
    ) {
      const rate = edge.serverErrors / edge.statusRequests;
      const priorRate = priorEdge.serverErrors / priorEdge.statusRequests;
      if (points(rate - priorRate) >= SERVER_ERROR_RISE_POINTS) {
        findings.push({
          kind: "error",
          message:
            `Server errors (5xx) were ${(rate * 100).toFixed(1)}% of edge responses ` +
            `(${edge.serverErrors} of ${edge.statusRequests}), up from ${(priorRate * 100).toFixed(1)}% in ${priorWindow}.`,
          count: edge.serverErrors,
          denominator: edge.statusRequests,
          currentWindow,
          comparisonWindow: priorWindow,
        });
      }
    }

    const vitals = edge?.performance;
    const priorVitals = priorEdge?.performance;
    if (vitals && priorVitals && vitals.samples >= MIN_PATTERN_SESSIONS && priorVitals.samples >= MIN_PATTERN_SESSIONS) {
      for (const [label, key] of /** @type {const} */ ([
        ["First contentful paint", "firstContentfulPaintP75"],
        ["Page load", "pageLoadTimeP75"],
      ])) {
        const value = vitals[key];
        const prior = priorVitals[key];
        if (value === null || prior === null || prior <= 0) continue;
        // Integer comparison: value / prior >= 1.2 without float drift.
        if (value * 100 < prior * (100 + VITALS_REGRESSION_PERCENT) || value - prior < VITALS_REGRESSION_MS) continue;
        findings.push({
          kind: "performance",
          message:
            `${label} p75 rose from ${prior} ms in ${priorWindow} to ${value} ms across ${vitals.samples} samples.`,
          count: vitals.samples,
          denominator: vitals.samples,
          currentWindow,
          comparisonWindow: priorWindow,
        });
      }
    }
  }

  return findings;
}

// ── Assembly ─────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   events: InsightEvent[] | null | undefined,
 *   assignments: PortfolioAssignment[] | SourceState | null | undefined,
 *   contentCatalog?: ContentCatalog,
 *   clarity?: unknown,
 *   cloudflare?: unknown,
 *   previous?: HistorySummary | null,
 *   window: ReportWindow,
 * }} input
 * @returns {PortfolioIntelligence}
 */
export function buildPortfolioIntelligence({
  events,
  assignments,
  contentCatalog = {},
  clarity,
  cloudflare,
  previous = null,
  window: reportWindow,
}) {
  const { journeys: grouped, diagnostics: grouping } = partitionJourneys(events);
  const journeySource = Array.isArray(events) ? "available" : "unavailable";
  const identity = resolveAssignments(assignments);

  /** @type {Map<string, PortfolioAssignment>} */
  const byCode = new Map();
  const duplicates = new Set();
  for (const assignment of identity ?? []) {
    const code = text(assignment?.campaignCode);
    if (!code) continue;
    if (byCode.has(code)) duplicates.add(code);
    else byCode.set(code, assignment);
  }
  for (const code of duplicates) byCode.delete(code);

  const journeys = grouped.map((journey) => ({
    ...journey,
    assignment: journey.campaignCode ? (byCode.get(journey.campaignCode) ?? null) : null,
  }));
  const coded = journeys.filter((journey) => journey.campaignCode && !journey.assignment);
  const unmappedCampaignCodes =
    identity === null
      ? []
      : unique(coded.map((journey) => /** @type {string} */ (journey.campaignCode)).filter((code) => !duplicates.has(code))).sort();

  const assignedLinks = [...byCode.values()]
    .map((assignment) => ({
      assignment,
      journeys: journeys.filter((journey) => journey.assignment === assignment),
    }))
    .sort((left, right) => {
      const latest = (link) => (link.journeys.length ? Math.max(...link.journeys.map(lastEventAt)) : Number.NEGATIVE_INFINITY);
      const sent = (link) => Date.parse(link.assignment.sentAt ?? "") || Number.NEGATIVE_INFINITY;
      return (
        latest(right) - latest(left) ||
        sent(right) - sent(left) ||
        left.assignment.campaignCode.localeCompare(right.assignment.campaignCode)
      );
    });
  // Infinity minus Infinity is NaN, which sort treats as equal; the chain above
  // falls through to the campaign code for two idle links.

  const clarityState = resolveSource(clarity);
  const cloudflareState = resolveSource(cloudflare);
  const current = {
    window: reportWindow,
    assignedLinks,
    content: summarizeContent(journeys, contentCatalog),
    audience: summarizeAudience(journeys),
    journeyPatterns: summarizeJourneyPatterns(journeys, contentCatalog),
    signals: { clarity: claritySignals(clarityState), cloudflare: cloudflareSignals(cloudflareState) },
    contentCatalog,
    diagnostics: { journeySource },
  };

  return {
    findings: deriveFindings(current, previous),
    assignedLinks,
    anonymousJourneys: journeys.filter((journey) => journey.assignment === null),
    content: current.content,
    audience: current.audience,
    journeyPatterns: current.journeyPatterns,
    signals: current.signals,
    window: reportWindow,
    diagnostics: {
      journeySource,
      ...grouping,
      sessions: journeys.length,
      assignedSessions: journeys.length - journeys.filter((journey) => journey.assignment === null).length,
      anonymousSessions: journeys.filter((journey) => journey.assignment === null).length,
      identityResolution: identity === null ? "unavailable" : "available",
      duplicateCampaignCodes: [...duplicates].sort(),
      unmappedCampaignCodes,
      unmappedCampaignSessions: identity === null ? 0 : coded.filter((journey) => !duplicates.has(/** @type {string} */ (journey.campaignCode))).length,
      unresolvedCampaignSessions: identity === null ? coded.length : 0,
      configurationErrors: [
        ...[...duplicates].sort().map((code) => `duplicate campaign code: ${code}`),
        ...unmappedCampaignCodes.map((code) => `unmapped campaign code: ${code}`),
      ],
      sources: { clarity: clarityState.status, cloudflare: cloudflareState.status },
      thresholds: {
        minPatternSessions: MIN_PATTERN_SESSIONS,
        returnGapHours: RETURN_GAP_HOURS,
        materialRateChangePoints: MATERIAL_RATE_CHANGE_POINTS,
        strongCompletionPercent: STRONG_COMPLETION_PERCENT,
        weakEvidenceRatePercent: WEAK_EVIDENCE_RATE_PERCENT,
        pathContactLiftPoints: PATH_CONTACT_LIFT_POINTS,
        frustrationRisePoints: FRUSTRATION_RISE_POINTS,
        serverErrorMinCount: SERVER_ERROR_MIN_COUNT,
        serverErrorRisePoints: SERVER_ERROR_RISE_POINTS,
        vitalsRegressionPercent: VITALS_REGRESSION_PERCENT,
        vitalsRegressionMs: VITALS_REGRESSION_MS,
      },
    },
  };
}
