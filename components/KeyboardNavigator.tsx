"use client";

import { type KeyboardEvent, type RefObject, useRef, useState } from "react";
import { nextKeyboardIndex } from "../lib/keyboard-navigation";
import { nodeAction } from "../lib/node-interaction";
import type { SpatialGraphNode } from "../lib/spatial-graph";

const roleLabels: Record<SpatialGraphNode["role"], string> = {
  root: "Root",
  instinct: "Instinct",
  approach: "Approach",
  output: "Output",
};

export function KeyboardNavigator({
  nodes,
  onNodeFocus,
  onNodeSelect,
  selectedNodeId,
  controlRef,
}: {
  nodes: readonly SpatialGraphNode[];
  onNodeFocus: (nodeId: string | null) => void;
  onNodeSelect: (node: SpatialGraphNode | null) => void;
  selectedNodeId: string | null;
  controlRef?: RefObject<HTMLButtonElement | null>;
}) {
  const actionableNodes = nodes.filter((node) => nodeAction(node) === "inspect");
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const selectedIndex = actionableNodes.findIndex(
    (node) => node.id === selectedNodeId,
  );
  const currentIndex = selectedIndex >= 0 ? selectedIndex : index;
  const current = actionableNodes[currentIndex];

  function select(nextIndex: number) {
    const node = actionableNodes[nextIndex];
    if (!node) return;
    setActive(true);
    setIndex(nextIndex);
    onNodeFocus(node.id);
    onNodeSelect(node);
  }

  function move(direction: "next" | "previous") {
    select(nextKeyboardIndex(currentIndex, direction, actionableNodes.length));
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
    if (event.key === "Enter" && active && current?.href) {
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
        disabled={actionableNodes.length === 0}
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
            <span>{roleLabels[current.role]}</span>
            <strong>{current.label}</strong>
            <small>{currentIndex + 1} of {actionableNodes.length}</small>
          </>
        ) : (
          "Explore by keyboard"
        )}
      </button>
      {active && current ? (
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
