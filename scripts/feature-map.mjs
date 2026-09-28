/**
 * The feature map: .agents/skills/verify-portfolio/features/README.md.
 *
 * `readFeatureMap` parses its tables into rows; `staleRows` compares the rows
 * with this checkout, offline, and returns one message per disagreement. The
 * live check (scripts/live.mjs) refuses to touch the network while any
 * message stands, and tests/feature-map.test.ts runs the same comparison in
 * `npm test`, so a stale map fails ci before it can mislead a live run.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { listSheets } from "./sync-component-sheets.mjs";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const mapPath = ".agents/skills/verify-portfolio/features/README.md";
export const contentPath = "content/portfolio-content.json";
export const primaryOrigin = "https://bradleyberkman.com";

// Quoted text may hold \" for a literal quote.
const QUOTED = String.raw`"((?:[^"\\]|\\.)*)"`;
const CHECK = new RegExp(
  String.raw`^(page(?: ${QUOTED.replace("(", "(?<pageText>")})?|status (?<status>\d{3})(?: ${QUOTED.replace("(", "(?<statusText>")})?|sitemap|probe (?<probe>[a-z0-9-]+)|uncovered: (?<reason>.+))$`,
);
const unquote = (text) => text?.replace(/\\(.)/g, "$1");

/** Every `| Feature | Reached at | Source | Check |` row under a heading. */
export function readFeatureMap(text) {
  const rows = [];
  const errors = [];
  let section = "";
  text.split("\n").forEach((line, index) => {
    const at = index + 1;
    if (line.startsWith("## ")) section = line.slice(3).trim();
    if (!line.startsWith("|") || /^\|\s*(Feature|-)/.test(line)) return;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length !== 4) {
      errors.push(`${mapPath}:${at}: a row needs 4 cells (Feature | Reached at | Source | Check), found ${cells.length}`);
      return;
    }
    const [feature, reached, sourceCell, checkCell] = cells;
    const url = reached.match(/`(https:\/\/[^`]+)`/)?.[1];
    const source = sourceCell.match(/^`([^`]+)`$/)?.[1];
    const check = checkCell.match(/^`(.+)`$/)?.[1];
    const parsed = check?.match(CHECK);
    const where = `${mapPath}:${at} (${feature})`;
    if (!url) errors.push(`${where}: "Reached at" names no https:// URL in backticks`);
    if (!source) errors.push(`${where}: "Source" must be one path in backticks`);
    if (!parsed) errors.push(`${where}: "${checkCell}" is not a check this map defines`);
    if (!url || !source || !parsed) return;
    const groups = parsed.groups;
    const kind = check.split(/[ :]/)[0];
    rows.push({
      line: at,
      where,
      section,
      feature,
      url,
      source,
      kind,
      text: unquote(groups.pageText ?? groups.statusText),
      status: groups.status ? Number(groups.status) : undefined,
      probe: groups.probe,
      reason: groups.reason,
    });
  });
  return { rows, errors };
}

/** URL path a route file under app/ answers at, or null for a dynamic segment. */
export function routePath(file) {
  const segments = path.dirname(file.replace(/^app\//, "")).split("/").filter((segment) => segment !== ".");
  if (segments.some((segment) => segment.startsWith("["))) return null;
  return `/${segments.join("/")}`;
}

function appRoutes(root) {
  return readdirSync(path.join(root, "app"), { recursive: true })
    .map((entry) => `app/${entry}`)
    .filter((file) => /\/(page\.tsx|route\.ts)$/.test(`/${file}`))
    .sort();
}

/**
 * Where the map and the checkout disagree. `probes` is the set of probe names
 * scripts/live-probes.mjs defines. Paths are relative to `root`.
 */
export async function staleRows({ text, probes, root = repoRoot }) {
  const { rows, errors } = readFeatureMap(text);
  const stale = [...errors];
  const content = JSON.parse(readFileSync(path.join(root, contentPath), "utf8"));
  const sources = new Set(rows.map((row) => row.source));

  for (const row of rows) {
    const [file, fragment] = row.source.split("#");
    const { pathname } = new URL(row.url);
    if (!existsSync(path.join(root, file))) {
      stale.push(`${row.where}: ${file} is not a file in this checkout`);
      continue;
    }
    if (file === contentPath) {
      if (!fragment || !content.records[fragment]) {
        stale.push(`${row.where}: ${contentPath} has no record "${fragment ?? ""}"`);
      } else if (pathname !== `/index/${fragment}`) {
        stale.push(`${row.where}: record ${fragment} is served at /index/${fragment}, but the row says ${pathname}`);
      }
    }
    if (/^app\/.*\/?(page\.tsx|route\.ts)$/.test(file) && row.url.startsWith(primaryOrigin)) {
      const served = routePath(file);
      if (served && served !== pathname) stale.push(`${row.where}: ${file} is served at ${served}, but the row says ${pathname}`);
    }
    if (file.startsWith("public/") && `/${file.slice("public/".length)}` !== pathname) {
      stale.push(`${row.where}: ${file} is served at /${file.slice("public/".length)}, but the row says ${pathname}`);
    }
    if (row.kind === "probe" && !probes.has(row.probe)) {
      stale.push(`${row.where}: scripts/live-probes.mjs defines no probe "${row.probe}"`);
    }
  }

  for (const id of Object.keys(content.records)) {
    if (!sources.has(`${contentPath}#${id}`)) {
      stale.push(`record "${id}" is in ${contentPath} but no feature map row names ${contentPath}#${id}; add a row`);
    }
  }
  for (const file of appRoutes(root)) {
    if (!sources.has(file)) stale.push(`${file} is a route but no feature map row names it; add a row (or an \`uncovered: why\` row)`);
  }
  for (const sheet of (await listSheets(path.join(root, "docs/components"))).sort()) {
    const file = path.relative(root, sheet);
    if (!sources.has(file)) stale.push(`${file} is a component sheet but no feature map row names it; add a row for what a visitor does with it (or an \`uncovered: why\` row)`);
  }
  const used = new Set(rows.filter((row) => row.kind === "probe").map((row) => row.probe));
  for (const probe of probes) {
    if (!used.has(probe)) stale.push(`scripts/live-probes.mjs defines probe "${probe}" but no feature map row runs it`);
  }
  return { rows, stale };
}
