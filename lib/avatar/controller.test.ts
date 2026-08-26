import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarController } from "./controller";
import { AvatarTargetRegistry } from "./target-registry";

function rect(left: number, top: number, width: number, height: number): DOMRect {
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

function elementAt(left: number, top: number, width: number, height: number) {
  return { getBoundingClientRect: () => rect(left, top, width, height) } as HTMLElement;
}

function controllerWithOpenStage() {
  return new AvatarController(new AvatarTargetRegistry());
}

describe("avatar controller", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1_000);
    vi.stubGlobal("innerHeight", 800);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts at the right home dock on the viewport floor", () => {
    // Catches the legacy x-only anchor from omitting the foot position or safe floor.
    const controller = controllerWithOpenStage();

    expect(controller.getSnapshot()).toMatchObject({
      position: { x: 920, y: 776 },
      locomotion: "grounded",
      facing: "front",
      motion: null,
    });
    expect(controller.getSnapshot()).not.toHaveProperty("anchorX");
  });

  it("uses an expanded Director console as the grounded floor obstacle", () => {
    // Catches walking behind the live console instead of standing just above it.
    const registry = new AvatarTargetRegistry();
    registry.registerObstacle(
      "avatar:director-console",
      elementAt(300, 560, 400, 200),
    );

    const controller = new AvatarController(registry);

    expect(controller.getSnapshot().position).toEqual({ x: 920, y: 544 });
  });

  it("keeps an explicit tone independent from the active full-body clip", () => {
    // Catches tone selection replacing or restarting the authored behavior.
    const controller = controllerWithOpenStage();
    controller.execute({ action: "play", animation: "shrug" });

    controller.execute({
      action: "setTone",
      tone: { energy: "high", warmth: "reserved", confidence: "uncertain", mischief: "playful" },
    });

    expect(controller.getSnapshot()).toMatchObject({
      animation: "shrug",
      tone: { energy: "high", warmth: "reserved", confidence: "uncertain", mischief: "playful" },
    });
  });

  it("starts at the viewport midpoint when its horizontal safe insets overlap", () => {
    // Catches a narrow viewport placing the foot outside the stage after the 2D migration.
    vi.stubGlobal("innerWidth", 120);
    const controller = controllerWithOpenStage();

    expect(controller.getSnapshot().position).toEqual({ x: 60, y: 776 });
  });

  it("keeps server-side stage placement and planning finite without viewport globals", () => {
    // Catches the registry's Infinity fallback leaking into CSS-pixel snapshot coordinates.
    vi.useFakeTimers();
    vi.unstubAllGlobals();
    const registry = new AvatarTargetRegistry();
    registry.register("hero", elementAt(20, 40, 80, 80));
    const controller = new AvatarController(registry);

    expect(controller.getSnapshot().position).toSatisfy(
      ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
    );

    void controller.execute({ action: "walkTo", target: "hero" });
    expect(controller.getSnapshot().motion?.points).toSatisfy(
      (points) => points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
    );
    controller.stopMotion();
  });

  it("notifies subscribers once with a fresh snapshot for a state change", () => {
    // Catches a mutable snapshot that can make useSyncExternalStore miss an update.
    const controller = controllerWithOpenStage();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    const before = controller.getSnapshot();

    controller.execute({ action: "setState", state: "thinking" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      state: "thinking",
      animation: "wake_up_and_look_up",
      currentCommand: { action: "setState", state: "thinking" },
    });
    expect(controller.getSnapshot()).not.toBe(before);

    unsubscribe();
    controller.execute({ action: "setState", state: "idle" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("fails the isolated avatar when the loaded library omits a registered clip", () => {
    // Catches a runtime mismatch silently substituting an unrelated available clip.
    const controller = controllerWithOpenStage();
    const listener = vi.fn();
    controller.execute({ action: "setState", state: "success" });
    controller.subscribe(listener);

    controller.setAvailableAnimations(new Set(["idle_3", "walking"]));

    expect(controller.getSnapshot()).toMatchObject({
      state: "success",
      animation: "cheer_with_both_hands",
      failed: true,
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("fails instead of ignoring a direct unavailable behavior", () => {
    // Catches agent-selected motion disappearing without a visible renderer failure.
    const controller = controllerWithOpenStage();
    controller.setAvailableAnimations(new Set(["idle_3"]));

    controller.execute({ action: "play", animation: "orange_justice_cc0" });

    expect(controller.getSnapshot()).toMatchObject({ animation: "idle_3", failed: true });
  });

  it("walks a horizontal grounded route and publishes its destination immediately", async () => {
    // Catches movement that still exposes scalar endpoints or waits to publish stable placement.
    vi.useFakeTimers();
    const registry = new AvatarTargetRegistry();
    registry.register("portfolio:chat", elementAt(300, 500, 400, 160));
    const controller = new AvatarController(registry);

    const walking = controller.execute({ action: "walkTo", target: "portfolio:chat" });

    expect(controller.getSnapshot()).toMatchObject({
      animation: "walking",
      position: { x: 788, y: 776 },
      locomotion: "grounded",
      motion: {
        kind: "walk",
        locomotion: "grounded",
        points: [{ x: 920, y: 776 }, { x: 788, y: 776 }],
      },
      facing: "left",
    });

    await vi.runAllTimersAsync();
    await walking;
    expect(controller.getSnapshot()).toMatchObject({
      state: "idle",
      animation: "idle_3",
      locomotion: "grounded",
      motion: null,
      facing: "left",
    });
  });

  it("enters and exits along horizontal routes", () => {
    // Catches a transition that changes the actor's foot height while entering or leaving.
    const controller = controllerWithOpenStage();

    void controller.execute({ action: "enter", from: "left" });
    expect(controller.getSnapshot().motion?.points).toEqual([
      { x: -72, y: 776 },
      { x: 920, y: 776 },
    ]);

    void controller.execute({ action: "exit", to: "right" });
    expect(controller.getSnapshot().motion?.points).toEqual([
      { x: 920, y: 776 },
      { x: 1_072, y: 776 },
    ]);
  });

  it("faces target attention from the stable foot x coordinate", () => {
    // Catches target facing retaining a stale scalar anchor after a stage journey.
    const registry = new AvatarTargetRegistry();
    registry.register("hero", elementAt(120, 0, 80, 40));
    const controller = new AvatarController(registry);

    controller.execute({ action: "lookAt", target: "hero" });
    expect(controller.getSnapshot().facing).toBe("left");

    registry.register("portfolio:chat", elementAt(940, 0, 40, 40));
    controller.execute({ action: "pointAt", target: "portfolio:chat" });
    expect(controller.getSnapshot()).toMatchObject({
      target: "portfolio:chat",
      facing: "right",
      pointing: "right",
      position: { x: 920, y: 776 },
    });
  });

  it("plans a visible multi-point swim and docks it on the floor", async () => {
    // Catches a swimming command that teleports, skips safe routing, or leaves the actor airborne.
    vi.useFakeTimers();
    const registry = new AvatarTargetRegistry();
    registry.register("portfolio:chat", elementAt(420, 260, 200, 280));
    const controller = new AvatarController(registry);

    const swimming = controller.execute({ action: "swimTo", target: "portfolio:chat" });
    const active = controller.getSnapshot();
    expect(active).toMatchObject({
      animation: "swim_forward",
      locomotion: "swimming",
      motion: { kind: "swim", locomotion: "swimming" },
    });
    expect(active.motion?.points.length).toBeGreaterThan(2);
    expect(active.position).toEqual(active.motion?.points.at(-1));
    expect(active.position.y).toBe(776);

    await vi.runAllTimersAsync();
    await swimming;
    expect(controller.getSnapshot()).toMatchObject({
      locomotion: "grounded",
      state: "idle",
      animation: "idle_3",
      motion: null,
      position: { y: 776 },
    });
  });

  it("preserves swimming_to_edge while a direct swim begins", () => {
    // Catches travel replacing the Director-paired swimming clip at motion start.
    const registry = new AvatarTargetRegistry();
    registry.register("portfolio:chat", elementAt(420, 260, 200, 280));
    const controller = new AvatarController(registry);
    controller.execute({ action: "play", animation: "swimming_to_edge" });

    void controller.execute({ action: "swimTo", target: "portfolio:chat" });

    expect(controller.getSnapshot()).toMatchObject({
      animation: "swimming_to_edge",
      locomotion: "swimming",
      motion: { kind: "swim" },
    });
    controller.stopMotion();
  });

  it("only starts a lap when its closed route can be planned", async () => {
    // Catches an unavailable lap mutating state or throwing instead of becoming a no-op.
    vi.useFakeTimers();
    const controller = controllerWithOpenStage();
    const swimming = controller.execute({ action: "swimRoute", route: "lap" });

    expect(controller.getSnapshot()).toMatchObject({
      animation: "swim_forward",
      locomotion: "swimming",
      motion: { kind: "swim", locomotion: "swimming" },
    });
    expect(controller.getSnapshot().motion?.points.length).toBeGreaterThan(3);

    await vi.runAllTimersAsync();
    await swimming;
    expect(controller.getSnapshot()).toMatchObject({
      locomotion: "grounded",
      state: "idle",
      animation: "idle_3",
      motion: null,
      position: { y: 776 },
      facing: "front",
    });
  });

  it("preserves swimming_to_edge while a lap begins", () => {
    // Catches ambient travel replacing the Director-paired swimming clip at motion start.
    const controller = controllerWithOpenStage();
    controller.execute({ action: "play", animation: "swimming_to_edge" });

    void controller.execute({ action: "swimRoute", route: "lap" });

    expect(controller.getSnapshot()).toMatchObject({
      animation: "swimming_to_edge",
      locomotion: "swimming",
      motion: { kind: "swim" },
    });
    controller.stopMotion();
  });

  it("leaves an unavailable swimming target unchanged", () => {
    // Catches missing geometry becoming a failed travel or an exception.
    const controller = controllerWithOpenStage();
    const before = controller.getSnapshot();

    expect(() => controller.execute({ action: "swimTo", target: "hero" })).not.toThrow();
    expect(controller.getSnapshot()).toBe(before);
  });

  it("leaves an unsafe lap route unchanged", () => {
    // Catches a planner rejection becoming a failed animation or a partial movement update.
    const registry = new AvatarTargetRegistry();
    registry.registerObstacle("portfolio:header", elementAt(0, 0, 1_000, 800));
    const controller = new AvatarController(registry);
    const before = controller.getSnapshot();

    expect(() => controller.execute({ action: "swimRoute", route: "lap" })).not.toThrow();
    expect(controller.getSnapshot()).toBe(before);
  });

  it("does not offer a lap when actor clearance encloses the home dock", () => {
    // Catches canSwimLap accepting a zero-length route when every bounded stop falls back to the dock.
    const registry = new AvatarTargetRegistry();
    registry.register("hero", elementAt(0, 0, 800, 800));
    registry.register("portfolio:chat", elementAt(800, 0, 200, 650));
    const controller = new AvatarController(registry);

    expect(controller.canSwimLap()).toBe(false);
  });

  it("plans a genuine lap after greeting the lab index beside the expanded console", () => {
    // Catches the live lab console's expanded swim clearance rejecting the greeted index dock.
    vi.stubGlobal("innerWidth", 1_440);
    const registry = new AvatarTargetRegistry();
    registry.register("hero", elementAt(368, 32, 336, 112));
    registry.register("portfolio:index", elementAt(720, 32, 336, 112));
    registry.register("project:dubs", elementAt(1_072, 32, 336, 112));
    registry.registerObstacle("avatar:director-console", elementAt(368, 600, 704, 188));
    const controller = new AvatarController(registry);

    void controller.execute({ action: "walkTo", target: "portfolio:index" });
    controller.stopMotion();

    expect(controller.getSnapshot().position).toEqual({ x: 1_144, y: 584 });
    expect(controller.canSwimLap()).toBe(true);

    void controller.execute({ action: "swimRoute", route: "lap" });
    expect(controller.getSnapshot().motion?.points.length).toBeGreaterThan(2);
    controller.stopMotion();
  });

  it("checks a lap against fresh stage geometry without claiming motion ownership", () => {
    // Catches ambient arbitration mutating the actor or retaining stale route safety.
    const registry = new AvatarTargetRegistry();
    const controller = new AvatarController(registry);
    const before = controller.getSnapshot();

    expect(controller.canSwimLap()).toBe(true);
    expect(controller.getSnapshot()).toBe(before);

    registry.registerObstacle("portfolio:header", elementAt(0, 0, 1_000, 800));
    expect(controller.canSwimLap()).toBe(false);
    expect(controller.getSnapshot()).toBe(before);
  });

  it("lets direct state ownership prevent a stale swim completion", async () => {
    // Catches an expired timer overwriting a newer speech state.
    vi.useFakeTimers();
    const controller = controllerWithOpenStage();
    const swimming = controller.execute({ action: "swimRoute", route: "lap" });

    controller.execute({ action: "setState", state: "talking" });
    await vi.runAllTimersAsync();
    await swimming;

    expect(controller.getSnapshot()).toMatchObject({
      state: "talking",
      animation: "agree_gesture",
      locomotion: "grounded",
      motion: null,
    });
  });

  it("lets an aborted swim leave the newer snapshot alone", async () => {
    // Catches a runner cancellation that settles the old swimming route after abort.
    vi.useFakeTimers();
    const controller = controllerWithOpenStage();
    const abort = new AbortController();
    const swimming = controller.execute({ action: "swimRoute", route: "lap" }, abort.signal);

    abort.abort();
    controller.execute({ action: "setState", state: "thinking" });
    await vi.runAllTimersAsync();
    await swimming;

    expect(controller.getSnapshot()).toMatchObject({
      state: "thinking",
      animation: "wake_up_and_look_up",
      motion: null,
    });
  });

  it("settles an aborted swim without a successor at its stable destination", async () => {
    // Catches an abort that resolves the runner while leaving the renderer-owned route active forever.
    vi.useFakeTimers();
    const controller = controllerWithOpenStage();
    const abort = new AbortController();
    const swimming = controller.execute({ action: "swimRoute", route: "lap" }, abort.signal);
    const destination = controller.getSnapshot().position;

    abort.abort();
    await swimming;

    expect(controller.getSnapshot()).toMatchObject({
      position: destination,
      state: "idle",
      animation: "idle_3",
      locomotion: "grounded",
      motion: null,
    });
  });

  it("hiding, resetting, stopping, and disposing invalidate active motion", async () => {
    // Catches each controller lifecycle seam leaving a timer able to settle visibility or state later.
    vi.useFakeTimers();
    const controller = controllerWithOpenStage();

    const hidden = controller.execute({ action: "exit", to: "right" });
    controller.setVisible(false);
    await vi.runAllTimersAsync();
    await hidden;
    expect(controller.getSnapshot()).toMatchObject({ visible: false, motion: null, locomotion: "grounded" });

    controller.setVisible(true);
    const resetMotion = controller.execute({ action: "swimRoute", route: "lap" });
    controller.reset();
    await vi.runAllTimersAsync();
    await resetMotion;
    expect(controller.getSnapshot()).toMatchObject({ position: { x: 920, y: 776 }, motion: null });

    const stoppedMotion = controller.execute({ action: "swimRoute", route: "lap" });
    const destination = controller.getSnapshot().position;
    controller.stopMotion();
    await vi.runAllTimersAsync();
    await stoppedMotion;
    expect(controller.getSnapshot()).toMatchObject({
      position: destination,
      locomotion: "grounded",
      state: "idle",
      motion: null,
      failed: false,
    });

    const disposedMotion = controller.execute({ action: "exit", to: "left" });
    controller.dispose();
    await vi.runAllTimersAsync();
    await disposedMotion;
    expect(controller.getSnapshot()).toMatchObject({ visible: true, motion: null, locomotion: "grounded" });
  });

  it("preserves stable placement for tone and target attention", () => {
    // Catches non-travel commands accidentally cancelling a route or moving its stable destination.
    const registry = new AvatarTargetRegistry();
    registry.register("hero", elementAt(120, 0, 80, 40));
    const controller = new AvatarController(registry);
    void controller.execute({ action: "swimRoute", route: "lap" });
    const position = controller.getSnapshot().position;
    const motion = controller.getSnapshot().motion;

    controller.execute({
      action: "setTone",
      tone: { energy: "high", warmth: "reserved", confidence: "uncertain", mischief: "playful" },
    });
    controller.execute({ action: "lookAt", target: "hero" });

    expect(controller.getSnapshot()).toMatchObject({ position, motion });
  });

  it("restores a fresh initial stage snapshot when reset", () => {
    // Catches reset leaving a target, pose, placement, or failure visible for the next turn.
    const controller = controllerWithOpenStage();
    const initial = controller.getSnapshot();

    controller.execute({ action: "setState", state: "talking" });
    controller.setVisible(false);
    controller.markFailed();
    controller.reset();

    expect(controller.getSnapshot()).toEqual(initial);
  });

  it("records renderer model failure without throwing", () => {
    // Catches a renderer failure that can escape the avatar boundary and break the portfolio.
    const controller = controllerWithOpenStage();

    expect(() => controller.markFailed()).not.toThrow();
    expect(controller.getSnapshot().failed).toBe(true);
  });
});
