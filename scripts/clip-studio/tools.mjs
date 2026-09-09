/**
 * What the studio needs from the machine, and what to say when it is missing.
 *
 * The studio itself — the page, the preview, the painted backgrounds — needs
 * nothing but this repository. Rendering a video needs ffmpeg and a browser,
 * and the falling-map background needs a film that lives in another repository.
 * Each of those is checked before any work starts, so a fresh machine is told
 * what to install rather than shown a spawn error twenty seconds in.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/** Runs a command and resolves true when it exits cleanly. */
function answers(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });
}

export async function hasFfmpeg() {
  return answers("ffmpeg", ["-version"]);
}

export const ffmpegAdvice =
  "ffmpeg is not on this machine, and the studio needs it to write a video. " +
  "Install it with `brew install ffmpeg`, then run this again.";

/** Copies npx has already unpacked, newest first. Often the only ones with browsers. */
export function npxPlaywrightModules(home = process.env.HOME ?? "") {
  const root = path.join(home, ".npm/_npx");
  try {
    return readdirSync(root)
      .map((entry) => path.join(root, entry, "node_modules/playwright"))
      .filter((module) => existsSync(module))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  } catch {
    return [];
  }
}

/**
 * Playwright, from wherever this machine has one: an explicit module, a
 * project-local install, the global one, or a copy npx unpacked.
 */
export function loadPlaywright(require = createRequire(import.meta.url)) {
  const home = process.env.HOME ?? "",
    candidates = [
      process.env.PLAYWRIGHT_MODULE,
      "playwright",
      path.join(home, ".npm-global/lib/node_modules/playwright"),
      ...npxPlaywrightModules(home),
    ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // Try the next resolution path.
    }
  }
  throw new Error(playwrightAdvice);
}

export const playwrightAdvice =
  "Playwright is not on this machine, and the studio renders frames through it. " +
  "Run `npm run clip:setup` to install it and its browser, or set " +
  "PLAYWRIGHT_MODULE to a copy you already have.";

/**
 * A Playwright package pins one browser build, and the shared cache may hold a
 * different one, installed by another tool. Rather than fail, the runner points
 * the launch at the newest cached headless shell.
 */
export function cachedBrowser(home = process.env.HOME ?? "") {
  const root = path.join(home, "Library/Caches/ms-playwright"),
    shells = [
      ["chromium_headless_shell-", "chrome-headless-shell-mac-arm64/chrome-headless-shell"],
      [
        "chromium-",
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      ],
    ];
  try {
    const builds = readdirSync(root);
    for (const [prefix, suffix] of shells) {
      const match = builds
        .filter((entry) => entry.startsWith(prefix))
        .sort((a, b) => Number(b.slice(prefix.length)) - Number(a.slice(prefix.length)))[0];
      if (!match) continue;
      const executable = path.join(root, match, suffix);
      if (existsSync(executable)) return executable;
    }
  } catch {
    // Fall through to Playwright's own resolution.
  }
  return null;
}

/**
 * Checks everything a render needs before it starts. Throws one message naming
 * what to do, rather than failing part-way through. The checks are injectable
 * so both outcomes can be exercised on a machine that has the tools, or has
 * neither.
 */
export async function assertRenderTools({
  ffmpeg = hasFfmpeg,
  playwright = loadPlaywright,
} = {}) {
  if (!(await ffmpeg())) throw new Error(ffmpegAdvice);
  playwright();
}
