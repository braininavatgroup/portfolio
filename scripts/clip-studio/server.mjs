/**
 * Static server for the clip studio. It serves the authoring page, the spec
 * files, the avatar model, Three.js from node_modules, and the cached brand
 * fonts. It binds to the loopback interface only.
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readBrandFont } from "./fonts.mjs";
import { filmPath } from "./films.mjs";
import { ffmpegAdvice, hasFfmpeg } from "./tools.mjs";
import { resolveSpec } from "./public/spec.mjs";

const codeDir = path.dirname(fileURLToPath(import.meta.url)),
  repoDir = path.resolve(codeDir, "../.."),
  publicDir = path.join(codeDir, "public"),
  specDir = path.join(codeDir, "specs"),
  threeDir = path.join(repoDir, "node_modules/three");

const types = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/** One render at a time: the runner owns a browser and a full CPU core. */
const render = { running: false, progress: "", file: null, error: null };

function startRender(name) {
  render.running = true;
  render.progress = "";
  render.file = null;
  render.error = null;
  const child = spawn(process.execPath, [path.join(codeDir, "render.mjs"), "--spec", name], {
    cwd: repoDir,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "",
    errors = "";
  child.stdout.on("data", (chunk) => {
    out += chunk;
  });
  child.stderr.on("data", (chunk) => {
    errors += chunk;
    const frames = errors.match(/\d+\/\d+/g);
    if (frames) render.progress = frames[frames.length - 1];
  });
  child.once("error", (error) => {
    render.running = false;
    render.error = error.message;
  });
  child.once("close", (code) => {
    render.running = false;
    if (code === 0) render.file = out.trim().split("\n").pop();
    else render.error = errors.trim().split("\n").slice(-3).join(" ") || `render exited ${code}`;
  });
}

let records = null;

/**
 * The map's own nodes: label, family, and register straight from
 * `lib/portfolio-structure.ts`, so the studio draws what the portfolio draws.
 * The structure is TypeScript, so it is read through tsx, once per server.
 */
async function mapRecords() {
  if (records) return records;
  const script =
    "import { portfolioRecordStructures } from './lib/portfolio-structure';" +
    "import content from './content/portfolio-content.json' with { type: 'json' };" +
    "process.stdout.write(JSON.stringify(portfolioRecordStructures.map((record) => ({" +
    "id: record.id, family: record.family, register: record.register," +
    "label: content.records[record.id]?.label ?? record.id }))));";
  const child = spawn("npx", ["--no-install", "tsx", "-e", script], {
    cwd: repoDir,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "",
    errors = "";
  child.stdout.on("data", (chunk) => {
    out += chunk;
  });
  child.stderr.on("data", (chunk) => {
    errors = `${errors}${chunk}`.slice(-2000);
  });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`reading the map's nodes failed\n${errors}`)),
    );
  });
  records = JSON.parse(out);
  return records;
}

/** A recorded take arrives as WebM bytes; 600 MB is well past a long take. */
function readTake(request, limit = 600_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) reject(new Error("The take is too large"));
      else chunks.push(chunk);
    });
    request.once("end", () => resolve(Buffer.concat(chunks)));
    request.once("error", reject);
  });
}

