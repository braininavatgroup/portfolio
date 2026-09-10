/**
 * Checked-in managed renderer: turns a clip spec into an Instagram-ready MP4,
 * or into a single still.
 *
 *   node scripts/clip-studio/render.mjs --spec portfolio-launch
 *   node scripts/clip-studio/render.mjs --spec portfolio-launch --still 4.2
 *
 * It runs one headless browser per invocation with an ephemeral context, never
 * a personal profile or a visible window, and writes only workspace-scoped
 * artifacts under `.context/clips`. Frames are stepped deterministically in the
 * page and piped straight to ffmpeg, so nothing depends on real-time playback.
 */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer, specNames } from "./server.mjs";
import { assertRenderTools, cachedBrowser, loadPlaywright } from "./tools.mjs";
import { filmPath } from "./films.mjs";
import { resolveSpec } from "./public/spec.mjs";

const codeDir = path.dirname(fileURLToPath(import.meta.url)),
  repoDir = path.resolve(codeDir, "../..");

function parseArguments(argv) {
  const options = { spec: null, out: null, still: null, strip: null, audio: null, open: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("--")) throw new Error(`${flag} needs a value`);
      index += 1;
      return next;
    };
    if (flag === "--spec") options.spec = value();
    else if (flag === "--strip") options.strip = Number(value());
    else if (flag === "--out") options.out = value();
    else if (flag === "--still") options.still = Number(value());
    else if (flag === "--audio") options.audio = value();
    else if (flag === "--open") options.open = true;
    else throw new Error(`Unknown option ${flag}`);
  }
  return options;
}

function stamp() {
  const now = new Date(),
    pad = (value) => String(value).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function decodeFrame(dataUrl) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("The page returned an unreadable frame");
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

/** Fails before any browser work if the local studio server is not answering. */
async function assertServer(origin) {
  const response = await fetch(`${origin}/api/specs`).catch((error) => {
    throw new Error(`The clip studio server did not answer: ${error.message}`);
  });
  if (!response.ok) throw new Error(`The clip studio server answered ${response.status}`);
}

async function launchBrowser() {
  const { chromium } = loadPlaywright(),
    options = {
      headless: true,
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--disable-lcd-text",
      ],
    };
  try {
    return await chromium.launch(options);
  } catch (error) {
    const executablePath = /Executable doesn't exist/.test(error.message) && cachedBrowser();
    if (!executablePath) throw error;
    return chromium.launch({ ...options, executablePath });
  }
}

async function openStudio(origin, specName) {
  const browser = await launchBrowser(),
    context = await browser.newContext({ viewport: { width: 1080, height: 1920 } }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/?spec=${encodeURIComponent(specName)}&headless=1`, {
    waitUntil: "load",
  });
  await page
    .waitForFunction(() => window.clipStudio?.ready || window.clipStudioError, null, {
      timeout: 90_000,
    })
    .catch(() => {
      throw new Error(`The studio page did not become ready. ${errors.join("; ")}`);
    });
  const failure = await page.evaluate(() => window.clipStudioError ?? null);
  if (failure) throw new Error(failure);
  const spec = await page.evaluate(() => ({
    width: window.clipStudio.spec.width,
    height: window.clipStudio.spec.height,
    fps: window.clipStudio.spec.fps,
    totalDuration: window.clipStudio.spec.totalDuration,
  }));
  return { browser, page, spec };
}

function startFfmpeg(spec, outFile, audio) {
  const args = ["-y", "-f", "image2pipe", "-framerate", String(spec.fps), "-i", "-"];
  if (audio) args.push("-i", audio, "-shortest", "-c:a", "aac", "-b:a", "160k");
  args.push(
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "19",
    "-profile:v", "high",
    "-pix_fmt", "yuv420p",
    "-r", String(spec.fps),
    "-movflags", "+faststart",
    outFile,
  );
  const child = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
  });
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${stderr}`)),
    );
  });
  return { child, done };
}

