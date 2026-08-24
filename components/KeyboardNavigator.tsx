"use client";

import { useEffect, useRef } from "react";
import { nextKeyboardIndex } from "../lib/keyboard-navigation";
import { nodeAction } from "../lib/node-interaction";
import type { SpatialGraphNode } from "../lib/spatial-graph";

function isIgnoredTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement ||
    target instanceof HTMLAnchorElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

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
  const actionableNodes = nodes.filter((node) => {
    const action = nodeAction(node);
    return action === "focus" || action === "inspect";
  });
  const indexRef = useRef(-1);
  const previousSelectedNodeId = useRef(selectedNodeId);
  const selectedIndex = actionableNodes.findIndex(
    (node) => node.id === selectedNodeId,
  );

  useEffect(() => {
    if (previousSelectedNodeId.current !== null && selectedNodeId === null) {
      indexRef.current = -1;
      onNodeFocus(null);
    }
    previousSelectedNodeId.current = selectedNodeId;
  }, [onNodeFocus, selectedNodeId]);

  useEffect(() => {
    function select(index: number) {
      const node = actionableNodes[index];
      if (!node) return;
      indexRef.current = index;
      onNodeFocus(node.id);
      onNodeSelect(node);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isIgnoredTarget(event.target)) return;

      const direction =
        event.key === "ArrowRight" || event.key === "ArrowDown"
          ? "next"
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? "previous"
            : null;

      if (direction && actionableNodes.length > 0) {
        event.preventDefault();
        const currentIndex =
          selectedIndex >= 0 ? selectedIndex : indexRef.current;
        const nextIndex =
          currentIndex < 0
            ? direction === "next"
              ? 0
              : actionableNodes.length - 1
            : nextKeyboardIndex(
                currentIndex,
                direction,
                actionableNodes.length,
              );
        select(nextIndex);
        return;
      }

      if (event.key === "Enter") {
        const currentIndex =
          selectedIndex >= 0 ? selectedIndex : indexRef.current;
        const node = actionableNodes[currentIndex];
        if (node?.href) {
          event.preventDefault();
          window.location.assign(node.href);
        }
        return;
      }

      if (
        event.key === "Escape" &&
        (selectedIndex >= 0 || indexRef.current >= 0)
      ) {
        event.preventDefault();
        indexRef.current = -1;
        onNodeFocus(null);
        onNodeSelect(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [actionableNodes, onNodeFocus, onNodeSelect, selectedIndex]);

  return null;
}
