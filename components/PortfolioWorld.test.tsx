// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BRADLEY_MIN_LEAN,
  BRADLEY_SPOTLIGHT_SPREAD,
  clearSpotlightLineLabels,
  clearSpotlightLabelRays,
  composeSpotlightGoals,
  MAX_SPOTLIGHT_LEAN,
  connectorSegment,
  PAST_WORLD_ALPHA,
  PortfolioWorld,
  REST_FIELD_ALPHA,
  SPOTLIGHT_JITTER,
  spreadFrom,
} from "./PortfolioWorld";
import {
  getWorldFocusIds,
  portfolioThreads,
  portfolioWorldNodeById,
} from "../lib/portfolio-world";
import {
  AUTHORED_ZONES,
  createRng,
  inSector,
  LOOSE_SLOTS,
  screenAngle,
  screenDistance,
  STAR_ARCS,
  STAR_BAND,
  stillRng,
  zoneMembers,
} from "../lib/portfolio-world-zones";
import {
  projectWorldPoint,
  translateWorldPointByScreenDelta,
  worldPointAtDepth,
} from "../lib/portfolio-world-projection";
import { envelopeInset } from "../lib/portfolio-node-envelope";
import { segmentRectDistance } from "../lib/portfolio-world-field";
import { storyTreeJunction } from "../lib/portfolio-story-tree";

afterEach(cleanup);

