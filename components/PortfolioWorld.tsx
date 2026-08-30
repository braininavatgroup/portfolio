"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  getVisibleWorldLinks,
  getWorldFocusIds,
  portfolioThreadById,
  portfolioWorldNodeById,
  portfolioWorldNodes,
  type PortfolioWorldFamily,
  type PortfolioWorldNode,
} from "../lib/portfolio-world";

type Point = { x: number; y: number };
type Point3 = Point & { z: number };
type ProjectedPoint = Point & { depth: number; scale: number };
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
  point: Point3;
  rawBase: Point3;
  screen: ProjectedPoint | null;
  userPlaced: boolean;
};

type PortfolioWorldProps = {
  activeThreadId: string | null;
  selectedId: string | null;
  onReset: () => void;
  onSelect: (node: PortfolioWorldNode) => void;
  registerAvatarStage?: (element: HTMLElement | null) => void;
};

const MARK_SIZE = 15;
const LABEL_MAX_WIDTH = 132;
const LABEL_LINE_HEIGHT = 15;
const FONT = '400 12.5px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif';

type ConnectorAnchor = Point & { family: PortfolioWorldFamily };

const closedMarkVertices: Partial<Record<PortfolioWorldFamily, readonly Point[]>> = {
  component: [
    { x: 0, y: -MARK_SIZE * 0.52 },
    { x: MARK_SIZE * 0.51, y: MARK_SIZE * 0.42 },
    { x: -MARK_SIZE * 0.51, y: MARK_SIZE * 0.42 },
  ],
  personal: [
    { x: -MARK_SIZE * 0.48, y: -MARK_SIZE * 0.48 },
    { x: MARK_SIZE * 0.48, y: -MARK_SIZE * 0.48 },
    { x: MARK_SIZE * 0.48, y: MARK_SIZE * 0.48 },
    { x: -MARK_SIZE * 0.48, y: MARK_SIZE * 0.48 },
  ],
  engagement: [
    { x: 0, y: -MARK_SIZE * 0.54 },
    { x: MARK_SIZE * 0.54, y: 0 },
    { x: 0, y: MARK_SIZE * 0.54 },
    { x: -MARK_SIZE * 0.54, y: 0 },
  ],
};

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
  if (family === "formative" || family === "product") return MARK_SIZE * 0.49;
  const vertices = closedMarkVertices[family];
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

export const portfolioOverviewLayout: Record<
  string,
  readonly [number, number, number]
> = {
  bradley: [48.88, 19.93, 646.71],
  "thread-making-work-playable": [35.34, 32.79, 698.43],
  "thread-choosing-what-not-to-automate": [63.3, 34.67, 719.72],
  "thread-finding-myself-in-software": [11.29, 53.66, 721.38],
  dubs: [18.73, 41.17, 859.1],
  writ: [21.19, 55.82, 898.83],
  kickoff: [81.31, 42.68, 838.89],
  pitching: [92.13, 54.87, 939.23],
  reporting: [70.78, 60.84, 902.14],
  "personal-os": [34.29, 60.66, 797.65],
  yoohoo: [52.43, 67.85, 881.72],
  infamous: [9.34, 71.43, 762.31],
  "music-practice": [25.41, 79.45, 822.3],
  "systems-consulting": [47.11, 81.46, 882.3],
  "real-estate": [76.49, 82.38, 919.84],
  touring: [93.41, 72.24, 990.31],
};

const storyLayouts: Record<
  string,
  { bradley: Point3; story: Point3; members: Record<string, Point3> }
> = {
  "making-work-playable": {
    bradley: { x: 560, y: 15, z: 540 },
    story: { x: 330, y: 10, z: 610 },
    members: {
      "personal-os": { x: -100, y: 230, z: 820 },
      dubs: { x: -320, y: 120, z: 820 },
      writ: { x: -340, y: -90, z: 820 },
      yoohoo: { x: -120, y: -220, z: 820 },
    },
  },
  "choosing-what-not-to-automate": {
    bradley: { x: 570, y: 10, z: 540 },
    story: { x: 350, y: 0, z: 610 },
    members: {
      kickoff: { x: 100, y: 200, z: 820 },
      pitching: { x: -120, y: 230, z: 820 },
      reporting: { x: -330, y: 110, z: 820 },
      "personal-os": { x: -340, y: -110, z: 820 },
      yoohoo: { x: -130, y: -230, z: 820 },
    },
  },
  "finding-myself-in-software": {
    bradley: { x: 680, y: 95, z: 500 },
    story: { x: 500, y: -75, z: 555 },
    members: {
      infamous: { x: 220, y: 240, z: 850 },
      "music-practice": { x: 0, y: 300, z: 850 },
      "systems-consulting": { x: -170, y: 330, z: 850 },
      kickoff: { x: -220, y: 260, z: 850 },
      pitching: { x: -400, y: 150, z: 850 },
      reporting: { x: -480, y: 0, z: 850 },
      "personal-os": { x: -420, y: -170, z: 850 },
      "real-estate": { x: -250, y: -280, z: 850 },
      touring: { x: -20, y: -365, z: 850 },
      dubs: { x: 210, y: -270, z: 850 },
      writ: { x: 390, y: -150, z: 850 },
      yoohoo: { x: 450, y: 40, z: 850 },
    },
  },
};

