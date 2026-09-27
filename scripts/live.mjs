#!/usr/bin/env node
/**
 * The live check: proves the deployed production site is right, read-only.
 *
 *   npm run live [-- --dist <dir>] [-- --base <url>]
 *
 * HTTP checks every deployed surface (bradleyberkman.com, www, the Access-gated
 * insights host), then walks the pages in headless Chromium and fails on any
 * console error, page error or failed request, then runs the reading-room and
 * toolbar interaction checks. With --dist (the tested artifact ci uploaded),
 * it also proves production serves that exact build: the page's
 * deploymentVersion is the artifact's build id and every static asset the page
 * names is in the artifact.
 *
 * Read-only: analytics beacons (the insight sink, Clarity, Cloudflare RUM) are
 * answered locally so a check run never lands in Bradley's visitor data, and
 * the chat is never sent a message. Any new live check belongs in this file.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import { checkCarouselLinkFeedback, checkReadingRoomResize } from "./check-reading-room-interactions.mjs";
import { checkToolbarGeometry } from "./check-toolbar-geometry.mjs";
import { cachedBrowser, loadPlaywright } from "./clip-studio/tools.mjs";

const { values: args } = parseArgs({
  options: {
    base: { type: "string", default: "https://bradleyberkman.com" },
    dist: { type: "string" },
    "expect-text": { type: "string" },
  },
});
const base = args.base.replace(/\/$/, "");
const content = JSON.parse(readFileSync(new URL("../content/portfolio-content.json", import.meta.url), "utf8"));
const records = Object.entries(content.records);

let failures = 0;
async function check(name, run) {
  try {
    const detail = await run();
    console.log(`ok   ${name}${detail ? ` (${detail})` : ""}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
async function get(url, init = {}) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000), ...init });
  return { response, body: await response.text() };
}
const html = (text) => text.replaceAll("&", "&amp;");

// --- HTTP: every surface the Worker serves -----------------------------------

let homeHtml = "";
await check("GET / is 200 with the home page", async () => {
  const { response, body } = await get(`${base}/`);
  expect(response.status === 200, `status ${response.status}`);
  expect(body.includes("<title>Bradley Berkman"), "no Bradley Berkman title");
  if (args["expect-text"]) expect(body.includes(args["expect-text"]), `missing "${args["expect-text"]}"`);
  homeHtml = body;
});
await check("GET www / is 200", async () => {
  const { response } = await get(`${base.replace("://", "://www.")}/`);
  expect(response.status === 200, `status ${response.status}`);
});
for (const [id, record] of records) {
  await check(`GET /index/${id} is 200 with its label`, async () => {
    const { response, body } = await get(`${base}/index/${id}`);
    expect(response.status === 200, `status ${response.status}`);
    expect(body.includes(html(record.label)), `label "${record.label}" not rendered`);
  });
}
for (const [route, text] of [
  ["/demos/touring", "<title>"],
  ["/demos/quarterly-dashboard", "<title>"],
  ["/privacy", "<title>"],
  ["/robots.txt", "Sitemap:"],
]) {
  await check(`GET ${route} is 200`, async () => {
    const { response, body } = await get(`${base}${route}`);
    expect(response.status === 200, `status ${response.status}`);
    expect(body.includes(text), `missing ${text}`);
  });
}
await check("GET /sitemap.xml lists every record", async () => {
  const { response, body } = await get(`${base}/sitemap.xml`);
  expect(response.status === 200, `status ${response.status}`);
  const missing = records.filter(([id]) => !body.includes(`/index/${id}<`)).map(([id]) => id);
  expect(missing.length === 0, `missing ${missing.join(", ")}`);
});
await check("GET /cv/bradley-berkman-cv.pdf is a PDF", async () => {
  const response = await fetch(`${base}/cv/bradley-berkman-cv.pdf`, { signal: AbortSignal.timeout(20_000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  expect(response.status === 200, `status ${response.status}`);
  expect(bytes.subarray(0, 5).toString() === "%PDF-", "not a PDF");
  return `${bytes.length} bytes`;
});
await check("GET /index/not-a-project is 404", async () => {
  const { response } = await get(`${base}/index/not-a-project`);
  expect(response.status === 404, `status ${response.status}`);
});
await check("chat session endpoint is configured", async () => {
  const { response, body } = await get(`${base}/api/portfolio-chat/session`);
  expect(response.status === 200, `status ${response.status}: ${body.slice(0, 120)}`);
  expect(JSON.parse(body).required === true, `unexpected ${body.slice(0, 120)}`);
});
await check("insights.braininavat.dance is behind Cloudflare Access", async () => {
  const { response } = await get("https://insights.braininavat.dance/");
  const location = response.headers.get("location") ?? "";
  expect(response.status === 302 && location.includes(".cloudflareaccess.com/"), `status ${response.status} -> ${location}`);
});

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

// --- Browser: pages load clean, and the reading room still works -------------

const playwright = loadPlaywright();
const browser = await playwright.chromium.launch({ executablePath: cachedBrowser() ?? undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Answer the analytics sends locally: the check reads production and records
  // nothing. The Cloudflare beacon script itself loads for real, because it is
  // pinned by an integrity hash; only its /cdn-cgi/rum report is answered here.
  await context.route(/\/api\/portfolio-insight|\/cdn-cgi\/rum|clarity\.ms/, (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  const page = await context.newPage();
  let problems = [];
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

  const pages = ["/", ...records.map(([id]) => `/index/${id}`), "/demos/touring", "/demos/quarterly-dashboard", "/privacy"];
  for (const route of pages) {
    await check(`browser ${route} loads with no errors`, async () => {
      problems = [];
      // Not networkidle: record pages stream video and never go idle.
      const response = await page.goto(`${base}${route}`, { waitUntil: "load", timeout: 45_000 });
      await page.waitForTimeout(3_000);
      expect(response?.status() === 200, `status ${response?.status()}`);
      expect(problems.length === 0, problems.slice(0, 3).join("; "));
    });
  }
  await check("reading-room panels resize at 1020/1280/1440px", async () => {
    const moves = await checkReadingRoomResize(page, `${base}/`);
    return `${moves.length} drags`;
  });
  await check("carousel links show hover and focus feedback", async () => {
    const links = await checkCarouselLinkFeedback(page, `${base}/`);
    return `${links.length} links`;
  });
  await check("toolbar artwork and actions stay aligned", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/`, { waitUntil: "networkidle" });
    const rows = await checkToolbarGeometry(page);
    expect(rows.length > 0, "no toolbar rows painted");
    return `${rows.length} rows`;
  });
} finally {
  await browser.close();
}

console.log(failures === 0 ? "live: all checks passed" : `live: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
