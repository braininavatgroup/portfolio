import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  composeExample,
  listSheets,
  readExampleRegions,
  readImportBindings,
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
 * The module under `components/` that is not a component:
 * `bradley-glasses.ts` builds Three.js geometry. Everything that renders, or
 * is a public hook, gets a sheet.
 *
 * The list is pinned to its exact contents below, because otherwise it is a
 * one-line escape hatch: adding a component and adding its name here would
 * silence the sheet-per-component gate with nothing objecting.
 */
const unsheetedModules = new Set([
  "avatar/bradley-glasses.ts",
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

    expect(expected.length).toBeGreaterThan(0);
    expect(await sheetPaths()).toEqual(expected);
  });

  /**
   * Pins the exclusion list so it cannot be quietly extended to silence the
   * gate above. Changing it is then a deliberate edit to this assertion.
   */
  it("excludes only the module that is not a component", () => {
    expect([...unsheetedModules].sort()).toEqual([
      "avatar/bradley-glasses.ts",
    ]);
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
    const source = await readFile(
      `${repositoryRoot}app/design/sheet-examples.tsx`,
      "utf8",
    );
    const regions = readExampleRegions(source);
    const bindings = readImportBindings(source);
    const sheets = await sheetPaths();

    expect(sheets.length).toBeGreaterThan(0);
    for (const sheet of sheets) {
      const name = sheet.slice(sheet.lastIndexOf("/") + 1, -".md".length);
      const body = await readFile(`${sheetsRoot}/${sheet}`, "utf8");

      expect(
        regions.get(name),
        `sheet-examples.tsx has no "// #example:${name}" region`,
      ).toBeDefined();
      expect(
        readSheetExample(body),
        `${sheet} is out of date — run node scripts/sync-component-sheets.mjs`,
      ).toBe(composeExample(regions.get(name), bindings));
    }
  });

  /**
   * The example is quoted with the imports it needs, so a reader can paste it.
   * Assert that directly: the block must import the component the sheet is
   * about, and every bare identifier it uses must be declared somewhere in the
   * block. Before this, each sheet hand-wrote one `Import:` line, and twelve of
   * sixteen examples referenced something that line never named.
   */
  it("gives each example every import it needs to be pasted", async () => {
    for (const sheet of await sheetPaths()) {
      const name = sheet.slice(sheet.lastIndexOf("/") + 1, -".md".length);
      const block = readSheetExample(
        await readFile(`${sheetsRoot}/${sheet}`, "utf8"),
      );

      expect(block, `${sheet} has no example`).not.toBeNull();
      const imported = new Set(
        [...block.matchAll(/^import\s+{([^}]*)}\s+from/gm)].flatMap(([, names]) =>
          names.split(",").map((part: string) => part.trim()),
        ),
      );
      const declared = new Set(
        [...block.matchAll(/\b(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)].map(
          ([, id]) => id,
        ),
      );

      expect(
        imported.has(name) || name.startsWith("use"),
        `${sheet} never imports ${name}`,
      ).toBe(true);

      // Anything used as a JSX tag or a call must come from somewhere.
      const referenced = [
        ...block.matchAll(/<([A-Z][\w$]*)/g),
        ...block.matchAll(/\bnew\s+([A-Z][\w$]*)/g),
      ].map(([, id]) => id);
      for (const id of new Set(referenced)) {
        expect(
          imported.has(id) || declared.has(id),
          `${sheet} uses ${id} without importing or declaring it`,
        ).toBe(true);
      }
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

  /**
   * Caps the prose, not the file. The example block carries its own imports so
   * it can be pasted, which makes total length a bad proxy for how much there
   * is to read. What must stay skimmable is the writing around it.
   */
  it("keeps every sheet's prose under a page", async () => {
    for (const sheet of await sheetPaths()) {
      const body = await readFile(`${sheetsRoot}/${sheet}`, "utf8");
      const prose = body
        .replace(/^```tsx\n[\s\S]*?^```$/m, "")
        .replace(/\n{2,}/g, "\n\n")
        .trim();

      expect(prose.split("\n").length, `${sheet} reads too long`).toBeLessThan(
        46,
      );
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
      [
        "ComponentGallery.tsx",
        "DesignGallery.tsx",
        "three-fixtures.tsx",
        "TokenGallery.tsx",
        "sheet-examples.tsx",
      ].map((file) => readFile(`${galleryDirectory}/${file}`, "utf8")),
    );

    // Both spellings. The gallery reaches its three heaviest fixtures through
    // `lazy(() => import("../../components/…"))`, which has no `from` — so a
    // `from`-only scan missed PortfolioExperience, the component the route goes
    // to the most trouble to render.
    const joined = sources.join("\n");
    const rendered = new Set(
      [
        ...joined.matchAll(/from "\.\.\/\.\.\/components\/([^"]+)"/g),
        ...joined.matchAll(/import\("\.\.\/\.\.\/components\/([^"]+)"\)/g),
      ].map(([, path]) => path),
    );

    expect(rendered.size).toBeGreaterThan(0);
    expect(rendered, "the lazy-import spelling is not being scanned").toContain(
      "PortfolioExperience",
    );
    for (const path of rendered) {
      if ([...unsheetedModules].some((m) => m.replace(/\.tsx?$/, "") === path)) {
        continue;
      }
      expect(sheets, `the gallery renders ${path} with no sheet`).toContain(
        `${path}.md`,
      );
    }
  });
});
