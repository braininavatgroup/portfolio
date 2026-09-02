import { describe, expect, it } from "vitest";
import { AvatarController } from "./controller";
import type { AvatarCommand } from "./contracts";
import { AvatarTargetRegistry } from "./target-registry";
import { avatarCommandActions, parsePortfolioResponseEffects } from "./validation";

/**
 * One valid instance of every command in the grammar. The `satisfies` clause
 * makes a new action in the union a compile error here, so this fixture cannot
 * silently fall behind the contract it is meant to cover.
 */
function stageElement(width: number, height: number) {
  return {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  } as HTMLElement;
}

const oneOfEach = {
  setState: { action: "setState", state: "idle" },
  setTone: {
    action: "setTone",
    tone: { energy: "low", warmth: "warm", confidence: "assured", mischief: "none" },
  },
  play: { action: "play", animation: "shrug" },
  wait: { action: "wait", durationMs: 250 },
  enter: { action: "enter", from: "left" },
  exit: { action: "exit", to: "right" },
  walkTo: { action: "walkTo", target: "portfolio:record:dubs" },
  swimTo: { action: "swimTo", target: "portfolio:chat" },
  swimRoute: { action: "swimRoute", route: "lap" },
  lookAt: { action: "lookAt", target: "portfolio:index" },
  pointAt: { action: "pointAt", target: "portfolio:record:dubs" },
} as const satisfies Record<AvatarCommand["action"], AvatarCommand>;

