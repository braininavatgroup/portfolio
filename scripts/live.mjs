#!/usr/bin/env node
/**
 * The live check: walks the feature map against the deployed site, read-only.
 *
 *   npm run live [-- --dist <dir>] [-- --base <url>] [-- --evidence <dir>]
 *   npm run live -- --map-only
 *   npm run live -- --only <text>   # just the rows whose feature, source or probe contains it
 *
 * The map is .agents/skills/verify-portfolio/features/README.md; its header
 * defines the checks. First the map is compared with this checkout, offline
 * (scripts/feature-map.mjs): any disagreement prints STALE and the run stops
 * before the network, because a stale map would test the wrong site. Then
 * every row is driven against production: HTTP rows by fetch, `page` rows in
 * headless Chromium failing on any console error, page error or failed
 * request, and `probe` rows by the visitor interactions in
 * scripts/live-probes.mjs. FAIL means production answered wrong; DOWN means it
 * did not answer. With --dist (the tested artifact ci uploaded) it also proves
 * production serves that exact build.
 *
 * Read-only: analytics beacons (the insight sink, Clarity, Cloudflare RUM) are
 * answered inside the check's browser so a run never lands in Bradley's
 * visitor data, and the Guide is never sent a question. A new live check is a
 * map row plus, for an interaction, a probe.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import { contentPath, mapPath, primaryOrigin, repoRoot, staleRows } from "./feature-map.mjs";
import { probes } from "./live-probes.mjs";
import { cachedBrowser, loadPlaywright } from "./clip-studio/tools.mjs";

const { values: args } = parseArgs({
  options: {
    base: { type: "string", default: primaryOrigin },
    dist: { type: "string" },
    evidence: { type: "string" },
    "expect-text": { type: "string" },
    "map-only": { type: "boolean", default: false },
    only: { type: "string" },
  },
});
const base = args.base.replace(/\/$/, "");
const content = JSON.parse(readFileSync(path.join(repoRoot, contentPath), "utf8"));

// --- The map, against this checkout ------------------------------------------

const { rows: mapped, stale } = await staleRows({
  text: readFileSync(path.join(repoRoot, mapPath), "utf8"),
  probes: new Set(Object.keys(probes)),
});
console.log(`live: feature map ${mapPath} (${mapped.length} rows)`);
for (const message of stale) console.log(`STALE ${message}`);
if (stale.length > 0) {
  console.log(`live: ${stale.length} stale feature map row(s); fix the map before trusting a live result`);
  process.exit(1);
}
if (args["map-only"]) {
  const uncovered = mapped.filter((row) => row.kind === "uncovered").length;
  console.log(`live: feature map is current (${mapped.length - uncovered} driven, ${uncovered} uncovered)`);
  process.exit(0);
}
const rows = args.only
  ? mapped.filter((row) => [row.section, row.feature, row.source, row.probe ?? ""].some((field) => field.includes(args.only)))
  : mapped;
if (args.only) console.log(`live: --only "${args.only}" keeps ${rows.length} rows`);

// --- Reporting -----------------------------------------------------------------

class Down extends Error {}
const unreachable = /fetch failed|ENOTFOUND|ECONNRE|ETIMEDOUT|EAI_AGAIN|net::ERR_(NAME_NOT_RESOLVED|CONNECTION_|INTERNET_DISCONNECTED|ADDRESS_UNREACHABLE|TIMED_OUT)/;
const counts = { ok: 0, FAIL: 0, DOWN: 0 };
const report = [];
if (args.evidence) mkdirSync(args.evidence, { recursive: true });

async function check(name, run) {
  let verdict = "ok";
  let detail = "";
  try {
    detail = (await run()) ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    verdict = error instanceof Down || unreachable.test(message) ? "DOWN" : "FAIL";
    detail = message;
  }
  counts[verdict] += 1;
  report.push({ name, verdict, detail });
  const label = verdict === "ok" ? "ok  " : verdict;
  console.log(verdict === "ok" ? `${label} ${name}${detail ? ` (${detail})` : ""}` : `${label} ${name}: ${detail}`);
  return verdict;
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const at = (url) => (url.startsWith(primaryOrigin) ? `${base}${url.slice(primaryOrigin.length)}` : url);
async function get(url) {
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    return { response, body: await response.text() };
  } catch (error) {
    throw new Down(`${url} did not answer: ${error.cause?.code ?? error.message}`);
  }
}
const html = (text) => text.replaceAll("&", "&amp;");
const named = (row) => `${row.section}: ${row.feature}`;
const recordId = (row) => (row.source.startsWith(`${contentPath}#`) ? row.source.split("#")[1] : null);

// --- HTTP: every route row -----------------------------------------------------

let homeHtml = "";
const pageRows = rows.filter((row) => row.kind === "page");
for (const row of rows.filter((candidate) => ["page", "status"].includes(candidate.kind))) {
  await check(`${named(row)} [${row.kind === "page" ? "page" : `status ${row.status}`}]`, async () => {
    const url = at(row.url);
    const { response, body } = await get(url);
    const expected = row.kind === "page" ? 200 : row.status;
    expect(response.status === expected, `${url} answered ${response.status}, the map says ${expected}`);
    const where = response.status >= 300 && response.status < 400 ? response.headers.get("location") ?? "" : body;
    if (row.kind === "page") expect(body.includes("<title>"), "no <title>");
    if (row.text) expect(where.includes(html(row.text)) || where.includes(row.text), `missing "${row.text}"`);
    const id = recordId(row);
    if (id) expect(body.includes(html(content.records[id].label)), `label "${content.records[id].label}" not rendered`);
    if (new URL(url).pathname === "/" && url.startsWith(base)) {
      if (args["expect-text"]) expect(body.includes(args["expect-text"]), `missing "${args["expect-text"]}"`);
      homeHtml = body;
    }
    return response.status === 302 ? `-> ${new URL(where).host}` : undefined;
  });
}
for (const row of rows.filter((candidate) => candidate.kind === "sitemap")) {
  await check(`${named(row)} [sitemap]`, async () => {
    const { response, body } = await get(at(row.url));
    expect(response.status === 200, `status ${response.status}`);
    const listed = new Set([...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => new URL(loc).pathname));
    const pages = mapped.filter((page) => page.kind === "page" && page.url.startsWith(primaryOrigin));
    const expected = new Set(pages.map((page) => new URL(page.url).pathname));
    const missing = [...expected].filter((pathname) => !listed.has(pathname));
    const extra = [...listed].filter((pathname) => !expected.has(pathname));
    expect(missing.length === 0, `sitemap leaves out mapped pages: ${missing.join(", ")}`);
    expect(extra.length === 0, `sitemap lists pages no map row names: ${extra.join(", ")}`);
    return `${listed.size} pages, all mapped`;
  });
}

// --- Build identity: production serves the artifact ci tested ---------------

if (args.dist) {
  await check(`production serves the tested build in ${args.dist}`, async () => {
    const staticRoot = path.join(args.dist, "client/_next/static");
    const buildId = readdirSync(staticRoot).find((entry) => /^[0-9a-f-]{36}$/.test(entry));
    expect(buildId, `no build id directory in ${staticRoot}`);
    // A Worker deploy can take a few seconds to reach every edge.
    let live = "";
    for (let attempt = 0; attempt < 12; attempt += 1) {
      live = homeHtml.match(/deploymentVersion\\?":\\?"([0-9a-f-]{36})/)?.[1] ?? "";
      if (live === buildId) break;
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      homeHtml = (await get(`${base}/`)).body;
    }
    expect(live === buildId, `live deploymentVersion ${live || "absent"}, tested build ${buildId}`);
    const assets = [...new Set(homeHtml.match(/\/_next\/static\/[^"\\?#]+/g) ?? [])];
    const missing = assets.filter((asset) => !existsSync(path.join(args.dist, "client", asset)));
    expect(assets.length > 0 && missing.length === 0, `assets not in the tested build: ${missing.join(", ")}`);
    return `${buildId}, ${assets.length} assets`;
  });
} else {
  console.log("skip build identity (no --dist; ci passes the tested artifact)");
}

// --- Browser: pages load clean, and every mapped interaction works -----------

const playwright = loadPlaywright();
const browser = await playwright.chromium.launch({ executablePath: cachedBrowser() ?? undefined });

/** A fresh context whose page records every console error, failed request and HTTP error. */
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  // Answer the analytics sends locally: the check reads production and records
  // nothing. The Cloudflare beacon script itself loads for real, because it is
  // pinned by an integrity hash; only its /cdn-cgi/rum report is answered here.
  await context.route(/\/api\/portfolio-insight|\/cdn-cgi\/rum|clarity\.ms/, (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  const page = await context.newPage();
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    // Aborted means the page cancelled it (navigation, superseded fetch), not a failure.
    const reason = request.failure()?.errorText ?? "";
    if (!reason.includes("ERR_ABORTED")) problems.push(`request failed: ${request.url()} ${reason}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return { context, page, problems };
}
const evidenceName = (name) => name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
async function keep(page, name, verdict) {
  if (!args.evidence) return;
  const file = path.join(args.evidence, `${verdict === "ok" ? "" : `${verdict}-`}${evidenceName(name)}.png`);
  await page.screenshot({ path: file }).catch(() => {});
}

try {
  for (const row of pageRows) {
    const { context, page, problems } = await openPage();
    const name = `${named(row)} [browser]`;
    const verdict = await check(name, async () => {
      // Not networkidle: record pages stream video and never go idle.
      const response = await page.goto(at(row.url), { waitUntil: "load", timeout: 45_000 });
      await page.waitForTimeout(3_000);
      expect(response?.status() === 200, `status ${response?.status()}`);
      expect(problems.length === 0, problems.slice(0, 3).join("; "));
    });
    if (verdict !== "ok") await keep(page, name, verdict);
    await context.close();
  }

  const results = new Map();
  for (const row of rows.filter((candidate) => candidate.kind === "probe")) {
    if (!results.has(row.probe)) {
      const { context, page, problems } = await openPage();
      let outcome;
      try {
        const detail = await probes[row.probe]({ page, base, content });
        expect(problems.length === 0, problems.slice(0, 3).join("; "));
        outcome = { detail };
      } catch (error) {
        outcome = { error };
      }
      await keep(page, `probe-${row.probe}`, outcome.error ? (unreachable.test(outcome.error.message) ? "DOWN" : "FAIL") : "ok");
      await context.close();
      results.set(row.probe, outcome);
    }
    const outcome = results.get(row.probe);
    await check(`${named(row)} [probe ${row.probe}]`, async () => {
      if (outcome.error) throw outcome.error;
      return outcome.detail;
    });
  }
} finally {
  await browser.close();
}

for (const row of rows.filter((candidate) => candidate.kind === "uncovered")) {
  console.log(`skip ${named(row)}: uncovered: ${row.reason}`);
}
if (args.evidence) writeFileSync(path.join(args.evidence, "live-report.json"), `${JSON.stringify(report, null, 2)}\n`);

const failed = counts.FAIL + counts.DOWN;
console.log(
  failed === 0
    ? `live: all ${counts.ok} checks passed`
    : `live: ${counts.FAIL} failed, ${counts.DOWN} down, ${counts.ok} passed${counts.FAIL === 0 ? " (DOWN is the network or Cloudflare, not the site; rerun)" : ""}`,
);
process.exit(failed === 0 ? 0 : 1);
