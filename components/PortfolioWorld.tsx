"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  getVisibleWorldLinks,
  getWorldFocusIds,
  isWorldLinkActive,
  PORTFOLIO_ARC_THREAD_ID,
  portfolioInterfaceText,
  portfolioThreadById,
  portfolioVisualFormat,
  portfolioWorldNodeById,
  portfolioWorldNodes,
  type PortfolioVisualBlock,
  type PortfolioWorldFamily,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";
import { editorLiveText } from "../lib/editor/editor-store";
import { EditableText, useEditorActive } from "./editor/EditableText";
import { PortfolioControlMark } from "./PortfolioNodeMark";
import { ReaderPlaceholderFrame } from "./PortfolioReader";
import type { CanvasLabelAnchor } from "./editor/CanvasLabelEditor";

const CanvasLabelEditor: ComponentType<{
  anchor: CanvasLabelAnchor;
  onClose: () => void;
}> | null = import.meta.env.DEV
  ? lazy(() => import("./editor/CanvasLabelEditor"))
  : null;

const recordLabelPath = (nodeId: string) => `records.${nodeId}.label`;
import {
  clonePoint as clone,
  projectWorldPoint,
  translateWorldPointByScreenDelta,
  type Point3,
  type ProjectedPoint,
} from "../lib/portfolio-world-projection";
import { relaxWorldOverlaps } from "../lib/portfolio-world-layout";
import {
  PORTFOLIO_NODE_MARK_SIZE,
  portfolioNodeMarkPrimitives,
  portfolioNodeMarkVertices,
} from "../lib/portfolio-node-mark";

type Point = { x: number; y: number };
type Camera = {
  position: Point3;
  target: Point3;
  goalPosition: Point3;
  goalTarget: Point3;
  fov: number;
};
type RuntimeNode = PortfolioWorldNode & {
  alpha: number;
  base: Point3;
  goal: Point3;
  goalAlpha: number;
  labelLines: string[];
  labelSource: string;
  point: Point3;
  rawBase: Point3;
  screen: ProjectedPoint | null;
  userPlaced: boolean;
};

type PortfolioWorldProps = {
  activeThreadId: string | null;
  activeVisual?: PortfolioVisualBlock | null;
  selectedId: string | null;
  onCloseVisual?: () => void;
  onReset: () => void;
  onSelect: (node: PortfolioWorldNode) => void;
  registerAvatarStage?: (element: HTMLElement | null) => void;
};

const MARK_SIZE = PORTFOLIO_NODE_MARK_SIZE;
const BRADLEY_MARK_SIZE = 21;
const LABEL_MAX_WIDTH = 132;
const LABEL_LINE_HEIGHT = 15;
export const PAST_WORLD_ALPHA = 0.42;
const FONT = '400 12.5px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif';
const BRADLEY_FONT = '500 14px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif';

type ConnectorAnchor = Point & { family: PortfolioWorldFamily };

function cross2d(a: Point, b: Point) {
  return a.x * b.y - a.y * b.x;
}

function polygonBoundaryInset(vertices: readonly Point[], direction: Point) {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    const edge = { x: end.x - start.x, y: end.y - start.y };
    const denominator = cross2d(direction, edge);
    if (Math.abs(denominator) < 1e-8) continue;
    const distance = cross2d(start, edge) / denominator;
    const segmentPosition = cross2d(start, direction) / denominator;
    if (distance >= 0 && segmentPosition >= 0 && segmentPosition <= 1) {
      nearest = Math.min(nearest, distance);
    }
  }
  return Number.isFinite(nearest) ? nearest : 0;
}

function markBoundaryInset(family: PortfolioWorldFamily, direction: Point) {
  if (family === "operation") return MARK_SIZE * 0.5;
  if (family === "product") return MARK_SIZE * 0.49;
  const vertices = portfolioNodeMarkVertices(family);
  return vertices ? polygonBoundaryInset(vertices, direction) : 0;
}

export function connectorSegment(from: ConnectorAnchor, to: ConnectorAnchor) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (!distance) return { start: { x: from.x, y: from.y }, end: { x: to.x, y: to.y } };
  const direction = { x: dx / distance, y: dy / distance };
  const fromInset = markBoundaryInset(from.family, direction);
  const toInset = markBoundaryInset(to.family, { x: -direction.x, y: -direction.y });
  return {
    start: {
      x: from.x + direction.x * fromInset,
      y: from.y + direction.y * fromInset,
    },
    end: {
      x: to.x - direction.x * toInset,
      y: to.y - direction.y * toInset,
    },
  };
}

