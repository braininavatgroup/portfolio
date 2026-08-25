"use client";

import { useSyncExternalStore } from "react";
import { AvatarController } from "../../lib/avatar/controller";
import {
  allowedAvatarAnimations,
  allowedAvatarStates,
  type AvatarCommand,
} from "../../lib/avatar/contracts";
import { AvatarSequenceRunner } from "../../lib/avatar/sequence-runner";
import { SiteActionExecutor } from "../../lib/avatar/site-actions";

type AvatarDevHarnessProps = {
  controller: AvatarController;
  runner?: AvatarSequenceRunner;
  siteActionExecutor?: SiteActionExecutor;
};

const debugTargets = ["hero", "portfolio:chat", "portfolio:index"] as const;

export function AvatarDevHarness({
  controller,
  runner,
  siteActionExecutor,
}: AvatarDevHarnessProps) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const run = (command: Exclude<AvatarCommand, { action: "wait" }>) => {
    if (runner) {
      void runner.run([command]);
      return;
    }
    controller.execute(command);
  };

  return (
    <section className="avatar-dev-harness" aria-label="Avatar developer controls">
      <h2>Avatar developer controls</h2>
      <p data-avatar-debug-state={snapshot.state}>
        {snapshot.state} · {snapshot.animation}
      </p>
      <div>
        {allowedAvatarStates.map((state) => (
          <button key={state} type="button" onClick={() => run({ action: "setState", state })}>
            {state}
          </button>
        ))}
      </div>
      <div>
        {allowedAvatarAnimations.map((animation) => (
          <button key={animation} type="button" onClick={() => run({ action: "play", animation })}>
            {animation}
          </button>
        ))}
      </div>
      <div>
        <button type="button" onClick={() => run({ action: "enter", from: "left" })}>enter left</button>
        <button type="button" onClick={() => run({ action: "exit", to: "right" })}>exit right</button>
        {debugTargets.map((target) => (
          <button key={target} type="button" onClick={() => run({ action: "lookAt", target })}>
            look at {target}
          </button>
        ))}
        <button type="button" onClick={() => void siteActionExecutor?.execute({ type: "clearSpotlight" })}>
          clear spotlight
        </button>
        <button type="button" onClick={() => controller.markFailed()}>simulate failure</button>
        <button type="button" onClick={() => controller.reset()}>reset avatar</button>
      </div>
    </section>
  );
}
