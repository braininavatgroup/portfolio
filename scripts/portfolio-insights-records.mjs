// What an insights run keeps between runs, and for how long — independent of
// where it is kept.
//
// One run's records are a flat set of named entries inside one location:
//
//   source-clarity.json      { capturedAt, value }   kept until replaced
//   source-cloudflare.json   { capturedAt, value }   kept until replaced
//   source-insights.json     { capturedAt, value }   kept until replaced
//   source-airtable.json     { capturedAt, value }   identity-bearing
//                            or { capturedAt, value: null, configurationErrors }
//                            after a configuration error, until a clean read
//   raw-events-YYYY-MM-DDTHH-MM-SS-sssZ.json         named by capture time
//                            { capturedAt, windowStart?, truncated?, events }
//                            deleted once windowStart (or, for entries written
//                            before it was stored, the capture time) is more
//                            than 180 days old; no event older than that is
//                            ever read back
//   history.jsonl, dashboard.html                    never pruned here
//
// `recordStore` turns a backend — read, write, list, remove over those names —
// into the storage port `runInsights` uses. The two backends are
// `portfolio-insights-storage.mjs`, a 0700 directory of 0600 files on the Mac,
// and `worker/portfolio-insights-store.ts`, an R2 bucket behind the scheduled
// Worker. Retention, last-known-good, and configuration-error rules live here
// so both obey one copy of them.
//
// How a run is expected to call the port, per source:
//   const previous = await readSourceSnapshot(dir, name);
//   try {
//     const fresh = parse(await fetchSource());           // parse must succeed
//     await writeSourceSnapshot(dir, name, fresh, capturedAt);
//     state = resolveSourceResult({ fresh, previous, capturedAt });
//   } catch (error) {
//     state = resolveSourceResult({ previous, error, capturedAt });
//   }
// Write a source snapshot only after its response parsed successfully; a
// failed or unparsed fetch never touches the entry, so the prior value stays
// the last-known-good one. Then, in order:
//   1. writeRawEvents(dir, events, capturedAt) for event-level results;
//   2. appendHistoryRow(dir, row) and writeDashboard(dir, html);
//   3. pruneRawSnapshots(dir, now) — only after both writes in step 2 have
//      succeeded, so an aborted run never loses the raw events it summarised.

/** @typedef {"clarity" | "cloudflare" | "insights" | "airtable"} SourceName */
/** @typedef {{ capturedAt: string; value: unknown; configurationErrors?: string[] }} SourceSnapshot */
/**
 * @typedef {{
 *   status: "fresh" | "stale" | "unavailable";
 *   capturedAt: string | null;
 *   value: unknown;
 *   error?: string;
 * }} SourceState
 */
/**
 * Named entries inside one location. `location` is opaque: a directory path
 * for the local backend, a key prefix for the Worker's.
 *
 * `read` answers null for an entry that is not there, and `write` replaces an
 * entry atomically — a torn write must leave the previous value readable,
 * because that value is the last-known-good one a failing run falls back to.
 *
 * @typedef {{
 *   ensure: (location: any) => Promise<void>;
 *   read: (location: any, name: string) => Promise<string | null>;
 *   write: (location: any, name: string, contents: string) => Promise<void>;
 *   list: (location: any) => Promise<string[]>;
 *   remove: (location: any, name: string) => Promise<void>;
 *   describe: (location: any, name: string) => string;
 * }} RecordBackend
 */

export const SOURCE_NAMES = Object.freeze(["clarity", "cloudflare", "insights", "airtable"]);
export const RAW_EVENTS_RETENTION_DAYS = 180;
// The longest window a run can read (`--days` is capped at 30), so an entry's
// recorded `windowStart` is never more than this before its capture. Pruning
// uses it to tell, from the name alone, which entries could possibly be
// expired: at steady state that is none, so the daily prune opens nothing.
// That matters most at the edge, where each read is a round trip inside a
// scheduled Worker's CPU budget rather than a local file read.
const MAX_WINDOW_DAYS = 30;
export const HISTORY_ENTRY = "history.jsonl";
export const DASHBOARD_ENTRY = "dashboard.html";
const ERROR_MESSAGE_LIMIT = 300;
const DAY_MS = 86_400_000;
const RAW_EVENTS_PATTERN = /^raw-events-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/u;

/** @param {string} source @returns {string} */
export function sourceEntryName(source) {
  if (!SOURCE_NAMES.includes(source)) throw new Error(`unknown insight source: ${String(source)}`);
  return `source-${source}.json`;
}

/** @param {string | Date} capturedAt @returns {string} canonical ISO time */
function isoTime(capturedAt) {
  const time = new Date(capturedAt);
  if (typeof capturedAt === "number" || Number.isNaN(time.getTime())) {
    throw new Error(`invalid capturedAt: ${String(capturedAt)}`);
  }
  return time.toISOString();
}

/** @param {unknown} error @returns {string} the message only, bounded */
function errorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, ERROR_MESSAGE_LIMIT);
}

/** @param {string | Date} capturedAt @returns {string} */
export function rawEventsFileName(capturedAt) {
  return `raw-events-${isoTime(capturedAt).replace(/[:.]/gu, "-")}.json`;
}

