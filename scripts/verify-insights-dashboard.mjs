#!/usr/bin/env node
/**
 * Managed browser proof for the local portfolio insights dashboard.
 *
 *   node scripts/verify-insights-dashboard.mjs --file <dashboard.html> [--output <dir>]
 *
 * Opens the self-contained HTML file in headless Chromium at desktop and phone
 * sizes, in light and dark, each in a fresh browser context. It proves the page
 * makes no request beyond its own file, logs no errors, keeps its sections in
 * order, opens every disclosure, links only to Clarity, Airtable, and the
 * scheduled dashboard in a new tab, keeps text legible, fits a phone without sideways scrolling, and
 * actually changes colour in dark mode. Screenshots and report.json land in a
 * workspace- and run-scoped directory under .context/verification/biv-421/.
 *
 * The runner takes one machine-wide browser slot (a mkdir lock shared with the
 * parallel-web-verification runner), never opens a visible window, and never
 * touches a personal browser profile.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { cachedBrowser, loadPlaywright } from "./clip-studio/tools.mjs";
import { SCHEDULED_DASHBOARD_HOST } from "./portfolio-insights-dashboard.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The only destinations a dashboard anchor may point at. */
export const ALLOWED_LINK_PREFIXES = Object.freeze([
  "https://clarity.microsoft.com/projects/view/yatoiqtrjm/",
  "https://airtable.com/app0LM9NfGL4ZHi3j/",
]);

/** The header's link to the current run: its root only, matched exactly. */
export const SCHEDULED_DASHBOARD_URL = `https://${SCHEDULED_DASHBOARD_HOST}/`;

/** The top-level sections, in the order a reader meets them. */
export const SECTION_HEADINGS = Object.freeze([
  "What changed",
  "Assigned links",
  "Content resonance",
  "Journeys",
  "Chat",
  "Audience",
  "Observe in Clarity",
  "Diagnostics",
]);

export const SCENARIOS = Object.freeze([
  { name: "desktop-light", viewport: { width: 1440, height: 900 }, colorScheme: "light" },
  { name: "desktop-dark", viewport: { width: 1440, height: 900 }, colorScheme: "dark" },
  { name: "phone-light", viewport: { width: 390, height: 844 }, colorScheme: "light" },
  { name: "phone-dark", viewport: { width: 390, height: 844 }, colorScheme: "dark" },
]);

export const MIN_FONT_PX = 11;
export const PHONE_WIDTH = 390;

export const usage =
  "Usage: node scripts/verify-insights-dashboard.mjs --file <path.html> [--output <dir>]";

/** Parses `--file`, `--output`, and `--help`, in `--flag value` or `--flag=value` form. */
export function parseArguments(argv) {
  const options = { file: null, output: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    const match = /^--(file|output)(?:=(.*))?$/.exec(argument);
    if (!match) throw new Error(`Unknown argument: ${argument}\n${usage}`);
    let value = match[2];
    if (value === undefined) {
      value = argv[index + 1];
      index += 1;
    }
    if (!value || value.startsWith("--")) throw new Error(`--${match[1]} needs a value\n${usage}`);
    options[match[1]] = value;
  }
  if (!options.help && !options.file) throw new Error(`--file is required\n${usage}`);
  return options;
}

/** A UTC timestamp safe for a directory name, e.g. 2026-09-11T16-40-05-123Z. */
export function runIdFor(date = new Date()) {
  return date.toISOString().replaceAll(":", "-").replace(".", "-");
}

export function defaultOutputDir(root, runId) {
  return path.join(root, ".context", "verification", "biv-421", runId);
}

export function isAllowedHref(href) {
  if (typeof href !== "string") return false;
  return href === SCHEDULED_DASHBOARD_URL || ALLOWED_LINK_PREFIXES.some((prefix) => href.startsWith(prefix));
}

