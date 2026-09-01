"use client";

// Every Three.js fixture lives in this module so the whole of three,
// @react-three/fiber and @react-three/drei stays in one code-split chunk that
// the /design route never downloads until a reviewer mounts one of them.

import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AvatarAssetAdapter } from "../../components/avatar/AvatarAssetAdapter";
import { AvatarOverlay } from "../../components/avatar/AvatarOverlay";
import { ProceduralAvatar } from "../../components/avatar/ProceduralAvatar";
import { AvatarToyboxBoundary } from "../../components/avatar-toybox/AvatarToyboxBoundary";
import { AvatarToyboxOverlay } from "../../components/avatar-toybox/AvatarToyboxOverlay";
import { useAvatarToyboxSession } from "../../components/avatar-toybox/useAvatarToyboxSession";
import { getOutputToken } from "../../components/scene/output-token-map";
import { createAvatarStageServices } from "../../lib/avatar/stage-services";
import { defaultAvatarTone } from "../../lib/avatar/contracts";
import type { AllowedAnimation, AvatarTone } from "../../lib/avatar/contracts";
import type { AvatarFacing } from "../../lib/avatar/orientation";
import { portfolioNodes } from "../../lib/spatial-graph";
import { Specimen, Stage } from "./gallery-ui";

const energeticTone: AvatarTone = {
  energy: "high",
  warmth: "warm",
  confidence: "assured",
  mischief: "playful",
};

const reservedTone: AvatarTone = {
  energy: "low",
  warmth: "reserved",
  confidence: "uncertain",
  mischief: "none",
};