/** @param {string} name @returns {number | null} capture time from a raw-events entry name */
function rawEventsTime(name) {
  const match = RAW_EVENTS_PATTERN.exec(name);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, ms] = match.map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, second, ms);
}

/**
 * When a raw entry's retention clock started: its recorded window start, or
 * its capture time for entries written before the window was stored.
 * @param {Record<string, unknown> | null} parsed
 * @param {number} capturedMs
 */
function retentionAnchor(parsed, capturedMs) {
  const start = typeof parsed?.windowStart === "string" ? Date.parse(parsed.windowStart) : Number.NaN;
  return Number.isFinite(start) ? Math.min(start, capturedMs) : capturedMs;
}

/**
 * How a run reads one source's state, given what this run fetched and what the
 * last good run left. Pure, and shared by every backend: `fresh` wins, a
 * failure falls back to `previous` as stale, and neither leaves the source
 * unavailable with `value` null so nothing downstream reads it as zero.
 *
 * @param {{ fresh?: unknown; previous?: SourceSnapshot | null; error?: unknown; capturedAt: string }} options
 * @returns {SourceState}
 */
export function resolveSourceResult({ fresh, previous, error, capturedAt }) {
  const failed = error !== undefined && error !== null;
  if (!failed && fresh !== undefined) return { status: "fresh", capturedAt, value: fresh };
  const detail = failed ? { error: errorMessage(error) } : {};
  if (previous) return { status: "stale", capturedAt: previous.capturedAt, value: previous.value, ...detail };
  return { status: "unavailable", capturedAt: null, value: null, ...detail };
}

/**
 * The storage port over one backend.
 * @param {RecordBackend} backend
 * @returns {import("./portfolio-insights-storage.mjs").InsightStorage}
 */
