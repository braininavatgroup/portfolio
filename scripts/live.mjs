#!/usr/bin/env node
/**
 * The live check: proves the deployed production site is right, read-only.
 *
 *   npm run live [-- --dist <dir>] [-- --base <url>]
 *
 * Exits0 on pass,1 only after one fresh wrong-answer retry,3 when unable to
 * observe or missing a required input. One settling wait per invocation.
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
import { WrongAnswer, requireInput, subjectJson, liveResults } from "./live-result.mjs";

import { checkCarouselLinkFeedback, checkReadingRoomResize } from "./check-reading-room-interactions.mjs";
import { checkToolbarGeometry } from "./check-toolbar-geometry.mjs";
import { cachedBrowser, loadPlaywright } from "./clip-studio/tools.mjs";

const { check, exitCode } = liveResults({ settleMs: process.argv.some(arg => arg === "--dist" || arg.startsWith("--dist=")) ? 60000 : 15000 });
async function main() {
  const { values: args } = parseArgs({
    options: {
      base: { type: "string", default: "https://bradleyberkman.com" },
      dist: { type: "string" },
      "expect-text": { type: "string" },
      assignments: { type: "boolean", default: false },
      activity: { type: "boolean", default: false },
      "map-only": { type: "boolean", default: false },
    },
  });
  const base = args.base.replace(/\/$/, "");
  const content = JSON.parse(readFileSync(new URL("../content/portfolio-content.json", import.meta.url), "utf8"));
  const records = Object.entries(content.records);
  const featureMapPath = process.env.PORTFOLIO_FEATURE_MAP
    ?? new URL("../features/features.json", import.meta.url);
  const featureMap = JSON.parse(readFileSync(featureMapPath, "utf8"));

  function expect(condition, message) {
    if (!condition) throw new WrongAnswer(message);
  }

  if (args.activity) {
    await check("private activity projection capability", async () => {
      const { readKeychainPassword } = await import('./portfolio-insights.mjs');
      const token = process.env.PORTFOLIO_ACTIVITY_READ_TOKEN || (await readKeychainPassword('biv-portfolio-insights', 'activity-read-token')).trim();
      requireInput(/^[a-f0-9]{64}$/.test(token), 'activity-read credential unavailable');
      const url = new URL('/internal/portfolio-activity', args.base);
      const refused = await fetch(url, { signal: AbortSignal.timeout(30000) });
      expect(refused.status === 403, 'unsigned activity projection was not refused');
      const response = await fetch(url, { headers: { 'x-portfolio-activity-token': token }, signal: AbortSignal.timeout(30000) });
      requireInput(![401, 403].includes(response.status), 'activity-read credential was refused');
      expect(response.status === 200 && response.headers.get('cache-control') === 'no-store', 'activity projection unavailable or cacheable');
      const p = await subjectJson(response);
      expect(p?.version === 1 && ['fresh', 'stale', 'unavailable'].includes(p.status) && Array.isArray(p.items) && p.items.length <= 100, 'invalid projection');
      expect(p.items.every(i => i && /^[a-f0-9]{64}$/.test(i.id) && !('sessionId' in i) && !('events' in i)), 'raw identifiers or events in projection');
      return `${p.status}; ${p.items.length} qualifying tabs; partial=${Boolean(p.truncated)}; no visits or writes simulated`;
    });
    return;
  }

  if (args.assignments) {
    await check("Supabase assignment reader", async () => {
      const { readKeychainPassword } = await import('./portfolio-insights.mjs');
      const { resolveAssignmentToken, fetchPortfolioAssignments, AssignmentConfigurationError, AssignmentResponseError } = await import('./portfolio-insights-assignments.mjs');
      const token = await resolveAssignmentToken({ env: process.env, readKeychain: readKeychainPassword });
      requireInput(token, 'assignment-read credential unavailable');
      const client = process.env.BOARD_ACCESS_CLIENT_ID || (await readKeychainPassword('biv-job-board', 'access-client-id')).trim();
      const secret = process.env.BOARD_ACCESS_CLIENT_SECRET || (await readKeychainPassword('biv-job-board', 'access-client-secret')).trim();
      requireInput(client && secret, 'board Access credentials unavailable');
      const expected = process.env.PORTFOLIO_ASSIGNMENTS_EXPECTED_COUNT;
      requireInput(expected === undefined || /^(0|[1-9][0-9]*)$/.test(expected) && Number.isSafeInteger(Number(expected)), 'expected assignment count must be a nonnegative integer');
      let rows;
      try {
        rows = await fetchPortfolioAssignments({ token, accessHeaders: { 'CF-Access-Client-Id': client, 'CF-Access-Client-Secret': secret },
          fetchImpl: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) });
      } catch (error) {
        if (error instanceof AssignmentConfigurationError || error instanceof AssignmentResponseError) throw new WrongAnswer(error.message);
        throw error;
      }
      if (expected !== undefined) expect(rows.length === Number(expected), 'count differs from reviewed migration');
      const healthUrl = new URL('/internal/portfolio-assignment-health', args.base);
      const refused = await fetch(healthUrl, { signal: AbortSignal.timeout(30000) });
      expect(refused.status === 403, 'unsigned assignment health read was not refused');
      const health = await fetch(healthUrl, {
        headers: { 'x-portfolio-assignments-token': token }, signal: AbortSignal.timeout(30000),
      });
      requireInput(![401, 403].includes(health.status), 'assignment health credential was refused');
      const status = await subjectJson(health);
      const sourceUnavailable = health.status === 503 && status?.version === 1 && status.status === 'unavailable'
        && (status.upstreamStatus === 401 || status.upstreamStatus === 403
          || status.upstreamStatus === null && ['redirect', 'request-context', 'subrequest', 'service-binding', 'network', 'url', 'other'].includes(status.transportCategory));
      requireInput(!sourceUnavailable, 'scheduled assignment source authentication or transport unavailable');
      expect(health.ok && status?.version === 1 && status.status === 'fresh' && status.count === rows.length,
        `scheduled Worker binding unavailable (HTTP ${health.status}; upstream ${status?.upstreamStatus ?? 'unknown'}; transport ${status?.transportCategory ?? 'unknown'})`);
      return `${rows.length} valid assignments through local and scheduled Worker readers; codes and identities omitted`;
    });
    return;
  }

  await check("feature map records match portfolio content", async () => {
    const mapped = [...featureMap.records].sort();
    const actual = records.map(([id]) => id).sort();
    requireInput(JSON.stringify(mapped) === JSON.stringify(actual),
      `mapped [${mapped.join(", ")}], content [${actual.join(", ")}]`);
    return `${mapped.length} records`;
  }, { retry: false });
  for (const control of featureMap.controls) {
    await check(`map control ${control.id}`, async () => {
      const source = readFileSync(new URL(`../${control.source}`, import.meta.url), "utf8");
      requireInput(source.includes(control.marker), `${control.source} no longer contains ${JSON.stringify(control.marker)}`);
      return control.source;
    }, { retry: false });
  }
  if (args["map-only"] || exitCode()) return;
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
  for (const { path: route, contains: text } of featureMap.routes) {
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
    const expected = readFileSync(new URL("../public/cv/bradley-berkman-cv.pdf", import.meta.url));
    const response = await fetch(`${base}/cv/bradley-berkman-cv.pdf`, { signal: AbortSignal.timeout(20_000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(response.status === 200, `status ${response.status}`);
    expect(bytes.subarray(0, 5).toString() === "%PDF-", "not a PDF");
    expect(bytes.equals(expected), "live CV differs from the approved PDF in this revision");
    return `${bytes.length} bytes, matching the approved PDF`;
  });
  await check("GET /index/not-a-project is 404", async () => {
    const { response } = await get(`${base}/index/not-a-project`);
    expect(response.status === 404, `status ${response.status}`);
  });
  await check("chat session endpoint is configured", async () => {
    const { response, body } = await get(`${base}/api/portfolio-chat/session`);
    expect(response.status === 200, `status ${response.status}: ${body.slice(0, 120)}`);
    expect((await subjectJson(new Response(body)))?.required === true, `unexpected ${body.slice(0, 120)}`);
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
      requireInput(buildId, `no build id directory in ${staticRoot}`);
      const { body: currentHtml } = await get(`${base}/`);
      const live = currentHtml.match(/deploymentVersion\\?":\\?"([0-9a-f-]{36})/)?.[1] ?? "";
      expect(live === buildId, `live deploymentVersion ${live || "absent"}, tested build ${buildId}`);
      homeHtml = currentHtml;
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
    async function browserCheck(name, run, options = {}) {
      await check(name, async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
        try {
          await context.route(/\/api\/portfolio-insight|\/cdn-cgi\/rum|clarity\.ms/, route => route.fulfill({ status: 204, body: "" }));
          const page = await context.newPage();
          const wrong = [], unavailable = [];
          let loaded = false;
          page.on("console", message => { if (message.type() === "error") wrong.push(`console: ${message.text()}`); });
          page.on("pageerror", error => wrong.push(`page error: ${error.message}`));
          page.on("requestfailed", request => {
            const reason = request.failure()?.errorText ?? "";
            if (!reason.includes("ERR_ABORTED")) unavailable.push(`request failed: ${reason}`);
          });
          page.on("response", response => { if (response.status() >= 400) wrong.push(`HTTP ${response.status()}`); });
          const goto = page.goto.bind(page);
          page.goto = async (...args) => {
            loaded = false;
            const response = await goto(...args);
            requireInput(response, "navigation returned no response");
            expect(response.status() === 200, `status ${response.status()}`);
            loaded = true;
            return response;
          };
          let result, error;
          try { result = await run(page, context); } catch (caught) { error = caught; }
          // Inspect events after interaction, including failed locator waits; a
          // reachable HTTP/JS error is stronger evidence than a separate outage.
          if (wrong.length) throw new WrongAnswer(wrong.slice(0, 3).join("; "));
          if (error instanceof WrongAnswer) throw error;
          if (unavailable.length) throw new Error(unavailable.slice(0, 3).join("; "));
          if (error) {
            if (loaded && playwright.errors?.TimeoutError && error instanceof playwright.errors.TimeoutError) throw new WrongAnswer(error.message);
            throw error;
          }
          return result;
        } finally {
          try { await context.close(); }
          catch (error) { await check("browser cleanup", async () => { throw error; }, { retry: false }); }
        }
      });
    }
    const pages = ["/", ...records.map(([id]) => `/index/${id}`),
      ...featureMap.routes.filter((route) => route.browser).map((route) => route.path)];
    for (const route of pages) {
      await browserCheck(`browser ${route} loads with no errors`, async page => {
        // Not networkidle: record pages stream video and never go idle.
        await page.goto(`${base}${route}`, { waitUntil: "load", timeout: 45_000 });
        await page.waitForTimeout(3_000);
      });
    }
    await browserCheck("reading-room panels resize at 1020/1280/1440px", async page => {
      const moves = await checkReadingRoomResize(page, `${base}/`);
      return `${moves.length} drags`;
    });
    await browserCheck("carousel links show hover and focus feedback", async page => {
      const links = await checkCarouselLinkFeedback(page, `${base}/`);
      return `${links.length} links`;
    });
    await browserCheck("toolbar artwork and actions stay aligned", async page => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${base}/`, { waitUntil: "networkidle" });
      const rows = await checkToolbarGeometry(page);
      expect(rows.length > 0, "no toolbar rows painted");
      return `${rows.length} rows`;
    });
    await browserCheck("Brain Food starts and steers at a 390px touch viewport", async (touchPage, mobile) => {
        await touchPage.goto(`${base}/`, { waitUntil: "load", timeout: 45_000 });
        await touchPage.getByRole("button", { name: "Map tab" }).click();
        const play = touchPage.getByRole("button", { name: "Play Brain Food" });
        await play.waitFor({ state: "visible" });
        await play.click({ timeout: 20_000 });
        const avatar = touchPage.locator('.avatar-overlay[data-avatar-state="brain-food"]');
        await avatar.waitFor({ timeout: 20_000 });
        const before = Number(await avatar.getAttribute("data-brain-food-x"));
        expect(Number.isFinite(before), "no avatar play position");
        const world = touchPage.locator('.portfolio-world[data-brain-food="true"]');
        const box = await world.boundingBox();
        expect(box && box.width >= 390 && box.height >= 600, `Map play bounds ${JSON.stringify(box)}`);
        const direction = before > box.x + box.width / 2 ? -1 : 1;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const cdp = await mobile.newCDPSession(touchPage);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + direction * 100, y, id: 1 }] });
        await touchPage.waitForFunction(({ before, direction }) => {
          const position = Number(document.querySelector('.avatar-overlay')?.getAttribute('data-brain-food-x'));
          return (position - before) * direction > 3;
        }, { before, direction }, { timeout: 5_000 });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        const after = Number(await avatar.getAttribute("data-brain-food-x"));
        expect((after - before) * direction > 3, `avatar did not move: ${before} -> ${after}`);
        await touchPage.getByRole("button", { name: "Exit Brain Food" }).click();
        return `${before.toFixed(1)} -> ${after.toFixed(1)}`;
    }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  } finally {
    await browser.close();
  }

}
try { await main(); }
catch (error) { await check("live verification inputs/runtime", async () => { throw error; }, { retry: false }); }
console.log(`live: exit ${exitCode()} (0 pass, 1 confirmed wrong, 3 unavailable)`);
process.exit(exitCode());