const overview = {
  position: { x: 0, y: 35, z: -760 },
  target: { x: 0, y: 0, z: 760 },
};
const storyView = {
  position: { x: -90, y: 55, z: -650 },
  target: { x: 0, y: -10, z: 800 },
};

const storyLayouts: Record<
  string,
  { bradley: Point3; story: Point3; members: Record<string, Point3> }
> = {
  "making-work-playable": {
    bradley: { x: 560, y: 15, z: 540 },
    story: { x: 330, y: 10, z: 610 },
    members: {
      kickoff: { x: 80, y: 270, z: 820 },
      pitching: { x: -130, y: 290, z: 850 },
      reporting: { x: -330, y: 190, z: 820 },
      "real-estate": { x: -420, y: 20, z: 850 },
      touring: { x: -360, y: -170, z: 820 },
      dubs: { x: -180, y: -280, z: 850 },
      writ: { x: 40, y: -280, z: 820 },
      yoohoo: { x: 190, y: -120, z: 850 },
    },
  },
  [PORTFOLIO_ARC_THREAD_ID]: {
    bradley: { x: 680, y: 95, z: 500 },
    story: { x: 500, y: -75, z: 555 },
    members: {
      "thread-philosophy": { x: 80, y: 230, z: 820 },
      "thread-making-work-playable": { x: -180, y: 40, z: 850 },
      "thread-authorship": { x: 80, y: -220, z: 820 },
    },
  },
  authorship: {
    bradley: { x: 680, y: 95, z: 500 },
    story: { x: 500, y: -75, z: 555 },
    members: {
      "music-practice": { x: 0, y: 300, z: 850 },
      "systems-consulting": { x: -170, y: 330, z: 850 },
      "product-studio": { x: -300, y: 290, z: 850 },
      kickoff: { x: -220, y: 260, z: 850 },
      pitching: { x: -400, y: 150, z: 850 },
      reporting: { x: -480, y: 0, z: 850 },
      "real-estate": { x: -250, y: -280, z: 850 },
      touring: { x: -20, y: -365, z: 850 },
      dubs: { x: 210, y: -270, z: 850 },
      writ: { x: 390, y: -150, z: 850 },
      yoohoo: { x: 450, y: 40, z: 850 },
    },
  },
  philosophy: {
    bradley: { x: 570, y: 10, z: 540 },
    story: { x: 350, y: 0, z: 610 },
    members: {
      pitching: { x: 100, y: 200, z: 820 },
      reporting: { x: -120, y: 230, z: 820 },
      "real-estate": { x: -330, y: 110, z: 820 },
      touring: { x: -340, y: -110, z: 820 },
      writ: { x: -130, y: -230, z: 820 },
    },
  },
};

function createRuntimeNodes(): RuntimeNode[] {
  return portfolioWorldNodes.map((node) => {
    const { x: screenX, y: screenY, z } = node.position;
    const point = { x: (50 - screenX) * 18, y: (50 - screenY) * 18, z };
    return {
      ...node,
      alpha: 1,
      base: clone(point),
      goal: clone(point),
      goalAlpha: 1,
      labelLines: [node.label],
      labelSource: node.label,
      point: clone(point),
      rawBase: clone(point),
      screen: null,
      userPlaced: false,
    };
  });
}

function wrapLabel(
  label: string,
  measure: (value: string) => number,
  maxWidth = LABEL_MAX_WIDTH,
) {
  if (measure(label) <= maxWidth || !label.includes(" ")) return [label];
  const words = label.split(" ");
  let best = [label];
  let bestWidth = Infinity;
  for (let index = 1; index < words.length; index += 1) {
    const candidate = [
      words.slice(0, index).join(" "),
      words.slice(index).join(" "),
    ];
    const width = Math.max(...candidate.map(measure));
    if (width < bestWidth) {
      best = candidate;
      bestWidth = width;
    }
  }
  return best;
}

/**
 * Every colour the canvas paints, resolved in one pass.
 *
 * drawNode used to call getComputedStyle per node per frame, immediately after
 * the loop wrote inline left/top/pointerEvents to all seventeen node buttons —
 * so style was dirty and each read forced a synchronous recalculation of the
 * document, ~35 times a frame. Reading once, before the writes, is the whole
 * fix; the values only change with the mode.
 */