function clone(point: Point3): Point3 {
  return { x: point.x, y: point.y, z: point.z };
}

function normalize(point: Point3): Point3 {
  const length = Math.hypot(point.x, point.y, point.z) || 1;
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}

function cross(a: Point3, b: Point3): Point3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Point3, b: Point3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cameraBasis(position: Point3, target: Point3) {
  const forward = normalize({
    x: target.x - position.x,
    y: target.y - position.y,
    z: target.z - position.z,
  });
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = normalize(cross(right, forward));
  return { forward, right, up };
}

export function projectWorldPoint(
  point: Point3,
  position: Point3,
  target: Point3,
  fov: number,
  width: number,
  height: number,
): ProjectedPoint & { right: Point3; up: Point3 } | null {
  const { forward, right, up } = cameraBasis(position, target);
  const delta = {
    x: point.x - position.x,
    y: point.y - position.y,
    z: point.z - position.z,
  };
  const depth = dot(delta, forward);
  if (depth < 30) return null;
  const scale = fov / depth;
  return {
    x: width / 2 + dot(delta, right) * scale,
    y: height / 2 - dot(delta, up) * scale,
    depth,
    scale,
    right,
    up,
  };
}

export function translateWorldPointByScreenDelta(
  point: Point3,
  scale: number,
  dx: number,
  dy: number,
  position = overview.position,
  target = overview.target,
) {
  const { right, up } = cameraBasis(position, target);
  const screenRight = dx / Math.max(0.18, scale);
  const screenDown = dy / Math.max(0.18, scale);
  return {
    x: point.x + right.x * screenRight - up.x * screenDown,
    y: point.y + right.y * screenRight - up.y * screenDown,
    z: point.z + right.z * screenRight - up.z * screenDown,
  };
}

