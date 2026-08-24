export type TransitionPhase = "body" | "entering" | "graph" | "returning";

export type TransitionState = {
  phase: TransitionPhase;
  run: number;
};

export type TransitionEvent =
  | { type: "ENTER" }
  | { type: "EXIT" }
  | { type: "COMPLETE" }
  | { type: "RESET" }
  | { type: "SHOW_GRAPH" };

export const transitionDuration = (reducedMotion: boolean) =>
  reducedMotion ? 180 : 1500;

export function transitionReducer(
  state: TransitionState,
  event: TransitionEvent,
): TransitionState {
  switch (event.type) {
    case "ENTER":
      if (state.phase !== "body") return state;
      return { phase: "entering", run: state.run + 1 };
    case "EXIT":
      if (state.phase !== "graph" && state.phase !== "entering") return state;
      return { phase: "returning", run: state.run + 1 };
    case "COMPLETE":
      if (state.phase === "entering") return { ...state, phase: "graph" };
      if (state.phase === "returning") return { ...state, phase: "body" };
      return state;
    case "RESET":
      return { ...state, phase: "body" };
    case "SHOW_GRAPH":
      return { ...state, phase: "graph" };
  }
}