type WorldPalette = {
  compact: boolean;
  connector: string;
  editingNodeId: string | undefined;
  ink: string;
  register: (name: string) => string;
  selectedNodeId: string | undefined;
  width: number;
};

function readWorldPalette(world: HTMLElement): WorldPalette {
  const style = getComputedStyle(world);
  const registers = new Map<string, string>();
  const width = world.clientWidth;
  return {
    compact: width <= 600,
    connector: cssColor(style, "--map-connector", "#4f585d"),
    editingNodeId: world.dataset.editingLabel,
    ink: cssColor(style, "--ink", "#201711"),
    register: (name) => {
      const cached = registers.get(name);
      if (cached !== undefined) return cached;
      const resolved = cssColor(style, `--world-${name}`, "#201711");
      registers.set(name, resolved);
      return resolved;
    },
    selectedNodeId: world.dataset.selectedNode,
    width,
  };
}

function cssColor(style: CSSStyleDeclaration, variable: string, fallback: string) {
  return style.getPropertyValue(variable).trim() || fallback;
}

// The dossier subject a visual belongs to: the open thread when the map is
// on its story node, otherwise the selected record.
function visualSubjectTitle(selectedId: string | null, activeThreadId: string | null) {
  const thread = activeThreadId ? portfolioThreadById.get(activeThreadId) : undefined;
  if (thread && (!selectedId || selectedId === thread.nodeId)) return thread.title;
  const node = selectedId ? portfolioWorldNodeById.get(selectedId) : undefined;
  return node?.label ?? portfolioInterfaceText["world.mast"];
}

function PortfolioVisualStage({
  block,
  onClose,
  title,
}: {
  block: PortfolioVisualBlock;
  onClose?: () => void;
  /** The dossier subject the visual belongs to, shown in the stage head. */
  title: string;
}) {
  const format = portfolioVisualFormat(block);
  const assets =
    block.src && format !== "video"
      ? [{ src: block.src, alt: block.alt ?? "" }]
      : [];
  const frameCount = format === "gallery" ? assets.length || 3 : 1;
  const [activeFrame, setActiveFrame] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const asset = assets[activeFrame];

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <section
      aria-label={`Visual in map: ${block.purpose}`}
      className="portfolio-visual-stage"
      data-format={format}
      data-status={block.status}
    >
      <header className="portfolio-visual-stage-head">
        <div>
          <span>Map visual</span>
          <strong>{title}</strong>
        </div>
        <PortfolioControlMark
          aria-label="Close visual in map"
          kind="close"
          label="Close"
          onClick={onClose}
          ref={closeButtonRef}
        />
      </header>

      <div className="portfolio-visual-stage-frame">
        {format === "video" && block.src && block.captionsSrc ? (
          <video
            aria-label={block.alt ?? block.purpose}
            controls
            poster={block.poster}
            preload="metadata"
            src={block.src}
          >
            <track
              default
              kind="captions"
              src={block.captionsSrc}
              srcLang="en"
            />
          </video>
        ) : asset ? (
          <img
            alt={asset.alt}
            src={asset.src}
          />
        ) : (
          <div
            aria-label={`Planned ${format} placeholder`}
            className="portfolio-visual-stage-placeholder"
            data-format={format}
          >
            <ReaderPlaceholderFrame
              format={format}
              frame={activeFrame + 1}
              frameCount={frameCount}
              sourceStatus={block.sourceStatus}
              treatment={block.treatment}
            />
          </div>
        )}
      </div>

      <footer className="portfolio-visual-stage-copy">
        <p>{block.caption ?? block.purpose}</p>
        {format === "gallery" ? (
          <nav aria-label="Visual frames">
            <PortfolioControlMark
              aria-label="Previous visual frame"
              disabled={activeFrame === 0}
              kind="previous"
              label="Previous"
              onClick={() => setActiveFrame((frame) => Math.max(0, frame - 1))}
            />
            <span>{activeFrame + 1} / {frameCount}</span>
            <PortfolioControlMark
              aria-label="Next visual frame"
              disabled={activeFrame === frameCount - 1}
              kind="next"
              label="Next"
              onClick={() =>
                setActiveFrame((frame) => Math.min(frameCount - 1, frame + 1))
              }
            />
          </nav>
        ) : null}
      </footer>
    </section>
  );
}

