import { createHash } from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProject } from "./public/model.mjs";
import { studioDataDir, sourcePath } from "./storage.mjs";
import { acquireLibrary } from "./lease.mjs";
const codeDir = path.dirname(fileURLToPath(import.meta.url)),
  dir = studioDataDir(),
  port = Number(
    process.env.PORTFOLIO_STUDIO_PORT || process.env.CONDUCTOR_PORT || 55080,
  ),
  origin = `http://127.0.0.1:${port}`;
await mkdir(dir, { recursive: true, mode: 0o700 });
try {
  await fs.promises.access(path.join(dir, "manifest.json"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  console.error(
    "No media library yet. Run npm run media:scan, then npm run media:studio.",
  );
  process.exit(1);
}
acquireLibrary(dir);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => process.exit(0));
const manifest = JSON.parse(
  await readFile(path.join(dir, "manifest.json"), "utf8"),
);
const meta = JSON.parse(
  await readFile(path.join(dir, "manifest-meta.json"), "utf8"),
);
const verified = new Map();
const reviewDir = path.join(dir, "review");
const reviewFiles = new Set([
  "index.html",
  "review.mjs",
  "campaign-kickoff-selected-preview.mp4",
  "pitch-pipeline-selected-preview.mp4",
  "pitch-original-160.mp4",
  "campaign-kickoff-poster.png",
  "pitch-pipeline-poster.png",
  "reporting-drafts-2x.png",
  "review-report.json",
  "propagation-plan.json",
  "folder-fix-closeup.png",
  "reporting-dashboard-candidate.png",
]);
function sourceFile(a) {
  return sourcePath(dir, a);
}

async function assertSource(a) {
  if (!a.src) return;
  const file = sourceFile(a),
    s = await fs.promises.stat(file),
    key = `${s.mtimeMs}:${s.size}`;
  if (verified.get(a.id) === key) return;
  const actual = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
  if (actual !== a.sha256)
    throw Error(
      `Source changed: ${a.name}. Refresh the media list before making selections.`,
    );
  verified.set(a.id, key);
}
const stateFile = path.join(dir, "decisions.json");
let state = { revision: 0, project: { version: 1, assets: {} } };
try {
  state = JSON.parse(await readFile(stateFile, "utf8"));
  validateProject(state.project, manifest);
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const mime = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".json": "application/json",
};
const json = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};
let writing = false;
const server = http.createServer(async (req, res) => {
  try {
    if (
      ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)
    ) {
      res.writeHead(403);
      return res.end("Local access only");
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    );
    const url = new URL(req.url, origin);
    if (url.pathname === "/api/project" && req.method === "GET")
      return json(res, 200, {
        ...state,
        manifest,
        baseCommit: meta.baseCommit,
      });
    if (url.pathname === "/api/project" && req.method === "POST") {
      if (
        ![origin, `http://localhost:${port}`].includes(req.headers.origin) ||
        req.headers["content-type"] !== "application/json"
      )
        return json(res, 403, {
          error: "Save must come from the local studio.",
        });
      let body = "",
        size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 5e6)
          return json(res, 413, { error: "Project is too large." });
        body += chunk;
      }
      const next = JSON.parse(body);
      const project = validateProject(next.project, manifest);
      for (const id of Object.keys(project.assets))
        await assertSource(manifest.find((a) => a.id === id));
      if (writing || next.revision !== state.revision)
        return json(res, 409, {
          error:
            "Another tab saved newer work. Export this tab before reloading.",
        });
      writing = true;
      try {
        await mkdir(path.join(dir, "backups"), { recursive: true });
        if (state.revision)
          await writeFile(
            path.join(dir, "backups", `decisions-${state.revision}.json`),
            JSON.stringify(state),
          );
        const saved = {
          revision: state.revision + 1,
          project,
          updatedAt: new Date().toISOString(),
        };
        await writeFile(stateFile + ".tmp", JSON.stringify(saved, null, 2));
        await rename(stateFile + ".tmp", stateFile);
        state = saved;
        json(res, 200, {
          revision: state.revision,
          updatedAt: state.updatedAt,
        });
      } finally {
        writing = false;
      }
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    let file, extension;
    if (url.pathname.startsWith("/media/")) {
      const a = manifest.find(
        (a) => a.id === decodeURIComponent(url.pathname.slice(7)),
      );
      if (!a?.src) {
        res.writeHead(404);
        return res.end();
      }
      await assertSource(a);
      file = sourceFile(a);
      extension = path.extname(a.src);
    } else if (url.pathname.startsWith("/review/")) {
      const name = url.pathname.slice("/review/".length) || "index.html";
      if (!reviewFiles.has(name)) {
        res.writeHead(404);
        return res.end();
      }
      file = path.join(reviewDir, name);
    } else if (
      ["/", "/app.mjs", "/model.mjs", "/studio.css"].includes(url.pathname)
    )
      file = path.join(
        codeDir,
        "public",
        url.pathname === "/" ? "index.html" : url.pathname.slice(1),
      );
    else {
      res.writeHead(404);
      return res.end();
    }
    const stat = await fs.promises.stat(file);
    res.setHeader(
      "Content-Type",
      mime[extension || path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("Accept-Ranges", "bytes");
    let start = 0,
      end = stat.size - 1;
    if (req.headers.range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!m || (!m[1] && !m[2])) {
        res.writeHead(416);
        return res.end();
      }
      if (!m[1]) start = Math.max(0, stat.size - Number(m[2]));
      else {
        start = Number(m[1]);
        if (m[2]) end = Math.min(Number(m[2]), end);
      }
      if (start > end || start >= stat.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        return res.end();
      }
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Content-Length": end - start + 1,
      });
    } else res.writeHead(200, { "Content-Length": stat.size });
    if (req.method === "HEAD") return res.end();
    const stream = fs.createReadStream(file, { start, end });
    stream.pipe(res);
    res.on("close", () => stream.destroy());
  } catch (e) {
    if (!res.headersSent) json(res, 400, { error: e.message });
    else res.end();
  }
});
server.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", async () => {
  await writeFile(path.join(dir, "server.pid"), String(process.pid));
  console.log(`Redaction studio: ${origin}\nSelections: ${stateFile}`);
});
