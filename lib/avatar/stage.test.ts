import { describe, expect, it } from "vitest";
import {
  groundedFloorY,
  inflateStageBounds,
  planFloorStroll,
  planSwimLap,
  planSwimPath,
  sampleStagePath,
  screenPointToOrthographic,
  selectGroundedDock,
  stagePathLength,
  stageTravelDuration,
  targetSwimmingDocks,
  type AvatarStageMotion,
} from "./stage";
type AvatarTargetBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  inViewport: boolean;
};

function bounds(
  left: number,
  top: number,
  right: number,
  bottom: number,
  inViewport = true,
): AvatarTargetBounds {
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    inViewport,
  };
}

describe("avatar stage geometry", () => {
  it("derives a floor from the viewport or an expanded console", () => {
    // Catches a floor that ignores either the safe bottom inset or the console foot gap.
    expect(groundedFloorY(800, 24)).toBe(776);
    expect(groundedFloorY(800, 24, 560, 16)).toBe(544);
  });

  it("inflates every target edge by the actor clearance", () => {
    // Catches collision bounds that leave one side open for actor clipping.
    expect(inflateStageBounds(bounds(100, 200, 300, 400), 88)).toEqual(
      bounds(12, 112, 388, 488),
    );
  });

  it("publishes grounded motions as a horizontal, path-based contract", () => {
    // Catches a controller contract that can reintroduce x-only movement.
    const motion: AvatarStageMotion = {
      id: 4,
      kind: "walk",
      locomotion: "grounded",
      points: [
        { x: 920, y: 744 },
        { x: 288, y: 744 },
      ],
      durationMs: 1_215,
    };

    expect(motion.points.map((point) => point.y)).toEqual([744, 744]);
    expect(motion.points.map((point) => point.x)).toEqual([920, 288]);
  });

  it("selects a grounded dock by collision count, overlap area, then travel", () => {
    // Catches choosing a nearer dock before resolving collision risk and area.
    expect(
      selectGroundedDock({
        current: { x: 720, y: 776 },
        target: bounds(500, 400, 700, 700),
        obstacles: [bounds(760, 650, 970, 800)],
        viewport: { width: 1_200, height: 800, floorY: 776 },
        actorHalfWidth: 72,
        gap: 16,
      }),
    ).toEqual({ x: 412, y: 776 });

    expect(
      selectGroundedDock({
        current: { x: 900, y: 776 },
        target: bounds(500, 400, 700, 700),
        obstacles: [bounds(340, 704, 490, 800), bounds(710, 704, 820, 800)],
        viewport: { width: 1_200, height: 800, floorY: 776 },
        actorHalfWidth: 72,
        gap: 16,
      }),
    ).toEqual({ x: 788, y: 776 });

    expect(
      selectGroundedDock({
        current: { x: 600, y: 776 },
        target: bounds(500, 400, 700, 700),
        obstacles: [],
        viewport: { width: 1_200, height: 800, floorY: 776 },
        actorHalfWidth: 72,
        gap: 16,
      }),
    ).toEqual({ x: 412, y: 776 });
  });

  it("bounds target swimming docks on all four padded sides", () => {
    // Catches docks that can lead outside the viewport or omit a target approach.
    expect(
      targetSwimmingDocks({
        target: bounds(40, 70, 240, 270),
        viewport: { width: 1_000, height: 800 },
        inset: 24,
        padding: 88,
      }),
    ).toEqual([
      { x: 24, y: 170 },
      { x: 328, y: 170 },
      { x: 140, y: 24 },
      { x: 140, y: 358 },
    ]);
  });

  it("uses two points for a clear direct swim", () => {
    // Catches a direct route taking an arbitrary detour.
    expect(
      planSwimPath({
        start: { x: 100, y: 700 },
        destinations: [{ x: 900, y: 300 }],
        obstacles: [],
        viewport: { width: 1_000, height: 800 },
        viewportInset: 24,
        obstaclePadding: 88,
      }),
    ).toEqual([{ x: 100, y: 700 }, { x: 900, y: 300 }]);
  });

  it("routes a swim around a blocking rectangle", () => {
    // Catches a visibility edge that cuts through the actor-padded obstacle.
    expect(
      planSwimPath({
        start: { x: 100, y: 600 },
        destinations: [{ x: 900, y: 600 }],
        obstacles: [{ left: 420, top: 200, right: 620, bottom: 650 }],
        viewport: { width: 1_000, height: 800 },
        viewportInset: 24,
        obstaclePadding: 88,
      }),
    ).toEqual([
      { x: 100, y: 600 },
      { x: 332, y: 738 },
      { x: 708, y: 738 },
      { x: 900, y: 600 },
    ]);
  });

  it("keeps every swim route segment outside the actor clearance around an obstacle", () => {
    // Catches planning center points with only viewport-edge inset, allowing the 144px actor to clip targets.
    const obstacle = { left: 420, top: 200, right: 620, bottom: 650 };
    const clearance = 88;
    const path = planSwimPath({
      start: { x: 100, y: 600 },
      destinations: [{ x: 900, y: 600 }],
      obstacles: [obstacle],
      viewport: { width: 1_000, height: 800 },
      viewportInset: 24,
      obstaclePadding: clearance,
    });

    expect(path).toEqual([
      { x: 100, y: 600 },
      { x: 332, y: 738 },
      { x: 708, y: 738 },
      { x: 900, y: 600 },
    ]);

    const expanded = bounds(
      obstacle.left - clearance,
      obstacle.top - clearance,
      obstacle.right + clearance,
      obstacle.bottom + clearance,
    );
    for (let index = 1; index < path!.length; index += 1) {
      expect(segmentEntersRectangle(path![index - 1]!, path![index]!, expanded)).toBe(false);
    }
  });

  it("returns null when viewport-touching obstacles surround a target", () => {
    // Catches a planner treating a destination boxed off from every inset corridor as reachable.
    expect(
      planSwimPath({
        start: { x: 100, y: 400 },
        destinations: [{ x: 500, y: 400 }],
        obstacles: [
          { left: 420, top: 0, right: 580, bottom: 360 },
          { left: 420, top: 440, right: 580, bottom: 800 },
          { left: 0, top: 360, right: 420, bottom: 440 },
          { left: 580, top: 360, right: 1_000, bottom: 440 },
        ],
        viewport: { width: 1_000, height: 800 },
        viewportInset: 24,
        obstaclePadding: 88,
      }),
    ).toBeNull();
  });

  it("samples an unequal-segment path by its travelled distance", () => {
    // Catches treating waypoints as equal time slices rather than equal distance travel.
    const path = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 40 },
    ];

    expect(stagePathLength(path)).toBe(70);
    expect(sampleStagePath(path, 0)).toEqual({ x: 0, y: 0 });
    expect(sampleStagePath(path, 0.5)).toEqual({ x: 30, y: 5 });
    expect(sampleStagePath(path, 1)).toEqual({ x: 30, y: 40 });
  });

  it("plans a lap through open space before returning to a grounded dock", () => {
    // Catches an ambient swim that skips the open upper/side tour or cannot finish grounded.
    expect(
      planSwimLap({
        start: { x: 800, y: 744 },
        dock: { x: 800, y: 744 },
        obstacles: [bounds(380, 260, 620, 600)],
        viewport: { width: 1_000, height: 800, floorY: 744 },
        viewportInset: 24,
        obstaclePadding: 88,
      }),
    ).toEqual([
      { x: 800, y: 744 },
      { x: 976, y: 24 },
      { x: 24, y: 24 },
      { x: 24, y: 720 },
      { x: 800, y: 744 },
    ]);
  });

  it("keeps a bounded lap when one cardinal stop is inaccessible at actor clearance", () => {
    // Catches an 88px exclusion zone turning a still-safe ambient loop into a rejected route.
    expect(
      planSwimLap({
        start: { x: 920, y: 776 },
        dock: { x: 920, y: 776 },
        obstacles: [
          bounds(300, 500, 700, 660),
          bounds(80, 100, 260, 180),
          bounds(160, 180, 380, 480),
        ],
        viewport: { width: 1_000, height: 800, floorY: 776 },
        viewportInset: 24,
        obstaclePadding: 88,
      }),
    ).toEqual([
      { x: 920, y: 776 },
      { x: 976, y: 24 },
      { x: 788, y: 748 },
      { x: 24, y: 752 },
      { x: 920, y: 776 },
    ]);
  });

  it("rejects a lap when actor clearance leaves no reachable excursion", () => {
    // Catches stop fallbacks publishing a zero-length swim from an enclosed but technically open dock.
    expect(
      planSwimLap({
        start: { x: 920, y: 776 },
        dock: { x: 920, y: 776 },
        obstacles: [
          bounds(0, 0, 800, 800),
          bounds(800, 0, 1_000, 650),
        ],
        viewport: { width: 1_000, height: 800, floorY: 776 },
        viewportInset: 24,
        obstaclePadding: 88,
      }),
    ).toBeNull();
  });

  it("rejects an all-skipped tour even when its grounded dock differs", () => {
    // Catches dock travel making an enclosed tour appear to be a genuine ambient excursion.
    expect(
      planSwimLap({
        start: { x: 920, y: 776 },
        dock: { x: 900, y: 776 },
        obstacles: [
          bounds(0, 0, 800, 800),
          bounds(800, 0, 1_000, 650),
        ],
        viewport: { width: 1_000, height: 800, floorY: 776 },
        viewportInset: 24,
        obstaclePadding: 88,
      }),
    ).toBeNull();
  });

  it("launches a greeted lab dock clear of the expanded bottom console", () => {
    // Catches the console's 88px swim bounds rejecting an actor that is grounded safely above its corner.
    const obstacles = [
      bounds(368, 32, 704, 144),
      bounds(1_072, 32, 1_408, 144),
      bounds(720, 32, 1_056, 144),
      bounds(368, 600, 1_072, 788),
    ];
    const path = planSwimLap({
      start: { x: 1_144, y: 584 },
      dock: { x: 1_360, y: 584 },
      obstacles,
      viewport: { width: 1_440, height: 800, floorY: 584 },
      viewportInset: 24,
      obstaclePadding: 88,
    });

    expect(path).not.toBeNull();
    expect(path!.slice(0, 2)).toEqual([
      { x: 1_144, y: 584 },
      { x: 1_160, y: 512 },
    ]);
    expect(stagePathLength(path!.slice(1))).toBeGreaterThan(0);
    for (let index = 2; index < path!.length; index += 1) {
      for (const obstacle of obstacles) {
        expect(
          segmentEntersRectangle(
            path![index - 1]!,
            path![index]!,
            inflateStageBounds(obstacle, 88),
          ),
        ).toBe(false);
      }
    }
  });

  it("finds an open right-card fallback beyond 88px clearance", () => {
    // Catches fixed 192px stop candidates skipping the lab's top-right cards instead of swimming around them.
    const path = planSwimLap({
      start: { x: 920, y: 776 },
      dock: { x: 920, y: 776 },
      obstacles: [bounds(760, 32, 940, 144)],
      viewport: { width: 1_000, height: 800, floorY: 776 },
      viewportInset: 24,
      obstaclePadding: 88,
    });

    expect(path).not.toBeNull();
    expect(path).toContainEqual({ x: 888, y: 288 });
  });

  it("uses an open upper-right alternative when the exact corner is inflated into an obstacle", () => {
    const obstacle = bounds(880, 0, 968, 120);
    const path = planSwimLap({
      start: { x: 800, y: 744 },
      dock: { x: 800, y: 744 },
      obstacles: [obstacle],
      viewport: { width: 1_000, height: 800, floorY: 744 },
      viewportInset: 24,
      obstaclePadding: 88,
    });

    expect(path).not.toBeNull();
    expect(path).toContainEqual({ x: 24, y: 24 });
    expect(path).toContainEqual({ x: 24, y: 720 });
    expect(path!.some((point) => point.x > 700 && point.y < 300)).toBe(true);

    const inflated = inflateStageBounds(obstacle, 88);
    for (let index = 1; index < path!.length; index += 1) {
      expect(
        path!.slice(index - 1, index + 1).some((point) =>
          point.x > inflated.left && point.x < inflated.right &&
          point.y > inflated.top && point.y < inflated.bottom,
        ),
      ).toBe(false);
    }
    expect(path!.at(-1)).toEqual({ x: 800, y: 744 });
  });

  it("maps CSS-pixel feet into centered orthographic coordinates", () => {
    // Catches a renderer mapping that flips vertical screen coordinates or offsets the origin.
    expect(
      screenPointToOrthographic(
        { x: 250, y: 600 },
        { width: 1_000, height: 800, floorY: 776 },
      ),
    ).toEqual([-250, -200, 0]);
  });

  it("scales grounded and swimming travel with their separate speed tables", () => {
    // Catches swim travel accidentally sharing the grounded timing model.
    expect(stageTravelDuration(520, "high", "grounded")).toBe(684);
    expect(stageTravelDuration(520, "medium", "grounded")).toBe(1_000);
    expect(stageTravelDuration(520, "low", "grounded")).toBe(1_444);
    expect(stageTravelDuration(520, "high", "swimming")).toBe(813);
    expect(stageTravelDuration(1, "high", "grounded")).toBe(280);
    expect(stageTravelDuration(5_000, "low", "swimming")).toBe(1_800);
  });
});

