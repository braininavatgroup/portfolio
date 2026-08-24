"use client";

import type { RefObject } from "react";
import type { PortfolioEntity } from "../lib/portfolio-model";
import type { SpatialGraphNode } from "../lib/spatial-graph";

const roleDetails = {
  instinct: { label: "Instinct", position: "1 of 3" },
  approach: { label: "Approach", position: "2 of 3" },
  output: { label: "Output", position: "3 of 3" },
} as const;

type NodeDrawerProps = {
  node: SpatialGraphNode;
  entities: readonly PortfolioEntity[];
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function NodeDrawer({
  node,
  entities,
  onClose,
  returnFocusRef,
}: NodeDrawerProps) {
  if (node.role === "root" || node.role === "domain") return null;
  const role = roleDetails[node.role];
  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const orderedEntities = node.entityIds.flatMap((entityId) => {
    const entity = entitiesById.get(entityId);
    return entity ? [entity] : [];
  });

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
          <p className="eyebrow">{role.label}</p>
          <p className="node-position">{role.position} in this projection</p>
        </div>
        <button aria-label="Close details" onClick={close} type="button">Close</button>
      </div>
      <div className="node-drawer-content">
        <h2 id="node-drawer-title">{node.label}</h2>
        <p>{node.detail}</p>
        {orderedEntities.map((entity) => (
          <section key={entity.id}>
            <h3>{entity.title}</h3>
            <p>{entity.summary}</p>
            {entity.detail ? <p>{entity.detail}</p> : null}
            {entity.links
              ?.filter(({ href }) => href !== node.href)
              .map((link) => (
                <a href={link.href} key={`${link.label}:${link.href}`}>
                  {link.label}
                </a>
              ))}
          </section>
        ))}
        {node.href ? <a href={node.href}>View case study</a> : null}
      </div>
    </aside>
  );
}
