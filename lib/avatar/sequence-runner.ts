import type { AvatarCommand } from "./contracts";

type SequenceExecutor = (
  command: Exclude<AvatarCommand, { action: "wait" }>,
  signal: AbortSignal,
) => void | Promise<void>;

function waitForDuration(durationMs: number, signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeoutId = setTimeout(finish, durationMs);

    function finish() {
      clearTimeout(timeoutId);
      signal.removeEventListener("abort", finish);
      resolve();
    }

    signal.addEventListener("abort", finish, { once: true });
  });
}

export class AvatarSequenceRunner {
  #currentAbortController = new AbortController();
  #execute: SequenceExecutor;

  constructor(execute: SequenceExecutor) {
    this.#execute = execute;
  }

  cancel() {
    this.#currentAbortController.abort();
  }

  async run(commands: readonly AvatarCommand[]) {
    this.#currentAbortController.abort();
    const controller = new AbortController();
    this.#currentAbortController = controller;

    for (const command of commands) {
      if (controller.signal.aborted) {
        return;
      }

      if (command.action === "wait") {
        await waitForDuration(command.durationMs, controller.signal);
        continue;
      }

      await this.#execute(command, controller.signal);
    }
  }
}
