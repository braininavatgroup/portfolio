import { chooseAmbientVariant } from "./ambient";
import type {
  AvatarCommand,
  PortfolioResponseEffects,
  ProjectAvatarTargetId,
} from "./contracts";
import { AvatarController } from "./controller";
import { AvatarSequenceRunner } from "./sequence-runner";
import { adaptCommandsForReducedMotion } from "./state";
import { AvatarTargetRegistry } from "./target-registry";

export type AvatarContextEvent =
  | { type: "input_focus" }
  | { type: "input_activity" }
  | { type: "input_blur" }
  | { type: "turn_start" }
  | { type: "evidence" }
  | { type: "first_text" }
  | { type: "turn_complete" }
  | { type: "project_open"; target: ProjectAvatarTargetId }
  | { type: "tab_change"; target: ProjectAvatarTargetId }
  | { type: "project_close" };

type TimerHandle = ReturnType<typeof setTimeout>;

type AvatarDirectorOptions = {
  random?: () => number;
  ambientDelayMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (timer: TimerHandle) => void;
};

export class AvatarDirector {
  #controller: AvatarController;
  #runner: AvatarSequenceRunner;
  #registry: AvatarTargetRegistry;
  #random: () => number;
  #ambientDelayMs: number;
  #setTimer: (callback: () => void, delayMs: number) => TimerHandle;
  #clearTimer: (timer: TimerHandle) => void;
  #ambientTimer: TimerHandle | null = null;
  #ambientEnabled = false;
  #disposed = false;
  #previousAmbientId: string | null = null;
  #operatorResumeAmbient = false;
  #turnActive = false;
  #busy = false;
  #reducedMotion = false;
  #runId = 0;

  constructor(
    controller: AvatarController,
    runner: AvatarSequenceRunner,
    registry: AvatarTargetRegistry,
    options: AvatarDirectorOptions = {},
  ) {
    this.#controller = controller;
    this.#runner = runner;
    this.#registry = registry;
    this.#random = options.random ?? Math.random;
    this.#ambientDelayMs = options.ambientDelayMs ?? 14_000;
    this.#setTimer = options.setTimer ?? setTimeout;
    this.#clearTimer = options.clearTimer ?? clearTimeout;
  }

  isIdle() {
    return !this.#turnActive && !this.#busy;
  }

  setReducedMotion(reducedMotion: boolean) {
    this.#reducedMotion = reducedMotion;
    if (reducedMotion) this.stop();
  }

