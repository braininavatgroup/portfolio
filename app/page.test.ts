import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("portfolio page", () => {
  it("opens the spatial composition at the root URL with no landing phase", () => {
    const page = Home();

    expect(page.type.name).toBe("PortfolioExperience");
    expect(page.props).toEqual({});
  });

  it("has no alternate Avatar Lab page route", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(pageSource).not.toContain("avatarLab");
  });

  it("does not ship the retired Director console", () => {
    const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const overlaySource = readFileSync(
      new URL("../components/avatar/AvatarOverlay.tsx", import.meta.url),
      "utf8",
    );

    expect(pageSource).not.toContain("Avatar Director console");
    expect(pageSource).not.toContain("Avatar developer controls");
    expect(overlaySource).not.toContain("AvatarDirectorConsole");
  });
});
