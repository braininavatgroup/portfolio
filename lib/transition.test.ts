import { describe, expect, it } from "vitest";
import {
  transitionDuration,
  transitionReducer,
  type TransitionState,
} from "./transition";

const body: TransitionState = { phase: "body", run: 0 };

describe("portfolio transition", () => {
  it("moves through the explicit body, entering, and graph phases", () => {
    const entering = transitionReducer(body, { type: "ENTER" });
    expect(entering).toEqual({ phase: "entering", run: 1 });
    expect(transitionReducer(entering, { type: "COMPLETE" })).toEqual({
      phase: "graph",
      run: 1,
    });
  });

  it("ignores duplicate enter events during camera travel", () => {
    const entering: TransitionState = { phase: "entering", run: 3 };
    expect(transitionReducer(entering, { type: "ENTER" })).toBe(entering);
  });

  it("resets every phase and increments the next run once", () => {
    const reset = transitionReducer({ phase: "graph", run: 2 }, { type: "RESET" });
    expect(reset).toEqual({ phase: "body", run: 2 });
    expect(transitionReducer(reset, { type: "ENTER" }).run).toBe(3);
  });

  it("opens the graph directly when browser navigation returns to its URL", () => {
    expect(transitionReducer(body, { type: "SHOW_GRAPH" })).toEqual({
      phase: "graph",
      run: 0,
    });
  });

  it("reverses from the graph through a returning phase before restoring the landing", () => {
    const graph: TransitionState = { phase: "graph", run: 2 };
    const returning = transitionReducer(graph, { type: "EXIT" });

    expect(returning).toEqual({ phase: "returning", run: 3 });
    expect(transitionReducer(returning, { type: "COMPLETE" })).toEqual({
      phase: "body",
      run: 3,
    });
  });

  it("ignores a second exit while the landing camera is already returning", () => {
    const returning: TransitionState = { phase: "returning", run: 4 };
    expect(transitionReducer(returning, { type: "EXIT" })).toBe(returning);
  });

  it("uses a short crossfade for reduced motion", () => {
    expect(transitionDuration(false)).toBe(1500);
    expect(transitionDuration(true)).toBe(180);
  });
});
