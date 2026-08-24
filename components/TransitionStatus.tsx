import type { TransitionPhase } from "../lib/transition";

const labels: Record<TransitionPhase, string> = {
  body: "Body view. The glass head is ready to enter.",
  entering: "Moving through the glass into the brain graph.",
  graph: "Brain graph open. Explore instinct, approach, and output.",
  returning: "Returning from the brain graph to the Bradley landing.",
};

export function TransitionStatus({ phase }: { phase: TransitionPhase }) {
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {labels[phase]}
    </p>
  );
}