export function PortfolioWorld({
  activeThreadId,
  activeVisual,
  onCloseVisual,
  onReset,
  onSelect,
  registerAvatarStage,
  selectedId,
}: PortfolioWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const runtime = useRef(createRuntimeNodes());
  const size = useRef({ width: 0, height: 0, dpr: 1 });
  const camera = useRef<Camera>({
    position: clone(overview.position),
    target: clone(overview.target),
    goalPosition: clone(overview.position),
    goalTarget: clone(overview.target),
    fov: 720,
  });
  const state = useRef<{ activeThreadId: string | null; selectedId: string | null }>({
    activeThreadId: null,
    selectedId: null,
  });
  const drag = useRef<{
    id: string;
    pointerId: number;
    start: Point;
    last: Point;
    moved: boolean;
  } | null>(null);
  const blankPress = useRef<{ pointerId: number; start: Point } | null>(null);
  const editorActive = useEditorActive();
  const [labelAnchor, setLabelAnchor] = useState<CanvasLabelAnchor | null>(null);
  const brainImage = useRef<HTMLImageElement | null>(null);
  const brainCache = useRef(new Map<string, HTMLCanvasElement>());
  const focusIds = useMemo(
    () => getWorldFocusIds({ activeThreadId, selectedId }),
    [activeThreadId, selectedId],
  );
  const focusRef = useRef(focusIds);
  const links = useMemo(
    () => getVisibleWorldLinks({ selectedId }),
    [selectedId],
  );
  const linksRef = useRef(links);
  const setWorldElement = useCallback(
    (element: HTMLElement | null) => {
      worldRef.current = element;
      registerAvatarStage?.(element);
    },
    [registerAvatarStage],
  );

  useEffect(() => {
    focusRef.current = focusIds;
    linksRef.current = links;
  }, [focusIds, links]);

  useEffect(() => {
    if (typeof Image === "undefined") return;
    const image = new Image();
    const cache = brainCache.current;
    image.src = "/biv-brain-symbol.png";
    brainImage.current = image;
    return () => {
      brainImage.current = null;
      cache.clear();
    };
  }, []);

  useEffect(() => {
    const previous = state.current;
    state.current = { activeThreadId, selectedId };
    const nodes = runtime.current;
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const activeStory = activeThreadId
      ? portfolioThreadById.get(activeThreadId)
      : undefined;

    if (activeStory) {
      // A record opened from a Story is evidence inside the same authored
      // composition. It does not collapse into a generic focus layout.
      if (previous.activeThreadId !== activeThreadId) {
        applyStoryGoals(nodes, activeStory.id, size.current, camera.current);
      }
      return;
    }

    if (!selectedId) {
      nodes.forEach((node) => {
        node.goal = clone(node.base);
        node.goalAlpha = 1;
      });
      camera.current.goalPosition = clone(overview.position);
      camera.current.goalTarget = clone(overview.target);
      return;
    }

    const selected = byId.get(selectedId);
    if (!selected) return;
    const adjacent = focusIds ? [...focusIds].filter((id) => id !== selectedId) : [];
    selected.goal = { x: 0, y: 0, z: 560 };
    selected.goalAlpha = 1;
    adjacent.forEach((id, index) => {
      const node = byId.get(id);
      if (!node) return;
      const angle =
        -Math.PI * 0.72 +
        index * ((Math.PI * 1.44) / Math.max(adjacent.length - 1, 1));
      node.goal = {
        x: Math.cos(angle) * 320,
        y: Math.sin(angle) * 205,
        z: 610 + (index % 2) * 140,
      };
      node.goalAlpha = 0.95;
    });
    nodes.forEach((node, index) => {
      if (node.id === selectedId || focusIds?.has(node.id)) return;
      const direction = index % 2 === 0 ? -1 : 1;
      node.goal = {
        x: direction * (560 + (index % 3) * 120),
        y: node.base.y * 1.45,
        z: 1120 + (index % 4) * 160,
      };
      node.goalAlpha = 0.16;
    });
    camera.current.goalPosition = { x: -120, y: 70, z: -580 };
    camera.current.goalTarget = { x: 0, y: 0, z: 610 };
  }, [activeThreadId, focusIds, selectedId]);

  useEffect(() => {
    const world = worldRef.current;
    const canvas = canvasRef.current;
    if (!world || !canvas) return;
    const context = canvas.getContext?.("2d") ?? null;
    let frame = 0;
    let disposed = false;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    let reduceMotion = motion?.matches ?? false;

    const measure = (value: string) => {
      if (!context) return value.length * 6.2;
      context.font = FONT;
      return context.measureText(value).width;
    };

    const fitOverview = () => {
      const { width, height } = size.current;
      if (!width || !height) return;
      const nodes = runtime.current;
      const working = new Map(nodes.map((node) => [node.id, clone(node.rawBase)]));

      relaxWorldOverlaps({
        positions: working,
        nodes: nodes.map((node) => ({
          id: node.id,
          label: node.label,
          pinned:
            node.id === "bradley" || node.family === "story" || node.userPlaced,
        })),
        camera: {
          position: overview.position,
          target: overview.target,
          fov: camera.current.fov,
        },
        viewport: { width, height },
        measure,
        wrap: (label, measureText) => wrapLabel(label, measureText),
        lineHeight: LABEL_LINE_HEIGHT,
        iterations: 120,
        padding: 5,
        minHalfWidth: 13,
        footprint: { top: 13, extraHeight: 31 },
        margins: { left: 12, right: 12, top: 18, bottom: 78 },
        bounds: { x: 940, y: 540, z: [480, 1120] },
      });

      nodes.forEach((node) => {
        node.base = clone(working.get(node.id)!);
        if (!state.current.selectedId && !state.current.activeThreadId) {
          node.point = clone(node.base);
          node.goal = clone(node.base);
        }
      });
    };

    const resize = () => {
      const bounds = world.getBoundingClientRect();
      const width = Math.max(1, bounds.width || world.clientWidth || 1);
      const height = Math.max(1, bounds.height || world.clientHeight || 1);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size.current = { width, height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      camera.current.fov = Math.max(
        180,
        Math.min(720, (width - 75) * 0.74, height * 0.9),
      );
      fitOverview();
      if (state.current.activeThreadId) {
        applyStoryGoals(
          runtime.current,
          state.current.activeThreadId,
          size.current,
          camera.current,
          measure,
        );
      }
    };

    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(world);
    const updateMotion = () => {
      reduceMotion = motion?.matches ?? false;
    };
    motion?.addEventListener?.("change", updateMotion);

    let lastLabelWidth = -1;
    const render = () => {
      // Read before the node buttons are written below, so the reads land on
      // clean style instead of forcing a recalculation per node.
      const palette = readWorldPalette(world);
      const { width, height } = size.current;
      const labelWidth = width <= 600 ? 96 : LABEL_MAX_WIDTH;
      const nodes = runtime.current;
      const active = state.current;
      const currentCamera = camera.current;
      const rate = reduceMotion ? 1 : active.activeThreadId ? 0.075 : 0.055;
      const cameraRate = reduceMotion ? 1 : 0.045;
      for (const node of nodes) {
        if (drag.current?.id !== node.id) {
          node.point.x += (node.goal.x - node.point.x) * rate;
          node.point.y += (node.goal.y - node.point.y) * rate;
          node.point.z += (node.goal.z - node.point.z) * rate;
        }
        node.alpha += (node.goalAlpha - node.alpha) * (reduceMotion ? 1 : 0.07);
      }
      for (const axis of ["x", "y", "z"] as const) {
        currentCamera.position[axis] +=
          (currentCamera.goalPosition[axis] - currentCamera.position[axis]) * cameraRate;
        currentCamera.target[axis] +=
          (currentCamera.goalTarget[axis] - currentCamera.target[axis]) * cameraRate;
      }
      for (const node of nodes) {
        node.screen = projectWorldPoint(
          node.point,
          currentCamera.position,
          currentCamera.target,
          currentCamera.fov,
          width,
          height,
        );
        // Re-wrap only when something that affects the wrap has changed. The
        // label is live-editable, so the cache key is the resolved text as
        // well as the width — width alone would freeze an in-progress edit.
        const liveLabel = editorLiveText(recordLabelPath(node.id), node.label);
        if (labelWidth !== lastLabelWidth || liveLabel !== node.labelSource) {
          node.labelSource = liveLabel;
          node.labelLines = wrapLabel(liveLabel, measure, labelWidth);
        }
        const button = buttonRefs.current.get(node.id);
        if (button && node.screen) {
          button.style.left = `${(node.screen.x / width) * 100}%`;
          button.style.top = `${(node.screen.y / height) * 100}%`;
          button.style.pointerEvents = node.alpha < 0.22 ? "none" : "auto";
        }
      }

      if (context) {
        context.clearRect(0, 0, width, height);
        drawLinks(context, nodes, linksRef.current, active.selectedId, palette);
        const sorted = [...nodes].sort(
          (a, b) => (b.screen?.depth ?? 0) - (a.screen?.depth ?? 0),
        );
        for (const node of sorted) {
          drawNode(context, node, palette, brainImage.current, brainCache.current);
        }
      }
      lastLabelWidth = labelWidth;
      if (!disposed) frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      motion?.removeEventListener?.("change", updateMotion);
    };
  }, []);

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
      start: { x: event.clientX, y: event.clientY },
      last: { x: event.clientX, y: event.clientY },
      moved: false,
    };
  }

  function movePointer(event: ReactPointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    const dx = event.clientX - active.last.x;
    const dy = event.clientY - active.last.y;
    if (Math.hypot(event.clientX - active.start.x, event.clientY - active.start.y) > 6) {
      active.moved = true;
    }
    const node = runtime.current.find(({ id }) => id === active.id);
    if (!node?.screen) return;
    node.point = translateWorldPointByScreenDelta(
      node.point,
      node.screen.scale,
      dx,
      dy,
      camera.current.position,
      camera.current.target,
    );
    node.goal = clone(node.point);
    active.last = { x: event.clientX, y: event.clientY };
  }

  // Locates the canvas-drawn label under a click so writing mode can anchor
  // its single-line input there. Mirrors the geometry in drawNode.
  function findLabelAnchorAt(clientX: number, clientY: number): CanvasLabelAnchor | null {
    const world = worldRef.current;
    const canvas = canvasRef.current;
    if (!world || !canvas) return null;
    const bounds = world.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    const context = canvas.getContext?.("2d") ?? null;
    const compact = world.clientWidth <= 600;
    const font = compact
      ? '400 11px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif'
      : FONT;
    const measure = (value: string) => {
      if (!context) return value.length * 6.2;
      context.font = font;
      return context.measureText(value).width;
    };
    const lineHeight = compact ? 12 : LABEL_LINE_HEIGHT;
    const padding = 4;
    for (const node of runtime.current) {
      const point = node.screen;
      if (!point || node.alpha < 0.22) continue;
      const showLabel =
        !compact ||
        node.family === "story" ||
        world.dataset.selectedNode === node.id;
      if (!showLabel || node.labelLines.length === 0) continue;
      const labelWidth = Math.max(...node.labelLines.map(measure));
      const labelX = compact
        ? point.x + (point.x < world.clientWidth / 2 ? -12 : 12)
        : point.x;
      const firstLineY = compact
        ? point.y - ((node.labelLines.length - 1) * lineHeight) / 2
        : point.y + 18 + LABEL_LINE_HEIGHT * 0.5;
      const align: CanvasLabelAnchor["align"] = compact
        ? point.x < world.clientWidth / 2
          ? "right"
          : "left"
        : "center";
      const left =
        align === "center"
          ? labelX - labelWidth / 2
          : align === "right"
            ? labelX - labelWidth
            : labelX;
      const top = firstLineY - lineHeight / 2;
      const height = node.labelLines.length * lineHeight;
      if (
        x >= left - padding &&
        x <= left + labelWidth + padding &&
        y >= top - padding &&
        y <= top + height + padding
      ) {
        const path = recordLabelPath(node.id);
        return {
          nodeId: node.id,
          path,
          initial: editorLiveText(path, node.label),
          base: node.label,
          rect: { left, top, width: labelWidth, height },
          align,
          compact,
        };
      }
    }
    return null;
  }

  function endPointer(event: ReactPointerEvent<HTMLElement>) {
    const active = drag.current;
    if (active && active.pointerId === event.pointerId) {
      drag.current = null;
      const node = runtime.current.find(({ id }) => id === active.id);
      if (!active.moved) {
        const selected = portfolioWorldNodeById.get(active.id);
        if (selected) onSelect(selected);
      } else if (node && !state.current.selectedId && !state.current.activeThreadId) {
        node.base = clone(node.point);
        node.rawBase = clone(node.point);
        node.userPlaced = true;
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
      if (import.meta.env.DEV && editorActive) {
        const anchor = findLabelAnchorAt(event.clientX, event.clientY);
        if (anchor) {
          setLabelAnchor(anchor);
          return;
        }
      }
      onReset();
    }
  }

  return (
    <section
      aria-label="Spatial portfolio world"
      className="portfolio-world"
      data-active-thread={activeThreadId ?? undefined}
      data-editing-label={labelAnchor?.nodeId}
      data-selected-node={selectedId ?? undefined}
      data-visual-open={activeVisual ? "true" : "false"}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (
          activeVisual ||
          event.button !== 0 ||
          !target.hasAttribute("data-world-surface")
        ) return;
        blankPress.current = {
          pointerId: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
        };
      }}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      ref={setWorldElement}
    >
      <canvas aria-hidden="true" data-world-surface ref={canvasRef} />
      <EditableText
        aria-hidden="true"
        as="div"
        className="portfolio-world-mast"
        path="interface.world.mast"
        value={portfolioInterfaceText["world.mast"]}
      />
      {portfolioWorldNodes.map((node) => (
        <button
          aria-label={`${node.kind} ${node.label}`}
          aria-pressed={selectedId === node.id}
          className="portfolio-world-node"
          data-cursor-color={`--world-${node.register}`}
          data-family={node.family}
          data-status={node.status}
          data-world-node={node.id}
          disabled={Boolean(activeVisual)}
          key={node.id}
          onClick={(event) => {
            if (event.detail === 0) onSelect(node);
          }}
          onPointerDown={(event) => beginNodeDrag(event, node)}
          ref={(element) => {
            if (element) buttonRefs.current.set(node.id, element);
            else buttonRefs.current.delete(node.id);
          }}
          type="button"
        />
      ))}
      {activeVisual ? (
        <PortfolioVisualStage
          block={activeVisual}
          key={activeVisual.id}
          onClose={onCloseVisual}
          title={visualSubjectTitle(selectedId, activeThreadId)}
        />
      ) : null}
      {import.meta.env.DEV && CanvasLabelEditor && labelAnchor ? (
        <Suspense fallback={null}>
          <CanvasLabelEditor
            anchor={labelAnchor}
            key={labelAnchor.nodeId}
            onClose={() => setLabelAnchor(null)}
          />
        </Suspense>
      ) : null}
    </section>
  );
}