/** Writes the take beside the rendered clips, converted to the posting shape. */
async function saveTake(take) {
  if (!(await hasFfmpeg())) throw new Error(ffmpegAdvice);
  const outDir = path.join(repoDir, ".context/clips"),
    now = new Date(),
    pad = (value) => String(value).padStart(2, "0"),
    stamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
    source = path.join(outDir, `take-${stamp}.webm`),
    target = path.join(outDir, `take-${stamp}.mp4`);
  await mkdir(outDir, { recursive: true });
  await writeFile(source, take);
  await new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y", "-i", source,
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "19",
        "-profile:v", "high",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30",
        "-movflags", "+faststart",
        target,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let errors = "";
    child.stderr.on("data", (chunk) => {
      errors = `${errors}${chunk}`.slice(-3000);
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${errors}`)),
    );
  });
  await rm(source, { force: true });
  return target;
}

function readBody(request, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) reject(new Error("The request body is too large"));
    });
    request.once("end", () => resolve(body));
    request.once("error", reject);
  });
}

function send(response, status, body, type = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
  });
  response.end(body);
}

/** Resolves `relative` inside `root`, refusing anything that escapes it. */
function safeJoin(root, relative) {
  const file = path.resolve(root, `.${path.posix.normalize(`/${relative}`)}`);
  return file === root || file.startsWith(`${root}${path.sep}`) ? file : null;
}

async function sendFile(response, file) {
  if (!file) return send(response, 403, "Forbidden");
  try {
    const body = await readFile(file);
    return send(response, 200, body, types[path.extname(file)] ?? "application/octet-stream");
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR")
      return send(response, 404, "Not found");
    throw error;
  }
}

export async function specNames() {
  const entries = await readdir(specDir);
  return entries.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)).sort();
}

export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1"),
        route = url.pathname;

      if (route === "/api/specs") {
        return send(response, 200, JSON.stringify(await specNames()), types[".json"]);
      }
      if (route.startsWith("/api/specs/")) {
        const name = decodeURIComponent(route.slice("/api/specs/".length));
        if (!/^[a-z0-9][a-z0-9-]*$/.test(name))
          return send(response, 400, JSON.stringify({ error: "Bad spec name" }), types[".json"]);
        if (request.method !== "PUT") return sendFile(response, path.join(specDir, `${name}.json`));

        let spec;
        try {
          spec = JSON.parse(await readBody(request));
          // The file on disk is the renderer's input, so it is validated first.
          resolveSpec(spec);
        } catch (error) {
          return send(response, 400, JSON.stringify({ error: error.message }), types[".json"]);
        }
        if (spec.name !== name)
          return send(
            response,
            400,
            JSON.stringify({ error: `The spec is named "${spec.name}", not "${name}"` }),
            types[".json"],
          );
        const file = path.join(specDir, `${name}.json`),
          temporary = `${file}.${process.pid}.part`;
        await writeFile(temporary, `${JSON.stringify(spec, null, 2)}\n`);
        await rename(temporary, file);
        return send(response, 200, JSON.stringify({ name }), types[".json"]);
      }

      if (route === "/api/records")
        return send(response, 200, JSON.stringify(await mapRecords()), types[".json"]);

      if (route === "/api/record" && request.method === "POST") {
        const take = await readTake(request);
        if (!take.length) return send(response, 400, JSON.stringify({ error: "Empty take" }), types[".json"]);
        try {
          const file = await saveTake(take);
          return send(response, 200, JSON.stringify({ file }), types[".json"]);
        } catch (error) {
          return send(response, 500, JSON.stringify({ error: error.message }), types[".json"]);
        }
      }

      if (route === "/api/render") {
        return send(response, 200, JSON.stringify(render), types[".json"]);
      }
      if (route.startsWith("/api/render/") && request.method === "POST") {
        const name = decodeURIComponent(route.slice("/api/render/".length));
        if (!(await specNames()).includes(name))
          return send(response, 404, JSON.stringify({ error: `No spec "${name}"` }), types[".json"]);
        if (render.running)
          return send(
            response,
            409,
            JSON.stringify({ error: "A render is already running" }),
            types[".json"],
          );
        startRender(name);
        return send(response, 202, JSON.stringify({ started: name }), types[".json"]);
      }
      if (route.startsWith("/clips/"))
        return sendFile(
          response,
          safeJoin(path.join(repoDir, ".context/clips"), route.slice("/clips".length)),
        );
      if (route === "/assets/avatar.glb")
        return sendFile(response, path.join(repoDir, "public/avatars/bradley-quiet-portrait.glb"));
      if (route === "/assets/mark.png")
        return sendFile(response, path.join(repoDir, "public/biv-brain-symbol.png"));
      if (route === "/assets/mark.svg")
        return sendFile(response, path.join(repoDir, "public/biv-brain-symbol.svg"));
      if (route.startsWith("/glyph-textures/"))
        return sendFile(response, safeJoin(path.join(repoDir, "public/glyph-textures"), route.slice("/glyph-textures".length)));
      if (route.startsWith("/films/")) {
        const name = route.slice("/films/".length).replace(/\.webm$/, "");
        try {
          // The first request transcodes; later ones are served from the cache.
          return await sendFile(response, await filmPath(name));
        } catch (error) {
          return send(response, 404, error.message);
        }
      }
      if (route.startsWith("/fonts/")) {
        const body = await readBrandFont(route.slice("/fonts/".length)).catch(() => null);
        return body
          ? send(response, 200, body, types[".ttf"])
          : send(response, 404, "Font unavailable");
      }
      if (route.startsWith("/vendor/three/addons/"))
        return sendFile(
          response,
          safeJoin(threeDir, `examples/jsm/${route.slice("/vendor/three/addons/".length)}`),
        );
      if (route.startsWith("/vendor/three/"))
        return sendFile(
          response,
          safeJoin(threeDir, `build/${route.slice("/vendor/three/".length)}`),
        );

      return sendFile(response, safeJoin(publicDir, route === "/" ? "/index.html" : route));
    } catch (error) {
      send(response, 500, error instanceof Error ? error.message : String(error));
    }
  });
}

/** Starts the server and resolves its origin. Port 0 picks a free port. */
export function startServer(port) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORTFOLIO_CLIP_PORT ?? 55090);
  const { origin } = await startServer(port);
  console.log(`Clip studio on ${origin}`);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => process.exit(0));
}
