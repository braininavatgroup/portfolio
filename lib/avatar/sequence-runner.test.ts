import { afterEach, describe, expect, it, vi } from "vitest";
import { AvatarController } from "./controller";
import { AvatarSequenceRunner } from "./sequence-runner";
import { AvatarTargetRegistry } from "./target-registry";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("avatar sequence runner", () => {
  it("cancels a pending wait before an older sequence can resume", async () => {
    // Catches a new turn that could allow an old wait to resume.
    vi.useFakeTimers();
    const states: string[] = [];
    const runner = new AvatarSequenceRunner(async (command) => {
      if (command.action === "setState") states.push(command.state);
    });

    const firstRun = runner.run([
      { action: "setState", state: "thinking" },
      { action: "wait", durationMs: 1_000 },
      { action: "setState", state: "success" },
    ]);
    await Promise.resolve();
    const secondRun = runner.run([{ action: "setState", state: "talking" }]);

    await vi.advanceTimersByTimeAsync(1_000);
    await Promise.all([firstRun, secondRun]);
    expect(states).toEqual(["thinking", "talking"]);
  });

  it("cancels an owned swim before the earlier sequence can settle it", async () => {
    // Catches runner abort resolving the promise while controller completion still overwrites a later state.
    vi.useFakeTimers();
    vi.stubGlobal("innerWidth", 1_000);
    vi.stubGlobal("innerHeight", 800);
    const controller = new AvatarController(new AvatarTargetRegistry());
    const runner = new AvatarSequenceRunner((command, signal) =>
      controller.execute(command, signal),
    );

    const swimming = runner.run([{ action: "swimRoute", route: "lap" }]);
    const talking = runner.run([{ action: "setState", state: "talking" }]);

    await vi.runAllTimersAsync();
    await Promise.all([swimming, talking]);
    expect(controller.getSnapshot()).toMatchObject({
      state: "talking",
      animation: "agree_gesture",
      motion: null,
      locomotion: "grounded",
    });
  });
});
