import { describe, expect, it, vi } from "vitest";
import { AvatarTargetRegistry } from "./target-registry";
import { SiteActionExecutor } from "./site-actions";

function registerHeroTarget(registry: AvatarTargetRegistry) {
  registry.register("hero", {
    getBoundingClientRect: () =>
      ({
        left: 100,
        top: 50,
        right: 220,
        bottom: 170,
        width: 120,
        height: 120,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      }) as DOMRect,
  } as HTMLElement);
}

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

  it("reports unsupported when the application did not supply a callback for any action branch", async () => {
    // Catches an executor that could report the wrong { ok: true } result when a callback is missing.
    const registry = new AvatarTargetRegistry();
    registerHeroTarget(registry);
    const executor = new SiteActionExecutor(registry, {});

    await expect(
      executor.execute({ type: "openProject", target: "project:dubs" }),
    ).resolves.toEqual({ ok: false, reason: "unsupported" });
    await expect(executor.execute({ type: "closeProject" })).resolves.toEqual({
      ok: false,
      reason: "unsupported",
    });
    await expect(
      executor.execute({ type: "activateTab", tab: "approach" }),
    ).resolves.toEqual({ ok: false, reason: "unsupported" });
    await expect(
      executor.execute({ type: "scrollTo", target: "hero" }),
    ).resolves.toEqual({ ok: false, reason: "unsupported" });
    await expect(
      executor.execute({ type: "spotlight", target: "hero" }),
    ).resolves.toEqual({ ok: false, reason: "unsupported" });
    await expect(executor.execute({ type: "clearSpotlight" })).resolves.toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("reports a missing target before trying to scroll when no registered element exists", async () => {
    // Catches an executor that could blur missing-target failures into unsupported callback results.
    const executor = new SiteActionExecutor(new AvatarTargetRegistry(), {
      scrollTo: vi.fn(),
    });

    await expect(
      executor.execute({ type: "scrollTo", target: "hero" }),
    ).resolves.toEqual({ ok: false, reason: "missing_target" });
  });

  it("swallows callback failures and reports unsupported instead of throwing", async () => {
    // Catches an executor callback that could escape into chat instead of returning a safe unsupported result.
    const registry = new AvatarTargetRegistry();
    registerHeroTarget(registry);
    const executor = new SiteActionExecutor(registry, {
      spotlight: () => {
        throw new Error("boom");
      },
    });

    await expect(
      executor.execute({ type: "spotlight", target: "hero" }),
    ).resolves.toEqual({ ok: false, reason: "unsupported" });
  });
});
