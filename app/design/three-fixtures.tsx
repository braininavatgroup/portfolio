"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { AvatarAssetAdapter } from "../../components/avatar/AvatarAssetAdapter";
import { AvatarOverlay } from "../../components/avatar/AvatarOverlay";
import {
  AvatarRuntime,
  type AvatarClip,
} from "../../lib/avatar/runtime";
import type { AvatarFacing } from "../../lib/avatar/orientation";
import { Specimen, Stage } from "./gallery-ui";

function PoseCanvas({ children }: { children: React.ReactNode }) {
  return (
    <Canvas
      aria-hidden="true"
      camera={{ fov: 30, position: [0, 0, 4] }}
      dpr={[1, 1.25]}
      gl={{ alpha: true, antialias: true }}
      style={{ height: "100%", width: "100%" }}
    >
      <ambientLight intensity={1.6} />
      <directionalLight intensity={1.7} position={[2, 4, 3]} />
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}

export function AvatarAssetAdapterFixture() {
  const [animation, setAnimation] = useState<AvatarClip>("idle_3");
  const [facing, setFacing] = useState<AvatarFacing>("front");

  return (
    <>
      <div className="design-lazy">
        {(["idle_3", "agree_gesture", "swim_forward", "cheer_with_both_hands"] as const).map(
          (clip) => (
            <button
              aria-pressed={animation === clip}
              className="design-gallery-control"
              key={clip}
              onClick={() => setAnimation(clip)}
              type="button"
            >
              {clip}
            </button>
          ),
        )}
        {(["front", "left", "right"] as const).map((value) => (
          <button
            aria-pressed={facing === value}
            className="design-gallery-control"
            key={value}
            onClick={() => setFacing(value)}
            type="button"
          >
            {value}
          </button>
        ))}
      </div>
      <Stage narrow size="medium">
        <PoseCanvas>
          <AvatarAssetAdapter
            anchor="center"
            animation={animation}
            facing={facing}
            reducedMotion={false}
          />
        </PoseCanvas>
      </Stage>
    </>
  );
}

export function AvatarOverlayFixture() {
  const [runtime] = useState(
    () =>
      new AvatarRuntime(() => ({
        dock: { x: window.innerWidth / 2, y: window.innerHeight - 24 },
        obstacles: [],
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          floorY: window.innerHeight - 24,
        },
      })),
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (visible) runtime.show();
    else runtime.hide();
  }, [runtime, visible]);

  return (
    <>
      <div className="design-lazy">
        <button
          aria-pressed={visible}
          className="design-gallery-control"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? "Visible" : "Hidden"}
        </button>
        <button
          className="design-gallery-control"
          onClick={() => void runtime.react()}
          type="button"
        >
          React
        </button>
        <button
          className="design-gallery-control"
          onClick={() => void runtime.queueSwimLap()}
          type="button"
        >
          Swim lap
        </button>
      </div>
      <div className="design-stage" data-size="viewport">
        <div className="experience portfolio-composition">
          <AvatarOverlay reducedMotion={false} runtime={runtime} />
        </div>
      </div>
    </>
  );
}

export function AvatarFixtures() {
  return (
    <>
      <Specimen
        note="The shipped Bradley model and its four supported clips."
        title="Asset adapter"
      >
        <AvatarAssetAdapterFixture />
      </Specimen>
      <Specimen
        flush
        note="The full overlay driven by the fixed avatar runtime."
        title="Avatar overlay"
      >
        <AvatarOverlayFixture />
      </Specimen>
    </>
  );
}
