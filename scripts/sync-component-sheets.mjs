#!/usr/bin/env node

// Copies each marked region of app/design/sheet-examples.tsx into the "Example"
// block of its sheet in docs/components/. The examples module is the source of
// truth: it is type-checked by `npm run typecheck` and partly rendered by the
// test suite, while the sheets are prose. Run this after editing an example;
// `tests/component-sheets.test.ts` fails when the two disagree.
//
// The emitted block carries its own imports. They are derived from the
// identifiers the region actually uses, matched against the import statements
// at the top of sheet-examples.tsx, so a sheet cannot advertise an example that
// would not resolve if you pasted it — which is what happened when the import
// line was hand-written and named one symbol per sheet.
//
// A sheet that has no example yet marks its slot with `<!-- example -->`.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
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

/**
 * `identifier -> module specifier`, from the module's own import statements.
 * Paths are rewritten from gallery-relative to repository-relative so a reader
 * can see what the thing actually is.
 */
export function readImportBindings(source) {
  const bindings = new Map();
  for (const [, clause, specifier] of source.matchAll(
    /^import\s+(?:type\s+)?({[^}]*}|[A-Za-z_$][\w$]*)\s+from\s+"([^"]+)";/gm,
  )) {
    const from = specifier.replace(/^\.\.\/\.\.\//, "").replace(/^\.\//, "app/design/");
    const names = clause.startsWith("{")
      ? clause.slice(1, -1).split(",").map((part) => part.trim()).filter(Boolean)
      : [clause.trim()];
    for (const name of names) {
      const local = name.split(/\s+as\s+/).pop().trim();
      if (local) bindings.set(local, { from, name });
    }
  }
  return bindings;
}

/** The example, prefixed with exactly the imports it needs. */
export function composeExample(body, bindings) {
  // Scan code only. A component named in a comment is not a use, and importing
  // it because prose mentioned it produces an example that no longer compiles.
  const code = body
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const used = new Set(
    [...code.matchAll(/\b[A-Za-z_$][\w$]*\b/g)].map(([token]) => token),
  );
  const byModule = new Map();
  for (const [local, { from, name }] of bindings) {
    if (!used.has(local)) continue;
    if (!byModule.has(from)) byModule.set(from, new Set());
    byModule.get(from).add(name);
  }
  const lines = [...byModule.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([from, names]) => `import { ${[...names].sort().join(", ")} } from "${from}";`);
  return lines.length > 0 ? `${lines.join("\n")}\n\n${body}` : body;
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
  const source = await readFile(examplesPath, "utf8");
  const regions = readExampleRegions(source);
  const bindings = readImportBindings(source);
  const missing = [];

  for (const path of await listSheets()) {
    const name = path.slice(path.lastIndexOf("/") + 1, -".md".length);
    const region = regions.get(name);
    if (!region) {
      missing.push(relative(repositoryRoot, path));
      continue;
    }
    const sheet = await readFile(path, "utf8");
    const next = withExample(sheet, composeExample(region, bindings));
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
