// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as examples from "./sheet-examples";

// The cheat-sheets claim their examples are copy-paste runnable. Everything in
// sheet-examples.tsx is type-checked by the build; this file additionally
// mounts the ones that do not need a WebGL context, which jsdom cannot give
// them. The WebGL examples are the gallery's own fixtures, and /design mounts
// those (see DesignGallery.test.tsx).

const webglExamples = [
  "AvatarAssetAdapterExample",
  "AvatarStageActorExample",
  "AvatarOverlayExample",
] as const;

/**
 * PortfolioExperience mounts the whole composition, including services that
 * measure the window; it has its own suite. The example is exercised there and
 * in the gallery rather than mounted a second time here.
 */
const separatelyCovered = ["PortfolioExperienceExample"] as const;

const exampleNames = Object.keys(examples).filter((name) =>
  name.endsWith("Example"),
);
const renderable = exampleNames.filter(
  (name) =>
    !(webglExamples as readonly string[]).includes(name) &&
    !(separatelyCovered as readonly string[]).includes(name),
);

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1_200);
  vi.stubGlobal("innerHeight", 800);
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  const shell = document.body.appendChild(document.createElement("div"));
  shell.id = "app-shell";
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cheat-sheet examples", () => {
  it("exports one example per sheet", () => {
    expect(exampleNames).toHaveLength(21);
  });

  /**
   * `renderable` is derived by subtracting two hand-maintained arrays, so it
   * can silently shrink to zero — and vitest reports `it.each([])` as a pass.
   * Pin the count so deleting a mount is a failure, not a quiet no-op.
   */
  it("actually mounts seventeen examples", () => {
    expect(renderable).toHaveLength(17);
    expect(webglExamples.length + separatelyCovered.length + renderable.length).toBe(
      exampleNames.length,
    );
  });

  it.each(renderable)("mounts %s", (name) => {
    const Example = (examples as Record<string, () => React.ReactNode>)[name];

    expect(() =>
      render(<Example />, { container: document.getElementById("app-shell")! }),
    ).not.toThrow();
  });

  it("routes every WebGL example through the gallery instead", () => {
    for (const name of webglExamples) {
      expect(exampleNames).toContain(name);
    }
  });
});
