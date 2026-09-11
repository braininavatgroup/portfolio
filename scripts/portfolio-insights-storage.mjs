// Local, private storage for the insights run: one last-known-good snapshot
// per source, event-level raw files that expire, and an atomic 0600 writer
// for anything else in the insight directory (the dashboard HTML, history).
//
// Layout inside the insight directory (mode 0700):
//   source-clarity.json      { capturedAt, value }   kept until replaced
//   source-cloudflare.json   { capturedAt, value }   kept until replaced
//   source-insights.json     { capturedAt, value }   kept until replaced
//   source-airtable.json     { capturedAt, value }   identity-bearing, 0600
//   raw-events-YYYY-MM-DDTHH-MM-SS-sssZ.json         deleted after 180 days
//   history.jsonl, dashboard.html                    never pruned here
//
// How the CLI (runInsights) is expected to call this, per source:
//   const previous = await readSourceSnapshot(dir, name);
//   try {
//     const fresh = parse(await fetchSource());           // parse must succeed
//     await writeSourceSnapshot(dir, name, fresh, capturedAt);
//     state = resolveSourceResult({ fresh, previous, capturedAt });
//   } catch (error) {
//     state = resolveSourceResult({ previous, error, capturedAt });
//   }
// Write a source snapshot only after its response parsed successfully; a
// failed or unparsed fetch never touches the file, so the prior value stays
// the last-known-good one. Then, in order:
//   1. writeRawEvents(dir, events, capturedAt) for event-level results;
//   2. append aggregate history and writePrivateFile(dashboard, html);
//   3. pruneRawSnapshots(dir, now) — only after both writes in step 2 have
//      succeeded, so an aborted run never loses the raw events it summarised.
// Directories may be passed as a path string or a file: URL (the CLI keeps
// its history directory as a URL).

