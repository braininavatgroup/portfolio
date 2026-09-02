import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("portfolio world surface", () => {
  it("uses one flat map-paper color without radial rings", async () => {
    const css = await readFile(new URL("./globals.css", import.meta.url), "utf8");
    const worldRule = css.match(/\.portfolio-world\s*\{([^}]+)\}/)?.[1] ?? "";

    expect(worldRule).toContain("background: var(--map-paper)");
    expect(worldRule).not.toContain("radial-gradient");
  });

  it("gives the mast and every dossier title one fixed display voice", async () => {
    const css = await readFile(new URL("./globals.css", import.meta.url), "utf8");
    const root = css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? "";
    const mast = css.match(/\.portfolio-world-mast\s*\{([^}]+)\}/)?.[1] ?? "";
    const title = css.match(/\.reader-content h1\s*\{([^}]+)\}/)?.[1] ?? "";

    expect(root).toContain("--reader-type-display: 500 36px/40px");
    for (const rule of [mast, title]) {
      expect(rule).toContain("font: var(--reader-type-display) var(--font-reader)");
      expect(rule).toContain("letter-spacing: -0.055em");
    }
    expect(title).toContain("text-wrap: balance");
    expect(css).not.toMatch(/--portfolio-display-title-size/);
  });

  it("puts the mast and the dossier on one 24px inset", async () => {
    const css = await readFile(new URL("./globals.css", import.meta.url), "utf8");
    const mast = css.match(/\.portfolio-world-mast\s*\{([^}]+)\}/)?.[1] ?? "";
    const content = css.match(/\.reader-content\s*\{([^}]+)\}/)?.[1] ?? "";

    expect(mast).toContain("left: var(--reader-space-3)");
    expect(mast).toContain("top: var(--reader-space-3)");
    expect(content).toContain(
      "padding: var(--reader-space-3) var(--reader-space-4) var(--reader-space-4)",
    );
  });

  it("draws no rules inside the dossier and no type under 11px", async () => {
    const css = await readFile(new URL("./globals.css", import.meta.url), "utf8");
    const readerStart = css.indexOf(".portfolio-reader {");
    const readerEnd = css.indexOf(".experience .portfolio-chat {");
    const reader = css.slice(readerStart, readerEnd);

    expect(reader).not.toMatch(/border-(top|bottom):[^;]*var\(--map-line/);
    expect(reader).not.toMatch(/font-size:\s*(?:[0-9]|10)px/);
    expect(reader).not.toMatch(/clamp\(/);
    expect(reader).not.toMatch(/transition:/);
  });
});
