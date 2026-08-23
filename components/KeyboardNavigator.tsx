"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { nextKeyboardIndex } from "../lib/keyboard-navigation";
import { portfolioNodes, type PortfolioNode } from "../lib/portfolio";

const nodes = portfolioNodes.filter(
  (node): node is PortfolioNode & { href: string } =>
    node.kind !== "brain" && typeof node.href === "string",
);

const kindLabels: Record<Exclude<PortfolioNode["kind"], "brain">, string> = {
  spec: "Model",
  system: "System",
  artifact: "Artifact",
  operation: "In use",
};

export function KeyboardNavigator({
  onNodeFocus,
}: {
  onNodeFocus: (nodeId: string | null) => void;
}) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = nodes[index];

  useEffect(() => {
    onNodeFocus(active ? current?.id ?? null : null);
    return () => onNodeFocus(null);
  }, [active, current?.id, onNodeFocus]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setActive(true);
      setIndex((value) => nextKeyboardIndex(value, "next", nodes.length));
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive(true);
      setIndex((value) => nextKeyboardIndex(value, "previous", nodes.length));
      return;
    }
    if (event.key === "Enter" && active && current) {
      event.preventDefault();
      window.location.assign(current.href);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setActive(false);
      trigger.current?.focus();
    }
  }

  return (
    <div className={`keyboard-navigator${active ? " keyboard-active" : ""}`}>
      <button
        aria-expanded={active}
        onClick={() => setActive(true)}
        onFocus={() => setActive(true)}
        onKeyDown={handleKeyDown}
        ref={trigger}
        type="button"
      >
        {active && current ? (
          <>
            <span>{kindLabels[current.kind]}</span>
            <strong>{current.label}</strong>
            <small>{index + 1} of {nodes.length}</small>
          </>
        ) : (
          "Explore by keyboard"
        )}
      </button>
      {active ? <p>Arrow keys move. Enter opens. Escape closes.</p> : null}
    </div>
  );
}
