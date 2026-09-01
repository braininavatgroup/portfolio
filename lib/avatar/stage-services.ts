import { AvatarController } from "./controller";
import { AvatarDirector } from "./director";
import { AvatarSequenceRunner } from "./sequence-runner";
import { AvatarTargetRegistry } from "./target-registry";

export type AvatarStageServices = {
  controller: AvatarController;
  director: AvatarDirector;
  registry: AvatarTargetRegistry;
  runner: AvatarSequenceRunner;
};

/**
 * The avatar service graph, built once.
 *
 * This was written out identically at four call sites — PortfolioExperience,
 * both gallery fixture modules, and the cheat-sheet examples — one of which
 * carried a comment reading "exactly as PortfolioExperience builds them". They
 * are always constructed together and always all of them, so the construction
 * is the thing to share, not each service.
 */
export function createAvatarStageServices(): AvatarStageServices {
  const registry = new AvatarTargetRegistry();
  const controller = new AvatarController(registry);
  const runner = new AvatarSequenceRunner((command, signal) =>
    controller.execute(command, signal),
  );
  const director = new AvatarDirector(controller, runner, registry);
  return { controller, director, registry, runner };
}
