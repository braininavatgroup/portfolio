import { afterEach, describe, expect, it, vi } from "vitest";
import { AvatarSequenceRunner } from "./sequence-runner";

afterEach(() => {
  vi.useRealTimers();
});

describe("avatar sequence runner", () => {
  it("cancels a pending wait before an older sequence can resume", async () => {
    // Catches a new turn that could allow an old wait to resume.
    vi.useFakeTimers();
    const states: string[] = [];
    const runner = new AvatarSequenceRunner(async (command) => {
      if (command.action === "setState") {
        states.push(command.state);
      }
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
});