function segmentEntersRectangle(
  from: { x: number; y: number },
  to: { x: number; y: number },
  rectangle: Pick<AvatarTargetBounds, "left" | "top" | "right" | "bottom">,
) {
  const samples = 1_000;
  return Array.from({ length: samples - 1 }, (_, index) => (index + 1) / samples).some(
    (progress) => {
      const x = from.x + (to.x - from.x) * progress;
      const y = from.y + (to.y - from.y) * progress;
      return x > rectangle.left && x < rectangle.right && y > rectangle.top && y < rectangle.bottom;
    },
  );
}

describe("floor strolls", () => {
  const viewport = { width: 1_000, height: 800, floorY: 776 };
  const stroll = (
    start: { x: number; y: number },
    obstacles: Array<{
      left: number;
      top: number;
      right: number;
      bottom: number;
      inViewport?: boolean;
    }> = [],
  ) =>
    planFloorStroll({
      start,
      obstacles,
      viewport,
      viewportInset: 24,
      actorHalfWidth: 36,
      actorHeight: 208,
      minimumDistance: 96,
    });

  it("walks to the farther viewport edge on an open floor", () => {
    expect(stroll({ x: 900, y: 776 })).toEqual({ x: 24, y: 776 });
    expect(stroll({ x: 100, y: 776 })).toEqual({ x: 976, y: 776 });
  });

  it("stops short of a pane that reaches down into the figure's height band", () => {
    const reader = { left: 200, top: 0, right: 600, bottom: 800, inViewport: true };
    expect(stroll({ x: 900, y: 776 }, [reader])).toEqual({ x: 636, y: 776 });
    // A pane that ends above the head is not in the way.
    const header = { left: 200, top: 0, right: 600, bottom: 500, inViewport: true };
    expect(stroll({ x: 900, y: 776 }, [header])).toEqual({ x: 24, y: 776 });
  });

  it("stays inside the pane the figure stands in", () => {
    const guide = { left: 700, top: 200, right: 1_000, bottom: 776, inViewport: true };
    expect(stroll({ x: 850, y: 776 }, [guide])).toEqual({ x: 736, y: 776 });
    expect(stroll({ x: 760, y: 776 }, [guide])).toEqual({ x: 964, y: 776 });
  });

  it("keeps an elevated Guide stroll on the dock's own floor", () => {
    const guide = { left: 700, top: 250, right: 1000, bottom: 450, inViewport: true };
    expect(stroll({ x: 850, y: 450 }, [guide])).toEqual({ x: 736, y: 450 });
  });

  it("returns null when no direction offers a stroll worth taking", () => {
    const guide = { left: 700, top: 200, right: 900, bottom: 776, inViewport: true };
    expect(stroll({ x: 800, y: 776 }, [guide])).toBeNull();
    expect(
      stroll({ x: 100, y: 776 }, [
        { left: 150, top: 0, right: 1_000, bottom: 800, inViewport: true },
      ]),
    ).toBeNull();
  });
});