function createRuntimeNodes(): RuntimeNode[] {
  return portfolioWorldNodes.map((node) => {
    const [screenX, screenY, z] = portfolioOverviewLayout[node.id];
    const point = { x: (50 - screenX) * 18, y: (50 - screenY) * 18, z };
    return {
      ...node,
      alpha: 1,
      base: clone(point),
      goal: clone(point),
      goalAlpha: 1,
      labelLines: [node.label],
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

function cssColor(style: CSSStyleDeclaration, variable: string, fallback: string) {
  return style.getPropertyValue(variable).trim() || fallback;
}

export function PortfolioWorld({
  activeThreadId,
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
  const brainImage = useRef<HTMLImageElement | null>(null);
  const brainCache = useRef(new Map<string, HTMLCanvasElement>());
  const focusIds = useMemo(
    () => getWorldFocusIds({ activeThreadId, selectedId }),
    [activeThreadId, selectedId],
  );
  const focusRef = useRef(focusIds);
  const links = useMemo(
    () => getVisibleWorldLinks({ activeThreadId, selectedId }),
    [activeThreadId, selectedId],
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
      const pinned = (node: RuntimeNode) =>
        node.id === "bradley" || node.family === "story" || node.userPlaced;
      const projectWorking = () =>
        new Map(
          nodes.map((node) => {
            const point = working.get(node.id)!;
            const projected = projectWorldPoint(
              point,
              overview.position,
              overview.target,
              camera.current.fov,
              width,
              height,
            )!;
            const lines = wrapLabel(node.label, measure);
            const labelWidth = Math.ceil(Math.max(...lines.map(measure)));
            const halfWidth = Math.max(13, labelWidth / 2);
            return [
              node.id,
              {
                ...projected,
                footprint: {
                  x: projected.x - halfWidth,
                  y: projected.y - 13,
                  width: halfWidth * 2,
                  height: 31 + lines.length * LABEL_LINE_HEIGHT,
                },
              },
            ] as const;
          }),
        );
      const applyPush = (
        node: RuntimeNode,
        dx: number,
        dy: number,
        projected: ProjectedPoint & { right: Point3; up: Point3 },
      ) => {
        if (pinned(node)) return;
        const point = working.get(node.id)!;
        const inverseScale = 1 / Math.max(0.18, projected.scale);
        point.x += projected.right.x * dx * inverseScale - projected.up.x * dy * inverseScale;
        point.y += projected.right.y * dx * inverseScale - projected.up.y * dy * inverseScale;
        point.z += projected.right.z * dx * inverseScale - projected.up.z * dy * inverseScale;
        point.x = Math.max(-940, Math.min(940, point.x));
        point.y = Math.max(-540, Math.min(540, point.y));
        point.z = Math.max(480, Math.min(1120, point.z));
      };

      for (let iteration = 0; iteration < 120; iteration += 1) {
        const projected = projectWorking();
        let moved = false;
        for (let aIndex = 0; aIndex < nodes.length; aIndex += 1) {
          for (let bIndex = aIndex + 1; bIndex < nodes.length; bIndex += 1) {
            const aNode = nodes[aIndex];
            const bNode = nodes[bIndex];
            const a = projected.get(aNode.id)!;
            const b = projected.get(bNode.id)!;
            const overlapX =
              Math.min(a.footprint.x + a.footprint.width, b.footprint.x + b.footprint.width) -
              Math.max(a.footprint.x, b.footprint.x) +
              5;
            const overlapY =
              Math.min(a.footprint.y + a.footprint.height, b.footprint.y + b.footprint.height) -
              Math.max(a.footprint.y, b.footprint.y) +
              5;
            if (overlapX <= 0 || overlapY <= 0) continue;
            moved = true;
            const aShare = pinned(aNode) ? 0 : pinned(bNode) ? 1 : 0.5;
            const bShare = 1 - aShare;
            if (overlapX < overlapY) {
              const direction = b.x >= a.x ? 1 : -1;
              applyPush(aNode, -direction * overlapX * aShare, 0, a);
              applyPush(bNode, direction * overlapX * bShare, 0, b);
            } else {
              const direction = b.y >= a.y ? 1 : -1;
              applyPush(aNode, 0, -direction * overlapY * aShare, a);
              applyPush(bNode, 0, direction * overlapY * bShare, b);
            }
          }
        }
        for (const node of nodes) {
          const projectedNode = projected.get(node.id)!;
          const box = projectedNode.footprint;
          if (box.x < 12) {
            applyPush(node, 12 - box.x, 0, projectedNode);
            moved = true;
          }
          if (box.x + box.width > width - 12) {
            applyPush(node, width - 12 - box.x - box.width, 0, projectedNode);
            moved = true;
          }
          if (box.y < 18) {
            applyPush(node, 0, 18 - box.y, projectedNode);
            moved = true;
          }
          if (box.y + box.height > height - 78) {
            applyPush(node, 0, height - 78 - box.y - box.height, projectedNode);
            moved = true;
          }
        }
        if (!moved) break;
      }
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
    window.addEventListener("resize", resize);
    const updateMotion = () => {
      reduceMotion = motion?.matches ?? false;
    };
    motion?.addEventListener?.("change", updateMotion);

    const render = () => {
      const { width, height } = size.current;
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
        node.labelLines = wrapLabel(
          node.label,
          measure,
          width <= 600 ? 96 : LABEL_MAX_WIDTH,
        );
        const button = buttonRefs.current.get(node.id);
        if (button && node.screen) {
          button.style.left = `${(node.screen.x / width) * 100}%`;
          button.style.top = `${(node.screen.y / height) * 100}%`;
          button.style.pointerEvents = node.alpha < 0.22 ? "none" : "auto";
        }
      }

      if (context) {
        context.clearRect(0, 0, width, height);
        drawLinks(context, nodes, linksRef.current, active.selectedId, active.activeThreadId, world);
        const sorted = [...nodes].sort(
          (a, b) => (b.screen?.depth ?? 0) - (a.screen?.depth ?? 0),
        );
        for (const node of sorted) {
          drawNode(context, node, world, brainImage.current, brainCache.current);
        }
      }
      if (!disposed) frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
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
      onReset();
    }
  }

  return (
    <section
      aria-label="Spatial portfolio world"
      className="portfolio-world"
      data-active-thread={activeThreadId ?? undefined}
      data-selected-node={selectedId ?? undefined}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (event.button !== 0 || !target.hasAttribute("data-world-surface")) return;
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
      <div className="portfolio-world-mast" aria-hidden="true">
        Bradley Berkman
      </div>
      <p className="portfolio-world-hint" aria-hidden="true">
        Tap a point to read
      </p>
      {portfolioWorldNodes.map((node) => (
        <button
          aria-label={`${node.kind} ${node.label}`}
          aria-pressed={selectedId === node.id}
          className="portfolio-world-node"
          data-cursor-color={`--world-${node.register}`}
          data-family={node.family}
          data-world-node={node.id}
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
  nodes.forEach((node) => {
    if (node.id === "bradley") node.goal = clone(layout.bradley);
    else if (node.id === story.nodeId) node.goal = clone(layout.story);
    else node.goal = layout.members[node.id]
      ? clone(layout.members[node.id])
      : clone(node.base);
    node.goalAlpha =
      node.id === "bradley" || node.id === story.nodeId || story.members.includes(node.id)
        ? 1
        : 0.13;
  });

  const { width, height } = dimensions;
  if (width && height) {
    const ids = ["bradley", story.nodeId, ...story.members];
    const working = new Map(ids.map((id) => [id, clone(byId.get(id)!.goal)]));
    const pinned = (id: string) => id === "bradley" || id === story.nodeId;
    const projected = () =>
      new Map(
        ids.map((id) => {
          const node = byId.get(id)!;
          const screen = projectWorldPoint(
            working.get(id)!,
            storyView.position,
            storyView.target,
            camera.fov,
            width,
            height,
          )!;
          const lines = wrapLabel(node.label, measure);
          const labelWidth = Math.ceil(Math.max(...lines.map(measure)));
          const halfWidth = Math.max(15, labelWidth / 2);
          return [
            id,
            {
              ...screen,
              footprint: {
                x: screen.x - halfWidth,
                y: screen.y - 14,
                width: halfWidth * 2,
                height: 34 + lines.length * LABEL_LINE_HEIGHT,
              },
            },
          ] as const;
        }),
      );
    const push = (
      id: string,
      dx: number,
      dy: number,
      screen: ProjectedPoint & { right: Point3; up: Point3 },
    ) => {
      if (pinned(id)) return;
      const point = working.get(id)!;
      const inverseScale = 1 / Math.max(0.18, screen.scale);
      point.x += screen.right.x * dx * inverseScale - screen.up.x * dy * inverseScale;
      point.y += screen.right.y * dx * inverseScale - screen.up.y * dy * inverseScale;
      point.z += screen.right.z * dx * inverseScale - screen.up.z * dy * inverseScale;
      point.x = Math.max(-980, Math.min(980, point.x));
      point.y = Math.max(-590, Math.min(590, point.y));
      point.z = Math.max(620, Math.min(1050, point.z));
    };
    for (let iteration = 0; iteration < 160; iteration += 1) {
      const screens = projected();
      let moved = false;
      for (let aIndex = 0; aIndex < ids.length; aIndex += 1) {
        for (let bIndex = aIndex + 1; bIndex < ids.length; bIndex += 1) {
          const aId = ids[aIndex];
          const bId = ids[bIndex];
          const a = screens.get(aId)!;
          const b = screens.get(bId)!;
          const overlapX =
            Math.min(a.footprint.x + a.footprint.width, b.footprint.x + b.footprint.width) -
            Math.max(a.footprint.x, b.footprint.x) +
            8;
          const overlapY =
            Math.min(a.footprint.y + a.footprint.height, b.footprint.y + b.footprint.height) -
            Math.max(a.footprint.y, b.footprint.y) +
            8;
          if (overlapX <= 0 || overlapY <= 0 || (pinned(aId) && pinned(bId))) continue;
          moved = true;
          const aShare = pinned(aId) ? 0 : pinned(bId) ? 1 : 0.5;
          const bShare = 1 - aShare;
          if (overlapX < overlapY) {
            const direction = b.x >= a.x ? 1 : -1;
            push(aId, -direction * overlapX * aShare, 0, a);
            push(bId, direction * overlapX * bShare, 0, b);
          } else {
            const direction = b.y >= a.y ? 1 : -1;
            push(aId, 0, -direction * overlapY * aShare, a);
            push(bId, 0, direction * overlapY * bShare, b);
          }
        }
      }
      for (const id of ids) {
        if (pinned(id)) continue;
        const screen = screens.get(id)!;
        const box = screen.footprint;
        if (box.x < 18) {
          push(id, 18 - box.x, 0, screen);
          moved = true;
        }
        if (box.x + box.width > width - 18) {
          push(id, width - 18 - box.x - box.width, 0, screen);
          moved = true;
        }
        if (box.y < 18) {
          push(id, 0, 18 - box.y, screen);
          moved = true;
        }
        if (box.y + box.height > height - 84) {
          push(id, 0, height - 84 - box.y - box.height, screen);
          moved = true;
        }
      }
      if (!moved) break;
    }
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
  activeThreadId: string | null,
  world: HTMLElement,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const style = getComputedStyle(world);
  const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const color = dark ? "#A5AFB5" : "#4F585D";
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const isActive = (link: (typeof links)[number]) => {
    if (!selectedId || !selected) return false;
    if (selectedId === "bradley") return link.layer === "story-root";
    if (selected.family === "story") {
      if (selected.threadId === "finding-myself-in-software") {
        return link.layer === "factual" ||
          (link.layer === "story-root" && (link.from === selectedId || link.to === selectedId));
      }
      return (
        (link.layer === "story-root" && (link.from === selectedId || link.to === selectedId)) ||
        (link.layer === "story-membership" && link.threadId === selected.threadId)
      );
    }
    return link.from === selectedId || link.to === selectedId;
  };
  void activeThreadId;
  void style;
  for (const link of links) {
    const from = byId.get(link.from);
    const to = byId.get(link.to);
    if (!from?.screen || !to?.screen) continue;
    const active = isActive(link);
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
  world: HTMLElement,
  image: HTMLImageElement | null,
  cache: Map<string, HTMLCanvasElement>,
) {
  const point = node.screen;
  if (!point) return;
  const style = getComputedStyle(world);
  const color = cssColor(style, `--world-${node.register}`, "#201711");
  const ink = cssColor(style, "--ink", "#201711");
  const size = MARK_SIZE;
  context.save();
  context.translate(point.x, point.y);
  context.globalAlpha = node.alpha;
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = 1.45;
  context.lineJoin = "round";

  if (node.family === "story") {
    context.beginPath();
    context.moveTo(0, -size * 0.49);
    context.lineTo(0, size * 0.49);
    context.moveTo(-size * 0.43, -size * 0.245);
    context.lineTo(size * 0.43, size * 0.245);
    context.moveTo(-size * 0.43, size * 0.245);
    context.lineTo(size * 0.43, -size * 0.245);
    context.stroke();
  } else if (node.family === "identity") {
    const glyph = tintedBrain(image, color, cache);
    if (glyph) context.drawImage(glyph, -size * 0.49, -size * 0.49, size * 0.98, size * 0.98);
  } else if (node.family === "formative") {
    context.beginPath();
    context.arc(0, 0, size * 0.49, 0, Math.PI * 2);
    context.stroke();
  } else if (node.family === "operation") {
    context.beginPath();
    context.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, size * 0.28, 0, Math.PI * 2);
    context.stroke();
  } else if (node.family === "component") {
    context.beginPath();
    context.moveTo(0, -size * 0.52);
    context.lineTo(size * 0.51, size * 0.42);
    context.lineTo(-size * 0.51, size * 0.42);
    context.closePath();
    context.stroke();
  } else if (node.family === "personal") {
    context.strokeRect(-size * 0.48, -size * 0.48, size * 0.96, size * 0.96);
    context.beginPath();
    context.arc(0, 0, size * 0.14, 0, Math.PI * 2);
    context.fill();
  } else if (node.family === "engagement") {
    context.beginPath();
    context.moveTo(0, -size * 0.54);
    context.lineTo(size * 0.54, 0);
    context.lineTo(0, size * 0.54);
    context.lineTo(-size * 0.54, 0);
    context.closePath();
    context.stroke();
  } else if (node.family === "product") {
    context.beginPath();
    context.arc(0, 0, size * 0.49, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, size * 0.14, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  const compact = world.clientWidth <= 600;
  const showLabel =
    !compact ||
    node.family === "story" ||
    world.dataset.selectedNode === node.id;
  if (!showLabel) return;

  context.save();
  context.globalAlpha = node.alpha;
  context.font = compact
    ? '400 11px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif'
    : FONT;
  context.fillStyle = ink;
  context.textBaseline = "middle";
  const labelLineHeight = compact ? 12 : LABEL_LINE_HEIGHT;
  const labelX = compact
    ? point.x + (point.x < world.clientWidth / 2 ? -12 : 12)
    : point.x;
  const labelY = compact
    ? point.y - ((node.labelLines.length - 1) * labelLineHeight) / 2
    : point.y + 18 + LABEL_LINE_HEIGHT * 0.5;
  context.textAlign = compact
    ? point.x < world.clientWidth / 2
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
