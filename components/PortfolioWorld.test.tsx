// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  connectorSegment,
  PortfolioWorld,
  projectWorldPoint,
  translateWorldPointByScreenDelta,
} from "./PortfolioWorld";

afterEach(cleanup);

describe("PortfolioWorld", () => {
  it("keeps the world surface free of a background grid", () => {
    render(
      <PortfolioWorld
        activeStoryId={null}
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
        activeStoryId={null}
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

  it("terminates connectors at each visible mark instead of a padded halo", () => {
    const circle = connectorSegment(
      { x: 0, y: 0, family: "product" },
      { x: 100, y: 0, family: "product" },
    );

    expect(circle.start.x).toBeCloseTo(7.35, 5);
    expect(circle.end.x).toBeCloseTo(92.65, 5);
    expect(circle.start.y).toBe(0);
    expect(circle.end.y).toBe(0);

    const openMarks = connectorSegment(
      { x: 10, y: 20, family: "identity" },
      { x: 70, y: 20, family: "story" },
    );

    expect(openMarks.start).toEqual({ x: 10, y: 20 });
    expect(openMarks.end).toEqual({ x: 70, y: 20 });
  });
});
