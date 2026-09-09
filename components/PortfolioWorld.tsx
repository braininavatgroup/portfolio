"use client";

import { PORTFOLIO_GLYPH } from "../lib/portfolio-glyph-metrics";

import { portfolioOverviewLabel, portfolioOverviewPositions, portfolioOverviewNodeLabel, overviewConnectorSegments } from "../lib/portfolio-overview-layout";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  getVisibleWorldLinks,
  getWorldFocusIds,
  isRestingWorldSelection,
  isWorldLinkActive,
  portfolioInterfaceText,
  portfolioThreadById,
  portfolioWorldNodeById,
  portfolioWorldNodes,
  type PortfolioWorldFamily,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";
import {
  clonePoint as clone,
  cameraBasis,
  projectWorldPoint,
  translateWorldPointByScreenDelta,
  worldPointAtDepth,
  type Point3,
  type ProjectedPoint,
} from "../lib/portfolio-world-projection";
import { relaxWorldOverlaps } from "../lib/portfolio-world-layout";
import {
  clearLabelRay,
  envelopeInset,
  type LayoutBox,
} from "../lib/portfolio-node-envelope";
import { storyTreeJunction } from "../lib/portfolio-story-tree";
import {
  FIELD,
  fieldScreenTargets,
  segmentRectClearanceShift,
  type FieldDimmed,
  type FieldLit,
  type Segment,
} from "../lib/portfolio-world-field";
import {
  AUTHORED_ZONES,
  clearTrunkCone,
  compositionRng,
  ensureShift,
  groupByFamily,
  LOOSE_LIMIT,
  MIN_SHIFT,
  looseZones,
  placeInZone,
  placeOne,
  polarPoint,
  setWorldSeed,
  starZones,
  stillRng,
  trunkTilt,
  ZONE_DEPTH,
  type Rng,
  type Zone,
  type ZoneMap,
} from "../lib/portfolio-world-zones";
import {
  PORTFOLIO_NODE_MARK_SIZE,
  PORTFOLIO_NODE_MARK_STROKE,
  portfolioNodeMarkPrimitives,
  portfolioNodeMarkRadius,
} from "../lib/portfolio-node-mark";
import type { BrainFoodNodePosition } from "../lib/avatar/brain-food";

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
  /** The painted label's box on screen this frame, part of the envelope. */
  labelBox: LayoutBox | null;
  labelLines: string[];
  point: Point3;
  rawBase: Point3;
  screen: ProjectedPoint | null;
  /** The widest label line, measured once per wrap, not per frame. */
  labelWidth: number;
  /** Each line's own width, so a connector can clip to the text, not the block. */
  labelLineWidths: number[];
  /** One box per painted line, hugging the text rather than its bounding block. */
  labelLineBoxes: LayoutBox[];
};

export type PortfolioWorldProps = {
  activeThreadId: string | null;
  brainFood?: {
    active: boolean;
    eatenIds: ReadonlySet<string>;
    remaining: number;
    syncNodePositions: (nodes: readonly BrainFoodNodePosition[]) => void;
  };
  compact?: boolean;
  nodesInTabOrder?: boolean;
  selectedId: string | null;
  onReset: () => void;
  onSelect: (node: PortfolioWorldNode) => void;
  registerAvatarStage?: (element: HTMLElement | null) => void;
};

const MARK_SIZE = PORTFOLIO_NODE_MARK_SIZE;
const BRADLEY_MARK_SIZE = 21;
const LABEL_MAX_WIDTH = 132;
const LABEL_LINE_HEIGHT = 15;
/** Where a label starts below its mark; drawNode paints it there. */
const LABEL_TOP = 18;
const BRADLEY_LABEL_TOP = 23;
/** Bradley's 14px medium label measures wider than the 12.5px record font. */
const BRADLEY_LABEL_SCALE = 14 / 12.5;
const COMPACT_LINE_HEIGHT = 12;
/** The compact label is painted at 11px against the 12.5px measurement. */
const COMPACT_LABEL_SCALE = 11 / 12.5;
const COMPACT_LABEL_INSET = 12;
export const PAST_WORLD_ALPHA = 0.42;
/** The default overview shows the full field without selection dimming. */
export const REST_FIELD_ALPHA = 1;
const FONT = '400 12.5px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif';
const BRADLEY_FONT = '500 14px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif';

type ConnectorAnchor = Point & {
  family: PortfolioWorldFamily;
  /** The painted label's box, when the anchor is a node with one showing. */
  labelBox?: LayoutBox | null;
};

/**
 * Every line stops this far outside a node's envelope (Rule 6.3): the mark's
 * tightest circle keeps a line from bleeding through an asterisk's open arms
 * or a triangle's gaps, the label box keeps it off the text beneath the
 * mark, and the clearance keeps it from touching either.
 */
const CONNECTOR_CLEARANCE = 2;

/** How far a label-clipped end ramps from nothing to full ink, in pixels. */
const CONNECTOR_FADE = 7;

/**
 * Splits a token colour into an `rgba()` builder so a connector can fade to
 * transparent in its own hue. Returns null for anything unparseable, which
 * leaves the line drawn flat rather than guessing at a colour.
 */
