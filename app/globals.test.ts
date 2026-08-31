import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("portfolio world surface", () => {
  it("uses one flat map-paper color without radial rings", async () => {
    const css = await readFile(new URL("./globals.css", import.meta.url), "utf8");
    const worldRule = css.match(/\.portfolio-world\s*\{([^}]+)\}/)?.[1] ?? "";

    expect(worldRule).toContain("background: var(--map-paper)");
    expect(worldRule).not.toContain("radial-gradient");
  });

  it("gives Bradley and Index the same display scale", async () => {
    const css = await readFile(new URL("./globals.css", import.meta.url), "utf8");
    const compositionRule = css.match(/\.portfolio-composition\s*\{([^}]+)\}/)?.[1] ?? "";
    const sharedTitleRule = css.match(
      /\.portfolio-world-mast,\s*\.reader-index-content > h1,\s*\.reader-topbar button\s*\{([^}]+)\}/,
    )?.[1] ?? "";

    expect(compositionRule).toContain(
      "--portfolio-display-title-size: clamp(25px, 2.5vw, 37px)",
    );
    expect(sharedTitleRule).toContain(
      "font-size: var(--portfolio-display-title-size)",
    );
    expect(sharedTitleRule).toContain("letter-spacing: -0.055em");
    expect(sharedTitleRule).toContain("line-height: 0.98");
    expect(css).not.toMatch(/\.reader-index-content h1\s*\{[^}]*font-size/);
  });
});
