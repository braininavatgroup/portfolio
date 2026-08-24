"use client";

import { useEffect, useState } from "react";
import { nextKeyboardIndex } from "../lib/keyboard-navigation";
import { nodeAction } from "../lib/node-interaction";
import type { SpatialGraphNode } from "../lib/spatial-graph";

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.matches("input, textarea, select") || target.isContentEditable);

export function KeyboardNavigator({
  nodes,
  onNodeFocus,
  onNodeSelect,
  selectedNodeId,
}: {
  nodes: readonly SpatialGraphNode[];
  onNodeFocus: (nodeId: string | null) => void;
  onNodeSelect: (node: SpatialGraphNode | null) => void;
  selectedNodeId: string | null;
}) {
  const actionableNodes = nodes.filter((node) => nodeAction(node) === "inspect");
  const [index, setIndex] = useState(-1);
  const selectedIndex = actionableNodes.findIndex(
    (node) => node.id === selectedNodeId,
  );
  const currentIndex = selectedIndex >= 0 ? selectedIndex : index;

  useEffect(() => {
    function select(nextIndex: number) {
      const node = actionableNodes[nextIndex];
      if (!node) return;
      setIndex(nextIndex);
      onNodeFocus(node.id);
      onNodeSelect(node);
    }

    function move(direction: "next" | "previous") {
      const nextIndex =
        currentIndex < 0
          ? direction === "next"
            ? 0
            : actionableNodes.length - 1
          : nextKeyboardIndex(currentIndex, direction, actionableNodes.length);
      select(nextIndex);
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        if (actionableNodes.length === 0) return;
        event.preventDefault();
        move("next");
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        if (actionableNodes.length === 0) return;
        event.preventDefault();
        move("previous");
        return;
      }
      if (event.key === "Enter" && currentIndex >= 0) {
        const current = actionableNodes[currentIndex];
        if (!current?.href) return;
        event.preventDefault();
        window.location.assign(current.href);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setIndex(-1);
        onNodeFocus(null);
        onNodeSelect(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actionableNodes, currentIndex, onNodeFocus, onNodeSelect]);

  return null;
}
