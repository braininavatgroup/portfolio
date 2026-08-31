// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectorSegment,
  portfolioOverviewLayout,
  PortfolioWorld,
  projectWorldPoint,
  translateWorldPointByScreenDelta,
} from "./PortfolioWorld";

afterEach(cleanup);

describe("PortfolioWorld", () => {
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

  it("opens a gallery placeholder over the map and lets it be inspected", () => {
    const onCloseVisual = vi.fn();
    render(
      <PortfolioWorld
        activeThreadId={null}
        activeVisual={{
          type: "visual",
          id: "test-gallery",
          status: "planned",
          purpose: "Inspect a representative multi-frame system.",
          format: "gallery",
          treatment: "sequence",
          sourceStatus: "recreate",
        }}
        onCloseVisual={onCloseVisual}
        onReset={() => {}}
        onSelect={() => {}}
        selectedId="dubs"
      />,
    );

    const stage = screen.getByRole("region", {
      name: "Visual in map: Inspect a representative multi-frame system.",
    });
    expect(stage.getAttribute("data-format")).toBe("gallery");
    expect(screen.getByText("1 / 3")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Next visual frame" }),
    );
    expect(screen.getByText("2 / 3")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Close visual in map" }),
    );
    expect(onCloseVisual).toHaveBeenCalledTimes(1);
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

  it("reconstructs the authored overview composition at its reference viewport", () => {
    const width = 915;
    const height = 787;
    const fov = 621.6;
    const expectedCenters: Record<string, readonly [number, number]> = {
      bradley: [448.5, 153.5],
      "thread-making-work-playable": [344.5, 261.5],
      "thread-choosing-what-not-to-automate": [558.5, 277.5],
      "thread-finding-myself-in-software": [165.5, 421.5],
      dubs: [241, 331.5],
      writ: [263.5, 431.5],
      "personal-os": [345, 469.5],
      yoohoo: [474, 513.5],
      kickoff: [677, 341.5],
      pitching: [734.5, 424],
      reporting: [597, 465],
      touring: [733.5, 533],
      "real-estate": [632.5, 606],
      infamous: [160.5, 550],
      "music-practice": [285, 599.5],
      "systems-consulting": [438, 605],
    };

    for (const [id, [expectedX, expectedY]] of Object.entries(expectedCenters)) {
      const [layoutX, layoutY, z] = portfolioOverviewLayout[id];
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
