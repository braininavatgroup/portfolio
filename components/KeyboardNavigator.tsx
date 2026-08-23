"use client";

import { KeyboardEvent, RefObject, useRef, useState } from "react";
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
};

export function KeyboardNavigator({
  onNodeFocus,
  onNodeSelect,
  selectedNodeId,
  controlRef,
}: {
  onNodeFocus: (nodeId: string | null) => void;
  onNodeSelect: (node: PortfolioNode | null) => void;
  selectedNodeId: string | null;
  controlRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const selectedIndex = nodes.findIndex((node) => node.id === selectedNodeId);
  const currentIndex = selectedIndex >= 0 ? selectedIndex : index;
  const current = nodes[currentIndex];

  function select(nextIndex: number) {
    const node = nodes[nextIndex];
    if (!node) return;
    setActive(true);
    setIndex(nextIndex);
    onNodeFocus(node.id);
    onNodeSelect(node);
  }

  function move(direction: "next" | "previous") {
    select(nextKeyboardIndex(currentIndex, direction, nodes.length));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move("next");
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move("previous");
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
      onNodeFocus(null);
      onNodeSelect(null);
      trigger.current?.focus();
    }
  }

  return (
    <div
      aria-label="Keyboard map controls"
      className={`keyboard-navigator${active ? " keyboard-active" : ""}`}
      onKeyDown={handleKeyDown}
      role="toolbar"
    >
      <button
        aria-expanded={active}
        onClick={() => {
          setActive(true);
          onNodeFocus(current?.id ?? null);
        }}
        onFocus={() => {
          setActive(true);
          onNodeFocus(current?.id ?? null);
        }}
        ref={(element) => {
          trigger.current = element;
          if (controlRef) controlRef.current = element;
        }}
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
      {active ? (
        <>
          <div className="keyboard-step-controls">
            <button aria-label="Previous node" onClick={() => move("previous")} type="button">
              Previous
            </button>
            <button aria-label="Next node" onClick={() => move("next")} type="button">
              Next
            </button>
          </div>
          <p>Arrow keys move. Enter opens. Escape closes.</p>
        </>
      ) : null}
    </div>
  );
}
