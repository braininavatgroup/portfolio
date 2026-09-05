import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const stylesheetUrl = new URL("../app/globals.css", import.meta.url);
const tokenDocumentationUrl = new URL("../docs/design-tokens.md", import.meta.url);

async function readStylesheet() {
  return readFile(stylesheetUrl, "utf8");
}

/**
 * Custom properties the stylesheet reads but deliberately does not declare,
 * because JavaScript sets them inline. Each entry names the file that must
 * still do so — an orphaned reader paints `transparent` in silence otherwise,
 * which is exactly how dynamic composition values can fail in silence.
 */
const inlineSetTokens: Readonly<Record<string, string>> = {
  "--cursor-a": "components/CursorInstrument.tsx",
  "--cursor-b": "components/CursorInstrument.tsx",
  "--mac-menu-bar-gap-left": "components/MacMenuBar.tsx",
  "--mac-menu-bar-gap-right": "components/MacMenuBar.tsx",
};

describe("design token contract", () => {
  it("keeps the arc register on the approved red pair in both modes", async () => {
    const stylesheet = await readStylesheet();
    const composition = stylesheet.match(/\n\.portfolio-composition\s*\{([^}]+)\}/)?.[1] ?? "";
    const dark = stylesheet.match(
      /@media \(prefers-color-scheme: dark\)\s*\{\s*\.portfolio-composition\s*\{([^}]+)\}/,
    )?.[1] ?? "";

    expect(composition).toContain("--world-arc: var(--world-hard-red)");
    expect(dark).toContain("--world-arc: var(--world-signal-red)");
  });

  it("routes every explicit Reading Room focus outline through the Acid alias", async () => {
    const stylesheet = await readStylesheet();
    const compositionStart = stylesheet.indexOf(".portfolio-composition {");
    const galleryStart = stylesheet.indexOf("/* Design gallery", compositionStart);
    const composition = stylesheet.slice(compositionStart, galleryStart);
    const focusRules = [...composition.matchAll(/([^{}]*:focus-visible[^{}]*)\{([^}]*)\}/g)];
    const explicitOutlines = focusRules
      .filter(([, , declarations]) => /\boutline\s*:/.test(declarations))
      .map(([, selectors, declarations]) => ({
        selectors: selectors.trim(),
        outline: declarations.match(/\boutline\s*:\s*([^;]+);/)?.[1].trim(),
      }));

    expect(explicitOutlines.length).toBeGreaterThan(0);
    expect(
      explicitOutlines.filter(
        ({ outline }) => outline !== "2px solid var(--focus-ring)",
      ),
    ).toEqual([]);
  });

  it("resolves every custom property the stylesheet reads", async () => {
    const stylesheet = await readStylesheet();
    const declared = new Set(
      [...stylesheet.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(([, token]) => token),
    );
    const used = new Set(
      [...stylesheet.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(
        ([, token]) => token,
      ),
    );

    expect(used.size).toBeGreaterThan(0);
    const unresolved = [...used].filter(
      (token) => !declared.has(token) && !(token in inlineSetTokens),
    );

    expect(unresolved).toEqual([]);
  });

  it("keeps every inline-set token's setter alive", async () => {
    for (const [token, source] of Object.entries(inlineSetTokens)) {
      const setter = await readFile(
        new URL(`../${source}`, import.meta.url),
        "utf8",
      );

      expect(setter, `${source} no longer sets ${token}`).toContain(
        `"${token}"`,
      );
    }
  });

  it("keeps raw color values inside custom-property definitions", async () => {
    const stylesheet = await readStylesheet();
    const rootDefinitionsRemoved = stylesheet.replace(
      /:root\s*\{[\s\S]*?\}/,
      "",
    );
    const rawColors = rootDefinitionsRemoved.match(
      /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi,
    );

    expect(rawColors).toBeNull();
  });

  /**
   * Tailwind was removed: it shipped an @import, a 57-declaration @theme inline
   * block and two packages to serve exactly two utility classes, one of which
   * (pointer-events-none on .avatar-overlay) violated the composition's own
   * "no utility classes" rule while duplicating an inline style beside it.
   * These assertions keep it gone rather than letting it drift back in.
   */
  it("keeps Tailwind out of the stylesheet", async () => {
    const stylesheet = await readStylesheet();

    expect(stylesheet).not.toMatch(/@import\s+"tailwindcss"/);
    expect(stylesheet).not.toMatch(/@theme\b/);
    expect(stylesheet).not.toMatch(/@apply\b/);
  });

  it("routes active font declarations through named font tokens", async () => {
    const stylesheet = await readStylesheet();
    const fontFacesRemoved = stylesheet.replace(/@font-face\s*\{[\s\S]*?\}/g, "");
    const fontDeclarations = [
      ...fontFacesRemoved.matchAll(/(?:^|[;{])\s*font(?:-family)?\s*:\s*([^;]+);/gm),
    ].map((match) => match[1]);

    // Two, not four. --font-prototype-sans and --font-prototype-sans-short
    // named Geist and went with it; leaving them approved would have let Geist
    // back in through a token nothing declares.
    const approvedFontTokens = ["--font-reader", "--font-prototype-mono"];
    const unapprovedDeclarations = fontDeclarations.filter((value) => {
      const normalized = value.trim();

      return normalized !== "inherit" && !approvedFontTokens.some(
        (token) => normalized.includes(`var(${token})`),
      );
    });

    expect(fontDeclarations).not.toEqual([]);
    expect(unapprovedDeclarations).toEqual([]);
  });

  it("documents every declared design token", async () => {
    const [stylesheet, documentation] = await Promise.all([
      readStylesheet(),
      readFile(tokenDocumentationUrl, "utf8"),
    ]);
    const tokens = new Set(
      [...stylesheet.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]),
    );
    const undocumented = [...tokens].filter(
      (token) => !documentation.includes(`\`${token}\``),
    );

    expect(undocumented).toEqual([]);
  });

  /**
   * The inverse, which was missing — and its absence is why the documentation
   * carried a table row for `--accent` describing a lime green that had no
   * reader left in the stylesheet, plus font aliases naming a typeface the
   * site no longer ships. Documentation that outlives its subject is worse
   * than none: it is confidently wrong.
   */
  it("documents no token the stylesheet has retired", async () => {
    const [stylesheet, documentation] = await Promise.all([
      readStylesheet(),
      readFile(tokenDocumentationUrl, "utf8"),
    ]);
    const declared = new Set(
      [...stylesheet.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(([, token]) => token),
    );
    // Only the inventory tables count. Naming a token in prose to record that
    // it was retired is history, and a doc that cannot say "this is gone" is a
    // doc that quietly drops the reason instead.
    const documented = new Set(
      documentation
        .split("\n")
        .filter((line) => line.startsWith("| `--"))
        .flatMap((line) => [...line.matchAll(/`(--[a-z0-9-]+)`/gi)].map(([, t]) => t)),
    );
    const retired = [...documented].filter(
      (token) => !declared.has(token) && !(token in inlineSetTokens),
    );

    expect(retired).toEqual([]);
  });
});