function PoseCanvas({ children }: { children: React.ReactNode }) {
  return (
    <Canvas
      aria-hidden="true"
      camera={{ fov: 30, position: [0, 0, 4.0] }}
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

/**
 * Seven poses, one WebGL context. Each used to get its own `<Canvas>`, which
 * cost seven contexts and seven uncapped 60fps frame loops for figures whose
 * only ambient motion is a body roll under one degree. Browsers cap contexts
 * around sixteen and evict the oldest, so the pose grid was the first thing to
 * go black once a reviewer also mounted the toybox and the composition.
 *
 * `pointing` is deliberately `"left"` on the wave: it is read at exactly one
 * line in ProceduralAvatar, and only for that animation and that direction.
 * `"right"` renders identically to `null`.
 */
const proceduralPoses: readonly {
  animation: AllowedAnimation;
  facing: AvatarFacing;
  label: string;
  pointing: "left" | "right" | null;
  tone: AvatarTone;
}[] = [
  { animation: "idle_3", facing: "front", label: "Quiet idle", pointing: null, tone: defaultAvatarTone },
  { animation: "walking", facing: "right", label: "Walking, facing right", pointing: null, tone: defaultAvatarTone },
  { animation: "wake_up_and_look_up", facing: "left", label: "Thinking, facing left", pointing: null, tone: reservedTone },
  { animation: "agree_gesture", facing: "front", label: "Talking", pointing: null, tone: defaultAvatarTone },
  { animation: "wave_one_hand", facing: "front", label: "Waving, pointing left", pointing: "left", tone: energeticTone },
  { animation: "cheer_with_both_hands", facing: "front", label: "Celebrating", pointing: null, tone: energeticTone },
  { animation: "shrug", facing: "front", label: "Shrug", pointing: null, tone: reservedTone },
];

const POSE_SPACING = 1.5;

export function ProceduralAvatarFixture() {
  const span = (proceduralPoses.length - 1) * POSE_SPACING;

  return (
    <>
      <div style={{ height: "240px", width: "100%" }}>
        <Canvas
          aria-hidden="true"
          camera={{ fov: 30, position: [0, 0, span * 0.62] }}
          dpr={[1, 1.25]}
          gl={{ alpha: true, antialias: true }}
          style={{ height: "100%", width: "100%" }}
        >
          <ambientLight intensity={1.6} />
          <directionalLight intensity={1.7} position={[2, 4, 3]} />
          <Suspense fallback={null}>
            {proceduralPoses.map((pose, index) => (
              // The rig is ~1.85 units tall with ~1.71 above the origin, so it
              // is dropped to centre that mass on the camera target.
              <group
                key={pose.label}
                position={[index * POSE_SPACING - span / 2, -0.76, 0]}
              >
                <ProceduralAvatar
                  animation={pose.animation}
                  facing={pose.facing}
                  pointing={pose.pointing}
                  reducedMotion={false}
                  tone={pose.tone}
                />
              </group>
            ))}
          </Suspense>
        </Canvas>
      </div>
      <div className="design-pose-labels">
        {proceduralPoses.map((pose) => (
          <small key={pose.label}>{pose.label}</small>
        ))}
      </div>
    </>
  );
}

export function AvatarAssetAdapterFixture() {
  const [animation, setAnimation] = useState<AllowedAnimation>("idle_3");
  const [facing, setFacing] = useState<AvatarFacing>("front");

  return (
    <>
      <div className="design-lazy">
        {(["idle_3", "walking", "agree_gesture", "joyful_dance_with_hand_sway"] as const).map(
          (id) => (
            <button
              aria-pressed={animation === id}
              className="design-gallery-control"
              key={id}
              onClick={() => setAnimation(id)}
              type="button"
            >
              {id}
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
            pointing={null}
            reducedMotion={false}
            tone={defaultAvatarTone}
          />
        </PoseCanvas>
      </Stage>
    </>
  );
}

/**
 * The overlay as the composition wires it: a registry, a controller, a
 * director, a sequence runner and a site-action executor. The controller
 * measures the browser window rather than the stage, so this fixture uses a
 * viewport-height stage to keep the avatar's floor in frame.
 */
export function AvatarOverlayFixture() {
  const [enabled, setEnabled] = useState(true);
  const [debug, setDebug] = useState(false);
  const [services] = useState(() => {
    return createAvatarStageServices();
  });

  const registerStage = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;
      services.registry.registerStage(element);
      services.controller.refreshStage(true);
    },
    [services],
  );

  useEffect(() => () => services.controller.dispose(), [services]);

  return (
    <>
      <div className="design-lazy">
        <button
          aria-pressed={enabled}
          className="design-gallery-control"
          onClick={() => setEnabled((current) => !current)}
          type="button"
        >
          {enabled ? "Visible" : "Hidden"}
        </button>
        {import.meta.env.DEV ? (
          <button
            aria-pressed={debug}
            className="design-gallery-control"
            onClick={() => setDebug((current) => !current)}
            type="button"
          >
            Director console
          </button>
        ) : null}
      </div>
      <div className="design-stage" data-size="viewport" ref={registerStage}>
        <div className="experience experience-graph portfolio-composition">
          <AvatarOverlay
            controller={services.controller}
            debug={debug}
            development
            director={services.director}
            enabled={enabled}
            onEnabledChange={setEnabled}
            reducedMotion={false}
            registry={services.registry}
            runner={services.runner}
          />
        </div>
      </div>
    </>
  );
}

const toyboxRoster = portfolioNodes
  .filter(({ role }) => role === "output")
  .map(({ id, label, projectSlug }) => ({
    id,
    label,
    tokenKind: projectSlug ? getOutputToken(projectSlug) : undefined,
  }));

/**
 * The toybox portals to `#avatar-toybox-root` and takes the whole screen, as
 * it does on the live page. The fixture is the real hook plus the real
 * overlay; only the roster and the "can open" predicate are supplied here.
 */
export function AvatarToyboxFixture() {
  const session = useAvatarToyboxSession({
    canOpen: () => true,
    collectibles: toyboxRoster,
    reducedMotion: false,
  });

  return (
    <div className="design-lazy">
      <button className="design-gallery-control" onClick={session.open} type="button">
        Open the toybox
      </button>
      <span>
        Takes over the screen, as on the live page. Escape closes it. Status:{" "}
        {session.status}.
      </span>
      {session.isOpen ? (
        <AvatarToyboxBoundary
          onFailure={() => session.close("Avatar toybox closed after a renderer error.")}
        >
          <AvatarToyboxOverlay session={session} />
        </AvatarToyboxBoundary>
      ) : null}
    </div>
  );
}

export function AvatarFixtures() {
  return (
    <>
      <Specimen
        note="ProceduralAvatar.tsx — the fallback rig, seven poses in one canvas. It renders without any downloaded model."
        title="Procedural avatar"
      >
        <ProceduralAvatarFixture />
      </Specimen>

      <Specimen
        note="AvatarAssetAdapter.tsx — the shipped configuration: a rigged GLB plus a motion library, with the procedural rig as the fallback."
        title="Asset adapter"
      >
        <AvatarAssetAdapterFixture />
      </Specimen>

      <Specimen
        flush
        note="AvatarOverlay.tsx — the full overlay, wired to a live controller and director. AvatarStageActor renders inside it; it has no separate specimen because a standalone one was this canvas with the controller removed."
        title="Avatar overlay"
      >
        <AvatarOverlayFixture />
      </Specimen>
    </>
  );
}