describe("PortfolioWorld", () => {
  it("fills its positioned slot without viewport-fixed geometry", async () => {
    const stylesheet = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    const shellRule = stylesheet.match(/^\.scene-shell\s*\{([^}]*)\}/m)?.[1];
    const worldRule = stylesheet.match(/\.portfolio-world\s*\{([^}]*)\}/)?.[1];

    expect(shellRule?.match(/\bposition:\s*([^;]+);/)?.[1]).toBe("relative");
    expect(worldRule?.match(/\bposition:\s*([^;]+);/)?.[1]).toBe("absolute");
    expect(worldRule?.match(/\binset:\s*([^;]+);/)?.[1]).toBe("0");
    expect(worldRule).not.toMatch(/\bheight:\s*100%\s*;/);
    expect(worldRule).not.toMatch(/\bposition:\s*fixed\s*;/);
  });

  it("keeps the world surface free of a background grid", () => {
    render(
      <PortfolioWorld
        activeThreadId={null}
        onReset={() => {}}
        onSelect={() => {}}
        selectedId={null}
      />,
    );

    expect(document.querySelector(".portfolio-world-grid")).toBeNull();
  });

  it("renders the accepted composed world on one shallow-3D canvas", () => {
    render(
      <PortfolioWorld
        activeThreadId={null}
        onReset={() => {}}
        onSelect={() => {}}
        selectedId={null}
      />,
    );

    const world = screen.getByRole("region", {
      name: "Spatial portfolio world",
    });
    expect(world.querySelector("canvas")).toBeTruthy();
    expect(world.querySelector(".world-glyph")).toBeNull();
  });

  it("turns the live map into the Brain Food field without a second overlay", async () => {
    const onSelect = vi.fn();
    const syncNodePositions = vi.fn();
    render(
      <PortfolioWorld
        activeThreadId={null}
        brainFood={{
          active: true,
          eatenIds: new Set(["dubs"]),
          remaining: 15,
          syncNodePositions,
        }}
        onReset={() => {}}
        onSelect={onSelect}
        selectedId={null}
      />,
    );

    expect(
      screen.getByText("Brain Food · 15 left · Arrows/WASD · Esc exits"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Dubs/ })).toBeNull();
    expect(
      screen
        .getAllByRole("button", { name: /Bradley Berkman/ })
        .every((button) => button.hasAttribute("disabled")),
    ).toBe(true);
    expect(document.querySelector(".avatar-toybox")).toBeNull();

    await waitFor(() => expect(syncNodePositions).toHaveBeenCalled());
    expect(
      syncNodePositions.mock.calls.at(-1)?.[0],
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "bradley" }),
        expect.objectContaining({ id: "dubs" }),
      ]),
    );
  });

  it("publishes live node positions before Brain Food starts", async () => {
    const syncNodePositions = vi.fn();
    render(
      <PortfolioWorld
        activeThreadId={null}
        brainFood={{
          active: false,
          eatenIds: new Set(),
          remaining: 16,
          syncNodePositions,
        }}
        onReset={() => {}}
        onSelect={() => {}}
        selectedId={null}
      />,
    );

    await waitFor(() => expect(syncNodePositions).toHaveBeenCalled());
    expect(syncNodePositions.mock.calls.at(-1)?.[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "bradley" })]),
    );
  });

  it("treats a drag as a hold that does not select, and a still press as a click", () => {
    const onSelect = vi.fn();
    render(
      <PortfolioWorld
        activeThreadId={null}
        onReset={() => {}}
        onSelect={onSelect}
        selectedId={null}
      />,
    );
    const button = screen.getAllByRole("button", { name: /Dubs/ })[0];

    fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(button, { pointerId: 1, clientX: 160, clientY: 140 });
    fireEvent.pointerUp(button, { pointerId: 1, clientX: 160, clientY: 140 });
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.pointerDown(button, { button: 0, pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(button, { pointerId: 2, clientX: 102, clientY: 101 });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("keeps every node a click target, the dimmed field under a selection included", async () => {
    const onSelect = vi.fn();
    render(
      <PortfolioWorld
        activeThreadId={null}
        onReset={() => {}}
        onSelect={onSelect}
        selectedId="dubs"
      />,
    );
    // Let the field settle to its dimmed alpha before clicking into it.
    for (let frame = 0; frame < 40; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    const focus = getWorldFocusIds({ activeThreadId: null, selectedId: "dubs" });
    const field = [...portfolioWorldNodeById.values()].filter((node) => !focus.has(node.id));
    expect(field.length).toBeGreaterThan(0);
    for (const node of field) {
      const button = screen.getByRole("button", { name: `${node.kind} ${node.label}` });
      expect(button.style.pointerEvents, `${node.id} lost its hit box`).not.toBe("none");
    }
    const target = field[0];
    const button = screen.getByRole("button", { name: `${target.kind} ${target.label}` });
    fireEvent.pointerDown(button, { button: 0, pointerId: 3, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(button, { pointerId: 3, clientX: 101, clientY: 100 });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: target.id }));
  });

  it("maps a rightward drag to rightward screen movement", () => {
    const cameraPosition = { x: 0, y: 35, z: -760 };
    const cameraTarget = { x: 0, y: 0, z: 760 };
    const start = { x: 0, y: 0, z: 800 };
    const projectedStart = projectWorldPoint(
      start,
      cameraPosition,
      cameraTarget,
      720,
      1000,
      1000,
    );
    const moved = translateWorldPointByScreenDelta(
      start,
      projectedStart!.scale,
      100,
      0,
      cameraPosition,
      cameraTarget,
    );
    const projectedMoved = projectWorldPoint(
      moved,
      cameraPosition,
      cameraTarget,
      720,
      1000,
      1000,
    );

    expect(projectedMoved!.x).toBeCloseTo(projectedStart!.x + 100, 5);
    expect(projectedMoved!.y).toBeCloseTo(projectedStart!.y, 5);
  });

  it("stops every connector outside the tightest circle around each mark", () => {
    // Product: 15 × 0.5 reach + half the 1.45 stroke + 2 clearance.
    const circle = connectorSegment(
      { x: 0, y: 0, family: "product" },
      { x: 100, y: 0, family: "product" },
    )!;
    expect(circle.start.x).toBeCloseTo(10.225, 5);
    expect(circle.end.x).toBeCloseTo(89.775, 5);
    expect(circle.start.y).toBe(0);
    expect(circle.end.y).toBe(0);

    // The open marks used to take no inset at all, so a line ran straight
    // into the asterisk's center. Bradley's canvas brain keeps its 21px scale.
    const openMarks = connectorSegment(
      { x: 10, y: 20, family: "identity" },
      { x: 70, y: 20, family: "story" },
    )!;
    expect(openMarks.start.x).toBeCloseTo(10 + 21 * 0.49 + 0.725 + 2, 5);
    expect(openMarks.end.x).toBeCloseTo(
      70 - (15 * 0.5 + 0.725 + 2),
      5,
    );

    // A triangle's circle is set by its base corners, not its apex, so a line
    // arriving from any direction clears the whole shape.
    const triangle = connectorSegment(
      { x: 0, y: 0, family: "component" },
      { x: 0, y: 100, family: "component" },
    )!;
    expect(triangle.start.y).toBeCloseTo(15 * 0.56 + 0.725 + 2, 5);
  });

  it("keeps a line off the label hanging beneath a mark, and drops one that cannot fit", () => {
    const labelBox = { x: -30, y: 18, width: 60, height: 15 };
    // Straight down through the label: the line starts under it.
    const down = connectorSegment(
      { x: 0, y: 0, family: "story", labelBox },
      { x: 0, y: 200, family: "product" },
    )!;
    expect(down.start.y).toBe(35);
    // Arriving from below, the target's label is in the way too.
    const up = connectorSegment(
      { x: 0, y: 200, family: "product" },
      { x: 0, y: 0, family: "story", labelBox },
    )!;
    expect(up.end.y).toBe(35);
    // Sideways, the label is not crossed and only the mark counts.
    const across = connectorSegment(
      { x: 0, y: 0, family: "story", labelBox },
      { x: 200, y: 0, family: "product" },
    )!;
    expect(across.start.x).toBeCloseTo(15 * 0.5 + 0.725 + 2, 5);
    // Two envelopes that touch leave nothing to draw.
    expect(
      connectorSegment(
        { x: 0, y: 0, family: "product" },
        { x: 15, y: 0, family: "product" },
      ),
    ).toBeNull();
  });

  it("keeps clipped connectors on their original ray instead of inventing a label-edge origin", () => {
    // A two-line desktop label at the full 132 width, hanging 18 below the mark.
    const labelBox = { x: -66, y: 18, width: 132, height: 30 };
    // Down-right at 35°: the visible segment remains collinear with the two
    // nodes and starts beyond the label rather than under its centre.
    const diagonal = connectorSegment(
      { x: 0, y: 0, family: "operation", labelBox },
      { x: 300, y: 210, family: "engagement" },
    )!;
    expect(diagonal.start.x).toBeGreaterThan(66);
    expect(diagonal.start.y / diagonal.start.x).toBeCloseTo(210 / 300, 5);
    expect(diagonal.end.y / diagonal.end.x).toBeCloseTo(210 / 300, 5);
    // The same invariant holds for a relation above the spotlight.
    const arriving = connectorSegment(
      {
        x: -150,
        y: -200,
        family: "component",
        labelBox: { x: -216, y: -182, width: 132, height: 30 },
      },
      { x: 0, y: 0, family: "story" },
    )!;
    expect((arriving.start.y + 200) / (arriving.start.x + 150)).toBeCloseTo(200 / 150, 5);
    // A compact label sits beside the mark: there the far-edge rule holds.
    const beside = connectorSegment(
      { x: 0, y: 0, family: "story", labelBox: { x: 12, y: -6, width: 60, height: 12 } },
      { x: 200, y: 0, family: "product" },
    )!;
    expect(beside.start.x).toBe(74);
    // A run that would climb back into the label from below keeps the far edge.
    const shallow = connectorSegment(
      { x: 0, y: 0, family: "story", labelBox },
      { x: 120, y: 40, family: "product" },
    )!;
    expect(shallow.start.y).toBeLessThan(48);
    expect(shallow.start.x).toBeGreaterThan(60);
  });

  it("eases each end of a line toward its new start instead of snapping", () => {
    const memory = new Map<string, { x: number; y: number }>();
    const labelBox = { x: -66, y: 18, width: 132, height: 30 };
    const first = connectorSegment(
      { x: 0, y: 0, family: "story", labelBox },
      { x: 300, y: 210, family: "product" },
      memory,
      "a->b",
    )!;
    expect(first.start.x).toBeGreaterThan(66);
    expect(first.start.y).toBeGreaterThan(0);
    // The target moves up beside the mark, so the ray clears the label.
    const second = connectorSegment(
      { x: 0, y: 0, family: "story", labelBox },
      { x: 300, y: 0, family: "product" },
      memory,
      "a->b",
    )!;
    expect(second.start.y).toBeLessThan(50);
    expect(second.start.y).toBeGreaterThan(0);
  });

  it("reconstructs the authored overview composition at its reference viewport", () => {
    const width = 915;
    const height = 787;
    const fov = 621.6;
    const expectedCenters: Record<string, readonly [number, number]> = {
      bradley: [448.5, 153.5],
      "thread-making-work-playable": [232, 348],
      "thread-philosophy": [665, 348],
      infamous: [86.5, 415],
      "music-practice": [101.2, 480.4],
      kickoff: [144, 540.4],
      pitching: [211.4, 590.3],
      reporting: [298.1, 626],
      "systems-consulting": [397, 644.6],
      "real-estate": [500, 644.6],
      touring: [598.9, 626],
      "product-studio": [685.6, 590.3],
      dubs: [753, 540.4],
      writ: [795.8, 480.4],
    };

    for (const [id, [expectedX, expectedY]] of Object.entries(expectedCenters)) {
      const { x: layoutX, y: layoutY, z } =
        portfolioWorldNodeById.get(id)!.position;
      const projected = projectWorldPoint(
        { x: (50 - layoutX) * 18, y: (50 - layoutY) * 18, z },
        { x: 0, y: 35, z: -760 },
        { x: 0, y: 0, z: 760 },
        fov,
        width,
        height,
      );

      expect(projected?.x, `${id} x`).toBeCloseTo(expectedX, 0);
      expect(projected?.y, `${id} y`).toBeCloseTo(expectedY, 0);
    }
  });
});

describe("PortfolioWorld slot sizing", () => {
  const rect = (width: number, height: number) =>
    ({
      bottom: height,
      height,
      left: 0,
      right: width,
      top: 0,
      width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("updates its canvas from the observed world slot and disconnects on unmount", () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }
        disconnect = disconnect;
        observe = observe;
        unobserve = vi.fn();
      },
    );
    vi.stubGlobal("devicePixelRatio", 1);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      rect(640, 480),
    );

    const rendered = render(
      <PortfolioWorld
        activeThreadId={null}
        onReset={() => {}}
        onSelect={() => {}}
        selectedId={null}
      />,
    );
    const world = screen.getByRole("region", { name: "Spatial portfolio world" });
    const canvas = world.querySelector("canvas")!;

    expect(observe).toHaveBeenCalledWith(world);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);

    act(() => {
      resizeCallback?.(
        [
          {
            target: world,
            contentRect: rect(360, 240),
          } as unknown as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    });

    expect(canvas.width).toBe(360);
    expect(canvas.height).toBe(240);

    rendered.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("uses viewport resize only when ResizeObserver is unavailable and removes the fallback", () => {
    let bounds = rect(640, 480);
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("devicePixelRatio", 1);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => bounds,
    );
    const removeEventListener = vi.spyOn(window, "removeEventListener");

    const rendered = render(
      <PortfolioWorld
        activeThreadId={null}
        onReset={() => {}}
        onSelect={() => {}}
        selectedId={null}
      />,
    );
    const canvas = screen
      .getByRole("region", { name: "Spatial portfolio world" })
      .querySelector("canvas")!;

    bounds = rect(420, 260);
    fireEvent(window, new Event("resize"));

    expect(canvas.width).toBe(420);
    expect(canvas.height).toBe(260);

    rendered.unmount();
    expect(removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("keeps semantic node buttons pointer-operable while removing them from tab order", () => {
    const onSelect = vi.fn();
    render(
      <PortfolioWorld
        activeThreadId={null}
        nodesInTabOrder={false}
        onReset={() => {}}
        onSelect={onSelect}
        selectedId={null}
      />,
    );

    const node = screen.getByRole("button", { name: "About Bradley Berkman" });
    expect(node.tagName).toBe("BUTTON");
    expect(node.tabIndex).toBe(-1);
    expect(node.hasAttribute("disabled")).toBe(false);

    fireEvent.pointerDown(node, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerUp(node, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

/**
 * The canvas paint path — `drawLinks` and `drawNode`, ~150 lines — was
 * unreachable by the suite: jsdom returns null from `getContext`, so the render
 * loop no-opped and a `throw` at the top of `drawLinks` passed every test. That
 * is where the relationship-line colour was hard-coded past a discarded
 * `getComputedStyle`, invisible to `[data-theme]`.
 *
 * These install a recording 2D context and a stubbed style resolver, so the
 * paint runs and the colour it strokes with is observable.
 */
describe("PortfolioWorld canvas paint", () => {
  /**
   * A no-op-by-default proxy keeps newly added canvas calls from crashing the
   * jsdom harness. The assertions below intentionally observe only the paint
   * signals recorded here; they do not claim every canvas operation is covered.
   */
  function recordingContext() {
    const record = {
      gradientStops: [] as Array<{ offset: number; color: string }>,
      gradients: [] as Array<{ x0: number; y0: number; x1: number; y1: number; stops: Array<{ offset: number; color: string }> }>,
      drawImageWidths: [] as number[],
      strokeStyles: [] as string[],
      fillStyles: [] as string[],
      fillTexts: [] as string[],
      fillTextCalls: [] as { align: CanvasTextAlign; value: string; x: number; y: number }[],
      labelFonts: new Map<string, string>(),
      labelAlphas: new Map<string, number>(),
      pathAlphas: [] as number[],
      moveToCalls: 0,
      strokes: [] as Array<{ lineToCount: number; style: string; alpha: number }>,
      translateCalls: 0,
    };
    let lineToCount = 0;
    const target: Record<string, unknown> = {
      createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
        const stops: Array<{ offset: number; color: string }> = [];
        record.gradients.push({ x0, y0, x1, y1, stops });
        return { addColorStop: (offset: number, color: string) => {
          stops.push({ offset, color });
          record.gradientStops.push({ offset, color });
        } };
      },
      beginPath: () => {
        lineToCount = 0;
        record.pathAlphas.push(Number(target.globalAlpha));
      },
      drawImage: (...args: unknown[]) => {
        if (args.length === 5) record.drawImageWidths.push(Number(args[3]));
      },
      measureText: (value: string) => ({ width: value.length * 6.2 }),
      moveTo: () => {
        record.moveToCalls += 1;
      },
      lineTo: () => {
        lineToCount += 1;
      },
      stroke: () => {
        record.strokes.push({
          lineToCount,
          alpha: Number(target.globalAlpha),
          style: String(target.strokeStyle),
        });
      },
      translate: () => {
        record.translateCalls += 1;
      },
      fillText: (value: string, x: number, y: number) => {
        record.fillTexts.push(value);
        record.fillTextCalls.push({
          align: target.textAlign as CanvasTextAlign,
          value,
          x,
          y,
        });
        record.labelFonts.set(value, String(target.font));
        record.labelAlphas.set(value, Number(target.globalAlpha));
      },
    };
    const context = new Proxy(target, {
      get(object, property) {
        if (property in object) return object[property as string];
        // Canvas state properties read back as whatever was last written.
        return typeof property === "string" && property.endsWith("Style")
          ? ""
          : () => {};
      },
      set(object, property, value) {
        if (property === "strokeStyle") record.strokeStyles.push(String(value));
        if (property === "fillStyle") record.fillStyles.push(String(value));
        object[property as string] = value;
        return true;
      },
    });
    return { context, record };
  }

  function paintWithConnector(
    connector: string,
    options: {
      brainFoodActive?: boolean;
      compact?: boolean;
      selectedId?: string | null;
      width?: number;
    } = {},
  ) {
    const { context, record } = recordingContext();
    const width = options.width ?? 915;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(787);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(128);
    const realComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const style = realComputedStyle(element as Element);
      return {
        getPropertyValue: (property: string) =>
          property === "--map-connector" ? connector : style.getPropertyValue(property),
      } as CSSStyleDeclaration;
    });

    render(
      <div className="portfolio-composition">
        <PortfolioWorld
          activeThreadId={null}
          brainFood={options.brainFoodActive ? {
            active: true,
            eatenIds: new Set(),
            remaining: 16,
            syncNodePositions: vi.fn(),
          } : undefined}
          compact={options.compact}
          onReset={() => {}}
          onSelect={() => {}}
          selectedId={options.selectedId ?? null}
        />
      </div>,
    );

    return record;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads the supplied SVG for Bradley's canvas glyph", () => {
    let source = "";
    vi.stubGlobal(
      "Image",
      class {
        set src(value: string) {
          source = value;
        }
      },
    );

    render(
      <PortfolioWorld
        activeThreadId={null}
        onReset={() => {}}
        onSelect={() => {}}
        selectedId={null}
      />,
    );

    expect(source).toBe("/glyph-textures/circle.svg");
  });

  it("fades label-clipped connectors in their resolved hue", async () => {
    const record = paintWithConnector("rgb(1, 2, 3)");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(record.gradientStops.some(({ offset, color }) =>
      (offset === 0 || offset === 1) && color === "rgba(1, 2, 3, 0)",
    )).toBe(true);
    expect(record.gradientStops.some(({ offset, color }) =>
      offset > 0 && offset < 1 && color.startsWith("rgba(1, 2, 3, "),
    )).toBe(true);
  });

  it("fades the trunk immediately below Bradley's own label", async () => {
    const record = paintWithConnector("rgb(1, 2, 3)");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const label = record.fillTextCalls.filter(({ value }) => value.includes("Berkman")).at(-1)!;
    expect(label).toBeTruthy();
    const gradient = record.gradients.find(({ x0, y0, x1, stops }) =>
      Math.abs(x0 - label.x) < 0.01 && Math.abs(x1 - label.x) < 0.01 &&
      Math.abs(y0 - (label.y + 15 / 2 + 2)) < 0.01 &&
      stops[0]?.color === "rgba(1, 2, 3, 0)",
    );
    expect(gradient, "the endpoint was trimmed before label fading").toBeTruthy();
    expect(gradient!.stops[1].offset * Math.abs(gradient!.y1 - gradient!.y0)).toBeCloseTo(7);
  });

  it("actually paints, and strokes connectors with the resolved token", async () => {
    const record = paintWithConnector("rgb(1, 2, 3)");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    expect(record.moveToCalls, "drawLinks never ran").toBeGreaterThan(0);
    expect(record.translateCalls, "drawNode never ran").toBeGreaterThan(0);
    expect(record.fillTexts.length, "no label was painted").toBeGreaterThan(0);
    expect(record.strokeStyles).toContain("rgb(1, 2, 3)");
  });

  it("keeps overview connections present but quieter than selected-map connections", async () => {
    const connector = "rgb(12, 34, 56)";
    const record = paintWithConnector(connector);
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    expect(record.strokes.filter(stroke => stroke.style === connector && stroke.alpha > 0.1 && stroke.alpha <= 0.4).length).toBeGreaterThan(12);
  });

  it("strokes the selected map trunk and strongest branch as one joined path", async () => {
    const connector = "rgb(12, 34, 56)";
    const record = paintWithConnector(connector, { selectedId: "pitching" });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    expect(
      record.strokes.some(
        ({ lineToCount, style }) => style === connector && lineToCount === 2,
      ),
    ).toBe(true);
  });

  it("consumes the resolved connector token without a hardcoded fallback", async () => {
    const record = paintWithConnector("rgb(9, 8, 7)");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    expect(record.strokeStyles).toContain("rgb(9, 8, 7)");
    expect(record.strokeStyles).not.toContain("#4f585d");
  });

  it("paints floating nodes without graph connections during Brain Food", async () => {
    const record = paintWithConnector("rgb(1, 2, 3)", { brainFoodActive: true });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    expect(record.translateCalls, "drawNode never ran").toBeGreaterThan(0);
    expect(record.strokeStyles).not.toContain("rgb(1, 2, 3)");
  });

  it("keeps all Brain Food targets fully visible when the map resizes from a selected record", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", undefined);
    const record = paintWithConnector("rgb(1, 2, 3)", {brainFoodActive: true, selectedId: "dubs"});
    fireEvent(window, new Event("resize"));
    act(() => { for (let frame=0; frame<150; frame++) frames.shift()?.(frame * 16); });
    expect(record.labelAlphas.get("Philosophy")).toBeCloseTo(1, 3);
  });

  it("applies the Past alpha to the INFAMOUS mark and label on top of the resting field", async () => {
    const record = paintWithConnector("rgb(1, 2, 3)");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const past = REST_FIELD_ALPHA * PAST_WORLD_ALPHA;
    expect(record.pathAlphas).toContain(past);
    expect(record.labelAlphas.get("INFAMOUS PR")).toBe(past);
    expect(record.labelAlphas.get("Dubs")).toBe(1);
    expect(record.labelAlphas.get("Philosophy")).toBe(1);
    expect(record.labelAlphas.get("Bradley Berkman")).toBe(1);
  });

  it("gives Bradley the stronger identity label while record labels stay notational", async () => {
    const record = paintWithConnector("rgb(1, 2, 3)");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    expect(record.labelFonts.get("Bradley Berkman")).toBe(
      '500 14px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif',
    );
    expect(record.labelFonts.get("Philosophy")).toBe(
      '400 12.5px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif',
    );
    expect(
      record.drawImageWidths.some((width) => Math.abs(width * 0.9 - 20.58 * 0.9) < 0.001),
    ).toBe(true);
  });

  it("keeps only Bradley, every Story, the selected node, and the hovered node visible in compact slots", async () => {
    const record = paintWithConnector("rgb(1, 2, 3)", {
      compact: true,
      selectedId: "dubs",
    });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    expect(record.fillTexts).toContain("Bradley Berkman");
    expect(record.fillTexts).toContain("Making Work");
    expect(record.fillTexts).toContain("Philosophy");
    expect(record.fillTexts).toContain("Dubs");
    expect(record.fillTexts).not.toContain("Writ");

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Products Writ" }));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(record.fillTexts).toContain("Writ");
  });

  it("centres overview labels beneath their marks in compact slots", async () => {
    const width = 915;
    const record = paintWithConnector("rgb(1, 2, 3)", { compact: true, width });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const node = screen.getByRole("button", {
      name: "Theme Making Work Playable",
    });
    const nodeX = Number.parseFloat(node.style.left) / 100 * width;
    const label = record.fillTextCalls.find(({ value }) => value.startsWith("Making Work"));

    expect(nodeX).toBeLessThan(width * 0.3);
    expect(label?.align).toBe("center");
    expect(label?.x).toBeCloseTo(nodeX);
  });
});

describe("spotlight composition", () => {
  const bradley = { x: 20, y: 541, z: 647 };
  const centered = { x: 20, y: 100, z: 700 };
  const eight = Array.from({ length: 8 }, (_, index) => `r${index}`);

  it("keeps a lower relation while seating its connector clear of the selected label", () => {
    const camera = {
      position: { x: 0, y: 35, z: -760 },
      target: { x: 0, y: 0, z: 760 },
      fov: 621.6,
    };
    const viewport = { width: 915, height: 787 };
    const spotlight = { x: 0, y: 0, z: 700 };
    const related = new Map([["lower-right", { x: -360, y: -260, z: 700 }]]);
    const origin = projectWorldPoint(
      spotlight,
      camera.position,
      camera.target,
      camera.fov,
      viewport.width,
      viewport.height,
    )!;
    const before = projectWorldPoint(
      related.get("lower-right")!,
      camera.position,
      camera.target,
      camera.fov,
      viewport.width,
      viewport.height,
    )!;
    const labelBox = { x: origin.x - 66, y: origin.y + 18, width: 132, height: 30 };
    const directionTo = (point: { x: number; y: number }) => {
      const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
      return { x: (point.x - origin.x) / distance, y: (point.y - origin.y) / distance };
    };
    expect(envelopeInset(origin, 0, labelBox, directionTo(before), 2)).toBeGreaterThan(2);

    const cleared = clearSpotlightLabelRays({
      camera,
      label: "Brain in a Vat Music Promotions Agency",
      measure: (value) => value.length * 6.2,
      related,
      spotlight,
      viewport,
    });
    const after = projectWorldPoint(
      cleared.get("lower-right")!,
      camera.position,
      camera.target,
      camera.fov,
      viewport.width,
      viewport.height,
    )!;

    expect(after.y, "the relation itself may remain below the selected record").toBeGreaterThan(origin.y);
    expect(envelopeInset(origin, 0, labelBox, directionTo(after), 2)).toBe(2);
  });

  it("keeps same-side label clearance from collapsing related records together", () => {
    const camera = {
      position: { x: 0, y: 35, z: -760 },
      target: { x: 0, y: 0, z: 760 },
      fov: 621.6,
    };
    const viewport = { width: 915, height: 787 };
    const spotlight = { x: 0, y: 0, z: 700 };
    const origin = projectWorldPoint(
      spotlight,
      camera.position,
      camera.target,
      camera.fov,
      viewport.width,
      viewport.height,
    )!;
    const atScreen = (x: number, y: number) =>
      worldPointAtDepth(
        { x, y },
        origin.depth,
        camera.position,
        camera.target,
        camera.fov,
        viewport.width,
        viewport.height,
      );
    const related = new Map([
      ["lower-left-a", atScreen(origin.x - 82, origin.y + 108)],
      ["lower-left-b", atScreen(origin.x - 74, origin.y + 114)],
    ]);

    const cleared = clearSpotlightLabelRays({
      camera,
      label: "Brain in a Vat Music Promotions Agency",
      measure: (value) => value.length * 6.2,
      related,
      relatedLabels: new Map([
        ["lower-left-a", "Music promo campaign pitching"],
        ["lower-left-b", "Music promo campaign kickoff"],
      ]),
      spotlight,
      viewport,
    });
    const [a, b] = ["lower-left-a", "lower-left-b"].map((id) =>
      projectWorldPoint(
        cleared.get(id)!,
        camera.position,
        camera.target,
        camera.fov,
        viewport.width,
        viewport.height,
      )!,
    );

    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(80);
  });

  it("nudges a relation label clear of the non-incident Bradley trunk", () => {
    const camera = {
      position: { x: 0, y: 35, z: -760 },
      target: { x: 0, y: 0, z: 760 },
      fov: 621.6,
    };
    const viewport = { width: 678, height: 445 };
    const depth = 700;
    const atScreen = (x: number, y: number) =>
      worldPointAtDepth(
        { x, y },
        depth,
        camera.position,
        camera.target,
        camera.fov,
        viewport.width,
        viewport.height,
      );
    const bradley = atScreen(250, 38);
    const spotlight = atScreen(346, 289);
    const related = new Map([["making-work-playable", atScreen(208, 180)]]);

    const cleared = clearSpotlightLineLabels({
      bradley,
      camera,
      measure: (value) => value.length * 6.2,
      related,
      relatedLabels: new Map([["making-work-playable", "Making Work Playable"]]),
      spotlight,
      viewport,
    });
    const after = projectWorldPoint(
      cleared.get("making-work-playable")!,
      camera.position,
      camera.target,
      camera.fov,
      viewport.width,
      viewport.height,
    )!;
    const root = projectWorldPoint(
      bradley,
      camera.position,
      camera.target,
      camera.fov,
      viewport.width,
      viewport.height,
    )!;
    const spot = projectWorldPoint(
      spotlight,
      camera.position,
      camera.target,
      camera.fov,
      viewport.width,
      viewport.height,
    )!;
    const trunkStart = { x: root.x, y: root.y + 40 };
    const junction = storyTreeJunction(trunkStart, [spot]);
    const labelBox = {
      left: after.x - 62,
      top: after.y + 18,
      right: after.x + 62,
      bottom: after.y + 33,
    };

    expect(after.x).toBeLessThan(208);
    expect(segmentRectDistance([junction, spot], labelBox)).toBeGreaterThanOrEqual(8 - 1e-3);
  });

  it("hangs the spotlit node beneath Bradley and stars its relations clear of the trunk and the field below", () => {
    const { bradley: root, spotlight, related } = composeSpotlightGoals(bradley, centered, eight);

    // Even a record resting straight beneath him leans Bradley the minimum.
    expect(root.y).toBe(bradley.y);
    expect(Math.abs(root.x - bradley.x)).toBe(BRADLEY_MIN_LEAN);
    expect(spotlight.x).toBe(bradley.x);
    expect(spotlight.y).toBeLessThan(bradley.y);
    for (const point of related.values()) {
      const angle = screenAngle(spotlight, point);
      expect(angle > 240 && angle < 300, `${angle} is in the trunk cone`).toBe(false);
      expect(angle > 45 && angle < 135, `${angle} is in the bottom cone`).toBe(false);
      const radius = screenDistance(spotlight, point);
      expect(radius).toBeGreaterThanOrEqual(STAR_BAND[0]);
      expect(radius).toBeLessThanOrEqual(STAR_BAND[1]);
    }
    // The first half take the right arc in order, the rest the left.
    expect(inSector(screenAngle(spotlight, related.get("r0")!), STAR_ARCS.right)).toBe(true);
    expect(inSector(screenAngle(spotlight, related.get("r3")!), STAR_ARCS.right)).toBe(true);
    expect(inSector(screenAngle(spotlight, related.get("r4")!), STAR_ARCS.left)).toBe(true);
    expect(screenAngle(spotlight, related.get("r1")!)).toBeGreaterThan(
      screenAngle(spotlight, related.get("r0")!),
    );
  });

  it("lands up to four relations loosely around the spotlit node instead of starring them", () => {
    const { related, spotlight } = composeSpotlightGoals(bradley, centered, ["a", "b", "c"]);
    const [above, below, far] = ["a", "b", "c"].map((id) => related.get(id)!);

    expect(above.y).toBeGreaterThan(spotlight.y);
    expect(below.y).toBeLessThan(spotlight.y);
    expect(Math.abs(far.x - spotlight.x)).toBeGreaterThan(Math.abs(below.x - spotlight.x));
    ["a", "b", "c"].forEach((id, index) => {
      expect(inSector(screenAngle(spotlight, related.get(id)!), LOOSE_SLOTS[index].sector)).toBe(true);
    });
  });

  it("lands an authored Story in its zones, grouped and ordered as authored", () => {
    const map = AUTHORED_ZONES["thread-making-work-playable"];
    const members = zoneMembers(map.zones);
    const { spotlight, related } = composeSpotlightGoals(bradley, centered, members, map, createRng(7));

    expect(inSector(screenAngle(bradley, spotlight), map.spotlight.sector)).toBe(true);
    for (const zone of map.zones) {
      let previous = -Infinity;
      for (const id of zone.members) {
        const point = related.get(id)!;
        const angle = screenAngle(spotlight, point);
        const offset = (angle - zone.sector[0] + 360) % 360;
        expect(inSector(angle, zone.sector), `${id} at ${angle} outside ${zone.sector.join("–")}`).toBe(true);
        expect(offset, `${id} out of order`).toBeGreaterThan(previous);
        previous = offset;
        const radius = screenDistance(spotlight, point);
        expect(radius).toBeGreaterThanOrEqual(zone.band[0]);
        expect(radius).toBeLessThanOrEqual(zone.band[1]);
      }
    }
  });

  it("authors both large Stories completely", () => {
    for (const [nodeId, map] of Object.entries(AUTHORED_ZONES)) {
      const thread = portfolioThreads.find((entry) => entry.nodeId === nodeId)!;
      expect(zoneMembers(map.zones).sort()).toEqual([...thread.members].sort());
    }
  });

  it("takes a different pose per seed, and the same pose for the same seed", () => {
    const map = AUTHORED_ZONES["thread-making-work-playable"];
    const members = zoneMembers(map.zones);
    const one = composeSpotlightGoals(bradley, centered, members, map, createRng(1));
    const same = composeSpotlightGoals(bradley, centered, members, map, createRng(1));
    const other = composeSpotlightGoals(bradley, centered, members, map, createRng(2));

    expect(same.related).toEqual(one.related);
    expect(other.related.get("dubs")).not.toEqual(one.related.get("dubs"));
    const drift = Math.abs(other.spotlight.x - one.spotlight.x);
    expect(drift).toBeGreaterThan(0);
  });

  it("keeps a seeded record composition inside its jitter budget", () => {
    const still = composeSpotlightGoals(bradley, centered, eight);
    const seeded = composeSpotlightGoals(bradley, centered, eight, undefined, createRng(3));

    expect(Math.abs(seeded.spotlight.x - still.spotlight.x)).toBeLessThanOrEqual(SPOTLIGHT_JITTER.x);
    expect(Math.abs(seeded.spotlight.y - still.spotlight.y)).toBeLessThanOrEqual(SPOTLIGHT_JITTER.y);
    expect(seeded.bradley).toEqual(still.bradley);
  });

  it("caps how far the spotlit node hangs to the side, so far records still hang beneath Bradley", () => {
    const far = composeSpotlightGoals(bradley, { x: 1000, y: 100, z: 700 }, ["a"]);
    expect(far.spotlight.x - bradley.x).toBe(MAX_SPOTLIGHT_LEAN);
  });

  it("seats siblings with the same relations differently", () => {
    const one = composeSpotlightGoals(bradley, centered, ["a", "b", "c"], undefined, stillRng, { signature: 7 });
    const two = composeSpotlightGoals(bradley, centered, ["a", "b", "c"], undefined, stillRng, { signature: 8 });
    expect(screenAngle(one.spotlight, one.related.get("a")!)).not.toBeCloseTo(
      screenAngle(two.spotlight, two.related.get("a")!),
    );
  });

  it("leans Bradley and the spotlit node toward where it rests, so each lands differently", () => {
    const left = composeSpotlightGoals(bradley, { x: 400, y: 100, z: 700 }, eight);
    const right = composeSpotlightGoals(bradley, { x: -400, y: 100, z: 700 }, eight);
    const near = composeSpotlightGoals(bradley, { x: 30, y: 100, z: 700 }, eight);

    expect(left.bradley.x).toBeGreaterThan(bradley.x);
    expect(right.bradley.x).toBeLessThan(bradley.x);
    // A record resting almost beneath him still leans him a legible amount.
    expect(near.bradley.x - bradley.x).toBe(BRADLEY_MIN_LEAN);
    expect(left.spotlight.x - bradley.x).toBeGreaterThan(left.bradley.x - bradley.x);
    expect(left.bradley.y).toBe(bradley.y);
  });
});

describe("Bradley spotlight", () => {
  it("opens the tree around Bradley", () => {
    const root = { x: 0, y: 500, z: 650 };
    const base = { x: 300, y: 100, z: 700 };
    const story = spreadFrom(root, base, BRADLEY_SPOTLIGHT_SPREAD);

    expect(BRADLEY_SPOTLIGHT_SPREAD).toBeGreaterThan(1);
    expect(story.x).toBeGreaterThan(base.x);
    expect(story.y).toBeLessThan(base.y);
    expect(story.z).toBe(700);
    expect(spreadFrom(root, root, 2)).toEqual(root);
  });
});
