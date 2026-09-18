#!/usr/bin/env node
// The insights run as Bradley runs it on the Mac.
//
//   npm run insights                   # last 7 days, every source
//   npm run insights -- --days 30      # a longer Cloudflare window
//   npm run insights -- --json         # the run's snapshot
//   npm run insights -- --no-clarity   # skip Clarity's 10-requests-a-day budget
//   npm run insights -- --no-insights  # skip the first-party Analytics Engine sink
//   npm run insights -- --no-airtable  # render without assigned-link identity
//   npm run insights -- --no-snapshot  # read only; write nothing
//   npm run insights -- --history      # every past run, one row each
//   npm run insights -- --dashboard    # also open dashboard.html
//   npm run insights:dashboard         # rebuild the page from disk, no requests
//
// The run itself is `portfolio-insights-core.mjs`, which has no ambient
// dependencies. This file supplies the local ones: the login Keychain, the
// private insight directory, and the checked-in portfolio content. The
// scheduled Worker supplies its own in `worker/portfolio-insights-job.ts`, so
// the two runs read the same sources through the same code.
//
// Records land inside the insight directory (0700, every file 0600) —
// $PORTFOLIO_INSIGHTS_DIR when set, otherwise
// ~/Library/Application Support/biv/portfolio-insights. Tokens come from the
// environment or the Keychain entries `npm run setup:insights` writes, and are
// never printed or written to disk. Nothing here mutates anything remote.
//
// The run exits non-zero only when no source, current or saved, can fill a
// dashboard; a partial run is a successful run.

import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { chmod, readFile, stat, truncate } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { runInsights as runInsightsCore } from "./portfolio-insights-core.mjs";
import { parseArguments } from "./portfolio-insights-report.mjs";
import * as privateStorage from "./portfolio-insights-storage.mjs";

const execFileAsync = promisify(execFile);

/** @param {string} service @param {string} account */
export async function readKeychainPassword(service, account) {
  const { stdout } = await execFileAsync("/usr/bin/security", [
    "find-generic-password",
    "-s",
    service,
    "-a",
    account,
    "-w",
  ]);
  return stdout;
}

async function readPortfolioContent() {
  return JSON.parse(await readFile(new URL("../content/portfolio-content.json", import.meta.url), "utf8"));
}

/**
 * Where local runs keep their records: $PORTFOLIO_INSIGHTS_DIR when set,
 * otherwise the directory the retired launchd job used, so a manual run never
 * leaves raw events in a checkout where no prune reaches them.
 * @param {Record<string, string | undefined>} [env]
 */
export function defaultInsightsDirectory(env = process.env) {
  if (env.PORTFOLIO_INSIGHTS_DIR) return resolve(env.PORTFOLIO_INSIGHTS_DIR);
  return join(env.HOME || homedir(), "Library", "Application Support", "biv", "portfolio-insights");
}

/**
 * One local run. Dependencies default to the Mac's: the private directory,
 * the login Keychain, and the checked-in portfolio content.
 * @param {import("./portfolio-insights-report.mjs").InsightOptions} options
 * @param {Partial<Parameters<typeof runInsightsCore>[1]>} [dependencies]
 */
export function runInsights(options, dependencies = {}) {
  const env = dependencies.env ?? process.env;
  return runInsightsCore(options, {
    env,
    readKeychain: readKeychainPassword,
    readContent: readPortfolioContent,
    storage: privateStorage,
    directory: defaultInsightsDirectory(env),
    ...dependencies,
  });
}

/** The retired scheduled job's log started over past this size. */
export const LOG_LIMIT_BYTES = 1_048_576;

/**
 * A run's log repeats the terminal report, which names assigned links. Keep it
 * owner-only and start it over once it passes `limit` bytes. A writer holding
 * the file open for appending lands this run's output at the start of the
 * emptied file.
 * @param {string | undefined} path
 * @param {number} [limit]
 * @returns {Promise<boolean>} whether the log was emptied
 */
export async function capLog(path, limit = LOG_LIMIT_BYTES) {
  if (!path) return false;
  let size;
  try {
    size = (await stat(path)).size;
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return false;
    throw error;
  }
  await chmod(path, 0o600);
  if (size <= limit) return false;
  await truncate(path, 0);
  return true;
}

/** @param {unknown} error */
const messageOf = (error) => (error instanceof Error ? error.message : String(error));

async function main() {
  const options = parseArguments(process.argv.slice(2));
  // A run pointed at a log caps it first; a run with none never stops for it.
  await capLog(process.env.PORTFOLIO_INSIGHTS_LOG).catch(() => false);
  const result = await runInsights(options);
  process.stdout.write(result.output);
  if (options.dashboard && result.dashboardPath) {
    const page = result.dashboardPath;
    await execFileAsync("open", [page]).catch(() => {
      process.stderr.write(`Dashboard written to ${page}\n`);
    });
  }
  process.exitCode = result.exitCode;
}

// Run only as the entry point, so tests and the fixture can import runInsights.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${messageOf(error)}\n`);
    process.exitCode = 1;
  });
}
