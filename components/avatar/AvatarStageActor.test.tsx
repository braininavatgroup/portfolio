// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvatarSnapshot } from "../../lib/avatar/runtime";
import { AvatarStageActor, selectAvatarStageScale } from "./AvatarStageActor";

const frame = vi.hoisted(() => vi.fn());
const camera = vi.hoisted(() => ({
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  updateProjectionMatrix: vi.fn(),
}));
const adapter = vi.hoisted(() => vi.fn());
const stageSize = vi.hoisted(() => ({ width: 1_000, height: 800 }));
const stagePositions = vi.hoisted(() => new WeakMap<HTMLElement, {
  x: number;
  y: number;
  z: number;
  set: ReturnType<typeof vi.fn>;
}>());

vi.mock("@react-three/fiber", () => ({
  useFrame: frame,
  useThree: () => ({ camera, size: stageSize }),
}));

vi.mock("./AvatarAssetAdapter", () => ({
  AvatarAssetAdapter: (props: unknown) => {
    adapter(props);
    return <div data-testid="avatar-asset" />;
  },
  isSwimClip: (animation: string) => animation.startsWith("swim"),
}));

function snapshot(overrides: Partial<AvatarSnapshot> = {}): AvatarSnapshot {
  return {
    phase: "idle",
    animation: "idle",
    position: { x: 800, y: 776 },
    motion: null,
    facing: "front",
    swimHeading: null,
    visible: true,
    fitHeight: null,
    failed: false,
    ready: true,
    ...overrides,
  };
}

function stageGroup(container: HTMLElement) {
  return container.querySelector("group") as HTMLElement & {
    position: { x: number; y: number; z: number; set: ReturnType<typeof vi.fn> };
  };
}

