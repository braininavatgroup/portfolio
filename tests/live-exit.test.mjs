import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function runLive(mode, args = ["--activity"], extra = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "portfolio-live-exit-"));
  const preload = path.join(directory, "preload.mjs");
  const browser = path.join(directory, "browser.cjs");
  const counts = path.join(directory, "counts.json");
  const root = process.cwd();
  if (args.includes(":fixture-dist")) {
    const dist = path.join(directory, "dist"), id = "12345678-1234-1234-1234-123456789abc";
    mkdirSync(path.join(dist, "client/_next/static", id), {recursive: true});
    writeFileSync(path.join(dist, "client/_next/static", id, "main.js"), "fixture asset");
    args = args.map(arg => arg === ":fixture-dist" ? dist : arg);
  }
  writeFileSync(browser, `
const mode = ${JSON.stringify(mode)};
class TimeoutError extends Error {}
const fs = require('node:fs');
const countFile = ${JSON.stringify(counts)};
function record(key) {
  const counts = JSON.parse(fs.readFileSync(countFile));
  counts.browser ||= {};
  counts.browser[key] = (counts.browser[key] || 0) + 1;
  fs.writeFileSync(countFile, JSON.stringify(counts));
}
function page(context) {
  const events = {};
  let width = 1440, mouse = {x:0,y:0}, delta = 0, down = false, position = 100, opacity = '0.75';
  const emit = (name, value) => events[name]?.(value);
  const link = { first() { opacity = '0.75'; return this; }, filter() { return this; }, locator() { return this; },
    async evaluate(fn) {
      global.getComputedStyle = () => ({opacity});
      return fn({closest:()=>mode === 'carousel-parent-missing' ? null : {querySelector:()=>mode === 'carousel-button-missing' ? null : {focus(){}}}});
    }, async hover() { opacity = '1'; }, async focus() { opacity = '1'; } };
  return {
    on(name, fn) { events[name] = fn; },
    async goto(url) {
      record(url);
      if (mode === 'browser-down') throw new Error('browser disconnected');
      if (mode === 'navigation-timeout') throw new TimeoutError('navigation did not answer');
      if (mode === 'no-response') return null;
      if (mode === 'browser-http') emit('response', {status:()=>503});
      return { status: () => 200 };
    },
    async waitForTimeout() {},
    async setViewportSize(view) { width = view.width; },
    async waitForFunction() { position = 110; },
    mouse: { async move(x,y) { if (down) delta += x-mouse.x; mouse={x,y}; }, async down(){down=true;}, async up(){down=false;} },
    getByRole(role, {name}) {
      if (role !== 'separator') return { async click(){}, async waitFor(){} };
      return { async boundingBox() { return {x: (name==='Resize Contents' ? (width===1440?320:240) : (width===1440?1041:width-321))+delta,y:0,width:10,height:10}; }, async getAttribute(){return 'vertical';} };
    },
    locator(selector) {
      if (selector === '.reader-carousel-card a') return link;
      if (selector.includes('avatar-overlay')) return { async waitFor(){}, async getAttribute(){return String(position);} };
      if (selector.includes('portfolio-world')) return { async boundingBox(){return {x:0,y:0,width:390,height:844};} };
      return { async evaluateAll(fn) {
        if (mode.startsWith('toolbar-')) return fn([{getBoundingClientRect:()=>({width:100,height:40,x:0,y:0}),
          querySelector:()=>mode === 'toolbar-art-missing' ? null : {querySelector:()=>({getBoundingClientRect:()=>({x:24,y:11,width:18,height:18})})},
          closest:()=>null}]);
        if (mode === 'late-down') emit('requestfailed', {failure:()=>({errorText:'ERR_CONNECTION_RESET'})});
        if (mode === 'late-js') emit('pageerror', new Error('render failed'));
        if (mode === 'locator-timeout') throw new TimeoutError('toolbar not painted');
        if (mode === 'late-disconnect') throw new Error('browser disconnected during inspection');
        return [{height:40,centerY:20,artCenterY:20,artInset:33,actions:[]}];
      } };
    },
  };
}
module.exports = { errors: { TimeoutError }, chromium: { launch: async () => {
  if (['pass','chat-null'].includes(mode)) throw new Error('isolated browser unavailable');
  return { async newContext(){ const context={async route(){},async close(){},async newPage(){return page(context);},async newCDPSession(){return {async send(){}};}}; return context; }, async close(){} };
} } };
`);
  writeFileSync(preload, `
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const counts = { requests: {}, sleeps: [] };
const mode = ${JSON.stringify(mode)};
const root = ${JSON.stringify(root)};
const save = () => {
  try { counts.browser = JSON.parse(readFileSync(${JSON.stringify(counts)})).browser; } catch {}
  writeFileSync(${JSON.stringify(counts)}, JSON.stringify(counts));
};
save();
globalThis.setTimeout = (fn, ms, ...args) => { counts.sleeps.push(ms); save(); queueMicrotask(() => fn(...args)); return 0; };
globalThis.fetch = async (url) => {
  const u = new URL(url);
  const key = u.hostname + u.pathname;
  const n = counts.requests[key] = (counts.requests[key] || 0) + 1;
  save();
  if (mode === 'down' || (mode === 'flip' && n === 4)) throw new TypeError('fixture network unavailable');
  const reply = (body, status = 200, headers = {'cache-control': 'no-store'}) => new Response(body, { status, headers });
  if (u.pathname === '/internal/portfolio-activity') {
    if (n % 2) return reply('', 403);
    if (mode === 'auth') return reply('', 403);
    if (mode === 'activity-body-down') return new Response(new ReadableStream({start(controller){controller.error(new Error('body interrupted'));}}), {headers: {'cache-control':'no-store'}});
    if (mode === 'null') return reply('null', 200);
    if (mode === 'invalid') return reply('{', 200);
    if (mode === 'wrong' || mode === 'flip' || (mode === 'recover' && n === 2)) return reply('{}', 200);
    return reply(JSON.stringify({version: 1, status: 'fresh', items: []}), 200, {'cache-control': 'no-store'});
  }
  if (u.pathname === '/internal/portfolio-assignments') {
    if (mode === 'auth') return reply('', 403);
    if (mode === 'http') return reply('', 503);
    if (mode === 'invalid') return reply('{');
    if (mode === 'null') return reply('null');
    if (mode === 'body-down') return new Response(new ReadableStream({start(controller){controller.error(new Error('fixture body interrupted'));}}));
    return reply('{"version":1,"assignments":[]}');
  }
  if (u.pathname === '/internal/portfolio-assignment-health') {
    if (mode.startsWith('health-producer-') && n % 2 === 0) {
      const { handlePortfolioAssignmentHealth } = await import(pathToFileURL(root + '/worker/portfolio-assignment-health.ts').href);
      const binding = { fetch: async () => mode === 'health-producer-down'
        ? new Response(new ReadableStream({start(controller){controller.error(new Error('fixture source body interrupted'));}}))
        : new Response(mode === 'health-producer-invalid' ? '{' : 'null') };
      return handlePortfolioAssignmentHealth(new Request(url, {headers:{'x-portfolio-assignments-token':'b'.repeat(64)}}),
        {PORTFOLIO_ASSIGNMENTS_READ_TOKEN:'b'.repeat(64),JOB_SEARCH_ASSIGNMENTS:binding});
    }
    if (n % 2) return reply('', 403);
    if (mode.startsWith('health-source-')) return reply(JSON.stringify({version:1,status:'unavailable',upstreamStatus:mode === 'health-source-auth' ? 403 : mode === 'health-source-auth401' ? 401 : null,transportCategory:mode === 'health-source-network' ? 'network' : 'other'}), 503);
    if (mode === 'health-typed-body-down' || mode === 'health-typed-invalid') return reply(JSON.stringify({version:1,status:'unavailable',upstreamStatus:200,transportCategory:'other',observation:mode === 'health-typed-body-down' ? 'unavailable' : 'wrong'}), 503);
    if (mode === 'health-binding') return reply('{"version":1,"status":"unavailable","reason":"binding"}', 503);
    return reply(mode === 'health-null' ? 'null' : '{"version":1,"status":"fresh","count":0}');
  }
  if (u.hostname === 'insights.braininavat.dance') return reply('', 302, {location: 'https://example.cloudflareaccess.com/login'});
  const interrupted = status => new Response(new ReadableStream({start(controller){controller.error(new Error('fixture interrupted body'));}}), {status});
  if (u.pathname === '/cv/bradley-berkman-cv.pdf') return mode.startsWith('pdf-body-') ? interrupted(mode === 'pdf-body-wrong' ? 503 : 200) : reply(readFileSync(root + '/public/cv/bradley-berkman-cv.pdf'));
  if (u.pathname === '/' && u.hostname === 'bradleyberkman.com' && mode.startsWith('http-body-')) return interrupted(mode === 'http-body-wrong' ? 503 : 200);
  if (u.pathname === '/index/not-a-project') return reply('', 404);
  if (u.pathname === '/api/portfolio-chat/session') return reply(mode === 'chat-null' ? 'null' : '{"required":true}');
  const content = JSON.parse(readFileSync(root + '/content/portfolio-content.json'));
  if (u.pathname === '/sitemap.xml') return reply(Object.keys(content.records).map(id => '/index/' + id + '<').join(''));
  if (u.pathname.startsWith('/index/')) return reply(content.records[u.pathname.split('/').pop()]?.label.replaceAll('&', '&amp;') || '');
  const map = JSON.parse(readFileSync(root + '/features/features.json'));
  const version = mode.startsWith('build-') ? ' deploymentVersion":"' + (mode === 'build-wrong' || mode === 'build-recover' && n < 3 ? '87654321-1234-1234-1234-123456789abc' : '12345678-1234-1234-1234-123456789abc') + '" src="/_next/static/12345678-1234-1234-1234-123456789abc/main.js"' : '';
  return reply('<title>Bradley Berkman ' + map.routes.map(route => route.contains).join(' ') + version);
};
`);
  try {
    const result = spawnSync(process.execPath, [...(mode.startsWith("health-producer-") ? ["--import", "tsx"] : []), "--import", preload, "scripts/live.mjs", ...args], {
      encoding: "utf8", timeout: 10000,
      env: { ...process.env, PORTFOLIO_ACTIVITY_READ_TOKEN: "a".repeat(64), PORTFOLIO_ASSIGNMENTS_READ_TOKEN: "b".repeat(64), BOARD_ACCESS_CLIENT_ID: "fixture-client", BOARD_ACCESS_CLIENT_SECRET: "fixture-secret", PLAYWRIGHT_MODULE: browser, ...extra },
    });
    return { ...result, counts: JSON.parse(readFileSync(counts, "utf8")) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("actual activity CLI separates pass, wrong, unavailable and fresh retry", () => {
  for (const [mode, exit] of [["pass", 0], ["wrong", 1], ["null", 1], ["invalid", 1], ["down", 3], ["auth", 3], ["activity-body-down", 3], ["flip", 3], ["recover", 0]]) {
    const result = runLive(mode);
    assert.equal(result.status, exit, `${mode}: ${result.stdout}${result.stderr}`);
    const requests = Object.values(result.counts.requests).reduce((a, b) => a + b, 0);
    assert.equal(requests, mode === "down" ? 1 : ["pass", "auth", "activity-body-down"].includes(mode) ? 2 : 4, mode);
    assert.equal(result.counts.sleeps.filter(ms => ms === 15000).length, ["pass", "down", "auth", "activity-body-down"].includes(mode) ? 0 : 1, mode);
  }
});

test("actual full CLI keeps browser startup unavailable and known wrong precedence", () => {
  for (const [mode, exit] of [["pass", 3], ["chat-null", 1]]) {
    const result = runLive(mode, []);
    assert.equal(result.status, exit, `${mode}: ${result.stdout}${result.stderr}`);
    assert.equal(result.counts.requests["bradleyberkman.com/api/portfolio-chat/session"], mode === "pass" ? 1 : 2);
    assert.equal(result.counts.sleeps.filter(ms => ms === 15000).length, mode === "pass" ? 0 : 1);
  }
});

test("actual managed browser path classifies transport, responses, late events and locator waits", () => {
  for (const [mode, exit] of [["browser-pass", 0], ["browser-down", 3], ["navigation-timeout", 3], ["no-response", 3], ["browser-http", 1], ["late-down", 3], ["late-js", 1], ["locator-timeout", 1], ["late-disconnect", 3]]) {
    const result = runLive(mode, []);
    assert.equal(result.status, exit, `${mode}: ${result.stdout}${result.stderr}`);
    assert.equal(result.counts.sleeps.filter(ms => ms === 15000).length, ["browser-http", "late-js", "locator-timeout"].includes(mode) ? 1 : 0, mode);
    assert.equal(result.counts.browser["https://bradleyberkman.com/index/bradley"], mode === "browser-http" ? 2 : 1, mode);
  }
});

test("actual assignment CLI distinguishes response defects from capability/transport/input gaps", () => {
  for (const [mode, exit] of [["pass", 0], ["http", 1], ["null", 1], ["invalid", 1], ["auth", 3], ["body-down", 3], ["down", 3], ["health-null", 1]]) {
    const result = runLive(mode, ["--assignments"]);
    assert.equal(result.status, exit, `${mode}: ${result.stdout}${result.stderr}`);
    assert.equal(result.counts.requests["bradley-job-board.bradley-d45.workers.dev/internal/portfolio-assignments"], exit === 1 ? 2 : 1, mode);
    assert.equal(result.counts.sleeps.filter(ms => ms === 15000).length, exit === 1 ? 1 : 0, mode);
  }
  for (const extra of [{PORTFOLIO_ASSIGNMENTS_EXPECTED_COUNT: "-1"}, {PORTFOLIO_ASSIGNMENTS_EXPECTED_COUNT: "NaN"}, {PORTFOLIO_ASSIGNMENTS_READ_TOKEN: "invalid"}]) {
    const result = runLive("pass", ["--assignments"], extra);
    assert.equal(result.status, 3, result.stdout + result.stderr);
    assert.deepEqual(result.counts.requests, {});
  }
});

test("missing local source input is3 without reaching a production transport", () => {
  for (const [args, env] of [[["--map-only"], {PORTFOLIO_FEATURE_MAP: "/nonexistent/feature-map.json"}], [["--activity"], {PORTFOLIO_ACTIVITY_READ_TOKEN: "invalid"}]]) {
    const result = runLive("pass", args, env);
    assert.equal(result.status, 3, result.stdout + result.stderr);
    assert.deepEqual(result.counts.requests, {});
    assert.deepEqual(result.counts.sleeps, []);
  }
});

test("deployed build identity uses two fresh reads and one existing60s settling allowance", () => {
  for (const [mode, exit] of [["build-pass", 0], ["build-wrong", 1], ["build-recover", 0]]) {
    const result = runLive(mode, ["--dist", ":fixture-dist"]);
    assert.equal(result.status, exit, `${mode}: ${result.stdout}${result.stderr}`);
    assert.equal(result.counts.requests["bradleyberkman.com/"], mode === "build-pass" ? 2 : 3, mode);
    assert.deepEqual(result.counts.sleeps, mode === "build-pass" ? [] : [60000], mode);
  }
  const result = runLive("browser-pass", ["--dist", "/nonexistent/portfolio-artifact"]);
  assert.equal(result.status, 3, result.stdout + result.stderr);
  assert.deepEqual(result.counts.sleeps, []);
});

test("structured upstream auth and transport are unavailable, but absent production binding stays wrong", () => {
  for (const [mode, exit] of [["health-source-auth", 3], ["health-source-auth401", 3], ["health-source-network", 3], ["health-source-other", 3], ["health-binding", 1]]) {
    const result = runLive(mode, ["--assignments"]);
    assert.equal(result.status, exit, `${mode}: ${result.stdout}${result.stderr}`);
    assert.equal(result.counts.requests["bradley-job-board.bradley-d45.workers.dev/internal/portfolio-assignments"], exit === 1 ? 2 : 1, mode);
    assert.deepEqual(result.counts.sleeps, exit === 1 ? [15000] : [], mode);
  }
});

test("actual browser callbacks classify absent required DOM as wrong after a fresh retry", () => {
  for (const mode of ["toolbar-parent-missing", "toolbar-art-missing", "carousel-parent-missing", "carousel-button-missing"]) {
    const result = runLive(mode, []);
    assert.equal(result.status, 1, `${mode}: ${result.stdout}${result.stderr}`);
    assert.deepEqual(result.counts.sleeps, [15000], mode);
  }
});

test("HTTP status remains known wrong before reading a failed body; successful status alone proves no body", () => {
  for (const [mode, exit, request] of [["http-body-wrong", 1, "bradleyberkman.com/"], ["http-body-down", 3, "bradleyberkman.com/"], ["pdf-body-wrong", 1, "bradleyberkman.com/cv/bradley-berkman-cv.pdf"], ["pdf-body-down", 3, "bradleyberkman.com/cv/bradley-berkman-cv.pdf"]]) {
    const result = runLive(mode, []);
    assert.equal(result.status, exit, `${mode}: ${result.stdout}${result.stderr}`);
    assert.equal(result.counts.requests[request], exit === 1 ? 2 : 1, mode);
    assert.deepEqual(result.counts.sleeps, exit === 1 ? [15000] : [], mode);
  }
});

test("scheduled health preserves typed interrupted body versus delivered malformed JSON", () => {
  for (const [mode, exit] of [["health-typed-body-down", 3], ["health-typed-invalid", 1]]) {
    const result = runLive(mode, ["--assignments"]);
    assert.equal(result.status, exit, `${mode}: ${result.stdout}${result.stderr}`);
    assert.equal(result.counts.requests["bradley-job-board.bradley-d45.workers.dev/internal/portfolio-assignments"], exit === 1 ? 2 : 1, mode);
    assert.deepEqual(result.counts.sleeps, exit === 1 ? [15000] : [], mode);
  }
});

test("actual Worker adapter and actual CLI retain body-read versus received-JSON evidence end to end", () => {
  for (const [mode, exit] of [["health-producer-down", 3], ["health-producer-invalid", 1], ["health-producer-null", 1]]) {
    const result = runLive(mode, ["--assignments"]);
    assert.equal(result.status, exit, `${mode}: ${result.stdout}${result.stderr}`);
    assert.equal(result.counts.requests["bradley-job-board.bradley-d45.workers.dev/internal/portfolio-assignments"], exit === 1 ? 2 : 1, mode);
    assert.deepEqual(result.counts.sleeps, exit === 1 ? [15000] : [], mode);
  }
});
