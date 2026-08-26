// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avatarBehaviors } from "../../lib/avatar/behaviors";
import { AvatarController } from "../../lib/avatar/controller";
import { AvatarDirector } from "../../lib/avatar/director";
import { allowedAvatarStates, type AvatarCommand } from "../../lib/avatar/contracts";
import { AvatarSequenceRunner } from "../../lib/avatar/sequence-runner";
import { SiteActionExecutor } from "../../lib/avatar/site-actions";
import { AvatarTargetRegistry } from "../../lib/avatar/target-registry";
import { AvatarDirectorConsole } from "./AvatarDirectorConsole";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1_000);
  vi.stubGlobal("innerHeight", 800);
});

function bounds(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function registerDefaultTargets(registry: AvatarTargetRegistry) {
  registry.register("hero", { getBoundingClientRect: () => bounds(100, 80, 200, 120) } as HTMLElement);
  registry.register("portfolio:chat", { getBoundingClientRect: () => bounds(480, 500, 300, 120) } as HTMLElement);
  registry.register("portfolio:index", { getBoundingClientRect: () => bounds(760, 100, 180, 360) } as HTMLElement);
  registry.register("project:dubs", { getBoundingClientRect: () => bounds(760, 100, 180, 360) } as HTMLElement);
}

function renderDirector({
  reducedMotion = false,
  registry = new AvatarTargetRegistry(),
}: { reducedMotion?: boolean; registry?: AvatarTargetRegistry } = {}) {
  if (registry.resolveAll().length === 0) registerDefaultTargets(registry);
  const controller = new AvatarController(registry);
  const commands: AvatarCommand[] = [];
  const runner = new AvatarSequenceRunner((command, signal) => {
    commands.push(command);
    return controller.execute(command, signal);
  });
  const director = new AvatarDirector(controller, runner, registry);
  const onEnabledChange = vi.fn();
  const onExpandedPanelChange = vi.fn();
  const spotlight = vi.fn();
  const siteActionExecutor = new SiteActionExecutor(registry, { spotlight });
  const result = render(
    <AvatarDirectorConsole
      controller={controller}
      director={director}
      onEnabledChange={onEnabledChange}
      onExpandedPanelChange={onExpandedPanelChange}
      reducedMotion={reducedMotion}
      registry={registry}
      runner={runner}
      siteActionExecutor={siteActionExecutor}
    />,
  );

  return { ...result, commands, controller, director, onEnabledChange, onExpandedPanelChange, registry, spotlight };
}

async function advance(duration: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(duration);
  });
}

