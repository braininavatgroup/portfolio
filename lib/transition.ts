export type TransitionPhase = "body" | "entering" | "graph";

export type TransitionState = {
  phase: TransitionPhase;
  run: number;
};

export type TransitionEvent =
  | { type: "ENTER" }
  | { type: "COMPLETE" }
  | { type: "RESET" };

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
    case "COMPLETE":
      if (state.phase !== "entering") return state;
      return { ...state, phase: "graph" };
    case "RESET":
      return { ...state, phase: "body" };
  }
}
