import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { galleryFamilies } from "../app/design/fixtures";

const stylesheetUrl = new URL("../app/globals.css", import.meta.url);
const galleryUrl = new URL("../app/design/DesignGallery.tsx", import.meta.url);

describe("design gallery stylesheet contract", () => {
  it("shows only the six live world families", () => {
    expect(galleryFamilies).toEqual([
      "identity",
      "story",
      "operation",
      "component",
      "engagement",
      "product",
    ]);
  });

  it("drives the composition tokens from [data-theme] in both modes", async () => {
    const stylesheet = await readFile(stylesheetUrl, "utf8");

    expect(stylesheet).toContain('.design-gallery[data-theme="light"]');
    expect(stylesheet).toContain('.design-gallery[data-theme="dark"]');
    expect(stylesheet).toContain(
      ':where([data-theme="light"]) .portfolio-composition',
    );
    expect(stylesheet).toContain(
      ':where([data-theme="dark"]) .portfolio-composition',
    );
  });

  it("overrides every mode-aware alias the composition declares", async () => {
    const stylesheet = await readFile(stylesheetUrl, "utf8");
    const compositionRule =
      stylesheet.match(/\n\.portfolio-composition\s*\{([^}]+)\}/)?.[1] ?? "";
    const galleryDarkRule =
      stylesheet.match(
        /\.design-gallery\[data-theme="dark"\]\s*\{([^}]+)\}/,
      )?.[1] ?? "";

    const modeAliases = [
      ...compositionRule.matchAll(/(--[a-z-]+):\s*var\((--[a-z-]+-light)\)/g),
    ].map((match) => match[1]);

    expect(modeAliases.length).toBeGreaterThan(0);
    for (const alias of modeAliases) {
      expect(galleryDarkRule).toContain(`${alias}:`);
    }
  });

  it("makes each stage the containing block for fixed composition surfaces", async () => {
    const stylesheet = await readFile(stylesheetUrl, "utf8");
    const stageRule = stylesheet.match(/\.design-stage\s*\{([^}]+)\}/)?.[1] ?? "";

    expect(stageRule).toContain("transform: translateZ(0)");
    expect(stageRule).toContain("overflow: hidden");
  });

  it("scopes the gallery's own control styling so fixtures keep theirs", async () => {
    const stylesheet = await readFile(stylesheetUrl, "utf8");

    expect(stylesheet).toContain(".design-gallery-control");
    expect(stylesheet).not.toMatch(/\.design-gallery\s+button\s*[,{]/);
  });
});

describe("design gallery route", () => {
  it("code-splits every WebGL fixture out of the route entry", async () => {
    const source = await readFile(galleryUrl, "utf8");

    for (const specifier of ["./three-fixtures", "../../components/PortfolioExperience"]) {
      expect(source).toMatch(
        new RegExp(`lazy\\(\\(\\) =>\\s*\\n?\\s*import\\("${specifier.replace(/[./]/g, "\\$&")}"\\)`),
      );
    }
    expect(source).not.toMatch(/^import .*three-fixtures/m);
  });
});
