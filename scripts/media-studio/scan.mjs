import { portfolioRecordStructures } from "../../lib/portfolio-structure.ts";
import { portfolioWorldNodes } from "../../lib/portfolio-world.ts";
import { portfolioLinkPreview } from "../../lib/portfolio-link-preview.ts";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { studioDataDir, preserveSource } from "./storage.mjs";
import { mergeCatalog } from "./catalog.mjs";
import { acquireLibrary } from "./lease.mjs";

const root = process.cwd(),
  dir = studioDataDir();
await mkdir(dir, { recursive: true, mode: 0o700 });
const release = acquireLibrary(dir);
try {
  const readJSON = async (name, fallback) => {
    try {
      return JSON.parse(await readFile(path.join(dir, name), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return fallback;
      throw error;
    }
  };
  const previous = await readJSON("manifest.json", []);
  const publications = await readJSON("publications.json", []);
  const inventory = portfolioRecordStructures.flatMap((record) =>
    record.body
      .filter((b) => b.kind === "visual" && b.status === "ready")
      .map((b) => ({ record: record.id, ...b })),
  );
  for (const node of portfolioWorldNodes) {
    const preview = portfolioLinkPreview(node.body, node.id);
    if (preview)
      inventory.push({
        record: node.id,
        id: `hover-${node.id}`,
        format: "image",
        src: preview.src,
      });
  }
  const current = [],
    seen = new Set();
  async function add(record, src, kind, visualId) {
    const identity = src || visualId;
    if (seen.has(identity)) return;
    seen.add(identity);
    const input = path.resolve(root, "public", src.replace(/^\//, ""));
    if (src && !input.startsWith(path.join(root, "public") + path.sep))
      throw Error("Media must be inside public/");
    const sha256 = src
      ? createHash("sha256")
          .update(await readFile(input))
          .digest("hex")
      : undefined;
    if (
      previous.some(
        (a) =>
          a.src === src &&
          a.sha256 === sha256 &&
          (src || a.visualId === visualId),
      )
    )
      return;
    if (
      publications.some(
        (p) =>
          p.src === src &&
          p.sha256 === sha256 &&
          previous.some((a) => a.sha256 === p.sourceHash),
      )
    )
      return;
    const asset = {
      id: `asset-${createHash("sha256")
        .update(identity + (sha256 || ""))
        .digest("hex")
        .slice(0, 16)}`,
      name: src
        ? path
            .basename(src)
            .replace(/\.[^.]+$/, "")
            .replaceAll("-", " ")
        : "Interactive dashboard",
      record,
      kind,
      src,
      visualId,
      sha256,
      priorNote: "",
      deferred: ["touring", "dubs"].includes(record),
      client: src.includes("/clients/") || src.includes("/hover/"),
      checkpoints: [0],
    };
    if (src && previous.some((a) => a.src === src)) {
      asset.name += ` · new source ${sha256.slice(0, 6)}`;
    }
    if (kind === "video") {
      const info = JSON.parse(
        execFileSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            input,
          ],
          { encoding: "utf8" },
        ),
      );
      Object.assign(asset, {
        duration: Number(info.format.duration),
        width: info.streams[0].width,
        height: info.streams[0].height,
      });
      asset.checkpoints = Array.from(
        { length: Math.ceil(asset.duration / 15) },
        (_, i) => i * 15,
      );
      asset.checkpoints.push(
        Math.max(0, Math.floor((asset.duration - 1 / 30) * 1000) / 1000),
      );
    }
    if (src) await preserveSource(dir, asset, input);
    current.push(asset);
  }
  for (const v of inventory) {
    if (v.format === "gallery") {
      for (const slide of v.slides ?? [])
        for (const asset of slide.assets ?? [])
          await add(v.record, asset.src, "image", v.id);
    } else if (v.format === "video") {
      await add(v.record, v.src, "video", v.id);
      if (v.poster) await add(v.record, v.poster, "image", v.id);
    } else if (v.src) await add(v.record, v.src, "image", v.id);
    else if (v.format === "interactive")
      await add(v.record, "", "interactive", v.id);
  }
  const manifest = mergeCatalog(previous, current, publications);
  for (const [name, value] of Object.entries({
    "manifest.json": manifest,
    "manifest-meta.json": {
      baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      preparedAt: new Date().toISOString(),
      count: manifest.length,
    },
  })) {
    await writeFile(
      path.join(dir, name + ".tmp"),
      JSON.stringify(value, null, 2),
    );
    await rename(path.join(dir, name + ".tmp"), path.join(dir, name));
  }
  console.log(
    `${manifest.length} sources; ${manifest.length - previous.length} added. Selections preserved.\n${dir}`,
  );
} finally {
  release();
}