function alphaColor(color: string) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const digits = hex[1];
    const pairs =
      digits.length === 3
        ? [...digits].map((digit) => digit + digit)
        : [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)];
    const [r, g, b] = pairs.map((pair) => Number.parseInt(pair, 16));
    return (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color.trim());
  if (rgb) {
    const [r, g, b] = rgb[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
    if (r && g && b) return (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return null;
}

function markRadius(family: PortfolioWorldFamily) {
  return portfolioNodeMarkRadius(family, family === "identity" ? BRADLEY_MARK_SIZE : MARK_SIZE);
}

/**
 * While nodes travel, a line's start can jump the moment its ray starts or
 * stops crossing a label box. Each end remembers where it last started and
 * eases toward the new point, so the envelope takes hold smoothly rather
 * than snapping; a line may cross a label for a few frames mid-motion, which
 * is accepted.
 */
export type ConnectorMemory = Map<string, Point>;
const ANCHOR_EASE = 0.18;

function easeAnchor(memory: ConnectorMemory | undefined, key: string, point: Point): Point {
  if (!memory) return point;
  const previous = memory.get(key);
  const next = previous
    ? {
        x: previous.x + (point.x - previous.x) * ANCHOR_EASE,
        y: previous.y + (point.y - previous.y) * ANCHOR_EASE,
      }
    : point;
  memory.set(key, next);
  return next;
}

/**
 * Where a line leaves a node, heading for `toward`. The visible segment stays
 * on the relationship's ray and starts beyond the mark or label envelope.
 * Stable spotlight placement keeps the selected node's ray clear of its
 * label; this clipping remains the fallback during motion and dragging.
 */
function lineStart(node: ConnectorAnchor, toward: Point): Point {
  const dx = toward.x - node.x;
  const dy = toward.y - node.y;
  const distance = Math.hypot(dx, dy);
  if (!distance) return { x: node.x, y: node.y };
  const direction = { x: dx / distance, y: dy / distance };
  const radius = markRadius(node.family);
  const label = node.labelBox ?? null;
  const inset = envelopeInset(node, radius, label, direction, CONNECTOR_CLEARANCE);
  return { x: node.x + direction.x * inset, y: node.y + direction.y * inset };
}

/** The visible run of a line between two envelopes, or null when they touch. */
export function connectorSegment(
  from: ConnectorAnchor,
  to: ConnectorAnchor,
  memory?: ConnectorMemory,
  key = "",
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (!distance) return null;
  // Each end starts toward where the other actually starts; one more pass
  // settles the first end against the second envelope.
  const end = lineStart(to, lineStart(from, to));
  const start = lineStart(from, end);
  const along = ((end.x - start.x) * dx + (end.y - start.y) * dy) / distance;
  if (along <= 0) return null;
  return {
    start: easeAnchor(memory, `${key}:from`, start),
    end: easeAnchor(memory, `${key}:to`, end),
  };
}

/**
 * Where drawNode will paint a node's label this frame, in screen space, or
 * null when it paints none. Mirrors drawNode's geometry exactly; the two
 * must move together.
 */
function labelBoxFor(
  node: RuntimeNode,
  palette: Pick<
    WorldPalette,
    "compact" | "hoveredNodeId" | "selectedNodeId" | "width" | "resting"
  >,
): LayoutBox | null {
  const point = node.screen;
  if (!point || node.labelLines.length === 0) return null;
  const compact = palette.compact && !palette.resting;
  const showLabel = shouldShowLabel(node, palette);
  if (!showLabel) return null;
  const isBradley = node.id === "bradley";
  const scale = palette.compact ? COMPACT_LABEL_SCALE : isBradley ? BRADLEY_LABEL_SCALE : 1;
  const width = node.labelWidth * scale;
  const lineHeight = palette.compact ? COMPACT_LINE_HEIGHT : LABEL_LINE_HEIGHT;
  const height = node.labelLines.length * lineHeight;
  if (!compact) {
    return {
      x: point.x - width / 2,
      y: point.y + (isBradley ? BRADLEY_LABEL_TOP : LABEL_TOP),
      width,
      height,
    };
  }
  const onRight = compactLabelOnRight(point.x, palette.width);
  return {
    x: onRight ? point.x + COMPACT_LABEL_INSET : point.x - COMPACT_LABEL_INSET - width,
    y: point.y - height / 2,
    width,
    height,
  };
}

/**
 * The same geometry as `labelBoxFor`, split per painted line. A two-line label
 * whose lines differ in width leaves a wide dead margin beside the short one;
 * clipping connectors against the block made the clearance look far larger
 * than the text it was protecting.
 */
function labelLineBoxesFor(
  node: RuntimeNode,
  palette: Parameters<typeof labelBoxFor>[1],
): LayoutBox[] {
  const block = labelBoxFor(node, palette);
  if (!block || node.labelLineWidths.length !== node.labelLines.length) {
    return block ? [block] : [];
  }
  const scale = palette.compact
    ? COMPACT_LABEL_SCALE
    : node.id === "bradley"
      ? BRADLEY_LABEL_SCALE
      : 1;
  const lineHeight = palette.compact ? COMPACT_LINE_HEIGHT : LABEL_LINE_HEIGHT;
  const centre = block.x + block.width / 2;
  return node.labelLineWidths.map((lineWidth, index) => {
    const width = lineWidth * scale;
    return {
      x: centre - width / 2,
      y: block.y + index * lineHeight,
      width,
      height: lineHeight,
    };
  });
}

const overview = {
  position: { x: 0, y: 35, z: -760 },
  target: { x: 0, y: 0, z: 760 },
};
/**
 * Every spotlight state is one composition: Bradley stays at twelve o'clock,
 * the spotlit node — a Story or any record — hangs beneath him on the
 * trunk, and its relations land in zones around it (see
 * lib/portfolio-world-zones): an authored zone map for the large Stories,
 * the loose fan for up to four relations, the star for more. Grouping and
 * order are rules; the session seed picks the exact pose, so a record
 * returns to the same pose within a visit and a fresh one on reload.
 * Offsets are world units: +x is screen-left, +y is up.
 */
const LOOSE_GOAL: Point3 = { x: 20, y: -30, z: 660 };
const STAR_GOAL: Point3 = { x: 20, y: -150, z: 660 };
/** How far the spotlit node may wander from its lean, in world units. */
export const SPOTLIGHT_JITTER = { x: 30, y: 20 };

if (typeof window !== "undefined") {
  // One seed per page load; `?seed=` pins it while developing.
  const pinned = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get("seed")
    : null;
  setWorldSeed(pinned ? Number(pinned) : Math.floor(Math.random() * 4294967296));
}

export type SpotlightComposition = {
  bradley: Point3;
  spotlight: Point3;
  related: Map<string, Point3>;
};

/**
 * Each spotlit node lands as its own composition, not the same tree with the
 * relations swapped: it settles part-way back toward where it rests, and
 * Bradley leans a little the same way, so the trunk tilts and both move
 * again on every switch.
 */
const STAR_LEAN = 0.3;
const LOOSE_LEAN = 0.85;
const BRADLEY_LEAN = 0.12;
/** The spotlit node never hangs further than this to either side of Bradley. */
export const MAX_SPOTLIGHT_LEAN = 300;
/** Bradley always leans at least this far, so the lean reads as intended. */
export const BRADLEY_MIN_LEAN = 70;

export type SpotlightOptions = {
  /** The record's signature: rotates the loose fan's seating. */
  signature?: number;
  /** Half label widths in world units, so wide labels clear the trunk. */
  labelHalfWidths?: ReadonlyMap<string, number>;
  familyOf?: (id: string) => string | undefined;
};

export function composeSpotlightGoals(
  bradleyBase: Point3,
  spotlightBase: Point3,
  relatedIds: readonly string[],
  zoneMap?: ZoneMap,
  rng: Rng = stillRng,
  { signature = 0, labelHalfWidths, familyOf }: SpotlightOptions = {},
): SpotlightComposition {
  const dx = spotlightBase.x - bradleyBase.x;
  const lean = Math.sign(dx || 1) * Math.max(Math.abs(dx) * BRADLEY_LEAN, BRADLEY_MIN_LEAN);
  const bradley = { ...clone(bradleyBase), x: bradleyBase.x + lean };
  const related = new Map<string, Point3>();
  const fill = (anchor: Point3, zones: readonly Zone[]) => {
    for (const zone of zones) {
      for (const [id, point] of placeInZone(anchor, zone, rng)) {
        related.set(id, clearTrunkCone(anchor, bradley, point, labelHalfWidths?.get(id) ?? 0));
      }
    }
  };

  if (zoneMap) {
    const spotlight = placeOne(bradleyBase, zoneMap.spotlight, rng);
    fill(spotlight, zoneMap.zones);
    // Anything the map leaves out hangs straight below rather than vanishing.
    for (const id of relatedIds) {
      if (!related.has(id)) related.set(id, polarPoint(spotlight, 90, 400));
    }
    return { bradley, spotlight, related };
  }

  const loose = relatedIds.length <= LOOSE_LIMIT;
  const signed = () => rng() * 2 - 1;
  const shift = Math.max(
    -MAX_SPOTLIGHT_LEAN,
    Math.min(MAX_SPOTLIGHT_LEAN, dx * (loose ? LOOSE_LEAN : STAR_LEAN)),
  );
  const spotlight = {
    ...(loose ? LOOSE_GOAL : STAR_GOAL),
    x: bradleyBase.x + shift + signed() * SPOTLIGHT_JITTER.x,
  };
  spotlight.y += signed() * SPOTLIGHT_JITTER.y;
  fill(
    spotlight,
    loose
      ? looseZones(
          relatedIds,
          signature % Math.max(1, relatedIds.length),
          trunkTilt(spotlight, bradley),
        )
      : starZones(familyOf ? groupByFamily(relatedIds, familyOf) : relatedIds, familyOf),
  );
  return { bradley, spotlight, related };
}

/**
 * Selecting Bradley at rest is its own micro-state rather than a no-op: the
 * tree opens a little around him and the field reseats, and both close
 * again when he is deselected. Every map click moves something.
 */
export const BRADLEY_SPOTLIGHT_SPREAD = 1.08;

export function spreadFrom(root: Point3, base: Point3, scale: number): Point3 {
  return {
    x: root.x + (base.x - root.x) * scale,
    y: root.y + (base.y - root.y) * scale,
    z: base.z,
  };
}

/**
 * Where the records outside a composition go: the field
 * (lib/portfolio-world-field), dispersed evenly across the map behind the
 * composition, in the room the lit nodes and their lines leave free. They
 * stay present and clickable but never sit under a spotlit node.
 */
function fieldGoals(
  nodes: readonly RuntimeNode[],
  lit: ReadonlyMap<string, Point3>,
  links: readonly (readonly [string, string])[],
  camera: { position: Point3; target: Point3 },
  fov: number,
  viewport: { width: number; height: number },
  measure: (value: string) => number,
  rng: Rng,
): Map<string, Point3> {
  const project = (point: Point3) =>
    projectWorldPoint(point, camera.position, camera.target, fov, viewport.width, viewport.height);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const screens = new Map<string, Point>();
  const litPoints: FieldLit[] = [];
  for (const [id, point] of lit) {
    const screen = project(point);
    if (!screen) continue;
    screens.set(id, screen);
    const node = byId.get(id);
    // Anchors without a node (the tree's junction) only carry lines.
    if (!node) continue;
    litPoints.push({
      point: screen,
      halfWidth: Math.min(measure(node.label), LABEL_MAX_WIDTH) / 2,
    });
  }
  const lines: Segment[] = [];
  for (const [from, to] of links) {
    const a = screens.get(from);
    const b = screens.get(to);
    if (a && b) lines.push([a, b]);
  }
  const dimmed: FieldDimmed[] = [];
  for (const node of nodes) {
    if (lit.has(node.id)) continue;
    const rest = project(node.base);
    dimmed.push({ id: node.id, rest: rest ?? { x: viewport.width / 2, y: viewport.height / 2 } });
  }
  const targets = fieldScreenTargets(dimmed, litPoints, lines, viewport, rng);
  return new Map(
    [...targets].map(([id, target]) => [
      id,
      worldPointAtDepth(
        target,
        FIELD.depth,
        camera.position,
        camera.target,
        fov,
        viewport.width,
        viewport.height,
      ),
    ]),
  );
}

function createRuntimeNodes(): RuntimeNode[] {
  // The first frame is the resting composition, so the field starts dimmed
  // rather than fading down from full strength on load.
  const resting = getWorldFocusIds({ activeThreadId: null, selectedId: null });
  return portfolioWorldNodes.map((node) => {
    const { x: screenX, y: screenY, z } = node.position;
    const point = { x: (50 - screenX) * 18, y: (50 - screenY) * 18, z };
    const alpha = resting.has(node.id) ? 1 : REST_FIELD_ALPHA;
    return {
      ...node,
      alpha,
      base: clone(point),
      goal: clone(point),
      goalAlpha: alpha,
      labelBox: null,
      labelLines: [node.label],
      point: clone(point),
      rawBase: clone(point),
      screen: null,
      labelWidth: 0,
      labelLineWidths: [],
      labelLineBoxes: [],
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
  resting?: boolean;
  connector: string;
  editingNodeId: string | undefined;
  hoveredNodeId: string | undefined;
  ink: string;
  register: (name: string) => string;
  selectedNodeId: string | undefined;
  width: number;
};

function readWorldPalette(world: HTMLElement, width: number): WorldPalette {
  const style = getComputedStyle(world);
  const registers = new Map<string, string>();
  return {
    compact: world.dataset.compact === "true",
    resting: !world.dataset.selectedNode || world.dataset.selectedNode === "bradley",
    connector: cssColor(style, "--map-connector", "#4f585d"),
    editingNodeId: world.dataset.editingLabel,
    hoveredNodeId: world.dataset.hoveredNode,
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

function shouldShowLabel(
  node: Pick<RuntimeNode, "family" | "id">,
  palette: Pick<WorldPalette, "compact" | "hoveredNodeId" | "selectedNodeId" | "resting">,
) {
  return (
    palette.resting ||
    !palette.compact ||
    node.id === "bradley" ||
    node.family === "story" ||
    palette.selectedNodeId === node.id ||
    palette.hoveredNodeId === node.id
  );
}

function compactLabelOnRight(x: number, width: number) {
  return x < width * 0.3;
}

function cssColor(style: CSSStyleDeclaration, variable: string, fallback: string) {
  return style.getPropertyValue(variable).trim() || fallback;
}

export function PortfolioWorld({
  activeThreadId,
  brainFood,
  compact = false,
  nodesInTabOrder = true,
  onReset,
  onSelect,
  registerAvatarStage,
  selectedId,
}: PortfolioWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const brainFoodRef = useRef(brainFood);
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
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const measureRef = useRef<(value: string) => number>((value) => value.length * 6.2);
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
    brainFoodRef.current = brainFood;
  }, [brainFood]);

  useEffect(() => {
    focusRef.current = focusIds;
    linksRef.current = links;
  }, [focusIds, links]);

  useEffect(() => {
    if (typeof Image === "undefined") return;
    const image = new Image();
    const cache = brainCache.current;
    image.src = "/glyph-textures/circle.svg";
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

    if (brainFood?.active) {
      applyRestGoals(
        nodes,
        compact,
        size.current,
        camera.current,
        measureRef.current,
      );
      for (const node of nodes) node.goalAlpha = 1;
      return;
    }

    if (activeStory) {
      // A Story is its own composition: Bradley's tree with the members
      // placed around the chosen Story (composeSpotlightGoals).
      if (previous.activeThreadId !== activeThreadId) {
        applyStoryGoals(
          nodes,
          activeStory.id,
          size.current,
          camera.current,
          measureRef.current,
          byId.get("bradley")?.goal,
        );
      }
      return;
    }

    // Rest and Bradley are one composition: the authored tree, Bradley and
    // the Stories and field at full strength, the overview camera.
    if (isRestingWorldSelection(selectedId)) {
      applyRestGoals(
        nodes,
        compact,
        size.current,
        camera.current,
        measureRef.current,
      );
      return;
    }

    applyRecordGoals(
      nodes,
      selectedId,
      size.current,
      camera.current,
      measureRef.current,
      byId.get("bradley")?.goal,
    );
  }, [activeThreadId, brainFood?.active, compact, focusIds, selectedId]);

  useEffect(() => {
    const world = worldRef.current;
    const canvas = canvasRef.current;
    if (!world || !canvas) return;
    const context = canvas.getContext?.("2d") ?? null;
    let frame = 0;
    let disposed = false;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    let reduceMotion = motion?.matches ?? false;
    let worldOrigin = { x: 0, y: 0 };

    const measure = (value: string) => {
      if (!context) return value.length * 6.2;
      context.font = FONT;
      return context.measureText(value).width;
    };
    measureRef.current = measure;

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
          pinned: node.id === "bradley" || node.family === "story",
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
        // The slot is the whole canvas: nothing floats over its bottom edge in
        // the Reading Room, so the composition uses the full height.
        margins: { left: 12, right: 12, top: 18, bottom: 18 },
        bounds: { x: 940, y: 540, z: [480, 1120] },
      });
      centreComposition(working, camera.current.fov, width, height);

      nodes.forEach((node) => {
        node.base = clone(working.get(node.id)!);
        if (!state.current.selectedId && !state.current.activeThreadId) {
          node.point = clone(node.base);
          node.goal = clone(node.base);
        }
      });
    };

    const resize = (observedBounds?: Pick<DOMRectReadOnly, "height" | "width">) => {
      const elementBounds = world.getBoundingClientRect();
      const bounds = observedBounds ?? elementBounds;
      worldOrigin = { x: elementBounds.left, y: elementBounds.top };
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
      if (brainFoodRef.current?.active) {
        applyRestGoals(runtime.current, world.dataset.compact === "true", size.current, camera.current, measure);
        for (const node of runtime.current) node.goalAlpha = 1;
      } else if (state.current.activeThreadId) {
        applyStoryGoals(
          runtime.current,
          state.current.activeThreadId,
          size.current,
          camera.current,
          measure,
        );
      } else if (!isRestingWorldSelection(state.current.selectedId)) {
        applyRecordGoals(
          runtime.current,
          state.current.selectedId,
          size.current,
          camera.current,
          measure,
        );
      } else {
        applyRestGoals(
          runtime.current,
          world.dataset.compact === "true",
          size.current,
          camera.current,
          measure,
        );
      }
    };

    resize();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) => {
            const entry = entries.find(({ target }) => target === world);
            resize(entry?.contentRect);
          });
    const resizeFromViewport = () => resize();
    if (observer) observer.observe(world);
    else window.addEventListener("resize", resizeFromViewport);
    const updateMotion = () => {
      reduceMotion = motion?.matches ?? false;
    };
    motion?.addEventListener?.("change", updateMotion);

    let lastLabelWidth = -1;
    let lastResting: boolean | undefined;
    const connectorMemory: ConnectorMemory = new Map();
    const render = () => {
      // Read before the node buttons are written below, so the reads land on
      // clean style instead of forcing a recalculation per node.
      const palette = readWorldPalette(world, size.current.width);
      const { width, height } = size.current;
      const labelWidth = palette.resting ? (width < 400 ? 64 : Math.min(132, width * 0.24)) / (palette.compact ? COMPACT_LABEL_SCALE : 1) : palette.compact ? 96 : LABEL_MAX_WIDTH;
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
        // Re-wrap only when the available width has changed.
        if (labelWidth !== lastLabelWidth || palette.resting !== lastResting) {
          const label = palette.resting ? portfolioOverviewNodeLabel(node.label) : node.label;
          node.labelLines = palette.resting && node.id !== "bradley"
            ? portfolioOverviewLabel(label, measure, labelWidth)
            : wrapLabel(label, measure, node.id === "bradley" ? 160 : labelWidth);
          node.labelLineWidths = node.labelLines.map(measure);
          node.labelWidth = Math.max(...node.labelLineWidths);
        }
        node.labelBox = labelBoxFor(node, palette);
        node.labelLineBoxes = labelLineBoxesFor(node, palette);
        const button = buttonRefs.current.get(node.id);
        if (button && node.screen) {
          button.style.left = `${(node.screen.x / width) * 100}%`;
          button.style.top = `${(node.screen.y / height) * 100}%`;
          // Every drawn node is a target, the dimmed field included: a click
          // on any record lands on that record instead of falling through to
          // the surface and resetting the map.
          button.style.pointerEvents = brainFoodRef.current?.active
            ? "none"
            : "auto";
        }
      }

      if (brainFoodRef.current) {
        brainFoodRef.current.syncNodePositions(
          nodes.flatMap((node) =>
            node.screen
              ? [{
                  id: node.id,
                  x: worldOrigin.x + node.screen.x,
                  y: worldOrigin.y + node.screen.y,
                  radius: Math.max(22, markRadius(node.family)),
                }]
              : [],
          ),
        );
      }

      if (context) {
        context.clearRect(0, 0, width, height);
        const eaten = brainFoodRef.current?.active
          ? brainFoodRef.current.eatenIds
          : new Set<string>();
        if (!brainFoodRef.current?.active) {
          drawLinks(
            context,
            nodes,
            linksRef.current,
            active.selectedId,
            palette,
            connectorMemory,
          );
        }
        const sorted = [...nodes].sort(
          (a, b) => (b.screen?.depth ?? 0) - (a.screen?.depth ?? 0),
        );
        for (const node of sorted) {
          if (eaten.has(node.id)) continue;
          drawNode(context, node, palette, brainImage.current, brainCache.current);
        }
      }
      lastLabelWidth = labelWidth;
      lastResting = palette.resting;
      if (!disposed) frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", resizeFromViewport);
      motion?.removeEventListener?.("change", updateMotion);
    };
  }, []);

  function beginNodeDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: PortfolioWorldNode,
  ) {
    if (brainFoodRef.current?.active || event.button !== 0) return;
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
    if (brainFoodRef.current?.active) return;
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    const dx = event.clientX - active.last.x;
    const dy = event.clientY - active.last.y;
    if (Math.hypot(event.clientX - active.start.x, event.clientY - active.start.y) > 6) {
      active.moved = true;
    }
    const node = runtime.current.find(({ id }) => id === active.id);
    if (!node?.screen) return;
    // The goal stays put: a dragged node follows the pointer while held and
    // springs back to its composition on release.
    node.point = translateWorldPointByScreenDelta(
      node.point,
      node.screen.scale,
      dx,
      dy,
      camera.current.position,
      camera.current.target,
    );
    active.last = { x: event.clientX, y: event.clientY };
  }

  function endPointer(event: ReactPointerEvent<HTMLElement>) {
    if (brainFoodRef.current?.active) return;
    const active = drag.current;
    if (active && active.pointerId === event.pointerId) {
      drag.current = null;
      if (!active.moved) {
        const selected = portfolioWorldNodeById.get(active.id);
        if (selected) onSelect(selected);
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

  return (
    <section
      aria-label="Spatial portfolio world"
      className="portfolio-world"
      tabIndex={-1}
      data-active-thread={activeThreadId ?? undefined}
      data-compact={compact ? "true" : "false"}
      data-hovered-node={hoveredNodeId ?? undefined}
      data-selected-node={selectedId ?? undefined}
      data-brain-food={brainFood?.active ? "true" : "false"}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (
          brainFood?.active ||
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
      <div aria-hidden="true" className="portfolio-world-mast">
        {portfolioInterfaceText["world.mast"]}
      </div>
      {brainFood?.active ? (
        <p aria-live="polite" className="portfolio-world-brain-food-status">
          Brain Food · {brainFood.remaining} left · Arrows/WASD · Esc exits
        </p>
      ) : null}
      {portfolioWorldNodes.filter(
        (node) => !brainFood?.active || !brainFood.eatenIds.has(node.id),
      ).map((node) => (
        <button
          aria-label={`${node.kind} ${node.label}`}
          aria-pressed={selectedId === node.id}
          className="portfolio-world-node"
          data-cursor-color={`--world-${node.register}`}
          data-family={node.family}
          data-status={node.status}
          data-world-node={node.id}
          disabled={Boolean(brainFood?.active)}
          key={node.id}
          onClick={(event) => {
            if (event.detail === 0) onSelect(node);
          }}
          onPointerDown={(event) => beginNodeDrag(event, node)}
          onPointerEnter={() => setHoveredNodeId(node.id)}
          onPointerLeave={() =>
            setHoveredNodeId((current) =>
              current === node.id ? null : current
            )
          }
          ref={(element) => {
            if (element) buttonRefs.current.set(node.id, element);
            else buttonRefs.current.delete(node.id);
          }}
          tabIndex={nodesInTabOrder ? undefined : -1}
          type="button"
        />
      ))}
    </section>
  );
}

/** Records outside the composition sit in the field at this alpha. */
const FIELD_ALPHA = 0.14;

/**
 * Apply the selected record's label box as a placement constraint after the
 * overlap solver has settled the composition. Related nodes keep their side
 * and screen distance, including valid seats below the record; only a ray
 * that would cross the label turns far enough to clear its top corner.
 */
export function clearSpotlightLabelRays({
  camera,
  label,
  measure,
  related,
  relatedLabels,
  spotlight,
  viewport,
}: {
  camera: { position: Point3; target: Point3; fov: number };
  label: string;
  measure: (value: string) => number;
  related: ReadonlyMap<string, Point3>;
  relatedLabels?: ReadonlyMap<string, string>;
  spotlight: Point3;
  viewport: { width: number; height: number };
}): Map<string, Point3> {
  const origin = projectWorldPoint(
    spotlight,
    camera.position,
    camera.target,
    camera.fov,
    viewport.width,
    viewport.height,
  );
  if (!origin) return new Map(related);
  const lines = wrapLabel(label, measure);
  const width = Math.min(
    LABEL_MAX_WIDTH,
    Math.max(...lines.map((line) => measure(line))),
  );
  const labelBox = {
    x: origin.x - width / 2,
    y: origin.y + LABEL_TOP,
    width,
    height: lines.length * LABEL_LINE_HEIGHT,
  };
  const projectedRelations = [...related].map(([id, point]) => {
    const projected = projectWorldPoint(
      point,
      camera.position,
      camera.target,
      camera.fov,
      viewport.width,
      viewport.height,
    );
    if (!projected) {
      return { id, point, projected: null, cleared: null, originCrossed: false };
    }
    const originCleared = clearLabelRay(
      origin,
      projected,
      labelBox,
      CONNECTOR_CLEARANCE,
    );
    const originCrossed =
      originCleared.x !== projected.x || originCleared.y !== projected.y;
    return { id, point, projected, cleared: originCleared, originCrossed };
  });

  // Several same-side rays can all clamp to one label corner. Keep the
  // closest one there and fan the rest farther outward by their label widths,
  // preserving every relation's radius and side.
  for (const side of [-1, 1] as const) {
    const crossing = projectedRelations
      .filter(({ projected, cleared, originCrossed }) =>
        projected &&
        cleared &&
        originCrossed &&
        Math.sign(projected.x - origin.x) === side,
      )
      .map((entry) => {
        const relatedLabel = relatedLabels?.get(entry.id) ?? entry.id;
        const lines = wrapLabel(relatedLabel, measure);
        const labelWidth = Math.min(
          LABEL_MAX_WIDTH,
          Math.max(...lines.map((line) => measure(line))),
        );
        return {
          ...entry,
          angle: Math.atan2(
            entry.projected!.y - origin.y,
            entry.projected!.x - origin.x,
          ),
          clearedAngle: Math.atan2(
            entry.cleared!.y - origin.y,
            entry.cleared!.x - origin.x,
          ),
          distance: Math.hypot(
            entry.projected!.x - origin.x,
            entry.projected!.y - origin.y,
          ),
          halfWidth: Math.max(15, labelWidth / 2),
        };
      })
      .sort((a, b) => side > 0 ? a.angle - b.angle : b.angle - a.angle);

    for (let index = 1; index < crossing.length; index += 1) {
      const previous = crossing[index - 1]!;
      const current = crossing[index]!;
      const separation = previous.halfWidth + current.halfWidth + 8;
      const radius = Math.max(1, Math.min(previous.distance, current.distance));
      const angularGap = 2 * Math.asin(Math.min(0.98, separation / (2 * radius)));
      const unclamped = previous.clearedAngle - side * angularGap;
      current.clearedAngle = side > 0
        ? Math.max(-Math.PI / 2 + 0.01, unclamped)
        : Math.min(Math.PI * 1.5 - 0.01, unclamped);
      current.cleared = {
        x: origin.x + Math.cos(current.clearedAngle) * current.distance,
        y: origin.y + Math.sin(current.clearedAngle) * current.distance,
      };
      const source = projectedRelations.find(({ id }) => id === current.id);
      if (source) source.cleared = current.cleared;
    }
  }

  return new Map(
    projectedRelations.map(({ id, point, projected, cleared }) => {
      if (!projected || !cleared) return [id, point];
      if (cleared.x === projected.x && cleared.y === projected.y) return [id, point];
      return [
        id,
        worldPointAtDepth(
          cleared,
          projected.depth,
          camera.position,
          camera.target,
          camera.fov,
          viewport.width,
          viewport.height,
        ),
      ];
    }),
  );
}

/** Keep every relation label off the trunk and every other relation's line. */
export function clearSpotlightLineLabels({
  bradley,
  camera,
  measure,
  related,
  relatedLabels,
  spotlight,
  viewport,
}: {
  bradley: Point3;
  camera: { position: Point3; target: Point3; fov: number };
  measure: (value: string) => number;
  related: ReadonlyMap<string, Point3>;
  relatedLabels: ReadonlyMap<string, string>;
  spotlight: Point3;
  viewport: { width: number; height: number };
}): Map<string, Point3> {
  const project = (point: Point3) =>
    projectWorldPoint(
      point,
      camera.position,
      camera.target,
      camera.fov,
      viewport.width,
      viewport.height,
    );
  const root = project(bradley);
  const spot = project(spotlight);
  if (!root || !spot) return new Map(related);
  const bradleyLines = wrapLabel("Bradley Berkman", measure);
  const trunkStart = {
    x: root.x,
    y:
      root.y +
      BRADLEY_LABEL_TOP +
      bradleyLines.length * LABEL_LINE_HEIGHT +
      CONNECTOR_CLEARANCE,
  };
  const junction = storyTreeJunction(trunkStart, [spot]);
  const working = new Map(related);

  for (let pass = 0; pass < 4; pass += 1) {
    const projected = new Map(
      [...working].flatMap(([id, point]) => {
        const screen = project(point);
        return screen ? [[id, screen] as const] : [];
      }),
    );
    const obstacles: Array<{ line: Segment; incidentId?: string }> = [
      { line: [trunkStart, junction] },
      { line: [junction, spot] },
      ...[...projected].map(([id, point]) => ({
        line: [spot, point] as Segment,
        incidentId: id,
      })),
    ];
    let moved = false;

    for (const id of working.keys()) {
      const original = projected.get(id);
      if (!original) continue;
      const label = relatedLabels.get(id) ?? id;
      const lines = wrapLabel(label, measure);
      const width = Math.min(
        LABEL_MAX_WIDTH,
        Math.max(...lines.map((line) => measure(line))),
      );
      const target = { x: original.x, y: original.y };
      for (const obstacle of obstacles) {
        if (obstacle.incidentId === id) continue;
        const box = {
          left: target.x - width / 2,
          top: target.y + LABEL_TOP,
          right: target.x + width / 2,
          bottom: target.y + LABEL_TOP + lines.length * LABEL_LINE_HEIGHT,
        };
        const shift = segmentRectClearanceShift(obstacle.line, box, 8);
        target.x += shift.x;
        target.y += shift.y;
      }
      if (target.x === original.x && target.y === original.y) continue;
      working.set(
        id,
        worldPointAtDepth(
          target,
          original.depth,
          camera.position,
          camera.target,
          camera.fov,
          viewport.width,
          viewport.height,
        ),
      );
      moved = true;
    }
    if (!moved) break;
  }
  return working;
}

function applySpotlightGoals(
  nodes: RuntimeNode[],
  spotlightId: string,
  relatedIds: readonly string[],
  focusIds: Set<string>,
  dimensions: { width: number; height: number },
  camera: Camera,
  measure: (value: string) => number,
  /** Bradley's goal in the composition being left, when this is a new one. */
  bradleyFrom?: Point3,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const bradleyBase = byId.get("bradley")?.base ?? STAR_GOAL;
  const spotlightBase = byId.get(spotlightId)?.base ?? bradleyBase;
  const rng = compositionRng(spotlightId);
  // Pixels per world unit at the composition's depth, for label widths.
  const scale = (() => {
    const project = (x: number) =>
      projectWorldPoint(
        { x, y: 0, z: ZONE_DEPTH },
        overview.position,
        overview.target,
        camera.fov,
        dimensions.width,
        dimensions.height,
      );
    const a = project(0);
    const b = project(100);
    return a && b ? Math.abs(b.x - a.x) / 100 : 0.41;
  })();
  const labelHalfWidths = new Map(
    nodes.map((node) => [
      node.id,
      Math.min(measure(node.label), LABEL_MAX_WIDTH) / 2 / Math.max(0.05, scale),
    ]),
  );
  const composition = composeSpotlightGoals(
    bradleyBase,
    spotlightBase,
    relatedIds,
    AUTHORED_ZONES[spotlightId],
    rng,
    {
      signature: Math.max(0, nodes.findIndex((node) => node.id === spotlightId)),
      labelHalfWidths,
      familyOf: (id) => byId.get(id)?.family,
    },
  );
  // Every new composition moves Bradley by a legible amount.
  const bradleyGoal = ensureShift(bradleyFrom, composition.bradley, MIN_SHIFT, {
    x: Math.sign(composition.bradley.x - bradleyBase.x || 1),
    y: 0,
  });
  const lit = new Map<string, Point3>([
    ["bradley", bradleyGoal],
    [spotlightId, composition.spotlight],
    ...composition.related,
  ]);
  // Settle the lit composition first, so the field seats around where the
  // lit labels actually land; the field itself never enters the solver.
  const litNodes = nodes.filter((node) => lit.has(node.id));
  litNodes.forEach((node) => {
    node.goal = clone(lit.get(node.id)!);
  });
  relaxGoals(litNodes, {
    pinned: new Set(["bradley", spotlightId]),
    spotlit: focusIds,
    camera: overview,
    fov: camera.fov,
    dimensions,
    measure,
  });
  const spotlightNode = byId.get(spotlightId);
  if (spotlightNode) {
    const relatedLabels = new Map(
      relatedIds.flatMap((id) => {
        const node = byId.get(id);
        return node ? [[id, node.label] as const] : [];
      }),
    );
    const cleared = clearSpotlightLabelRays({
      camera: { ...overview, fov: camera.fov },
      label: spotlightNode.label,
      measure,
      related: new Map(
        relatedIds.flatMap((id) => {
          const node = byId.get(id);
          return node ? [[id, node.goal] as const] : [];
        }),
      ),
      relatedLabels,
      spotlight: spotlightNode.goal,
      viewport: dimensions,
    });
    const lineCleared = clearSpotlightLineLabels({
      bradley: bradleyGoal,
      camera: { ...overview, fov: camera.fov },
      measure,
      related: cleared,
      relatedLabels,
      spotlight: spotlightNode.goal,
      viewport: dimensions,
    });
    for (const [id, point] of lineCleared) {
      const node = byId.get(id);
      if (node) node.goal = point;
    }
  }
  litNodes.forEach((node) => lit.set(node.id, clone(node.goal)));
  const field = fieldGoals(
    nodes,
    lit,
    [["bradley", spotlightId], ...relatedIds.map((id) => [spotlightId, id] as const)],
    overview,
    camera.fov,
    dimensions,
    measure,
    rng,
  );
  nodes.forEach((node) => {
    if (!lit.has(node.id)) node.goal = clone(field.get(node.id) ?? node.base);
    node.goalAlpha = focusIds.has(node.id) ? 1 : FIELD_ALPHA;
  });
  camera.goalPosition = clone(overview.position);
  camera.goalTarget = clone(overview.target);
}

/**
 * Rest and Bradley are one composition: the authored tree — Bradley and the
 * Stories and their connected field at full strength.
 * Selecting Bradley opens the tree a little and reseats the field, so the
 * click moves everything and deselecting closes it again.
 */
/**
 * Slides the whole rest composition along the camera's up axis so its
 * projected extent (marks plus the label footprint beneath them) sits in the
 * vertical middle of the slot. The poses were authored for a viewport whose
 * lower band held a floating chat; a Reading Room slot has no such band, and
 * a short slot otherwise stacks the composition against its top edge. When
 * the composition is taller than the slot, its top stays at the top margin.
 */
export function centreComposition(
  positions: Map<string, Point3>,
  fov: number,
  width: number,
  height: number,
  footprint: { top: number; bottom: number } = { top: 13, bottom: 31 },
  margin = 18,
) {
  const projected = [...positions.values()]
    .map((point) => projectWorldPoint(point, overview.position, overview.target, fov, width, height))
    .filter((point): point is NonNullable<typeof point> => point !== null);
  if (projected.length === 0) return;
  const top = Math.min(...projected.map((point) => point.y)) - footprint.top;
  const bottom = Math.max(...projected.map((point) => point.y)) + footprint.bottom;
  const centred = height / 2 - (top + bottom) / 2;
  const shiftPx = Math.max(centred, margin - top);
  if (Math.abs(shiftPx) < 0.5) return;
  const meanScale = projected.reduce((sum, point) => sum + point.scale, 0) / projected.length;
  const { up } = cameraBasis(overview.position, overview.target);
  // Screen y grows downward while the camera's up axis grows upward.
  const worldShift = -shiftPx / meanScale;
  for (const point of positions.values()) {
    point.x += up.x * worldShift;
    point.y += up.y * worldShift;
    point.z += up.z * worldShift;
  }
}

function applyRestGoals(
  nodes: RuntimeNode[],
  compact: boolean,
  dimensions: { width: number; height: number },
  camera: Camera,
  measure: (value: string) => number = value => value.length * 6.2,
) {
  if (!dimensions.width || !dimensions.height) return;
  const layout = portfolioOverviewPositions(nodes, dimensions, measure, compact);
  for (const node of nodes) {
    const screen = layout.positions.get(node.id);
    node.goal = screen ? worldPointAtDepth(screen, 1100, overview.position, overview.target, camera.fov, dimensions.width, dimensions.height) : clone(node.base);
    node.goalAlpha = REST_FIELD_ALPHA;
  }
  camera.goalPosition = clone(overview.position);
  camera.goalTarget = clone(overview.target);
}

/** A record's composition: the record beneath Bradley, its neighbours around it. */
function applyRecordGoals(
  nodes: RuntimeNode[],
  selectedId: string,
  dimensions: { width: number; height: number },
  camera: Camera,
  measure: (value: string) => number = (value) => value.length * 6.2,
  bradleyFrom?: Point3,
) {
  const focusIds = getWorldFocusIds({ activeThreadId: null, selectedId });
  const related = [...focusIds].filter((id) => id !== selectedId && id !== "bradley");
  applySpotlightGoals(
    nodes,
    selectedId,
    related,
    focusIds,
    dimensions,
    camera,
    measure,
    bradleyFrom,
  );
}

/** A Story's composition: the Story beneath Bradley, its members around it. */
function applyStoryGoals(
  nodes: RuntimeNode[],
  storyId: string,
  dimensions: { width: number; height: number },
  camera: Camera,
  measure: (value: string) => number = (value) => value.length * 6.2,
  bradleyFrom?: Point3,
) {
  const story = portfolioThreadById.get(storyId);
  if (!story) return;
  const focusIds = getWorldFocusIds({
    activeThreadId: story.id,
    selectedId: story.nodeId,
  });
  applySpotlightGoals(
    nodes,
    story.nodeId,
    story.members,
    focusIds,
    dimensions,
    camera,
    measure,
    bradleyFrom,
  );
}

/**
 * Settle a composition's goals so no label sits on another: the spine stays
 * put, spotlit nodes share pushes, and every dimmed node yields — it steps
 * out from under a spotlit one rather than hiding beneath it.
 */
function relaxGoals(
  nodes: RuntimeNode[],
  {
    pinned,
    spotlit,
    camera,
    fov,
    dimensions,
    measure,
  }: {
    pinned: Set<string>;
    spotlit: Set<string>;
    camera: { position: Point3; target: Point3 };
    fov: number;
    dimensions: { width: number; height: number };
    measure: (value: string) => number;
  },
) {
  const { width, height } = dimensions;
  if (!width || !height) return;
  const working = new Map(nodes.map((node) => [node.id, clone(node.goal)]));

  relaxWorldOverlaps({
    positions: working,
    nodes: nodes.map((node) => ({
      id: node.id,
      label: node.label,
      pinned: pinned.has(node.id),
      yielding: !spotlit.has(node.id),
    })),
    camera: { position: camera.position, target: camera.target, fov },
    viewport: { width, height },
    measure,
    wrap: (label, measureText) => wrapLabel(label, measureText),
    lineHeight: LABEL_LINE_HEIGHT,
    iterations: 160,
    padding: 8,
    minHalfWidth: 15,
    footprint: { top: 14, extraHeight: 34 },
    margins: { left: 18, right: 18, top: 18, bottom: 18 },
    // Wide enough to hold the field: a tighter clamp used to drag pushed
    // field nodes back into the composition.
    bounds: { x: 1600, y: 1600, z: [480, 1600] },
  });

  nodes.forEach((node) => {
    node.goal = clone(working.get(node.id)!);
  });
}

function drawLinks(
  context: CanvasRenderingContext2D,
  nodes: RuntimeNode[],
  links: ReturnType<typeof getVisibleWorldLinks>,
  selectedId: string | null,
  palette: WorldPalette,
  memory: ConnectorMemory,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const color = palette.connector;
  const tint = alphaColor(color);
  const stroke = (points: readonly Point[], alpha: number, active: boolean) => {
    if (points.length < 2) return;
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = palette.resting ? 0.7 : active ? 1.1 : 0.54;

    // A label-clipped end used to stop dead, so a line appeared to begin in
    // midair beside the text. Those ends ramp out instead; ends that are where
    // the relationship really stops still land flat.
    const fadeSegment = (segment: {
      start: Point;
      end: Point;
      fadeStart: boolean;
      fadeEnd: boolean;
    }) => {
      const length = Math.hypot(
        segment.end.x - segment.start.x,
        segment.end.y - segment.start.y,
      );
      if (length < 1e-3) return;
      const ramp = Math.min(CONNECTOR_FADE / length, 0.5);
      const gradient = context.createLinearGradient(
        segment.start.x,
        segment.start.y,
        segment.end.x,
        segment.end.y,
      );
      gradient.addColorStop(0, tint!(segment.fadeStart ? 0 : alpha));
      if (segment.fadeStart) gradient.addColorStop(ramp, tint!(alpha));
      if (segment.fadeEnd) gradient.addColorStop(1 - ramp, tint!(alpha));
      gradient.addColorStop(1, tint!(segment.fadeEnd ? 0 : alpha));
      context.globalAlpha = 1;
      context.strokeStyle = gradient;
      context.beginPath();
      context.moveTo(segment.start.x, segment.start.y);
      context.lineTo(segment.end.x, segment.end.y);
      context.stroke();
    };

    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    let pen = points[0];
    const faded: Parameters<typeof fadeSegment>[0][] = [];
    for (let index = 1; index < points.length; index++) {
      const segments = palette.resting
        ? overviewConnectorSegments(points[index - 1], points[index], nodes.flatMap(node => node.labelLineBoxes))
        : [{ start: points[index - 1], end: points[index], fadeStart: false, fadeEnd: false }];
      for (const segment of segments) {
        if (tint && (segment.fadeStart || segment.fadeEnd)) {
          faded.push(segment);
          continue;
        }
        if (segment.start.x !== pen.x || segment.start.y !== pen.y) context.moveTo(segment.start.x, segment.start.y);
        context.lineTo(segment.end.x, segment.end.y);
        pen = segment.end;
      }
    }
    context.stroke();
    for (const segment of faded) fadeSegment(segment);
    context.restore();
  };
  // There is always a spotlight — rest reads as Bradley — so a line is either
  // part of the current composition or nearly gone.
  const strengthOf = (active: boolean) => palette.resting ? 0.38 : active ? 0.78 : 0.025;
  const anchor = (node: RuntimeNode, screen: ProjectedPoint): ConnectorAnchor => ({
    x: screen.x,
    y: screen.y,
    family: node.family,
    // Overview label clipping happens per line in stroke(), including endpoints.
    labelBox: palette.resting ? null : node.labelBox,
  });

  const isRoot = (layer: (typeof links)[number]["layer"]) =>
    layer === "story-root" || layer === "spotlight-root";

  for (const link of links) {
    if (isRoot(link.layer)) continue;
    const from = byId.get(link.from);
    const to = byId.get(link.to);
    if (!from?.screen || !to?.screen) continue;
    const active = isWorldLinkActive(link, selectedId);
    const alpha = Math.min(from.alpha, to.alpha) * strengthOf(active);
    const segment = connectorSegment(
      anchor(from, from.screen),
      anchor(to, to.screen),
      memory,
      `${link.from}->${link.to}`,
    );
    if (segment) stroke([segment.start, segment.end], alpha, active);
  }

  // The Story lines are one tree: a trunk straight down from Bradley's mark
  // to a junction, then one straight branch per visible Story. The trunk
  // carries the strongest branch, so a single open Story still reads as
  // rooted on Bradley.
  const root = byId.get("bradley");
  const branches = links.flatMap((link) => {
    if (!isRoot(link.layer)) return [];
    const node = byId.get(link.to);
    if (!node?.screen) return [];
    const active = isWorldLinkActive(link, selectedId);
    return [{ node, screen: node.screen, active }];
  });
  if (!root?.screen || branches.length === 0) return;
  // The trunk leaves Bradley's envelope straight down: from under his label
  // on desktop, from the mark itself where the compact label sits beside it.
  const trunkStart = connectorSegment(
    anchor(root, root.screen),
    { x: root.screen.x, y: root.screen.y + 10000, family: root.family },
    memory,
    "trunk",
  )?.start ?? { x: root.screen.x, y: root.screen.y };
  const junction = storyTreeJunction(trunkStart, branches.map(({ screen }) => screen));
  const trunkActive = branches.some(({ active }) => active);
  const trunkAlpha = Math.max(
    ...branches.map(({ node, active }) =>
      Math.min(root.alpha, node.alpha) * strengthOf(active)),
  );
  const renderedBranches = branches.flatMap(({ node, screen, active }) => {
    const branch = connectorSegment(
      { x: junction.x, y: junction.y, family: root.family },
      anchor(node, screen),
      memory,
      `root->${node.id}`,
    );
    return branch
      ? [{
          active,
          alpha: Math.min(root.alpha, node.alpha) * strengthOf(active),
          end: branch.end,
        }]
      : [];
  });
  const primary = renderedBranches.reduce<(typeof renderedBranches)[number] | null>(
    (strongest, branch) => !strongest || branch.alpha > strongest.alpha ? branch : strongest,
    null,
  );
  if (!primary) {
    stroke([trunkStart, junction], trunkAlpha, trunkActive);
    return;
  }

  // The trunk and its strongest branch are one continuous path. A pair of
  // separately antialiased butt ends left a stair-stepped notch at this joint.
  stroke([trunkStart, junction, primary.end], trunkAlpha, trunkActive);
  for (const branch of renderedBranches) {
    if (branch === primary) continue;
    stroke([junction, branch.end], branch.alpha, branch.active);
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
  const size = (isBradley ? BRADLEY_MARK_SIZE : MARK_SIZE) * PORTFOLIO_GLYPH.artworkScale;
  const statusAlpha = node.status === "past" ? PAST_WORLD_ALPHA : 1;
  context.save();
  context.translate(point.x, point.y);
  context.globalAlpha = node.alpha * statusAlpha;
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = PORTFOLIO_NODE_MARK_STROKE * PORTFOLIO_GLYPH.artworkScale;
  context.lineJoin = PORTFOLIO_GLYPH.lineJoin;
  context.lineCap = PORTFOLIO_GLYPH.lineCap;

  for (const primitive of portfolioNodeMarkPrimitives(node.family, size)) {
    if (primitive.kind === "brain") {
      const glyph = tintedBrain(image, color, cache);
      if (glyph) {
        // The shared SVG has 18px of ink in a 20px surface. Preserve map ink size.
        const surfaceSize = size * 0.98 * (20 / 18);
        context.drawImage(
          glyph,
          -surfaceSize / 2,
          -surfaceSize / 2,
          surfaceSize,
          surfaceSize,
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

  const compact = palette.compact && !palette.resting;
  const showLabel = shouldShowLabel(node, palette);
  // While the map-label input is open its canvas text stays hidden so the
  // draft renders exactly once, in the input.
  if (!showLabel || palette.editingNodeId === node.id) return;

  context.save();
  context.globalAlpha = node.alpha * statusAlpha;
  context.font = palette.compact
    ? '400 11px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif'
    : isBradley
      ? BRADLEY_FONT
      : FONT;
  context.fillStyle = ink;
  context.textBaseline = "middle";
  const labelLineHeight = palette.compact ? 12 : LABEL_LINE_HEIGHT;
  const labelX = compact
    ? point.x + ((palette.resting || compactLabelOnRight(point.x, palette.width)) ? 12 : -12)
    : point.x;
  const labelY = compact
    ? point.y - ((node.labelLines.length - 1) * labelLineHeight) / 2
    : point.y + (isBradley ? BRADLEY_LABEL_TOP : LABEL_TOP) + labelLineHeight * 0.5;
  context.textAlign = compact
    ? palette.resting || compactLabelOnRight(point.x, palette.width)
      ? "left"
      : "right"
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
