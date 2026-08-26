import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("portfolio page", () => {
  it("has no alternate Avatar Lab page route", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(pageSource).not.toContain("avatarLab");
  });

  it("keeps Director-console labels outside the production page entry", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const overlaySource = readFileSync(
      new URL("../components/avatar/AvatarOverlay.tsx", import.meta.url),
      "utf8",
    );

    expect(pageSource).not.toContain("Avatar Director console");
    expect(pageSource).not.toContain("Avatar developer controls");
    expect(overlaySource).toContain("const AvatarDirectorConsole = import.meta.env.DEV");
  });
});
