#!/usr/bin/env node
// Read the Guide's own log events from Workers Logs, complete.
//
//   npm run chat:logs                 # last 7 days, one line per event
//   npm run chat:logs -- --days 3
//   npm run chat:logs -- --json       # the raw events
//
// Workers Logs keeps every event for this Worker (head sampling is 1), but the
// query API samples its *answer* when a window holds many rows: its
// `statistics.abr_level` reports 1 for every row, 10 for one in ten, 100 for one
// in a hundred. A seven-day query came back at 100 and showed 3 of about 100
// chat requests. A rare event like `portfolio_chat_stream` simply disappears.
// So this asks in 6-hour slices and splits any slice that still comes back
// sampled until it doesn't, down to 15 minutes; a slice that is still sampled
// there is reported, never silently dropped.
//
// These events carry no question or answer text by design (see the
// `portfolio_chat_stream` type in lib/server/portfolio-chat-handler.ts). Guide
// transcripts are in the insights bucket, on the dashboard's Chat section.
//
// The token is a read-only Workers Observability token, from
// $CLOUDFLARE_OBSERVABILITY_TOKEN or the login Keychain
// (biv-cloudflare-observability / read-token). It goes in a request header and
// is never printed.

import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

export const ACCOUNT_ID = "d459e1fdd68165fbc952d009070658d7";
export const SCRIPT_NAME = "bradley-portfolio-main-preview";
const HOUR_MS = 3_600_000;
export const SLICE_MS = 6 * HOUR_MS;
export const MIN_SLICE_MS = 15 * 60_000;
/** Workers Logs retention on this plan. */
export const MAX_DAYS = 7;

/** @param {string[]} argv */
export function parseChatLogArguments(argv) {
  const options = { days: MAX_DAYS, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--days") {
      const days = Number(argv[++index]);
      if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) throw new Error(`--days takes 1 to ${MAX_DAYS}`);
      options.days = days;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

/**
 * One query of the telemetry API over [from, to).
 * @param {{ token: string, fetchImplementation?: typeof fetch }} access
 * @param {number} from
 * @param {number} to
 */
async function queryWindow({ token, fetchImplementation = fetch }, from, to) {
  const response = await fetchImplementation(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/observability/telemetry/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        queryId: "portfolio-chat-logs",
        timeframe: { from, to },
        view: "events",
        limit: 1000,
        parameters: {
          filters: [
            { key: "$workers.scriptName", operation: "eq", type: "string", value: SCRIPT_NAME },
            { key: "event", operation: "includes", type: "string", value: "portfolio_chat" },
          ],
        },
      }),
    },
  );
  const body = /** @type {any} */ (await response.json());
  if (!response.ok || body?.success !== true) {
    throw new Error(`Workers Logs query failed (${response.status}): ${JSON.stringify(body?.errors ?? [])}`);
  }
  return {
    events: /** @type {Array<Record<string, any>>} */ (body.result?.events?.events ?? []),
    abrLevel: Number(body.result?.statistics?.abr_level ?? 1),
  };
}

/**
 * Every chat event in [from, to), asking in slices that come back unsampled.
 * @param {{ token: string, fetchImplementation?: typeof fetch }} access
 * @param {number} from
 * @param {number} to
 * @returns {Promise<{ events: Array<Record<string, any>>, sampled: Array<{ from: number, to: number, abrLevel: number }> }>}
 */
export async function readChatLogEvents(access, from, to) {
  const events = [];
  const sampled = [];
  const pending = [];
  for (let start = from; start < to; start += SLICE_MS) pending.push([start, Math.min(to, start + SLICE_MS)]);
  while (pending.length) {
    const [start, end] = /** @type {[number, number]} */ (pending.shift());
    const result = await queryWindow(access, start, end);
    if (result.abrLevel > 1 && end - start > MIN_SLICE_MS) {
      const middle = start + Math.floor((end - start) / 2);
      pending.unshift([start, middle], [middle, end]);
      continue;
    }
    if (result.abrLevel > 1) sampled.push({ from: start, to: end, abrLevel: result.abrLevel });
    events.push(...result.events);
  }
  events.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  return { events, sampled };
}

/** One readable line per event. Nothing here is question or answer text. */
export function formatChatLogEvent(event) {
  const source = event.source ?? {};
  const at = new Date(Number(event.timestamp)).toISOString().slice(0, 16).replace("T", " ");
  const cited = Array.isArray(source.citedEvidenceIds) ? source.citedEvidenceIds.join(", ") : "not recorded";
  const parts = [`${at} UTC`, source.event ?? "unknown", source.outcome ?? "unknown"];
  if (source.event === "portfolio_chat_stream") {
    parts.push(`${source.durationMs ?? "?"} ms`, `${source.answerCharacters ?? "?"} chars`, `cited: ${cited || "none"}`);
  }
  return parts.join(" · ");
}

async function readToken() {
  if (process.env.CLOUDFLARE_OBSERVABILITY_TOKEN) return process.env.CLOUDFLARE_OBSERVABILITY_TOKEN;
  const { stdout } = await promisify(execFile)("/usr/bin/security", [
    "find-generic-password",
    "-s",
    "biv-cloudflare-observability",
    "-a",
    "read-token",
    "-w",
  ]);
  return stdout.trim();
}

async function main() {
  const options = parseChatLogArguments(process.argv.slice(2));
  const token = await readToken().catch(() => {
    throw new Error(
      "No Workers Observability token. Set CLOUDFLARE_OBSERVABILITY_TOKEN or store one in the Keychain as biv-cloudflare-observability / read-token.",
    );
  });
  const to = Date.now();
  const { events, sampled } = await readChatLogEvents({ token }, to - options.days * 24 * HOUR_MS, to);
  if (options.json) process.stdout.write(`${JSON.stringify(events, null, 2)}\n`);
  else {
    process.stdout.write(`${events.length} Guide log events in the last ${options.days} days\n`);
    for (const event of events) process.stdout.write(`${formatChatLogEvent(event)}\n`);
  }
  for (const slice of sampled) {
    process.stderr.write(
      `warning: ${new Date(slice.from).toISOString()} → ${new Date(slice.to).toISOString()} came back sampled (abr_level ${slice.abrLevel}); events there may be missing\n`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