  async handle(event: AvatarContextEvent) {
    switch (event.type) {
      case "input_focus":
      case "input_activity":
        if (this.#turnActive) return;
        this.stopAmbient();
        return this.#run([
          { action: "setState", state: "listening" },
          { action: "lookAt", target: "portfolio:chat" },
        ]);
      case "input_blur":
        if (this.#turnActive) return;
        this.#controller.execute({ action: "setState", state: "idle" });
        this.startAmbient();
        return;
      case "turn_start":
        this.#turnActive = true;
        this.stopAmbient();
        return this.#run([
          { action: "lookAt", target: "portfolio:chat" },
          { action: "setState", state: "thinking" },
        ]);
      case "evidence":
        this.#controller.execute({ action: "setState", state: "tool_use" });
        return;
      case "first_text":
        this.#controller.execute({ action: "setState", state: "talking" });
        return;
      case "turn_complete":
        this.#turnActive = false;
        this.#controller.execute({ action: "setState", state: "idle" });
        this.startAmbient();
        return;
      case "project_open":
        this.stopAmbient();
        return this.#run([
          { action: "walkTo", target: event.target },
          { action: "pointAt", target: event.target },
          { action: "wait", durationMs: 900 },
          { action: "setState", state: "idle" },
        ]);
      case "tab_change":
        this.stopAmbient();
        return this.#run([{ action: "lookAt", target: event.target }]);
      case "project_close":
        this.stopAmbient();
        return this.#run([
          { action: "walkTo", target: "portfolio:index" },
          { action: "lookAt", target: "portfolio:index" },
          { action: "setState", state: "idle" },
        ]);
    }
  }

  perform(effects: PortfolioResponseEffects) {
    this.stopAmbient();
    const sequence = this.#pairSwimmingClipWithLap(effects.avatarSequence);
    const commands: AvatarCommand[] = [];
    for (const command of sequence) {
      commands.push(command);
      if (command.action === "play" && effects.avatarTone) {
        commands.push({ action: "setTone", tone: effects.avatarTone });
      }
    }
    return this.#run(commands);
  }

  async runOperatorSequence(commands: readonly AvatarCommand[]) {
    this.#operatorResumeAmbient =
      this.#operatorResumeAmbient || this.#ambientEnabled;
    this.#ambientEnabled = false;
    this.#clearAmbientTimer();
    const runId = this.#runId + 1;
    await this.#run(commands);
    if (
      this.#runId !== runId ||
      this.#disposed ||
      this.#turnActive ||
      !this.#operatorResumeAmbient
    ) {
      return;
    }
    this.#operatorResumeAmbient = false;
    this.startAmbient();
  }

  async onAmbientTick() {
    if (this.#disposed || !this.isIdle()) return;
    const targets = this.#registry
      .resolveAll()
      .filter(({ bounds }) => bounds.inViewport)
      .map(({ target }) => target);
    const variant = chooseAmbientVariant({
      previousId: this.#previousAmbientId,
      targets,
      canSwim: !this.#reducedMotion && this.#controller.canSwimLap(),
      random: this.#random,
    });
    this.#previousAmbientId = variant.id;
    if (!variant.command) {
      this.#controller.execute({ action: "setState", state: "idle" });
      return;
    }
    if (variant.command.action === "swimRoute") {
      await this.#run([variant.command]);
      return;
    }
    await this.#run([
      variant.command,
      { action: "wait", durationMs: 900 },
      { action: "setState", state: "idle" },
    ]);
  }

  startAmbient() {
    if (this.#disposed) return;
    this.#ambientEnabled = true;
    this.#scheduleAmbient();
  }

  #scheduleAmbient() {
    if (
      this.#disposed ||
      !this.#ambientEnabled ||
      this.#ambientTimer !== null ||
      !this.isIdle()
    ) {
      return;
    }
    const setTimer = this.#setTimer;
    this.#ambientTimer = setTimer(() => {
      this.#ambientTimer = null;
      if (this.#disposed || !this.#ambientEnabled) return;
      void this.onAmbientTick().finally(() => this.#scheduleAmbient());
    }, this.#ambientDelayMs);
  }

  stopAmbient() {
    this.#ambientEnabled = false;
    this.#operatorResumeAmbient = false;
    this.#clearAmbientTimer();
  }

  #clearAmbientTimer() {
    if (this.#ambientTimer === null) return;
    const clearTimer = this.#clearTimer;
    clearTimer(this.#ambientTimer);
    this.#ambientTimer = null;
  }

  stop() {
    this.stopAmbient();
    this.#runId += 1;
    this.#runner.cancel();
    this.#controller.stopMotion();
    this.#busy = false;
  }

  dispose() {
    this.#disposed = true;
    this.stop();
  }

  async #run(commands: readonly AvatarCommand[]) {
    if (this.#disposed) return;
    const runId = ++this.#runId;
    this.#busy = true;
    try {
      await this.#runner.run(
        this.#reducedMotion
          ? adaptCommandsForReducedMotion(commands)
          : commands,
      );
    } finally {
      if (this.#runId === runId) this.#busy = false;
    }
  }

  #pairSwimmingClipWithLap(commands: readonly AvatarCommand[]) {
    const hasSwimmingClip = commands.some(
      (command) =>
        command.action === "play" &&
        (command.animation === "swim_forward" || command.animation === "swimming_to_edge"),
    );
    const hasMovement = commands.some(
      (command) => command.action === "swimTo" || command.action === "swimRoute",
    );
    if (!hasSwimmingClip || hasMovement || !this.#controller.canSwimLap()) {
      return [...commands];
    }
    return [...commands, { action: "swimRoute" as const, route: "lap" as const }];
  }
}
