import { describe, expect, it } from "vitest";
import { chooseAmbientVariant } from "./ambient";

describe("avatar ambient score", () => {
  it("never selects the immediately previous variant when another choice exists", () => {
    // Catches ambient presence reading as a short obvious loop.
    expect(
      chooseAmbientVariant({
        previousId: "still",
        targets: ["hero", "portfolio:chat"],
        canSwim: false,
        random: () => 0,
      }),
    ).toEqual({
      id: "look:hero",
      command: { action: "lookAt", target: "hero" },
    });
  });

  it("uses stillness when no semantic target is mounted", () => {
    // Catches ambient code inventing an unavailable target or full-body performance.
    expect(
      chooseAmbientVariant({
        previousId: null,
        targets: [],
        canSwim: false,
        random: () => 0.75,
      }),
    ).toEqual({ id: "still", command: null });
  });

  it("keeps target choice bounded when random returns its upper edge", () => {
    // Catches an out-of-range weighted lookup.
    expect(
      chooseAmbientVariant({
        previousId: null,
        targets: ["hero"],
        canSwim: false,
        random: () => 1,
      }),
    ).toEqual({
      id: "look:hero",
      command: { action: "lookAt", target: "hero" },
    });
  });

  it("can select one safe lap without repeating it immediately", () => {
    // Catches ambient swimming starting without a safe route or becoming a loop.
    expect(
      chooseAmbientVariant({
        previousId: null,
        targets: ["hero"],
        canSwim: true,
        random: () => 0.99,
      }),
    ).toEqual({ id: "swim:lap", command: { action: "swimRoute", route: "lap" } });

    expect(
      chooseAmbientVariant({
        previousId: "swim:lap",
        targets: ["hero"],
        canSwim: true,
        random: () => 0.99,
      }),
    ).not.toMatchObject({ id: "swim:lap" });
  });

  it("excludes swimming when no lap is currently safe", () => {
    // Catches selection assuming the route will still be safe during execution.
    expect(
      chooseAmbientVariant({
        previousId: null,
        targets: ["hero"],
        canSwim: false,
        random: () => 0.99,
      }),
    ).not.toMatchObject({ id: "swim:lap" });
  });
});