describe("AvatarDirectorConsole", () => {
  it("provides a scene-first accessible console with roving keyboard tabs", () => {
    // Catches tabs that only look tab-like but neither select nor focus correctly.
    renderDirector();
    const scenes = screen.getByRole("tab", { name: "Scenes" });
    const target = screen.getByRole("tab", { name: "Target" });
    const advanced = screen.getByRole("tab", { name: "Advanced" });

    expect(screen.getByRole("region", { name: "Avatar Director console" })).toBeTruthy();
    expect(screen.getByRole("tablist").textContent).toBe("ScenesTargetMovementAdvanced");
    expect(scenes).toHaveProperty("tabIndex", 0);
    expect(scenes.getAttribute("aria-controls")).toBe("avatar-director-scenes");
    for (const scene of ["Greet", "Present project", "Answer", "Celebrate", "Dance", "Swim lap", "Come home"]) {
      expect(screen.getByRole("button", { name: scene })).toBeTruthy();
    }

    scenes.focus();
    fireEvent.keyDown(scenes, { key: "ArrowRight" });
    expect(target.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(target);
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(target.id);
    fireEvent.keyDown(target, { key: "End" });
    expect(document.activeElement).toBe(advanced);
    fireEvent.keyDown(advanced, { key: "Home" });
    expect(document.activeElement).toBe(scenes);
  });

  it("reports the live controller status and keeps collapse and visibility non-destructive", () => {
    // Preserves the recovery controls while moving detailed operations behind the console tabs.
    const { controller, director, onEnabledChange } = renderDirector();
    const stop = vi.spyOn(director, "stop");
    act(() => {
      controller.execute({ action: "setState", state: "thinking" });
      controller.markFailed();
    });
    expect(screen.getByText(/State: thinking.*Clip: .*Target: none.*Locomotion: grounded.*Renderer: failed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide assistant" }));
    expect(onEnabledChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Collapse console" }));
    expect(screen.getByRole("button", { name: "Expand console" })).toBeTruthy();
    expect(stop).not.toHaveBeenCalled();
  });

  it("exposes a distinct renderer-failure state while retaining Reset recovery", () => {
    const { controller } = renderDirector();
    act(() => controller.markFailed());

    const console = screen.getByRole("region", { name: "Avatar Director console" });
    expect(console.getAttribute("data-avatar-renderer-status")).toBe("failed");
    expect(
      screen.getByText(/Renderer: failed/).getAttribute("data-avatar-renderer-status"),
    ).toBe("failed");
    expect(screen.getByRole("button", { name: "Reset avatar" })).toBeTruthy();
  });

  it("keeps scene beats observable until their bounded waits settle", async () => {
    // Catches adjacent commands overwriting a wave, thought, celebration, or dance in the same turn.
    vi.useFakeTimers();
    const { controller } = renderDirector();

    fireEvent.click(screen.getByRole("button", { name: "Greet" }));
    const greetDuration = controller.getSnapshot().motion?.durationMs;
    expect(greetDuration).toBeTypeOf("number");
    await advance(greetDuration!);
    expect(controller.getSnapshot().animation).toBe("wave_one_hand");
    await advance(900);
    expect(controller.getSnapshot().state).toBe("idle");

    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    await act(async () => { await Promise.resolve(); });
    expect(controller.getSnapshot().state).toBe("thinking");
    await advance(750);
    expect(controller.getSnapshot().state).toBe("talking");
    await advance(900);
    expect(controller.getSnapshot().state).toBe("idle");

    fireEvent.click(screen.getByRole("button", { name: "Celebrate" }));
    await act(async () => { await Promise.resolve(); });
    expect(controller.getSnapshot().animation).toBe("cheer_with_both_hands_1");
    await advance(1_200);
    expect(controller.getSnapshot().state).toBe("idle");

    fireEvent.click(screen.getByRole("button", { name: "Dance" }));
    await act(async () => { await Promise.resolve(); });
    expect(controller.getSnapshot().animation).toBe("orange_justice_cc0");
    await advance(1_200);
    expect(controller.getSnapshot().state).toBe("idle");
  });

  it("routes console scenes, target, movement, and advanced sequences through Director ownership", () => {
    // Catches a new console control bypassing ambient arbitration through the runner directly.
    const { director } = renderDirector();
    const runOperatorSequence = vi.spyOn(director, "runOperatorSequence");

    fireEvent.click(screen.getByRole("button", { name: "Dance" }));
    fireEvent.click(screen.getByRole("tab", { name: "Target" }));
    fireEvent.click(screen.getByRole("button", { name: "Select project:dubs" }));
    fireEvent.click(screen.getByRole("button", { name: "Walk to project:dubs" }));
    fireEvent.click(screen.getByRole("tab", { name: "Movement" }));
    fireEvent.click(screen.getByRole("button", { name: "Enter left" }));
    fireEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    fireEvent.click(screen.getByRole("button", { name: "State: thinking" }));

    expect(runOperatorSequence).toHaveBeenNthCalledWith(1, [
      { action: "setTone", tone: { energy: "high", warmth: "warm", confidence: "assured", mischief: "playful" } },
      { action: "play", animation: "orange_justice_cc0" },
      { action: "wait", durationMs: 1_200 },
      { action: "setState", state: "idle" },
    ]);
    expect(runOperatorSequence).toHaveBeenNthCalledWith(2, [
      { action: "walkTo", target: "project:dubs" },
    ]);
    expect(runOperatorSequence).toHaveBeenNthCalledWith(3, [
      { action: "enter", from: "left" },
    ]);
    expect(runOperatorSequence).toHaveBeenNthCalledWith(4, [
      { action: "setState", state: "thinking" },
    ]);
  });

  it("walks, presents, spotlights, and only then settles a selected live project", async () => {
    // Catches spotlighting a project before the actor has completed its presentation beat.
    vi.useFakeTimers();
    const { controller, spotlight } = renderDirector();
    expect(screen.getByRole("button", { name: "Present project" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: "Target" }));
    fireEvent.click(screen.getByRole("button", { name: "Select portfolio:chat" }));
    fireEvent.click(screen.getByRole("tab", { name: "Scenes" }));
    expect(screen.getByRole("button", { name: "Present project" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: "Target" }));
    fireEvent.click(screen.getByRole("button", { name: "Select project:dubs" }));
    fireEvent.click(screen.getByRole("tab", { name: "Scenes" }));
    const present = screen.getByRole("button", { name: "Present project" });
    expect(present.hasAttribute("disabled")).toBe(false);
    fireEvent.click(present);
    const walkDuration = controller.getSnapshot().motion?.durationMs;
    await advance(walkDuration!);
    expect(controller.getSnapshot().currentCommand).toMatchObject({ action: "pointAt", target: "project:dubs" });
    expect(spotlight).not.toHaveBeenCalled();
    await advance(900);
    expect(spotlight).toHaveBeenCalledWith("project:dubs");
    expect(controller.getSnapshot().state).toBe("idle");
  });

  it("stops active ownership before reset so a cancelled sequence cannot resume", async () => {
    // Catches Reset looking correct initially while a pending runner wait later overwrites it.
    vi.useFakeTimers();
    const { controller, director, onEnabledChange } = renderDirector();
    const stop = vi.spyOn(director, "stop");
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    await act(async () => { await Promise.resolve(); });
    expect(controller.getSnapshot().state).toBe("thinking");

    fireEvent.click(screen.getByRole("button", { name: "Reset avatar" }));
    await advance(2_000);

    expect(stop).toHaveBeenCalledOnce();
    expect(controller.getSnapshot()).toMatchObject({ state: "idle", visible: true, failed: false });
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it("adapts every console-originated local sequence for reduced motion", async () => {
    // Catches a new console action bypassing the motion-safe command adapter.
    const { commands, spotlight } = renderDirector({ reducedMotion: true });
    fireEvent.click(screen.getByRole("button", { name: "Greet" }));
    await act(async () => { await Promise.resolve(); });
    expect(commands.map(({ action }) => action)).toEqual(["lookAt", "setState"]);

    commands.length = 0;
    fireEvent.click(screen.getByRole("tab", { name: "Target" }));
    fireEvent.click(screen.getByRole("button", { name: "Select project:dubs" }));
    fireEvent.click(screen.getByRole("button", { name: "Walk to project:dubs" }));
    await act(async () => { await Promise.resolve(); });
    expect(commands.map(({ action }) => action)).toEqual(["lookAt"]);

    commands.length = 0;
    fireEvent.click(screen.getByRole("tab", { name: "Movement" }));
    fireEvent.click(screen.getByRole("button", { name: "Swim lap" }));
    await act(async () => { await Promise.resolve(); });
    expect(commands).toEqual([]);

    fireEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    fireEvent.click(screen.getByRole("button", { name: "Orange Justice" }));
    fireEvent.click(screen.getByRole("button", { name: "Point at hero" }));
    fireEvent.click(screen.getByRole("button", { name: "State: thinking" }));
    fireEvent.click(screen.getByRole("button", { name: "Spotlight hero" }));
    await act(async () => { await Promise.resolve(); });
    expect(commands.map(({ action }) => action)).toEqual(["pointAt", "setState"]);
    expect(spotlight).toHaveBeenCalledWith("hero");
  });

  it("normalizes target and obstacle rectangles, refreshes live selections, and cleans listeners", () => {
    // Catches map geometry leaking viewport pixels or stale target IDs remaining actionable after resize.
    const registry = new AvatarTargetRegistry();
    let hero = bounds(100, 80, 200, 120);
    const heroElement = { getBoundingClientRect: () => hero } as HTMLElement;
    registry.register("hero", heroElement);
    const projectElement = { getBoundingClientRect: () => bounds(700, 200, 200, 160) } as HTMLElement;
    registry.register("project:dubs", projectElement);
    const obstacle = { getBoundingClientRect: () => bounds(800, 600, 250, 300) } as HTMLElement;
    registry.registerObstacle("avatar:director-console", obstacle);
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderDirector({ registry });

    fireEvent.click(screen.getByRole("tab", { name: "Target" }));
    const heroTarget = screen.getByRole("button", { name: "Select hero" });
    expect(heroTarget.style.left).toBe("10%");
    expect(heroTarget.style.top).toBe("10%");
    expect(heroTarget.getAttribute("data-avatar-map-target")).toBe("true");
    expect(screen.getByLabelText("Obstacle avatar:director-console").style.left).toBe("80%");
    expect(screen.getByLabelText("Obstacle avatar:director-console").style.height).toBe("25%");
    expect(screen.queryByRole("img", { name: "Live stage map" })).toBeNull();
    expect(screen.queryByRole("button", { name: /avatar:director-console/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select project:dubs" }));
    registry.unregister("project:dubs", projectElement);
    hero = bounds(200, 80, 200, 120);
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("button", { name: "Select hero" }).style.left).toBe("20%");
    expect(screen.getByText("Selected target: hero")).toBeTruthy();
    unmount();
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function), true);
  });

  it("exposes only the expanded panel for obstacle registration and retains complete advanced and movement controls", () => {
    // Catches the compact bar becoming an obstacle or a migration dropping an operator control.
    const { onExpandedPanelChange, unmount } = renderDirector();
    expect(onExpandedPanelChange).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    fireEvent.click(screen.getByRole("button", { name: "Collapse console" }));
    expect(onExpandedPanelChange).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: "Expand console" }));
    expect(onExpandedPanelChange).toHaveBeenLastCalledWith(expect.any(HTMLDivElement));

    fireEvent.click(screen.getByRole("tab", { name: "Movement" }));
    for (const label of ["Enter left", "Enter right", "Exit left", "Exit right", "Swim lap", "Swim to target", "Home dock"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    for (const state of allowedAvatarStates) expect(screen.getByRole("button", { name: `State: ${state}` })).toBeTruthy();
    for (const behavior of avatarBehaviors) expect(screen.getByRole("button", { name: behavior.label })).toBeTruthy();
    expect(screen.getByText(/position=.*locomotion=.*path=/)).toBeTruthy();
    unmount();
    expect(onExpandedPanelChange).toHaveBeenLastCalledWith(null);
  });
});
