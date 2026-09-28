#!/usr/bin/env node

// node .agents/skills/verify-portfolio/verify.mjs [live] [insights] [-- <live options>]
//
// Drives the portfolio the way a visitor does and keeps the evidence under
// .context/verification/<run>/. With no lane named, both run.
//
//   live      npm run live: the feature map against this checkout, then every
//             mapped route, record and control on production, read-only.
//             Options after `--` go to scripts/live.mjs (e.g. --only writ).
//   insights  renders the insights dashboard from fixture data into a temp
//             directory, checks it in headless Chromium at desktop and phone
//             sizes in light and dark (scripts/verify-insights-dashboard.mjs),
//             then deletes the temp directory. The real dashboard is behind
//             Cloudflare Access, so this is the only browser view of it.
//
// Exit 0 when every lane passes.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const LANES = ["live", "insights"];

const argv = process.argv.slice(2);
const split = argv.indexOf("--");
const lanes = split === -1 ? argv : argv.slice(0, split);
const liveOptions = split === -1 ? [] : argv.slice(split + 1);
const unknown = lanes.filter((lane) => !LANES.includes(lane));
if (unknown.length > 0) {
  console.error(`Unknown lane: ${unknown.join(", ")}. Lanes: ${LANES.join(", ")}.`);
  process.exit(2);
}
const selected = lanes.length > 0 ? lanes : LANES;
const runId = new Date().toISOString().replaceAll(":", "-").replace(/\..+/, "");
const evidence = path.join(repoRoot, ".context", "verification", `verify-portfolio-${runId}`);
fs.mkdirSync(evidence, { recursive: true });

const git = (...args) => spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" }).stdout.trim();
const say = (line) => {
  console.log(line);
  fs.appendFileSync(path.join(evidence, "run.log"), `${line}\n`);
};

// Run a command, echoing its output and keeping a copy in the evidence dir.
function run(label, args) {
  return new Promise((resolve) => {
    const log = fs.createWriteStream(path.join(evidence, `${label}.log`));
    const child = spawn(process.execPath, args, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (bytes) => {
        process.stdout.write(bytes);
        log.write(bytes);
      });
    }
    child.on("close", (status) => log.end(() => resolve(status)));
  });
}

// ── Preflight: what is being compared with what ─────────────────────────────

const head = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain") !== "";
spawnSync("git", ["fetch", "-q", "origin", "main"], { cwd: repoRoot });
const main = git("rev-parse", "origin/main");
say(`verify-portfolio: lanes ${selected.join(", ")}; evidence ${path.relative(repoRoot, evidence)}`);
say(`  checkout ${head}${dirty ? " (uncommitted changes)" : ""}; origin/main ${main}`);
if (selected.includes("live") && (head !== main || dirty)) {
  say("  note: production deploys from main; a FAIL here may be this checkout's map or probes, not production");
}

const results = {};

if (selected.includes("live")) {
  say(`lane live: npm run live ${liveOptions.join(" ")}`.trimEnd());
  const args = [path.join(repoRoot, "scripts", "live.mjs"), "--evidence", path.join(evidence, "live"), ...liveOptions];
  results.live = (await run("live", args)) === 0;
}

if (selected.includes("insights")) {
  const scratch = fs.mkdtempSync(path.join(tmpdir(), "verify-portfolio-insights-"));
  say(`lane insights: fixture dashboard in ${scratch}`);
  try {
    const built = (await run("insights-fixture", [path.join(repoRoot, "scripts", "portfolio-insights-fixture.mjs"), scratch])) === 0;
    const file = path.join(scratch, "dashboard.html");
    results.insights =
      built &&
      fs.existsSync(file) &&
      (await run("insights", [path.join(repoRoot, "scripts", "verify-insights-dashboard.mjs"), "--file", file, "--output", path.join(evidence, "insights")])) === 0;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
    say(`  removed ${scratch}: ${fs.existsSync(scratch) ? "NO, still there" : "gone"}`);
  }
}

// ── Result ──────────────────────────────────────────────────────────────────

const kept = fs.readdirSync(evidence, { recursive: true }).length;
for (const lane of selected) say(`${results[lane] ? "ok  " : "FAIL"} lane ${lane}`);
say(`evidence kept: ${path.relative(repoRoot, evidence)} (${kept} files)`);
process.exit(selected.every((lane) => results[lane]) ? 0 : 1);
