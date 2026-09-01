#!/usr/bin/env node

// Copies each marked region of app/design/sheet-examples.tsx into the "Example"
// block of its sheet in docs/components/. The examples module is the source of
// truth: it is compiled and partly rendered by the test suite, while the sheets
// are prose. Run this after editing an example; `tests/component-sheets.test.ts`
// fails when the two disagree.
//
// A sheet that has no example yet marks its slot with `<!-- example -->`.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const repositoryRoot = new URL("..", import.meta.url).pathname;
const examplesPath = join(repositoryRoot, "app/design/sheet-examples.tsx");
const sheetsRoot = join(repositoryRoot, "docs/components");

/** Every `// #example:<Name>` … `// #example-end` region, keyed by name. */
export function readExampleRegions(source) {
  const regions = new Map();
  const pattern = /^\/\/ #example:(\S+)\n([\s\S]*?)^\/\/ #example-end$/gm;
  for (const [, name, body] of source.matchAll(pattern)) {
    regions.set(name, body.trimEnd());
  }
  return regions;
}

/** The first fenced tsx block in a sheet, or null when it still has a slot. */
export function readSheetExample(sheet) {
  return sheet.match(/^```tsx\n([\s\S]*?)^```$/m)?.[1].trimEnd() ?? null;
}

function withExample(sheet, example) {
  const block = "```tsx\n" + example + "\n```";
  if (readSheetExample(sheet) === null) {
    return sheet.replace("<!-- example -->", block);
  }
  return sheet.replace(/^```tsx\n[\s\S]*?^```$/m, block);
}

export async function listSheets(root = sheetsRoot) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .filter((entry) => entry.name !== "README.md")
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name));
}

async function main() {
  const regions = readExampleRegions(await readFile(examplesPath, "utf8"));
  const missing = [];

  for (const path of await listSheets()) {
    const name = path.slice(path.lastIndexOf("/") + 1, -".md".length);
    const example = regions.get(name);
    if (!example) {
      missing.push(relative(repositoryRoot, path));
      continue;
    }
    const sheet = await readFile(path, "utf8");
    const next = withExample(sheet, example);
    if (next !== sheet) {
      await writeFile(path, next);
      console.log(`updated ${relative(repositoryRoot, path)}`);
    }
  }

  if (missing.length > 0) {
    console.error(
      `No #example region in sheet-examples.tsx for: ${missing.join(", ")}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  await main();
}
