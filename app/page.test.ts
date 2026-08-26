import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAvatarLabRequested } from "./page";

describe("avatar lab route gate", () => {
  it("accepts the explicit lab query only in development", () => {
    expect(isAvatarLabRequested("1", "development")).toBe(true);
    expect(isAvatarLabRequested(undefined, "development")).toBe(false);
    expect(isAvatarLabRequested("0", "development")).toBe(false);
    expect(isAvatarLabRequested("1", "test")).toBe(false);
    expect(isAvatarLabRequested("1", "production")).toBe(false);
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