/** Failures for one anchor, as { href, target, rel } read from its attributes. */
export function anchorFailures({ href, target, rel }) {
  const failures = [];
  const label = JSON.stringify(href ?? null);
  if (!isAllowedHref(href)) failures.push(`anchor ${label} is not a Clarity, Airtable, or scheduled dashboard link`);
  if (target !== "_blank") failures.push(`anchor ${label} has target=${JSON.stringify(target ?? null)}, not _blank`);
  const tokens = (rel ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.includes("noreferrer")) failures.push(`anchor ${label} rel=${JSON.stringify(rel ?? null)} lacks noreferrer`);
  return failures;
}

/** A failure when the expected headings are not all present, in order, among the found ones. */
export function headingOrderFailure(found, expected = SECTION_HEADINGS) {
  let cursor = 0;
  for (const heading of found) {
    if (heading === expected[cursor]) cursor += 1;
    if (cursor === expected.length) return null;
  }
  return `section headings out of order or missing: expected ${JSON.stringify(expected)} in order, found ${JSON.stringify(found)}; first missing ${JSON.stringify(expected[cursor])}`;
}

/** A request is automatic unless it is the dashboard file itself. */
export function unexpectedRequests(urls, fileUrl) {
  return urls.filter((url) => url !== fileUrl);
}

/** Failures for the numeric layout facts one scenario measured. */
export function layoutFailures({ viewportWidth, scrollWidth, clientWidth, smallText }, phase) {
  const failures = [];
  if (viewportWidth <= PHONE_WIDTH && scrollWidth > clientWidth + 1) {
    failures.push(`${phase}: page overflows horizontally (scrollWidth ${scrollWidth} > clientWidth ${clientWidth} + 1)`);
  }
  for (const item of smallText) {
    failures.push(`${phase}: ${item.selector} renders text at ${item.px}px (< ${MIN_FONT_PX}px): ${JSON.stringify(item.text)}`);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Machine-wide browser slot, shared with the parallel-web-verification runner.

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function processIsAlive(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

export async function acquireSlot({
  root = process.env.AGENT_VERIFY_SLOT_ROOT ?? path.join(process.env.TMPDIR ?? "/tmp", "agent-verify-slots"),
  slots = Math.max(1, Number(process.env.AGENT_VERIFY_SLOTS ?? 2) || 2),
  waitMs = Number(process.env.AGENT_VERIFY_SLOT_WAIT_MS ?? 300_000),
} = {}) {
  await mkdir(root, { recursive: true });
  const deadline = Date.now() + waitMs;
  for (;;) {
    for (let slot = 0; slot < slots; slot += 1) {
      const slotPath = path.join(root, `slot-${slot}`);
      try {
        await mkdir(slotPath);
        await writeFile(path.join(slotPath, "owner"), String(process.pid));
        return slotPath;
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
        try {
          const owner = await readFile(path.join(slotPath, "owner"), "utf8");
          if (!processIsAlive(owner.trim())) await rm(slotPath, { recursive: true, force: true });
        } catch {
          // Leave a slot alone while its owner file is being written.
        }
      }
    }
    if (Date.now() > deadline) throw new Error(`No browser slot free in ${root} after ${waitMs}ms`);
    await sleep(200);
  }
}

// ---------------------------------------------------------------------------
// Browser work.

/** Playwright plus the version of the copy that actually loaded. */
function resolvePlaywright() {
  const base = createRequire(import.meta.url);
  let loadedFrom = null;
  const recordingRequire = (id) => {
    const loaded = base(id);
    loadedFrom = id;
    return loaded;
  };
  const playwright = loadPlaywright(recordingRequire);
  let version = null;
  try {
    version = base(`${loadedFrom}/package.json`).version;
  } catch {
    // The version is evidence, not a precondition.
  }
  return { playwright, version, loadedFrom };
}

async function launchHeadless(chromium) {
  const options = { headless: true };
  try {
    return await chromium.launch(options);
  } catch (error) {
    const executablePath = /Executable doesn't exist/.test(error.message) && cachedBrowser();
    if (!executablePath) throw error;
    return chromium.launch({ ...options, executablePath });
  }
}

/** Measures text size, horizontal fit, and where overflow comes from. Runs in the page. */
function measureLayout(minPx) {
  const describe = (element) => {
    const id = element.id ? `#${element.id}` : "";
    const classes = typeof element.className === "string" && element.className.trim()
      ? `.${element.className.trim().split(/\s+/).join(".")}`
      : "";
    return `${element.tagName.toLowerCase()}${id}${classes}`;
  };
  const smallText = [];
  for (const element of document.body.querySelectorAll("*")) {
    const ownText = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();
    if (!ownText) continue;
    const declared = Number.parseFloat(getComputedStyle(element).fontSize);
    let px = declared;
    let selector = describe(element);
    // SVG text is drawn at its computed size times the viewBox scale.
    if (element instanceof SVGGraphicsElement) {
      const matrix = element.getScreenCTM();
      if (matrix) px *= Math.hypot(matrix.a, matrix.b);
      const svg = element.ownerSVGElement;
      const chart = svg?.getAttribute("aria-labelledby") ?? svg?.getAttribute("class") ?? "";
      selector = `svg[${chart}] ${selector} (declared ${declared}px, scaled by viewBox)`;
    }
    if (px < minPx - 0.01) {
      smallText.push({ selector, px: Math.round(px * 100) / 100, text: ownText.slice(0, 60) });
    }
  }
  const root = document.documentElement;
  const clientWidth = root.clientWidth;
  const overflowing = [];
  for (const element of document.body.querySelectorAll("*")) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.right <= clientWidth + 1) continue;
    let clipped = false;
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (getComputedStyle(parent).overflowX !== "visible") {
        clipped = true;
        break;
      }
    }
    if (!clipped) overflowing.push({ selector: describe(element), right: Math.round(rect.right) });
  }
  // Document order puts the outermost culprits first.
  const culprits = overflowing.slice(0, 8);
  return {
    viewportWidth: window.innerWidth,
    scrollWidth: root.scrollWidth,
    clientWidth,
    smallText,
    overflowing: culprits,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
  };
}