export function recordStore(backend) {
  /**
   * An entry that is absent, torn, or not a JSON object reads as null, and so
   * does one the backend could not read at all. Only the raw-event entries go
   * through this: a raw entry the next run cannot parse is one lost fallback,
   * while an unreadable source snapshot is a storage fault worth surfacing.
   */
  const readObject = async (location, name) => {
    let text;
    try {
      text = await backend.read(location, name);
    } catch {
      return null;
    }
    return parseObject(text);
  };

  /** @param {string | null | undefined} text */
  const parseObject = (text) => {
    if (text === null || text === undefined) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      // A torn or hand-edited entry is treated as absent, not as a crash.
      return null;
    }
  };

  /**
   * The last-known-good snapshot for one source, or null when none exists or
   * the entry is unreadable as a snapshot. A backend read that fails for any
   * other reason propagates.
   */
  const readSourceSnapshot = async (location, source) => {
    const parsed = parseObject(await backend.read(location, sourceEntryName(source)));
    if (!parsed || typeof parsed.capturedAt !== "string" || !("value" in parsed)) return null;
    const problems = Array.isArray(parsed.configurationErrors)
      ? parsed.configurationErrors.filter((problem) => typeof problem === "string" && problem !== "")
      : [];
    return {
      capturedAt: parsed.capturedAt,
      value: parsed.value,
      ...(problems.length > 0 ? { configurationErrors: problems } : {}),
    };
  };

  const writeSnapshotEntry = async (location, source, body) => {
    const name = sourceEntryName(source);
    await backend.ensure(location);
    await backend.write(location, name, `${JSON.stringify(body)}\n`);
    return backend.describe(location, name);
  };

  /**
   * Replaces one source's last-known-good value. Refuses an Error or an
   * undefined value so a failed fetch can never overwrite it.
   */
  const writeSourceSnapshot = async (location, source, value, capturedAt) => {
    sourceEntryName(source);
    if (value instanceof Error) throw new Error(`refusing to store an error as the ${source} snapshot`);
    if (value === undefined) throw new Error(`refusing to store an undefined ${source} snapshot`);
    return writeSnapshotEntry(location, source, { capturedAt: isoTime(capturedAt), value });
  };

  /**
   * Replaces one source's entry with the configuration problems that make it
   * unusable. The saved value rests on the same broken configuration, so it is
   * replaced rather than kept: a stored configuration error outranks any saved
   * value until a fetch parses cleanly.
   */
  const writeSourceConfigurationError = async (location, source, problems, capturedAt) => {
    sourceEntryName(source);
    if (
      !Array.isArray(problems) ||
      problems.length === 0 ||
      problems.some((problem) => typeof problem !== "string" || problem === "")
    ) {
      throw new Error(`refusing to store an empty ${source} configuration error`);
    }
    return writeSnapshotEntry(location, source, {
      capturedAt: isoTime(capturedAt),
      value: null,
      configurationErrors: problems,
    });
  };

  /**
   * Writes one run's event-level results as their own expiring entry.
   * `truncated` records whether the read hit its row cap, which the rows alone
   * cannot say once decoding has dropped some. `windowStart` is the start of
   * the window the rows cover; retention ages the entry from it, because the
   * oldest event is as old as the window, not as the capture.
   */
  const writeRawEvents = async (location, events, capturedAt, { truncated, windowStart } = {}) => {
    if (!Array.isArray(events)) throw new Error("raw events must be an array");
    const at = isoTime(capturedAt);
    const name = rawEventsFileName(at);
    await backend.ensure(location);
    await backend.write(
      location,
      name,
      `${JSON.stringify({
        capturedAt: at,
        ...(windowStart !== undefined ? { windowStart: isoTime(windowStart) } : {}),
        ...(typeof truncated === "boolean" ? { truncated } : {}),
        events,
      })}\n`,
    );
    return backend.describe(location, name);
  };

  /**
   * Deletes raw-event entries whose name timestamp is more than
   * `retentionDays` before `now`. Age comes from the name, not from any
   * modification time, so copying or touching an entry cannot extend or
   * shorten its life. Source snapshots, history, the dashboard, and
   * unparseable names are never touched.
   */
  const pruneRawSnapshots = async (location, now, retentionDays = RAW_EVENTS_RETENTION_DAYS) => {
    const nowMs = new Date(now).getTime();
    if (Number.isNaN(nowMs)) throw new Error(`invalid now: ${String(now)}`);
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
      throw new Error(`invalid retentionDays: ${String(retentionDays)}`);
    }
    const cutoff = nowMs - retentionDays * DAY_MS;
    const deleted = [];
    for (const name of (await backend.list(location)).sort()) {
      const capturedMs = rawEventsTime(name);
      if (capturedMs === null) continue;
      // The name alone settles both ends. A capture that is itself expired goes
      // without a read, because the window never starts after the capture; a
      // capture newer than the cutoff by more than the longest possible window
      // also goes without one, because no `windowStart` it could carry reaches
      // back past the cutoff. Only the band between them is opened.
      if (capturedMs - MAX_WINDOW_DAYS * DAY_MS >= cutoff) continue;
      if (capturedMs >= cutoff && retentionAnchor(await readObject(location, name), capturedMs) >= cutoff) continue;
      await backend.remove(location, name);
      deleted.push(backend.describe(location, name));
    }
    return deleted;
  };

  /**
   * The newest raw-events entry still inside retention that parses, or null.
   * The run shows it as stale journeys when the event-level read fails, so the
   * same rule as pruning applies before pruning runs: an entry whose window
   * began more than `retentionDays` ago is never read, and any single event
   * older than that is dropped from the answer.
   */
  const readLatestRawEvents = async (location, now, retentionDays = RAW_EVENTS_RETENTION_DAYS) => {
    const nowMs = new Date(now).getTime();
    if (Number.isNaN(nowMs)) throw new Error(`invalid now: ${String(now)}`);
    const cutoff = nowMs - retentionDays * DAY_MS;
    const newestFirst = (await backend.list(location))
      .map((name) => ({ name, at: rawEventsTime(name) }))
      .filter((entry) => entry.at !== null && entry.at >= cutoff)
      .sort((left, right) => Number(right.at) - Number(left.at));
    for (const { name, at } of newestFirst) {
      // A torn entry is skipped; the next newest one may still be good.
      const parsed = await readObject(location, name);
      if (!parsed || typeof parsed.capturedAt !== "string" || !Array.isArray(parsed.events)) continue;
      if (retentionAnchor(parsed, Number(at)) < cutoff) continue;
      const events = parsed.events.filter((event) => {
        const time = Date.parse(event?.timestamp);
        return !Number.isFinite(time) || time >= cutoff;
      });
      return {
        capturedAt: parsed.capturedAt,
        events,
        ...(typeof parsed.truncated === "boolean" ? { truncated: parsed.truncated } : {}),
      };
    }
    return null;
  };

  /**
   * Every past run's aggregate row, oldest first. A line that does not parse
   * comes back as null rather than dropping out, because a row's position is
   * what "the previous run" means; history is never pruned here.
   */
  const readHistory = async (location) => {
    const text = await backend.read(location, HISTORY_ENTRY);
    if (text === null || text === undefined) return [];
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
  };

  /**
   * Adds one run's aggregate row to history. The entry is rewritten whole
   * through the atomic writer rather than appended to, so a torn write cannot
   * leave a half-row behind; a value that did not end in a newline gets one
   * first.
   */
  const appendHistoryRow = async (location, row) => {
    const existing = (await backend.read(location, HISTORY_ENTRY)) ?? "";
    const separator = existing && !existing.endsWith("\n") ? "\n" : "";
    await backend.ensure(location);
    await backend.write(location, HISTORY_ENTRY, `${existing}${separator}${JSON.stringify(row)}\n`);
  };

  /** Replaces the rendered dashboard. */
  const writeDashboard = async (location, html) => {
    await backend.ensure(location);
    await backend.write(location, DASHBOARD_ENTRY, html);
    return backend.describe(location, DASHBOARD_ENTRY);
  };

  return {
    ensurePrivateDirectory: (location) => backend.ensure(location),
    readSourceSnapshot,
    writeSourceSnapshot,
    writeSourceConfigurationError,
    resolveSourceResult,
    writeRawEvents,
    readLatestRawEvents,
    pruneRawSnapshots,
    readHistory,
    appendHistoryRow,
    writeDashboard,
  };
}
