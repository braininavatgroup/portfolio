import { describe, expect, it, vi } from "vitest";
import { AvatarTargetRegistry } from "./target-registry";
import { SiteActionExecutor } from "./site-actions";

describe("site action executor", () => {
  it("routes semantic open, tab, spotlight, clear, and close actions through typed callbacks", async () => {
    // Catches an executor that could bypass application-owned callbacks.
    const calls = {
      openProject: vi.fn(),
      closeProject: vi.fn(),
      activateTab: vi.fn(),
      scrollTo: vi.fn(),
      spotlight: vi.fn(),
      clearSpotlight: vi.fn(),
    };
    const executor = new SiteActionExecutor(new AvatarTargetRegistry(), calls);

    await expect(
      executor.execute({ type: "openProject", target: "project:dubs" }),
    ).resolves.toEqual({ ok: true });
    await expect(
      executor.execute({ type: "activateTab", tab: "approach" }),
    ).resolves.toEqual({ ok: true });
    await expect(
      executor.execute({ type: "spotlight", target: "hero" }),
    ).resolves.toEqual({ ok: true });
    await expect(executor.execute({ type: "clearSpotlight" })).resolves.toEqual({
      ok: true,
    });
    await expect(executor.execute({ type: "closeProject" })).resolves.toEqual({
      ok: true,
    });

    expect(calls.openProject).toHaveBeenCalledWith("project:dubs");
    expect(calls.activateTab).toHaveBeenCalledWith("approach");
    expect(calls.spotlight).toHaveBeenCalledWith("hero");
    expect(calls.clearSpotlight).toHaveBeenCalledTimes(1);
    expect(calls.closeProject).toHaveBeenCalledTimes(1);
    expect(calls.scrollTo).not.toHaveBeenCalled();
  });
});
