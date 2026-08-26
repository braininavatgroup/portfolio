"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  getVisibleWorldLinks,
  getWorldFocusIds,
  portfolioStoryById,
  portfolioWorldNodeById,
  portfolioWorldNodes,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";

type Point = { x: number; y: number };

type PortfolioWorldProps = {
  activeStoryId: string | null;
  selectedId: string | null;
  onReset: () => void;
  onSelect: (node: PortfolioWorldNode) => void;
};

const initialPositions = Object.fromEntries(
  portfolioWorldNodes.map(({ id, position }) => [id, { ...position }]),
) as Record<string, Point>;

function focusPositions(
  positions: Record<string, Point>,
  selectedId: string | null,
  focusIds: Set<string> | null,
  userPlaced: ReadonlySet<string>,
) {
  if (!selectedId || !focusIds) return positions;
  const focused = [...focusIds].filter((id) => id !== selectedId);
  const next = { ...positions };
  if (!userPlaced.has(selectedId)) {
    next[selectedId] = { x: 50, y: 43 };
  }
  focused.forEach((id, index) => {
    if (userPlaced.has(id)) return;
    const angle = -Math.PI * 0.82 + (index * Math.PI * 1.64) / Math.max(focused.length - 1, 1);
    next[id] = {
      x: 50 + Math.cos(angle) * 31,
      y: 46 + Math.sin(angle) * 29,
    };
  });
  return next;
}

function nodeStyle(node: PortfolioWorldNode, position: Point): CSSProperties {
  return {
    left: `${position.x}%`,
    top: `${position.y}%`,
    "--node-color": `var(--world-${node.register})`,
  } as CSSProperties;
}

function WorldGlyph({ node }: { node: PortfolioWorldNode }) {
  if (node.family === "identity") {
    return <span aria-hidden="true" className="world-glyph world-glyph-brain" />;
  }
  if (node.family === "story") {
    return (
      <span aria-hidden="true" className="world-glyph world-glyph-story">
        <i />
        <i />
        <i />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`world-glyph world-glyph-${node.family}`}
    />
  );
}

export function PortfolioWorld({
  activeStoryId,
  onReset,
  onSelect,
  selectedId,
}: PortfolioWorldProps) {
  const [positions, setPositions] = useState(initialPositions);
  const [userPlaced, setUserPlaced] = useState<Set<string>>(() => new Set());
  const drag = useRef<{
    id: string;
    pointerId: number;
    startClient: Point;
    startPosition: Point;
    moved: boolean;
  } | null>(null);
  const blankPress = useRef<{ pointerId: number; start: Point } | null>(null);
  const worldRef = useRef<HTMLElement>(null);
  const focusIds = useMemo(
    () => getWorldFocusIds({ activeStoryId, selectedId }),
    [activeStoryId, selectedId],
  );
  const displayedPositions = useMemo(
    () => focusPositions(positions, selectedId, focusIds, userPlaced),
    [focusIds, positions, selectedId, userPlaced],
  );
  const links = useMemo(
    () => getVisibleWorldLinks({ activeStoryId, selectedId }),
    [activeStoryId, selectedId],
  );

  function beginNodeDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: PortfolioWorldNode,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      id: node.id,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startPosition: displayedPositions[node.id],
      moved: false,
    };
  }

  function movePointer(event: ReactPointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    const bounds = worldRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    const dx = event.clientX - active.startClient.x;
    const dy = event.clientY - active.startClient.y;
    if (Math.hypot(dx, dy) > 6 && !active.moved) {
      active.moved = true;
      setUserPlaced((current) => {
        const next = new Set(current);
        next.add(active.id);
        return next;
      });
    }
    setPositions((current) => ({
      ...current,
      [active.id]: {
        x: Math.min(96, Math.max(4, active.startPosition.x + (dx / bounds.width) * 100)),
        y: Math.min(94, Math.max(5, active.startPosition.y + (dy / bounds.height) * 100)),
      },
    }));
  }

  function endPointer(event: ReactPointerEvent<HTMLElement>) {
    const active = drag.current;
    if (active && event.pointerId === active.pointerId) {
      drag.current = null;
      if (!active.moved) {
        const node = portfolioWorldNodeById.get(active.id);
        if (node) onSelect(node);
      }
      return;
    }
    const blank = blankPress.current;
    blankPress.current = null;
    if (
      blank &&
      blank.pointerId === event.pointerId &&
      Math.hypot(event.clientX - blank.start.x, event.clientY - blank.start.y) < 7
    ) {
      onReset();
    }
  }

  const activeStory = activeStoryId
    ? portfolioStoryById.get(activeStoryId)
    : undefined;

  return (
    <section
      aria-label="Spatial portfolio world"
      className="portfolio-world"
      data-active-story={activeStory?.id}
      data-selected-node={selectedId ?? undefined}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget || event.button !== 0) return;
        blankPress.current = {
          pointerId: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
        };
      }}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      ref={worldRef}
    >
      <div className="portfolio-world-grid" aria-hidden="true" />
      <svg aria-hidden="true" className="portfolio-world-links" viewBox="0 0 100 100" preserveAspectRatio="none">
        {links.map((link) => {
          const from = displayedPositions[link.from];
          const to = displayedPositions[link.to];
          if (!from || !to) return null;
          const active = Boolean(
            selectedId &&
              ((focusIds?.has(link.from) && focusIds?.has(link.to)) ||
                link.from === selectedId ||
                link.to === selectedId),
          );
          return (
            <line
              data-active={active ? "true" : "false"}
              data-layer={link.layer}
              key={`${link.layer}:${link.storyId ?? "none"}:${link.from}:${link.to}`}
              x1={from.x}
              x2={to.x}
              y1={from.y}
              y2={to.y}
            />
          );
        })}
      </svg>
      <div className="portfolio-world-mast" aria-hidden="true">Bradley Berkman</div>
      {portfolioWorldNodes.map((node) => {
        const dimmed = Boolean(focusIds && !focusIds.has(node.id));
        return (
          <button
            aria-label={`${node.kind} ${node.label}`}
            aria-pressed={selectedId === node.id}
            className="portfolio-world-node"
            data-dimmed={dimmed ? "true" : "false"}
            data-family={node.family}
            data-register={node.register}
            data-world-node={node.id}
            key={node.id}
            onClick={(event) => {
              if (event.detail === 0) onSelect(node);
            }}
            onPointerDown={(event) => beginNodeDrag(event, node)}
            style={nodeStyle(node, displayedPositions[node.id])}
            type="button"
          >
            <WorldGlyph node={node} />
            <span className="portfolio-world-label">{node.label}</span>
          </button>
        );
      })}
    </section>
  );
}