import { randomBytes } from "node:crypto";
import { chmod, mkdir, readdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {"clarity" | "cloudflare" | "insights" | "airtable"} SourceName */
/** @typedef {{ capturedAt: string; value: unknown }} SourceSnapshot */
/**
 * @typedef {{
 *   status: "fresh" | "stale" | "unavailable";
 *   capturedAt: string | null;
 *   value: unknown;
 *   error?: string;
 * }} SourceState
 */

export const SOURCE_NAMES = Object.freeze(["clarity", "cloudflare", "insights", "airtable"]);
export const RAW_EVENTS_RETENTION_DAYS = 180;
const ERROR_MESSAGE_LIMIT = 300;
const DAY_MS = 86_400_000;
const RAW_EVENTS_PATTERN = /^raw-events-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/u;

/** @param {string | URL} directory @returns {string} */
const toPath = (directory) => (directory instanceof URL ? fileURLToPath(directory) : directory);

/** @param {string} source @returns {string} */
function sourceFileName(source) {
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

/** Creates the insight directory if needed and forces it to mode 0700. */
export async function ensurePrivateDirectory(/** @type {string | URL} */ directory) {
  const path = toPath(directory);
  await mkdir(path, { recursive: true, mode: 0o700 });
  await chmod(path, 0o700);
}

/**
 * Atomically replaces `path` with `contents` at mode 0600: writes a sibling
 * temporary file, renames it over the target, then chmods the result (the
 * create mode is subject to umask). A failed write leaves the old file intact.
 * The caller owns the enclosing directory; see ensurePrivateDirectory.
 * @param {string | URL} target
 * @param {string} contents
 */
export async function writePrivateFile(target, contents) {
  const path = toPath(target);
  const temporary = join(dirname(path), `.${randomBytes(6).toString("hex")}.tmp`);
  try {
    await writeFile(temporary, contents, { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  await chmod(path, 0o600);
}

/**
 * The last-known-good snapshot for one source, or null when none exists or
 * the file is unreadable as a snapshot. Other I/O errors propagate.
 * @param {string | URL} directory
 * @param {string} source
 * @returns {Promise<SourceSnapshot | null>}
 */
export async function readSourceSnapshot(directory, source) {
  const path = join(toPath(directory), sourceFileName(source));
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return null;
    throw error;
  }
  try {
    const parsed = /** @type {unknown} */ (JSON.parse(text));
    if (
      parsed &&
      typeof parsed === "object" &&
      "capturedAt" in parsed &&
      "value" in parsed &&
      typeof parsed.capturedAt === "string"
    ) {
      return { capturedAt: parsed.capturedAt, value: parsed.value };
    }
  } catch {
    // A torn or hand-edited file is treated as absent, not as a crash.
  }
  return null;
}

/**
 * Replaces one source's snapshot. Refuses an Error or undefined value so a
 * failed fetch can never overwrite the last-known-good file.
 * @param {string | URL} directory
 * @param {string} source
 * @param {unknown} value parsed, successful source result
 * @param {string | Date} capturedAt
 * @returns {Promise<void>}
 */
export async function writeSourceSnapshot(directory, source, value, capturedAt) {
  const name = sourceFileName(source);
  if (value instanceof Error) throw new Error(`refusing to store an error as the ${source} snapshot`);
  if (value === undefined) throw new Error(`refusing to store an undefined ${source} snapshot`);
  const snapshot = { capturedAt: isoTime(capturedAt), value };
  await ensurePrivateDirectory(directory);
  await writePrivateFile(join(toPath(directory), name), `${JSON.stringify(snapshot)}\n`);
}

/**
 * Decides what a source contributes to this run. A fetch that succeeded
 * (`fresh` defined, no `error`) is fresh; otherwise the prior snapshot is
 * stale at its own timestamp; with no prior snapshot the source is
 * unavailable, with a null value that must never render as zero. `error`
 * is reduced to its message, truncated to 300 characters.
 * @param {{ fresh?: unknown; previous?: SourceSnapshot | null; error?: unknown; capturedAt: string }} input
 * @returns {SourceState}
 */
export function resolveSourceResult({ fresh, previous, error, capturedAt }) {
  const failed = error !== undefined && error !== null;
  if (!failed && fresh !== undefined) return { status: "fresh", capturedAt, value: fresh };
  const detail = failed ? { error: errorMessage(error) } : {};
  if (previous) return { status: "stale", capturedAt: previous.capturedAt, value: previous.value, ...detail };
  return { status: "unavailable", capturedAt: null, value: null, ...detail };
}

/** @param {string | Date} capturedAt @returns {string} */
export function rawEventsFileName(capturedAt) {
  return `raw-events-${isoTime(capturedAt).replace(/[:.]/gu, "-")}.json`;
}

/**
 * Writes one run's event-level results as their own expiring file.
 * @param {string | URL} directory
 * @param {unknown[]} events
 * @param {string | Date} capturedAt
 * @returns {Promise<string>} the written path
 */
export async function writeRawEvents(directory, events, capturedAt) {
  if (!Array.isArray(events)) throw new Error("raw events must be an array");
  const at = isoTime(capturedAt);
  await ensurePrivateDirectory(directory);
  const path = join(toPath(directory), rawEventsFileName(at));
  await writePrivateFile(path, `${JSON.stringify({ capturedAt: at, events })}\n`);
  return path;
}

/**
 * Deletes raw-event files whose filename timestamp is more than
 * `retentionDays` before `now`. Age comes from the filename, not mtime, so
 * copying or touching a file cannot extend or shorten its life. Source
 * snapshots, history, the dashboard, and unparseable names are never touched.
 * @param {string | URL} directory
 * @param {string | number | Date} now
 * @param {number} [retentionDays]
 * @returns {Promise<string[]>} deleted paths
 */
export async function pruneRawSnapshots(directory, now, retentionDays = RAW_EVENTS_RETENTION_DAYS) {
  const nowMs = new Date(now).getTime();
  if (Number.isNaN(nowMs)) throw new Error(`invalid now: ${String(now)}`);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    throw new Error(`invalid retentionDays: ${String(retentionDays)}`);
  }
  const path = toPath(directory);
  let names;
  try {
    names = await readdir(path);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return [];
    throw error;
  }
  const cutoff = nowMs - retentionDays * DAY_MS;
  const deleted = [];
  for (const name of names.sort()) {
    const match = RAW_EVENTS_PATTERN.exec(name);
    if (!match) continue;
    const [, year, month, day, hour, minute, second, ms] = match.map(Number);
    const capturedMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    if (capturedMs >= cutoff) continue;
    const target = join(path, name);
    await unlink(target);
    deleted.push(target);
  }
  return deleted;
}
