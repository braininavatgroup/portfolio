import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarController } from "./controller";
import { AvatarDirector } from "./director";
import { AvatarSequenceRunner } from "./sequence-runner";
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

function createDirector(random = () => 0) {
  const registry = new AvatarTargetRegistry();
  registry.register("portfolio:chat", {
    getBoundingClientRect: () => rect(300, 500, 400, 160),
  } as HTMLElement);
  registry.register("portfolio:record:dubs", {
    getBoundingClientRect: () => rect(80, 100, 180, 80),
  } as HTMLElement);
  registry.register("portfolio:record:dubs", {
    getBoundingClientRect: () => rect(160, 180, 220, 300),
  } as HTMLElement);
  const controller = new AvatarController(registry);
  const runner = new AvatarSequenceRunner((command, signal) =>
    controller.execute(command, signal),
  );
  const director = new AvatarDirector(controller, runner, registry, {
    random,
    ambientDelayMs: 10_000,
  });
  return { controller, director, runner };
}

function createAmbientTimerHarness() {
  const callbacks: Array<() => void> = [];
  const setTimer = vi.fn((callback: () => void) => {
    callbacks.push(callback);
    return callbacks.length as unknown as ReturnType<typeof setTimeout>;
  });
  const clearTimer = vi.fn();
  const registry = new AvatarTargetRegistry();
  const controller = new AvatarController(registry);
  const runner = new AvatarSequenceRunner((command, signal) =>
    controller.execute(command, signal),
  );
  const director = new AvatarDirector(controller, runner, registry, {
    random: () => 0.99,
    setTimer,
    clearTimer,
  });

  return { callbacks, clearTimer, controller, director, setTimer };
}