function applyStoryGoals(
  nodes: RuntimeNode[],
  storyId: string,
  dimensions: { width: number; height: number },
  camera: Camera,
  measure: (value: string) => number = (value) => value.length * 6.2,
) {
  const story = portfolioThreadById.get(storyId);
  const layout = storyLayouts[storyId];
  if (!story || !layout) return;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const focusIds = getWorldFocusIds({
    activeThreadId: story.id,
    selectedId: story.nodeId,
  });
  nodes.forEach((node) => {
    if (node.id === "bradley") node.goal = clone(layout.bradley);
    else if (node.id === story.nodeId) node.goal = clone(layout.story);
    else node.goal = layout.members[node.id]
      ? clone(layout.members[node.id])
      : clone(node.base);
    node.goalAlpha = focusIds?.has(node.id) ? 1 : 0.13;
  });

  const { width, height } = dimensions;
  if (width && height) {
    const ids = ["bradley", story.nodeId, ...story.members];
    const working = new Map(ids.map((id) => [id, clone(byId.get(id)!.goal)]));

    relaxWorldOverlaps({
      positions: working,
      nodes: ids.map((id) => ({
        id,
        label: byId.get(id)!.label,
        pinned: id === "bradley" || id === story.nodeId,
      })),
      camera: {
        position: storyView.position,
        target: storyView.target,
        fov: camera.fov,
      },
      viewport: { width, height },
      measure,
      wrap: (label, measureText) => wrapLabel(label, measureText),
      lineHeight: LABEL_LINE_HEIGHT,
      iterations: 160,
      padding: 8,
      minHalfWidth: 15,
      footprint: { top: 14, extraHeight: 34 },
      margins: { left: 18, right: 18, top: 18, bottom: 84 },
      bounds: { x: 980, y: 590, z: [620, 1050] },
    });

    ids.forEach((id) => {
      byId.get(id)!.goal = clone(working.get(id)!);
    });
  }

  camera.goalPosition = clone(storyView.position);
  camera.goalTarget = clone(storyView.target);
}

