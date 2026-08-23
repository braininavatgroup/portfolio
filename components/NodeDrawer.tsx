"use client";

import type { RefObject } from "react";
import type { PortfolioNode } from "../lib/portfolio";

const layerDetails = {
  spec: { label: "Model", position: "1 of 3" },
  system: { label: "System", position: "2 of 3" },
  artifact: { label: "Artifact", position: "3 of 3" },
} as const;

export function NodeDrawer({
  node,
  onClose,
  returnFocusRef,
}: {
  node: Exclude<PortfolioNode, { kind: "brain" }> | PortfolioNode;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  if (node.kind === "brain") return null;
  const layer = layerDetails[node.kind];

  function close() {
    returnFocusRef?.current?.focus();
    onClose();
  }

  return (
    <aside
      aria-labelledby="node-drawer-title"
      aria-modal="false"
      className="node-drawer"
      role="dialog"
    >
      <div className="node-drawer-heading">
        <div>
          <p className="eyebrow">{layer.label}</p>
          <p className="node-position">{layer.position} in this chain</p>
        </div>
        <button aria-label="Close details" onClick={close} type="button">Close</button>
      </div>
      <h2 id="node-drawer-title">{node.label}</h2>
      <p>{node.detail}</p>
      {node.href ? <a href={node.href}>View case study</a> : null}
    </aside>
  );
}