describe("AvatarDirector", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("makes focused chat the listening target", async () => {
    // Catches typing into a chat that the actor does not appear to notice.
    const { controller, director } = createDirector();

    await director.handle({ type: "input_focus" });

    expect(controller.getSnapshot()).toMatchObject({
      state: "listening",
      target: "portfolio:chat",
      facing: "left",
    });
  });

  it("invokes browser timer adapters without rebinding their receiver", () => {
    // Catches browser timer functions throwing Illegal invocation when stored on the director.
    const registry = new AvatarTargetRegistry();
    const controller = new AvatarController(registry);
    const runner = new AvatarSequenceRunner((command, signal) =>
      controller.execute(command, signal),
    );
    const timer = 1 as unknown as ReturnType<typeof setTimeout>;
    const setTimer = vi.fn(function (this: unknown) {
      if (this !== undefined) throw new TypeError("Illegal invocation");
      return timer;
    });
    const clearTimer = vi.fn(function (this: unknown) {
      if (this !== undefined) throw new TypeError("Illegal invocation");
    });
    const director = new AvatarDirector(controller, runner, registry, {
      setTimer,
      clearTimer,
    });

    expect(() => director.startAmbient()).not.toThrow();
    expect(() => director.stopAmbient()).not.toThrow();
    expect(setTimer).toHaveBeenCalledTimes(1);
    expect(clearTimer).toHaveBeenCalledWith(timer);
  });

  it.each(["stopAmbient", "dispose"] as const)(
    "does not recreate an ambient timer after %s interrupts an in-flight glance",
    async (interrupt) => {
      // Catches hidden or detached experiences continuing to schedule actor work.
      vi.useFakeTimers();
      const callbacks: Array<() => void> = [];
      const setTimer = vi.fn((callback: () => void) => {
        callbacks.push(callback);
        return callbacks.length as unknown as ReturnType<typeof setTimeout>;
      });
      const registry = new AvatarTargetRegistry();
      registry.register("portfolio:record:dubs", {
        getBoundingClientRect: () => rect(80, 100, 180, 80),
      } as HTMLElement);
      const controller = new AvatarController(registry);
      const runner = new AvatarSequenceRunner((command, signal) =>
        controller.execute(command, signal),
      );
      const director = new AvatarDirector(controller, runner, registry, {
        random: () => 0.99,
        setTimer,
      });

      director.startAmbient();
      callbacks[0]?.();
      await Promise.resolve();
      director[interrupt]();
      await vi.runAllTimersAsync();

      expect(setTimer).toHaveBeenCalledTimes(1);
    },
  );

  it("a new turn cancels ambient work and owns thinking", async () => {
    // Catches an idle glance or older sequence winning after a new question starts.
    const { controller, director } = createDirector();
    await director.onAmbientTick();

    await director.handle({ type: "turn_start" });

    expect(controller.getSnapshot()).toMatchObject({
      state: "thinking",
      target: "portfolio:chat",
      animation: "wake_up_and_look_up",
    });
  });

  it("clears and permanently suppresses ambient timers when a new turn takes ownership", async () => {
    // Catches turn ownership clearing only the current route, not its scheduled successor.
    vi.useFakeTimers();
    const { callbacks, clearTimer, controller, director, setTimer } = createAmbientTimerHarness();

    director.startAmbient();
    await director.handle({ type: "turn_start" });
    expect(clearTimer).toHaveBeenCalledWith(1);

    await director.handle({ type: "turn_complete" });
    callbacks[1]?.();
    await Promise.resolve();
    expect(controller.getSnapshot().locomotion).toBe("swimming");
    await director.handle({ type: "turn_start" });
    await vi.runAllTimersAsync();

    expect(setTimer).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({
      state: "thinking",
      motion: null,
      locomotion: "grounded",
    });
  });

  it("walks beside a selected record, points, and settles", async () => {
    // Catches record navigation that feels disconnected from the actor or teleports over the dossier.
    vi.useFakeTimers();
    const { controller, director } = createDirector();

    const reaction = director.handle({
      type: "record_open",
      target: "portfolio:record:dubs",
    });
    await Promise.resolve();
    expect(controller.getSnapshot()).toMatchObject({
      animation: "walking",
      target: "portfolio:record:dubs",
      position: { x: expect.any(Number), y: expect.any(Number) },
      motion: { kind: "walk" },
    });

    await vi.runAllTimersAsync();
    await reaction;
    expect(controller.getSnapshot()).toMatchObject({
      state: "idle",
      animation: "idle_3",
      motion: null,
    });
  });

  it("returns beside the chat instead of walking into the reader when a record closes", async () => {
    vi.useFakeTimers();
    const { director, runner } = createDirector();
    const run = vi.spyOn(runner, "run");

    const closing = director.handle({ type: "record_close" });
    await vi.runAllTimersAsync();
    await closing;

    expect(run).toHaveBeenCalledWith([
      { action: "walkTo", target: "portfolio:chat" },
      { action: "lookAt", target: "portfolio:chat" },
      { action: "setState", state: "idle" },
    ]);
  });

  it("preserves record attention without stage travel under reduced motion", async () => {
    // Catches contextual navigation ignoring the same motion preference as agent-selected commands.
    const { controller, director } = createDirector();
    director.setReducedMotion(true);

    await director.handle({
      type: "record_open",
      target: "portfolio:record:dubs",
    });

    expect(controller.getSnapshot()).toMatchObject({
      target: "portfolio:record:dubs",
      motion: null,
    });
  });

  it("plays repeated large performances whenever the agent selects them", async () => {
    // Catches repeated model selections being filtered instead of played.
    const { controller, director } = createDirector();
    const effects = {
      avatarSequence: [
        { action: "play" as const, animation: "joyful_dance_with_hand_sway" as const },
      ],
      avatarIntent: "ordinary" as const,
      avatarTone: {
        energy: "high" as const,
        warmth: "warm" as const,
        confidence: "assured" as const,
        mischief: "playful" as const,
      },
      issues: [],
    };

    await director.perform(effects);
    const firstCommand = controller.getSnapshot().currentCommand;
    await director.perform(effects);

    expect(firstCommand).not.toBe(controller.getSnapshot().currentCommand);
    expect(controller.getSnapshot()).toMatchObject({
      animation: "joyful_dance_with_hand_sway",
      tone: effects.avatarTone,
    });
  });

  it("runs one safe ambient lap and returns the actor to idle", async () => {
    // Catches an eligible ambient swim being selected but never receiving runner ownership.
    vi.useFakeTimers();
    const { controller, director } = createDirector(() => 0.99);

    const lap = director.onAmbientTick();
    await Promise.resolve();
    expect(controller.getSnapshot()).toMatchObject({
      locomotion: "swimming",
      currentCommand: { action: "swimRoute", route: "lap" },
    });

    await vi.runAllTimersAsync();
    await lap;
    expect(controller.getSnapshot()).toMatchObject({
      state: "idle",
      motion: null,
      locomotion: "grounded",
    });
  });

  it("keeps an unsafe ambient lap at stable idle", async () => {
    // Catches a closed lap throwing or publishing a partial swimming scene.
    const registry = new AvatarTargetRegistry();
    registry.registerObstacle("avatar:director-console", {
      getBoundingClientRect: () => rect(0, 0, 1_000, 800),
    } as HTMLElement);
    const controller = new AvatarController(registry);
    const runner = new AvatarSequenceRunner((command, signal) =>
      controller.execute(command, signal),
    );
    const director = new AvatarDirector(controller, runner, registry, { random: () => 0.99 });

    await expect(director.onAmbientTick()).resolves.toBeUndefined();
    expect(controller.getSnapshot()).toMatchObject({ state: "idle", motion: null, locomotion: "grounded" });
  });

  it("gives a new turn ownership over an ambient lap", async () => {
    // Catches the ambient route settling over a newer thinking state.
    vi.useFakeTimers();
    const { controller, director } = createDirector(() => 0.99);
    const ambient = director.onAmbientTick();
    await Promise.resolve();
    expect(controller.getSnapshot().locomotion).toBe("swimming");

    await director.handle({ type: "turn_start" });
    await vi.runAllTimersAsync();
    await ambient;

    expect(controller.getSnapshot()).toMatchObject({
      state: "thinking",
      animation: "wake_up_and_look_up",
      motion: null,
      locomotion: "grounded",
    });
  });

  it("pairs a selected swimming clip with one safe lap in its runner sequence", async () => {
    // Catches direct animation playback racing an unowned swimming route.
    const { director, runner } = createDirector();
    const run = vi.spyOn(runner, "run");

    await director.perform({
      avatarSequence: [{ action: "play", animation: "swim_forward" }],
      avatarIntent: "ordinary",
      issues: [],
    });

    expect(run).toHaveBeenCalledWith([
      { action: "play", animation: "swim_forward" },
      { action: "swimRoute", route: "lap" },
    ]);
  });

  it("gives a direct performance ownership over an ambient lap", async () => {
    // Catches a direct scene starting alongside a still-owned ambient route.
    vi.useFakeTimers();
    const { controller, director } = createDirector(() => 0.99);
    const ambient = director.onAmbientTick();
    await Promise.resolve();
    expect(controller.getSnapshot().locomotion).toBe("swimming");

    await director.perform({
      avatarSequence: [{ action: "play", animation: "shrug" }],
      avatarIntent: "ordinary",
      issues: [],
    });
    await vi.runAllTimersAsync();
    await ambient;

    expect(controller.getSnapshot()).toMatchObject({
      animation: "shrug",
      motion: null,
      locomotion: "grounded",
    });
  });

  it("clears and permanently suppresses ambient timers when a direct performance takes ownership", async () => {
    // Catches a performance clearing the queued timer but restoring it from an aborted lap.
    vi.useFakeTimers();
    const { callbacks, clearTimer, controller, director, setTimer } = createAmbientTimerHarness();
    const effects = {
      avatarSequence: [{ action: "play" as const, animation: "shrug" as const }],
      avatarIntent: "ordinary" as const,
      issues: [],
    };

    director.startAmbient();
    await director.perform(effects);
    expect(clearTimer).toHaveBeenCalledWith(1);

    director.startAmbient();
    callbacks[1]?.();
    await Promise.resolve();
    expect(controller.getSnapshot().locomotion).toBe("swimming");
    await director.perform(effects);
    await vi.runAllTimersAsync();

    expect(setTimer).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({
      animation: "shrug",
      motion: null,
      locomotion: "grounded",
    });
  });

  it("keeps a timed operator scene ahead of ambient until it settles", async () => {
    // Catches console scenes bypassing Director ownership so the next ambient deadline aborts them.
    vi.useFakeTimers();
    const { controller, director } = createDirector(() => 0.5);

    director.startAmbient();
    await vi.advanceTimersByTimeAsync(9_999);
    const scene = director.runOperatorSequence([
      { action: "play", animation: "joyful_dance_with_hand_sway" },
      { action: "wait", durationMs: 1_200 },
      { action: "setState", state: "idle" },
    ]);

    expect(controller.getSnapshot().animation).toBe("joyful_dance_with_hand_sway");
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.getSnapshot()).toMatchObject({
      animation: "joyful_dance_with_hand_sway",
      locomotion: "grounded",
    });

    await vi.advanceTimersByTimeAsync(1_198);
    expect(controller.getSnapshot().animation).toBe("joyful_dance_with_hand_sway");
    await vi.advanceTimersByTimeAsync(1);
    await scene;
    expect(controller.getSnapshot()).toMatchObject({ state: "idle", locomotion: "grounded" });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(controller.getSnapshot().currentCommand).toMatchObject({
      action: "lookAt",
    });
  });

  it("carries ambient resume ownership across a superseding operator scene", async () => {
    // Catches the second manual scene inheriting ambient=false from the first and never resuming it.
    vi.useFakeTimers();
    const { director, setTimer } = createAmbientTimerHarness();

    director.startAmbient();
    const first = director.runOperatorSequence([
      { action: "wait", durationMs: 1_000 },
    ]);
    const second = director.runOperatorSequence([
      { action: "wait", durationMs: 100 },
    ]);

    await vi.advanceTimersByTimeAsync(100);
    await second;
    await first;

    expect(setTimer).toHaveBeenCalledTimes(2);
  });

  it("does not add a lap to a swimming clip when the current stage is unsafe", async () => {
    // Catches a direct performance reserving travel from a stale safety check.
    const registry = new AvatarTargetRegistry();
    registry.registerObstacle("avatar:director-console", {
      getBoundingClientRect: () => rect(0, 0, 1_000, 800),
    } as HTMLElement);
    const controller = new AvatarController(registry);
    const runner = new AvatarSequenceRunner((command, signal) =>
      controller.execute(command, signal),
    );
    const run = vi.spyOn(runner, "run");
    const director = new AvatarDirector(controller, runner, registry);

    await director.perform({
      avatarSequence: [{ action: "play", animation: "swimming_to_edge" }],
      avatarIntent: "ordinary",
      issues: [],
    });

    expect(run).toHaveBeenCalledWith([
      { action: "play", animation: "swimming_to_edge" },
    ]);
  });

  it("keeps explicit swim movement and non-swimming performances unmodified", async () => {
    // Catches route pairing duplicating model-selected movement or changing ordinary command order.
    const { director, runner } = createDirector();
    const run = vi.spyOn(runner, "run");

    await director.perform({
      avatarSequence: [
        { action: "play", animation: "swim_forward" },
        { action: "swimTo", target: "portfolio:chat" },
      ],
      avatarIntent: "ordinary",
      issues: [],
    });
    await director.perform({
      avatarSequence: [
        { action: "play", animation: "swimming_to_edge" },
        { action: "swimRoute", route: "lap" },
      ],
      avatarIntent: "ordinary",
      issues: [],
    });
    await director.perform({
      avatarSequence: [
        { action: "play", animation: "shrug" },
        { action: "wait", durationMs: 100 },
      ],
      avatarIntent: "ordinary",
      issues: [],
    });

    expect(run).toHaveBeenNthCalledWith(1, [
      { action: "play", animation: "swim_forward" },
      { action: "swimTo", target: "portfolio:chat" },
    ]);
    expect(run).toHaveBeenNthCalledWith(2, [
      { action: "play", animation: "swimming_to_edge" },
      { action: "swimRoute", route: "lap" },
    ]);
    expect(run).toHaveBeenNthCalledWith(3, [
      { action: "play", animation: "shrug" },
      { action: "wait", durationMs: 100 },
    ]);
  });

  it("removes paired swimming travel for reduced motion", async () => {
    // Catches the direct route pairing bypassing the existing reduced-motion adapter.
    const { controller, director, runner } = createDirector();
    const run = vi.spyOn(runner, "run");
    director.setReducedMotion(true);

    await director.perform({
      avatarSequence: [{ action: "play", animation: "swim_forward" }],
      avatarIntent: "ordinary",
      issues: [],
    });

    expect(run).toHaveBeenCalledWith([]);
    expect(controller.getSnapshot()).toMatchObject({ animation: "idle_3", motion: null });
  });

  it("cancels ambient swimming when reduced motion or stop takes ownership", async () => {
    // Catches preference and document-hide cancellation leaving a route active.
    vi.useFakeTimers();
    const { controller, director } = createDirector(() => 0.99);
    const ambient = director.onAmbientTick();
    await Promise.resolve();
    expect(controller.getSnapshot().locomotion).toBe("swimming");

    director.setReducedMotion(true);
    await vi.runAllTimersAsync();
    await ambient;
    expect(controller.getSnapshot()).toMatchObject({ motion: null, locomotion: "grounded" });

    const nextAmbient = director.onAmbientTick();
    await Promise.resolve();
    director.stop();
    await vi.runAllTimersAsync();
    await nextAmbient;
    expect(controller.getSnapshot()).toMatchObject({ motion: null, locomotion: "grounded" });
  });

  it("clears and permanently suppresses ambient timers when reduced motion takes ownership", async () => {
    // Catches a preference change clearing a timer but letting an aborted route schedule another.
    vi.useFakeTimers();
    const { callbacks, clearTimer, controller, director, setTimer } = createAmbientTimerHarness();

    director.startAmbient();
    director.setReducedMotion(true);
    expect(clearTimer).toHaveBeenCalledWith(1);

    director.setReducedMotion(false);
    director.startAmbient();
    callbacks[1]?.();
    await Promise.resolve();
    expect(controller.getSnapshot().locomotion).toBe("swimming");
    director.setReducedMotion(true);
    await vi.runAllTimersAsync();

    expect(setTimer).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({ motion: null, locomotion: "grounded" });
  });

  it.each(["stop", "dispose"] as const)("does not recreate timers after %s interrupts ambient ownership", async (interrupt) => {
    // Catches a route finalizer scheduling work after the overlay has hidden or detached.
    vi.useFakeTimers();
    const callbacks: Array<() => void> = [];
    const setTimer = vi.fn((callback: () => void) => {
      callbacks.push(callback);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    });
    const registry = new AvatarTargetRegistry();
    const controller = new AvatarController(registry);
    const runner = new AvatarSequenceRunner((command, signal) =>
      controller.execute(command, signal),
    );
    const director = new AvatarDirector(controller, runner, registry, {
      random: () => 0.99,
      setTimer,
    });

    director.startAmbient();
    callbacks[0]?.();
    await Promise.resolve();
    expect(controller.getSnapshot().locomotion).toBe("swimming");
    director[interrupt]();
    await vi.runAllTimersAsync();

    expect(setTimer).toHaveBeenCalledTimes(1);
  });
});