async function runScenario(browser, scenario, { fileUrl, outputDir, lightBackgrounds }) {
  const result = {
    name: scenario.name,
    viewport: scenario.viewport,
    colorScheme: scenario.colorScheme,
    ok: false,
    failures: [],
    requests: [],
    consoleErrors: [],
    pageErrors: [],
    popups: [],
    headings: [],
    details: { total: 0, openedByClick: 0, initiallyOpen: 0 },
    anchors: 0,
    layout: {},
    screenshots: {},
  };
  const fail = (message) => result.failures.push(message);
  const context = await browser.newContext({
    viewport: scenario.viewport,
    colorScheme: scenario.colorScheme,
    deviceScaleFactor: 1,
  });
  context.on("request", (request) => result.requests.push(request.url()));
  try {
    const page = await context.newPage();
    page.on("popup", (popup) => result.popups.push(popup.url()));
    page.on("console", (message) => {
      if (message.type() === "error") result.consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => result.pageErrors.push(String(error)));

    await page.goto(fileUrl, { waitUntil: "load", timeout: 15_000 });

    const inert = await page.evaluate(
      () => document.querySelectorAll("script, form, iframe, object, embed").length,
    );
    if (inert > 0) fail(`page contains ${inert} script, form, iframe, object, or embed element(s)`);

    result.headings = await page.$$eval("h2", (nodes) => nodes.map((node) => (node.textContent ?? "").trim()));
    const orderFailure = headingOrderFailure(result.headings);
    if (orderFailure) fail(orderFailure);

    const closedLayout = await page.evaluate(measureLayout, MIN_FONT_PX);
    result.layout.closed = closedLayout;
    // Text size is judged once, after every disclosure is open and all text renders.
    result.failures.push(...layoutFailures({ ...closedLayout, smallText: [] }, "before disclosures"));
    result.screenshots.closed = path.join(outputDir, `${scenario.name}-closed.png`);
    await page.screenshot({ path: result.screenshots.closed, fullPage: true });

    // Open each disclosure in document order, so a parent opens before its children.
    const summaries = page.locator("details > summary");
    const total = await page.locator("details").count();
    result.details.total = total;
    if ((await summaries.count()) !== total) fail(`found ${total} <details> but ${await summaries.count()} direct <summary> children`);
    for (let index = 0; index < (await summaries.count()); index += 1) {
      const summary = summaries.nth(index);
      const isOpen = await summary.evaluate((node) => node.parentElement.open);
      if (isOpen) {
        result.details.initiallyOpen += 1;
        continue;
      }
      await summary.click({ timeout: 5_000 });
      result.details.openedByClick += 1;
    }
    const closed = await page.$$eval("details", (nodes) =>
      nodes.flatMap((node, index) => (node.open ? [] : [`#${index} ${(node.querySelector("summary")?.textContent ?? "").trim().slice(0, 60)}`])),
    );
    for (const entry of closed) fail(`<details> ${entry} is still closed after clicking its summary`);
    if (page.url() !== fileUrl) fail(`clicking disclosures navigated the page to ${page.url()}`);

    const anchors = await page.$$eval("a", (nodes) =>
      nodes.map((node) => ({ href: node.getAttribute("href"), target: node.getAttribute("target"), rel: node.getAttribute("rel") })),
    );
    result.anchors = anchors.length;
    for (const anchor of anchors) result.failures.push(...anchorFailures(anchor));

    const openLayout = await page.evaluate(measureLayout, MIN_FONT_PX);
    result.layout.open = openLayout;
    result.failures.push(...layoutFailures(openLayout, "after disclosures"));
    result.screenshots.open = path.join(outputDir, `${scenario.name}-open.png`);
    await page.screenshot({ path: result.screenshots.open, fullPage: true });

    const widthKey = String(scenario.viewport.width);
    if (scenario.colorScheme === "light") {
      lightBackgrounds.set(widthKey, openLayout.bodyBackground);
    } else {
      const light = lightBackgrounds.get(widthKey);
      if (!light) fail("no light scenario at this width to compare the dark background against");
      else if (light === openLayout.bodyBackground) {
        fail(`dark mode did not change the body background (both ${openLayout.bodyBackground})`);
      }
    }
  } catch (error) {
    fail(`scenario aborted: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close().catch(() => {});
  }
  for (const url of unexpectedRequests(result.requests, fileUrl)) fail(`unexpected request: ${url}`);
  for (const message of result.consoleErrors) fail(`console error: ${message}`);
  for (const message of result.pageErrors) fail(`page error: ${message}`);
  for (const url of result.popups) fail(`a new page opened: ${url}`);
  result.ok = result.failures.length === 0;
  return result;
}

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    console.log(usage);
    return 0;
  }
  const file = path.resolve(options.file);
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) throw new Error(`Not a file: ${file}`);
  const bytes = await readFile(file);
  const fileUrl = pathToFileURL(file).href;
  const runId = runIdFor();
  const outputDir = path.resolve(options.output ?? defaultOutputDir(repoRoot, runId));
  await mkdir(outputDir, { recursive: true });

  const { playwright, version, loadedFrom } = resolvePlaywright();
  const startedAt = new Date();
  const scenarios = [];
  const slotPath = await acquireSlot();
  let browser;
  let browserVersion = null;
  try {
    browser = await launchHeadless(playwright.chromium);
    browserVersion = browser.version();
    const lightBackgrounds = new Map();
    for (const scenario of SCENARIOS) {
      scenarios.push(await runScenario(browser, scenario, { fileUrl, outputDir, lightBackgrounds }));
    }
  } finally {
    await browser?.close().catch(() => {});
    await rm(slotPath, { recursive: true, force: true });
  }

  const report = {
    ok: scenarios.length === SCENARIOS.length && scenarios.every((scenario) => scenario.ok),
    runId,
    file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    gitHead: gitHead(),
    playwright: { version, loadedFrom, browser: browserVersion },
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    outputDir,
    scenarios,
  };
  const reportPath = path.join(outputDir, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const scenario of scenarios) {
    console.log(`${scenario.ok ? "PASS" : "FAIL"} ${scenario.name} (${scenario.failures.length} failure(s))`);
    for (const failure of scenario.failures) console.log(`  - ${failure}`);
  }
  console.log(`report: ${reportPath}`);
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    },
  );
}
