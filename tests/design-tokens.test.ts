import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const stylesheetUrl = new URL("../app/globals.css", import.meta.url);
const tokenDocumentationUrl = new URL("../docs/design-tokens.md", import.meta.url);

async function readStylesheet() {
  return readFile(stylesheetUrl, "utf8");
}

describe("design token contract", () => {
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

  it("exposes the accepted composition colors to Tailwind", async () => {
    const stylesheet = await readStylesheet();
    const theme = stylesheet.match(/@theme inline\s*\{(?<body>[\s\S]*?)\}/)
      ?.groups?.body;

    expect(theme).toBeDefined();
    const requiredColorTokens = [
      "background",
      "foreground",
      "ink",
      "map-muted",
      "map-paper",
      "map-paper-near",
      "map-line",
      "map-line-strong",
      "reader-paper",
      "reader-summary",
      "reader-body",
      "reader-muted",
      "world-identity",
      "world-story",
      "world-finding",
      "world-warm",
      "world-bridge",
      "world-cool",
      "map-silver",
      "map-paper-dark",
      "map-paper-near-light",
      "map-paper-near-dark",
      "map-muted-light",
      "map-muted-dark",
      "map-line-light",
      "map-line-dark",
      "map-line-strong-light",
      "map-line-strong-dark",
      "map-grid-light",
      "map-grid-dark",
      "reader-paper-light",
      "reader-paper-dark",
      "reader-ink-light",
      "reader-ink-dark",
      "reader-summary-light",
      "reader-summary-dark",
      "reader-body-light",
      "reader-body-dark",
      "reader-muted-light",
      "reader-muted-dark",
      "reader-stage-shadow",
      "reader-media-shadow",
      "reader-gallery-shadow",
      "reader-assistant-shadow",
      "reader-floating-control-shadow",
      "world-lichen",
      "world-acid",
      "world-hard-red",
      "world-signal-red",
      "world-electric-pink",
      "world-hot-pink",
      "world-violet",
      "world-violet-dark",
      "world-production-cyan",
      "world-production-cyan-dark",
    ];
    const actualMappings = [...(theme ?? "").matchAll(
      /--color-([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\);/g,
    )].map((match) => [match[1], match[2]]);

    expect(actualMappings).toEqual(
      requiredColorTokens.map((token) => [token, token]),
    );
  });

  it("routes active font declarations through named font tokens", async () => {
    const stylesheet = await readStylesheet();
    const fontFacesRemoved = stylesheet.replace(/@font-face\s*\{[\s\S]*?\}/g, "");
    const fontDeclarations = [
      ...fontFacesRemoved.matchAll(/(?:^|[;{])\s*font(?:-family)?\s*:\s*([^;]+);/gm),
    ].map((match) => match[1]);

    const approvedFontTokens = [
      "--font-reader",
      "--font-prototype-sans",
      "--font-prototype-sans-short",
      "--font-prototype-mono",
    ];
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
});