function drawLinks(
  context: CanvasRenderingContext2D,
  nodes: RuntimeNode[],
  links: ReturnType<typeof getVisibleWorldLinks>,
  selectedId: string | null,
  palette: WorldPalette,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const color = palette.connector;
  for (const link of links) {
    const from = byId.get(link.from);
    const to = byId.get(link.to);
    if (!from?.screen || !to?.screen) continue;
    const active = isWorldLinkActive(link, selectedId);
    const strength = selectedId ? (active ? 0.78 : 0.025) : 0.25;
    const alpha = Math.min(from.alpha, to.alpha) * strength;
    const segment = connectorSegment(
      { x: from.screen.x, y: from.screen.y, family: from.family },
      { x: to.screen.x, y: to.screen.y, family: to.family },
    );
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = active ? 1.1 : 0.54;
    context.beginPath();
    context.moveTo(segment.start.x, segment.start.y);
    context.lineTo(segment.end.x, segment.end.y);
    context.stroke();
    context.restore();
  }
}

function drawNode(
  context: CanvasRenderingContext2D,
  node: RuntimeNode,
  palette: WorldPalette,
  image: HTMLImageElement | null,
  cache: Map<string, HTMLCanvasElement>,
) {
  const point = node.screen;
  if (!point) return;
  const color = palette.register(node.register);
  const ink = palette.ink;
  const isBradley = node.id === "bradley";
  const size = isBradley ? BRADLEY_MARK_SIZE : MARK_SIZE;
  const statusAlpha = node.status === "past" ? PAST_WORLD_ALPHA : 1;
  context.save();
  context.translate(point.x, point.y);
  context.globalAlpha = node.alpha * statusAlpha;
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = 1.45;
  context.lineJoin = "round";

  for (const primitive of portfolioNodeMarkPrimitives(node.family, size)) {
    if (primitive.kind === "brain") {
      const glyph = tintedBrain(image, color, cache);
      if (glyph) {
        context.drawImage(
          glyph,
          -size * 0.49,
          -size * 0.49,
          size * 0.98,
          size * 0.98,
        );
      }
      continue;
    }

    if (primitive.kind === "path") {
      const path = new Path2D(primitive.d);
      if (primitive.fill) context.fill(path);
      else context.stroke(path);
      continue;
    }

    context.beginPath();
    if (primitive.kind === "circle") {
      context.arc(
        primitive.x,
        primitive.y,
        primitive.radius,
        0,
        Math.PI * 2,
      );
    } else {
      primitive.points.forEach(({ x, y }, index) => {
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      if (primitive.close) context.closePath();
    }
    if (primitive.fill) context.fill();
    else context.stroke();
  }
  context.restore();

  const compact = palette.compact;
  const showLabel =
    !compact ||
    node.family === "story" ||
    palette.selectedNodeId === node.id;
  // While the map-label input is open its canvas text stays hidden so the
  // draft renders exactly once, in the input.
  if (!showLabel || palette.editingNodeId === node.id) return;

  context.save();
  context.globalAlpha = node.alpha * statusAlpha;
  context.font = compact
    ? '400 11px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif'
    : isBradley
      ? BRADLEY_FONT
      : FONT;
  context.fillStyle = ink;
  context.textBaseline = "middle";
  const labelLineHeight = compact ? 12 : LABEL_LINE_HEIGHT;
  const labelX = compact
    ? point.x + (point.x < palette.width / 2 ? -12 : 12)
    : point.x;
  const labelY = compact
    ? point.y - ((node.labelLines.length - 1) * labelLineHeight) / 2
    : point.y + (isBradley ? 23 : 18) + LABEL_LINE_HEIGHT * 0.5;
  context.textAlign = compact
    ? point.x < palette.width / 2
      ? "right"
      : "left"
    : "center";
  node.labelLines.forEach((line, index) => {
    context.fillText(line, labelX, labelY + labelLineHeight * index);
  });
  context.restore();
}

function tintedBrain(
  image: HTMLImageElement | null,
  color: string,
  cache: Map<string, HTMLCanvasElement>,
) {
  if (!image?.complete || !image.naturalWidth) return null;
  const existing = cache.get(color);
  if (existing) return existing;
  const glyph = document.createElement("canvas");
  glyph.width = 128;
  glyph.height = 128;
  const context = glyph.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, 128, 128);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, 128, 128);
  cache.set(color, glyph);
  return glyph;
}
