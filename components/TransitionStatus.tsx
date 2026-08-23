import type { TransitionPhase } from "../lib/transition";

const labels: Record<TransitionPhase, string> = {
  body: "Body view. The glass head is ready to enter.",
  entering: "Moving through the glass into the brain graph.",
  graph: "Brain graph open. Choose a domain or artifact.",
};

export function TransitionStatus({ phase }: { phase: TransitionPhase }) {
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {labels[phase]}
    </p>
  );
}