function write(stream, chunk) {
  return stream.write(chunk) ? Promise.resolve() : new Promise((r) => stream.once("drain", r));
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  // Say what the machine is missing before spending twenty seconds finding out.
  await assertRenderTools();
  const available = await specNames();
  const specName = options.spec ?? available[0];
  if (!specName) throw new Error("No specs found under scripts/clip-studio/specs");
  if (!available.includes(specName))
    throw new Error(`Spec "${specName}" not found. Available: ${available.join(", ")}`);

  // A film is transcoded on first use, which takes longer than the page waits.
  const spec = resolveSpec(
    JSON.parse(await readFile(path.join(codeDir, "specs", `${specName}.json`), "utf8")),
  );
  if (spec.background.kind === "video") {
    console.error(`Preparing the ${spec.background.film} background film…`);
    await filmPath(spec.background.film, { width: spec.width, height: spec.height });
  }

  const { server, origin } = await startServer(0);
  let browser;
  try {
    await assertServer(origin);
    const studio = await openStudio(origin, specName);
    browser = studio.browser;
    const { page, spec } = studio;
    const outDir = path.join(repoDir, ".context/clips");
    await mkdir(outDir, { recursive: true });

    if (options.strip !== null) {
      // A contact strip: one browser, many frames, laid out for a quick read of
      // how the clip actually moves rather than a still every few seconds.
      const every = options.strip,
        times = [];
      for (let at = 0; at < spec.totalDuration; at += every) times.push(Number(at.toFixed(2)));
      const dir = options.out ?? path.join(outDir, `${specName}-strip-${stamp()}`);
      await mkdir(dir, { recursive: true });
      for (const [index, at] of times.entries()) {
        const frame = await page.evaluate((seconds) => window.clipStudio.frame(seconds), at);
        await writeFile(
          path.join(dir, `${String(index).padStart(3, "0")}-${at}s.png`),
          decodeFrame(frame),
        );
      }
      console.log(dir);
      return;
    }

    if (options.still !== null) {
      if (!Number.isFinite(options.still)) throw new Error("--still needs a time in seconds");
      const file =
        options.out ?? path.join(outDir, `${specName}-${options.still}s-${stamp()}.png`);
      const frame = await page.evaluate((time) => window.clipStudio.frame(time), options.still);
      await writeFile(file, decodeFrame(frame));
      console.log(file);
      return;
    }

    const outFile = options.out ?? path.join(outDir, `${specName}-${stamp()}.mp4`),
      // A render that is interrupted leaves a partial file behind, and a partial
      // MP4 has no index — it will not open. Writing beside the target and
      // renaming on success means only finished clips carry the name.
      partFile = `${outFile}.part.mp4`,
      total = Math.round(spec.totalDuration * spec.fps),
      { child, done } = startFfmpeg(spec, partFile, options.audio);
    const cleanUp = () => rmSync(partFile, { force: true });
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
      child.kill("SIGKILL");
      cleanUp();
      process.exit(1);
    });

    console.error(
      `Rendering ${total} frames · ${spec.width}×${spec.height} · ${spec.fps}fps → ${outFile}`,
    );
    for (let index = 0; index < total; index += 1) {
      const time = index / spec.fps,
        frame = await page.evaluate((seconds) => window.clipStudio.frame(seconds), time),
        buffer = decodeFrame(frame);
      if (index === 0) await writeFile(outFile.replace(/\.mp4$/, "-poster.png"), buffer);
      await write(child.stdin, buffer);
      if (index % 30 === 0 || index === total - 1) console.error(`  ${index + 1}/${total}`);
    }
    child.stdin.end();
    try {
      await done;
    } catch (error) {
      cleanUp();
      throw error;
    }
    await rename(partFile, outFile);
    console.log(outFile);
    if (options.open) spawn("open", [outFile], { stdio: "ignore", detached: true }).unref();
  } finally {
    await browser?.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
