// Layer direction (PER-69). Each layer imports only itself and the layers in
// `may`; anything else fails with the module to use instead. The layers are how
// the code was already arranged, lowest first: lib/ (browser-safe types and
// logic, with content/), lib/server/, then worker/ on one side and
// components/ and app/ on the other. tests/built-client-assets.test.mjs proves
// the built client carries no server code; this catches the import that would
// put it there, before a build.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

type Layer = { dir: string; may: string[]; not?: string[]; instead: string };

// First match wins, so lib/server/ comes before lib/.
export const LAYERS: Layer[] = [
  {
    dir: "lib/server/",
    may: ["lib/", "content/"],
    instead:
      "lib/server/ builds on lib/ and content/ only; a Worker handler calls lib/server, not the other way round",
  },
  {
    dir: "lib/",
    may: ["content/"],
    not: ["lib/server/"],
    instead:
      "lib/ runs in the browser too, so it imports only lib/ and content/; move the shared piece into lib/ (as lib/portfolio-feedback.ts and lib/portfolio-supporting-routes.ts were) and import it from both sides",
  },
  {
    dir: "worker/",
    may: ["lib/", "content/", "scripts/portfolio-insights-"],
    instead:
      "the Worker uses lib/, lib/server/, content/ and the insights pipeline in scripts/portfolio-insights-*.mjs; never components/ or app/",
  },
  {
    dir: "components/",
    may: ["lib/", "content/"],
    not: ["lib/server/"],
    instead:
      "components reach the browser, so they use lib/ and content/ only; put shared types or logic in lib/ (e.g. lib/portfolio-feedback.ts) and call the Worker over HTTP",
  },
  {
    dir: "app/",
    may: ["components/", "lib/", "content/"],
    instead:
      "routes use components/, lib/ (lib/server/ from server routes) and content/; the Worker's code is reached over HTTP",
  },
];

// Tests may also use the shared helpers in tests/.
const TEST_HELPERS = "tests/";

const IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+|\brequire\s*\(\s*)["']((?:\.{1,2}\/|@\/)[^"']+)["']/gm;

function isTest(file: string) {
  return /\.test\.[cm]?[jt]sx?$/.test(file);
}

export function violations(files: string[], read: (file: string) => string) {
  const found: string[] = [];
  for (const file of files) {
    const layer = LAYERS.find((l) => file.startsWith(l.dir));
    if (!layer) continue;
    for (const m of read(file).matchAll(IMPORT)) {
      const spec = m[1];
      const target = spec.startsWith("@/")
        ? spec.slice(2)
        : normalize(join(dirname(file), spec));
      const allowed =
        [layer.dir, ...layer.may].some((d) => target.startsWith(d)) ||
        (isTest(file) && target.startsWith(TEST_HELPERS));
      if (allowed && !layer.not?.some((d) => target.startsWith(d))) continue;
      found.push(`${file} imports ${spec} (${target}).\n  Instead: ${layer.instead}.`);
    }
  }
  return found;
}

describe("layer direction", () => {
  it("has no import going against it", () => {
    const files = execFileSync(
      "git",
      ["ls-files", "*.ts", "*.tsx", "*.mjs", "*.js"],
      { cwd: ROOT, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);
    const found = violations(files, (f) => readFileSync(join(ROOT, f), "utf8"));
    expect(found, `\n${found.join("\n")}\n`).toEqual([]);
  });

  it("names the module to use when a component imports the Worker", () => {
    const found = violations(["components/X.tsx"], () =>
      'import { MAX_NOTES_TOTAL } from "../worker/portfolio-feedback-store";',
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/Instead: components reach the browser/);
  });

  it("keeps lib/ out of lib/server/", () => {
    expect(
      violations(["lib/x.ts"], () => 'import { y } from "@/lib/server/portfolio-chat-runtime";'),
    ).toHaveLength(1);
  });
});