describe("avatar effects validation", () => {
  it("accepts only semantic swimming commands", () => {
    const parsed = parsePortfolioResponseEffects({
      avatarSequence: [
        { action: "swimTo", target: "portfolio:chat" },
        { action: "swimRoute", route: "lap" },
      ],
    });

    expect(parsed.avatarSequence).toEqual([
      { action: "swimTo", target: "portfolio:chat" },
      { action: "swimRoute", route: "lap" },
    ]);
    expect(parsed.issues).toEqual([]);
  });

  it.each([
    { action: "swimTo", target: "portfolio:chat", x: 12 },
    { action: "swimTo", target: "missing" },
    { action: "swimRoute", route: "custom" },
    { action: "swimRoute", route: "lap", points: [{ x: 1, y: 2 }] },
  ])("rejects unsafe swimming input %#", (command) => {
    const parsed = parsePortfolioResponseEffects({
      avatarSequence: [command],
    });
    expect(parsed.avatarSequence).toEqual([]);
    expect(parsed.issues).not.toEqual([]);
  });

  it("accepts only the bounded performance intent and tone vocabulary", () => {
    // Catches arbitrary model-authored numbers or renderer values crossing the safe effect boundary.
    expect(
      parsePortfolioResponseEffects({
        avatarSequence: [],
        avatarIntent: "expressive",
        avatarTone: {
          energy: "high",
          warmth: "warm",
          confidence: "assured",
          mischief: "playful",
        },
      }),
    ).toEqual({
      avatarSequence: [],
      avatarIntent: "expressive",
      avatarTone: {
        energy: "high",
        warmth: "warm",
        confidence: "assured",
        mischief: "playful",
      },
      issues: [],
    });
  });

  it("accepts a bounded tone command inside a safe sequence", () => {
    // Catches tone support existing only in provider metadata instead of the shared command grammar.
    const tone = {
      energy: "low" as const,
      warmth: "reserved" as const,
      confidence: "assured" as const,
      mischief: "none" as const,
    };
    expect(
      parsePortfolioResponseEffects({
        avatarSequence: [{ action: "setTone", tone }],
      }).avatarSequence,
    ).toEqual([{ action: "setTone", tone }]);
  });

  it("drops an unsafe tone without disturbing a valid intent or sequence", () => {
    // Catches partial tone parsing that could leak unknown renderer controls.
    expect(
      parsePortfolioResponseEffects({
        avatarSequence: [{ action: "play", animation: "shrug" }],
        avatarIntent: "requested",
        avatarTone: {
          energy: 100,
          warmth: "warm",
          confidence: "neutral",
          mischief: "none",
          css: "rotate(90deg)",
        },
      }),
    ).toEqual({
      avatarSequence: [{ action: "play", animation: "shrug" }],
      avatarIntent: "requested",
      issues: ["avatarTone has unknown key: css"],
    });
  });

  it("accepts exact first-class behavior IDs and rejects removed aliases", () => {
    // Catches the protocol drifting back to the old guessed dance alias.
    expect(
      parsePortfolioResponseEffects({
        avatarSequence: [
          { action: "play", animation: "joyful_dance_with_hand_sway" },
          { action: "play", animation: "dance" },
        ],
      }),
    ).toEqual({
      avatarSequence: [
        { action: "play", animation: "joyful_dance_with_hand_sway" },
      ],
      issues: [
        "avatarSequence[1].animation must be an allowed animation",
      ],
    });
  });

  /**
   * Before this, the suite round-tripped three of the eleven commands. The
   * other eight were parsed by hand-written switch arms nobody exercised, at
   * the one boundary where the client decides what a model is allowed to make
   * the avatar do.
   */
  it.each(avatarCommandActions)("round-trips a valid %s command", (action) => {
    const command = oneOfEach[action];
    const parsed = parsePortfolioResponseEffects({ avatarSequence: [command] });

    expect(parsed.issues).toEqual([]);
    expect(parsed.avatarSequence).toEqual([command]);
  });

  it.each(avatarCommandActions)("rejects a %s command carrying an extra key", (action) => {
    const parsed = parsePortfolioResponseEffects({
      avatarSequence: [{ ...oneOfEach[action], smuggled: "rotate(90deg)" }],
    });

    expect(parsed.avatarSequence).toEqual([]);
    expect(parsed.issues).toEqual(["avatarSequence[0] has unknown key: smuggled"]);
  });

  it("does not treat inherited Object properties as actions", () => {
    // Catches a grammar lookup written with `in` rather than Object.hasOwn.
    const parsed = parsePortfolioResponseEffects({
      avatarSequence: [{ action: "toString" }, { action: "constructor" }],
    });

    expect(parsed.avatarSequence).toEqual([]);
    expect(parsed.issues).toEqual([
      "avatarSequence[0].action is not supported",
      "avatarSequence[1].action is not supported",
    ]);
  });

  /**
   * The parser and the controller's switch are two independent lists of the
   * same vocabulary, and TypeScript does not make the controller's exhaustive:
   * a switch with no default over a widened union still compiles, it just
   * silently does nothing. So assert it observably acts on every command it
   * claims to accept.
   */
  it.each(avatarCommandActions.filter((action) => action !== "wait"))(
    "the controller acts on %s",
    (action) => {
      // The four target commands resolve through the registry and correctly
      // no-op on an unknown target, so the targets have to exist for this to
      // be measuring the switch arm rather than a missing element.
      const registry = new AvatarTargetRegistry();
      const bounds = { left: 40, top: 40, width: 200, height: 120 };
      const element = {
        getBoundingClientRect: () => ({
          ...bounds,
          right: bounds.left + bounds.width,
          bottom: bounds.top + bounds.height,
          x: bounds.left,
          y: bounds.top,
          toJSON: () => ({}),
        }),
      } as HTMLElement;
      for (const target of ["portfolio:record:dubs", "portfolio:chat", "portfolio:index"] as const) {
        registry.register(target, element);
      }
      // Swimming plans a route across the stage, so it needs one.
      registry.registerStage(stageElement(620, 800));
      const controller = new AvatarController(registry);
      const before = controller.getSnapshot();

      // execute returns void for the synchronous arms and a promise for the
      // locomotion ones; the snapshot updates before either resolves.
      void controller.execute(
        oneOfEach[action] as Exclude<AvatarCommand, { action: "wait" }>,
      );

      expect(
        controller.getSnapshot(),
        `${action} left the controller untouched`,
      ).not.toBe(before);
    },
  );
});
