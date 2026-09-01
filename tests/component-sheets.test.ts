import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  listSheets,
  readExampleRegions,
  readSheetExample,
} from "../scripts/sync-component-sheets.mjs";

// The cheat-sheets in docs/components/ are prose, so nothing about them fails
// to compile when a component changes. These tests are the seam that makes
// them decay loudly instead: one sheet per component, every link resolvable,
// and every example still byte-identical to the compiled source in
// app/design/sheet-examples.tsx.

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const componentsRoot = `${repositoryRoot}components`;
const sheetsRoot = `${repositoryRoot}docs/components`;

/**
 * `components/` holds three things that are not components: the two test
 * suites' fixtures live inline, `bradley-glasses.ts` builds Three.js geometry,
 * and `scene/output-token-map.ts` is a lookup table. Everything that renders
 * or is a public hook gets a sheet.
 */
const unsheetedModules = new Set([
  "avatar/bradley-glasses.ts",
  "scene/output-token-map.ts",
]);

async function componentModules() {
  const entries = await readdir(componentsRoot, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      `${entry.parentPath ?? entry.path}/${entry.name}`.slice(
        componentsRoot.length + 1,
      ),
    )
    .filter((path) => /\.tsx?$/.test(path) && !path.includes(".test."))
    .filter((path) => !unsheetedModules.has(path))
    .sort();
}

async function sheetPaths() {
  return (await listSheets(sheetsRoot))
    .map((path) => path.slice(sheetsRoot.length + 1))
    .sort();
}

describe("component cheat-sheets", () => {
  it("has one sheet per component, mirroring the components/ tree", async () => {
    const expected = (await componentModules()).map((path) =>
      path.replace(/\.tsx?$/, ".md"),
    );

    expect(await sheetPaths()).toEqual(expected);
  });

  it("links a source file that still exists, from every sheet", async () => {
    for (const sheet of await sheetPaths()) {
      const body = await readFile(`${sheetsRoot}/${sheet}`, "utf8");
      const source = body.match(/^Source: \[`([^`]+)`\]/m)?.[1];

      expect(source, `${sheet} has no "Source:" line`).toBeDefined();
      await expect(
        readFile(`${repositoryRoot}${source}`, "utf8"),
        `${sheet} points at a missing ${source}`,
      ).resolves.toBeTypeOf("string");
    }
  });

  it("resolves every relative link a sheet makes into the repository", async () => {
    for (const sheet of await sheetPaths()) {
      const directory = new URL(`../docs/components/${sheet}`, import.meta.url);
      const body = await readFile(fileURLToPath(directory), "utf8");
      const targets = [...body.matchAll(/\]\((\.\.?\/[^)#]+)\)/g)].map(
        ([, target]) => target,
      );

      expect(targets.length, `${sheet} links nothing`).toBeGreaterThan(0);
      for (const target of targets) {
        await expect(
          readFile(new URL(target, directory), "utf8"),
          `${sheet} links a missing ${target}`,
        ).resolves.toBeTypeOf("string");
      }
    }
  });

  it("quotes its example verbatim from the compiled examples module", async () => {
    const regions = readExampleRegions(
      await readFile(`${repositoryRoot}app/design/sheet-examples.tsx`, "utf8"),
    );

    for (const sheet of await sheetPaths()) {
      const name = sheet.slice(sheet.lastIndexOf("/") + 1, -".md".length);
      const body = await readFile(`${sheetsRoot}/${sheet}`, "utf8");

      expect(
        regions.get(name),
        `sheet-examples.tsx has no "// #example:${name}" region`,
      ).toBeDefined();
      expect(
        readSheetExample(body),
        `${sheet} is out of date — run node scripts/sync-component-sheets.mjs`,
      ).toBe(regions.get(name));
    }
  });

  it("names the pitfalls section every sheet is supposed to carry", async () => {
    for (const sheet of await sheetPaths()) {
      const body = await readFile(`${sheetsRoot}/${sheet}`, "utf8");

      for (const heading of ["## Requires", "## Example", "## Pitfalls"]) {
        expect(body, `${sheet} is missing ${heading}`).toContain(heading);
      }
    }
  });

  it("keeps every sheet under a page", async () => {
    for (const sheet of await sheetPaths()) {
      const body = await readFile(`${sheetsRoot}/${sheet}`, "utf8");

      expect(body.split("\n").length, `${sheet} is too long`).toBeLessThan(90);
    }
  });

  it("lists every sheet in the index", async () => {
    const index = await readFile(`${sheetsRoot}/README.md`, "utf8");

    for (const sheet of await sheetPaths()) {
      expect(index, `README.md does not link ${sheet}`).toContain(`(./${sheet})`);
    }
  });

  it("is pointed to from the repository and styling instructions", async () => {
    const agents = await readFile(`${repositoryRoot}AGENTS.md`, "utf8");
    const conventions = await readFile(
      `${repositoryRoot}docs/design-conventions.md`,
      "utf8",
    );

    expect(agents).toContain("docs/components/");
    expect(conventions).toContain("docs/components/");
  });
});

describe("gallery and sheet coverage", () => {
  it("gives every component the gallery renders a sheet that names it", async () => {
    const sheets = await sheetPaths();
    const galleryDirectory = `${repositoryRoot}app/design`;
    const sources = await Promise.all(
      ["ComponentGallery.tsx", "DesignGallery.tsx", "three-fixtures.tsx"].map(
        (file) => readFile(`${galleryDirectory}/${file}`, "utf8"),
      ),
    );

    const rendered = new Set(
      sources
        .join("\n")
        .matchAll(/from "\.\.\/\.\.\/components\/([^"]+)"/g)
        .map(([, path]) => path),
    );

    expect(rendered.size).toBeGreaterThan(0);
    for (const path of rendered) {
      if (unsheetedModules.has(`${path}.ts`)) continue;
      expect(sheets, `the gallery renders ${path} with no sheet`).toContain(
        `${path}.md`,
      );
    }
  });
});