describe("AvatarStageActor", () => {
  it("caps the stage scale to the dock height and keeps a floor", () => {
    expect(selectAvatarStageScale(1440)).toBe(104);
    expect(selectAvatarStageScale(1440, null)).toBe(104);
    expect(selectAvatarStageScale(1440, 400)).toBe(104);
    expect(selectAvatarStageScale(1440, 120)).toBe(52);
    expect(selectAvatarStageScale(1440, 60)).toBe(40);
    expect(selectAvatarStageScale(390, 400)).toBe(72);
  });

  it("passes the snapshot's fit height into the stage scale", () => {
    render(<AvatarStageActor reducedMotion snapshot={snapshot({ fitHeight: 120 })} />);
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ stageScale: 52 }));
  });

  beforeEach(() => {
    frame.mockReset();
    adapter.mockReset();
    stageSize.width = 1_000;
    stageSize.height = 800;
    camera.updateProjectionMatrix.mockReset();
    Object.defineProperty(HTMLElement.prototype, "position", {
      configurable: true,
      get(this: HTMLElement) {
        let position = stagePositions.get(this);
        if (!position) {
          position = {
            x: 0,
            y: 0,
            z: 0,
            set: vi.fn((x: number, y: number, z: number) => {
              position!.x = x;
              position!.y = y;
              position!.z = z;
            }),
          };
          stagePositions.set(this, position);
        }
        return position;
      },
    });
  });

  afterEach(() => {
    cleanup();
    delete (HTMLElement.prototype as { position?: unknown }).position;
  });

  it("maps the CSS viewport top-left corner to the orthographic top-left corner", () => {
    const { container } = render(
      <AvatarStageActor snapshot={snapshot({ position: { x: 0, y: 0 } })} reducedMotion={false} />,
    );

    expect(stageGroup(container).position).toMatchObject({ x: -500, y: 400, z: 0 });
    expect(camera).toMatchObject({ left: -500, right: 500, top: 400, bottom: -400 });
  });

  it("places the actor group foot at the requested CSS pixel point", () => {
    const { container } = render(
      <AvatarStageActor snapshot={snapshot({ position: { x: 720, y: 776 } })} reducedMotion={false} />,
    );

    expect(stageGroup(container).position).toMatchObject({ x: 220, y: -376, z: 0 });
  });

  it("remaps a stationary CSS-pixel foot point when the orthographic viewport resizes", () => {
    const stableSnapshot = snapshot({ position: { x: 720, y: 776 } });
    const { container, rerender } = render(
      <AvatarStageActor snapshot={stableSnapshot} reducedMotion={false} />,
    );

    stageSize.width = 1_200;
    stageSize.height = 900;
    rerender(<AvatarStageActor snapshot={stableSnapshot} reducedMotion={false} />);

    expect(stageGroup(container).position).toMatchObject({ x: 120, y: -326, z: 0 });
  });

  it("samples a multi-segment route by travelled distance at half progress", () => {
    const { container } = render(
      <AvatarStageActor
        snapshot={snapshot({
          animation: "swim_forward",
          motion: {
            id: 1,
            kind: "swim",
            locomotion: "swimming",
            points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }],
            durationMs: 1_000,
          },
        })}
        reducedMotion={false}
      />,
    );

    const tick = frame.mock.calls[0]?.[0];
    act(() => tick({ clock: { elapsedTime: 0 } }, 0));
    act(() => tick({ clock: { elapsedTime: 0.5 } }, 0));

    expect(stageGroup(container).position).toMatchObject({ x: -400, y: 300, z: 0 });
  });

  it("mutates the actor group for frame samples without reconciling the asset every frame", () => {
    const { container } = render(
      <AvatarStageActor
        snapshot={snapshot({
          motion: {
            id: 1,
            kind: "swim",
            locomotion: "swimming",
            points: [{ x: 0, y: 0 }, { x: 400, y: 0 }],
            durationMs: 1_000,
          },
        })}
        reducedMotion={false}
      />,
    );
    const tick = frame.mock.calls[0]?.[0];
    const group = stageGroup(container);

    act(() => tick({ clock: { elapsedTime: 0 } }, 0));
    act(() => tick({ clock: { elapsedTime: 0.25 } }, 0));
    act(() => tick({ clock: { elapsedTime: 0.5 } }, 0));

    expect(group.position.set).toHaveBeenLastCalledWith(-300, 400, 0);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("moves through Brain Food without remounting the animated asset", () => {
    const { getByTestId, rerender } = render(
      <AvatarStageActor
        snapshot={snapshot({
          phase: "brain-food",
          animation: "swim_forward",
          position: { x: 400, y: 400 },
          swimHeading: 0,
        })}
        reducedMotion={false}
      />,
    );
    const asset = getByTestId("avatar-asset");

    rerender(
      <AvatarStageActor
        snapshot={snapshot({
          phase: "brain-food",
          animation: "swim_forward",
          position: { x: 412, y: 396 },
          swimHeading: Math.PI,
        })}
        reducedMotion={false}
      />,
    );

    expect(getByTestId("avatar-asset")).toBe(asset);
    expect(adapter).toHaveBeenLastCalledWith(expect.objectContaining({
      anchor: "center",
      swimHeadingRadians: Math.PI,
    }));
  });

  it("uses the active segment for visual horizontal facing without changing the authored swim clip", () => {
    render(
      <AvatarStageActor
        snapshot={snapshot({
          animation: "swim_forward",
          motion: {
            id: 1,
            kind: "swim",
            locomotion: "swimming",
            points: [{ x: 100, y: 100 }, { x: 300, y: 100 }],
            durationMs: 1_000,
          },
        })}
        reducedMotion={false}
      />,
    );

    act(() => frame.mock.calls[0]?.[0]({ clock: { elapsedTime: 0 } }, 0));

    expect(adapter).toHaveBeenLastCalledWith(expect.objectContaining({
      animation: "swim_forward",
      anchor: "center",
      swimHeadingRadians: 0,
    }));
  });

  it("uses the final motion point without registering frame travel when reduced motion is enabled", () => {
    const { container } = render(
      <AvatarStageActor
        snapshot={snapshot({
          motion: {
            id: 1,
            kind: "walk",
            locomotion: "grounded",
            points: [{ x: 100, y: 700 }, { x: 900, y: 700 }],
            durationMs: 1_000,
          },
        })}
        reducedMotion
      />,
    );

    expect(stageGroup(container).position).toMatchObject({ x: 400, y: -300, z: 0 });
    expect(frame).not.toHaveBeenCalled();
  });

  it("starts a replacement motion from its own route rather than the prior elapsed progress", () => {
    const first = snapshot({
      motion: {
        id: 1,
        kind: "walk",
        locomotion: "grounded",
        points: [{ x: 100, y: 700 }, { x: 900, y: 700 }],
        durationMs: 1_000,
      },
    });
    const { container, rerender } = render(
      <AvatarStageActor snapshot={first} reducedMotion={false} />,
    );
    const firstTick = frame.mock.calls[0]?.[0];
    act(() => firstTick({ clock: { elapsedTime: 0 } }, 0));
    act(() => firstTick({ clock: { elapsedTime: 0.5 } }, 0));

    rerender(
      <AvatarStageActor
        snapshot={snapshot({
          motion: {
            id: 2,
            kind: "walk",
            locomotion: "grounded",
            points: [{ x: 200, y: 600 }, { x: 400, y: 600 }],
            durationMs: 1_000,
          },
        })}
        reducedMotion={false}
      />,
    );
    const secondTick = frame.mock.calls.at(-1)?.[0];
    act(() => secondTick({ clock: { elapsedTime: 0.5 } }, 0));

    expect(stageGroup(container).position).toMatchObject({ x: -300, y: -200, z: 0 });
  });
});
