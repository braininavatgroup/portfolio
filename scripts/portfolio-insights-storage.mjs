// The local backend for an insights run's records: one directory at mode 0700
// holding files at mode 0600, replaced atomically.
//
// What the records are, and how long each one lives, is
// `portfolio-insights-records.mjs`; this module only says where they sit and
// who may read them. `worker/portfolio-insights-store.ts` is the other
// backend, over an R2 bucket, and obeys the same rules through the same
// factory.
//
// Directories may be passed as a path string or a file: URL (the CLI keeps
// its history directory as a URL).

import { randomBytes } from "node:crypto";
import { chmod, mkdir, readdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { recordStore } from "./portfolio-insights-records.mjs";

/**
 * @typedef {import("./portfolio-insights-records.mjs").SourceName} SourceName
 * @typedef {import("./portfolio-insights-records.mjs").SourceSnapshot} SourceSnapshot
 * @typedef {import("./portfolio-insights-records.mjs").SourceState} SourceState
 */

/**
 * The port `runInsights` reads and writes through. Both backends produce one
 * of these, so a run never learns which it has.
 *
 * @typedef {{
 *   ensurePrivateDirectory: (directory: any) => Promise<void>;
 *   readSourceSnapshot: (directory: any, source: string) => Promise<SourceSnapshot | null>;
 *   writeSourceSnapshot: (
 *     directory: any, source: string, value: unknown, capturedAt: string | Date,
 *   ) => Promise<string>;
 *   writeSourceConfigurationError: (
 *     directory: any, source: string, problems: string[], capturedAt: string | Date,
 *   ) => Promise<string>;
 *   resolveSourceResult: (options: {
 *     fresh?: unknown; previous?: SourceSnapshot | null; error?: unknown; capturedAt: string;
 *   }) => SourceState;
 *   writeRawEvents: (
 *     directory: any, events: unknown[], capturedAt: string | Date,
 *     meta?: { truncated?: boolean; windowStart?: string | Date },
 *   ) => Promise<string>;
 *   readLatestRawEvents: (directory: any, now: string | number | Date, retentionDays?: number) => Promise<
 *     { capturedAt: string; events: unknown[]; truncated?: boolean } | null
 *   >;
 *   pruneRawSnapshots: (directory: any, now: string | number | Date, retentionDays?: number) => Promise<string[]>;
 *   readHistory: (directory: any) => Promise<Array<Record<string, any> | null>>;
 *   appendHistoryRow: (directory: any, row: unknown) => Promise<void>;
 *   writeDashboard: (directory: any, html: string) => Promise<string>;
 * }} InsightStorage
 */

export {
  RAW_EVENTS_RETENTION_DAYS,
  rawEventsFileName,
  resolveSourceResult,
  SOURCE_NAMES,
} from "./portfolio-insights-records.mjs";

/** @param {string | URL} directory @returns {string} */
const toPath = (directory) => (directory instanceof URL ? fileURLToPath(directory) : directory);

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

const store = recordStore({
  ensure: ensurePrivateDirectory,
  describe: (directory, name) => join(toPath(directory), name),
  // An absent file is an absent record; every other I/O error propagates,
  // because a directory that cannot be read is a fault, not an empty history.
  read: async (directory, name) => {
    try {
      return await readFile(join(toPath(directory), name), "utf8");
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return null;
      throw error;
    }
  },
  write: (directory, name, contents) => writePrivateFile(join(toPath(directory), name), contents),
  list: async (directory) => {
    try {
      return await readdir(toPath(directory));
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return [];
      throw error;
    }
  },
  remove: (directory, name) => unlink(join(toPath(directory), name)),
});

export const {
  readSourceSnapshot,
  writeSourceSnapshot,
  writeSourceConfigurationError,
  writeRawEvents,
  readLatestRawEvents,
  pruneRawSnapshots,
  readHistory,
  appendHistoryRow,
  writeDashboard,
} = store;
