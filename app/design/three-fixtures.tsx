"use client";

// Every Three.js fixture lives in this module so the whole of three,
// @react-three/fiber and @react-three/drei stays in one code-split chunk that
// the /design route never downloads until a reviewer mounts one of them.

import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AvatarAssetAdapter } from "../../components/avatar/AvatarAssetAdapter";
import { AvatarOverlay } from "../../components/avatar/AvatarOverlay";
import { AvatarStageActor } from "../../components/avatar/AvatarStageActor";
import { ProceduralAvatar } from "../../components/avatar/ProceduralAvatar";
import { AvatarToyboxBoundary } from "../../components/avatar-toybox/AvatarToyboxBoundary";
import { AvatarToyboxOverlay } from "../../components/avatar-toybox/AvatarToyboxOverlay";
import { useAvatarToyboxSession } from "../../components/avatar-toybox/useAvatarToyboxSession";
import { getOutputToken } from "../../components/scene/output-token-map";
import { AvatarController } from "../../lib/avatar/controller";
import { AvatarDirector } from "../../lib/avatar/director";
import { AvatarSequenceRunner } from "../../lib/avatar/sequence-runner";
import { SiteActionExecutor } from "../../lib/avatar/site-actions";
import { AvatarTargetRegistry } from "../../lib/avatar/target-registry";
import { defaultAvatarTone } from "../../lib/avatar/contracts";
import type { AllowedAnimation, AvatarTone } from "../../lib/avatar/contracts";
import type { AvatarFacing } from "../../lib/avatar/orientation";
import { portfolioNodes } from "../../lib/spatial-graph";
import { galleryAvatarSnapshot } from "./fixtures";
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
      camera={{ fov: 30, position: [0, 1.1, 4.2] }}
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

const proceduralPoses: readonly {
  animation: AllowedAnimation;
  facing: AvatarFacing;
  label: string;
  pointing: "left" | "right" | null;
  reducedMotion: boolean;
  tone: AvatarTone;
}[] = [
  { animation: "idle_3", facing: "front", label: "Quiet idle", pointing: null, reducedMotion: false, tone: defaultAvatarTone },
  { animation: "walking", facing: "right", label: "Walking, facing right", pointing: null, reducedMotion: false, tone: defaultAvatarTone },
  { animation: "wake_up_and_look_up", facing: "left", label: "Thinking, facing left", pointing: null, reducedMotion: false, tone: reservedTone },
  { animation: "agree_gesture", facing: "front", label: "Talking", pointing: null, reducedMotion: false, tone: defaultAvatarTone },
  { animation: "wave_one_hand", facing: "front", label: "Pointing right", pointing: "right", reducedMotion: false, tone: energeticTone },
  { animation: "cheer_with_both_hands", facing: "front", label: "Celebrating, high energy", pointing: null, reducedMotion: false, tone: energeticTone },
  { animation: "shrug", facing: "front", label: "Shrug, reduced motion", pointing: null, reducedMotion: true, tone: reservedTone },
];

export function ProceduralAvatarFixture() {
  return (
    <div className="design-mark-grid">
      {proceduralPoses.map((pose) => (
        <div className="design-mark-cell" key={pose.label}>
          <div style={{ height: "180px", width: "100%" }}>
            <PoseCanvas>
              <ProceduralAvatar
                animation={pose.animation}
                facing={pose.facing}
                pointing={pose.pointing}
                reducedMotion={pose.reducedMotion}
                tone={pose.tone}
              />
            </PoseCanvas>
          </div>
          <small>{pose.label}</small>
        </div>
      ))}
    </div>
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
 * The stage actor positions itself in screen pixels inside an orthographic
 * canvas, so the fixture measures its own box and centres the snapshot in it.
 */
export function AvatarStageActorFixture() {
  const [size, setSize] = useState({ height: 420, width: 420 });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        setSize({ height: bounds.height, width: bounds.width });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const snapshot = galleryAvatarSnapshot({
    animation: "idle_3",
    position: { x: size.width / 2, y: size.height - 24 },
  });

  return (
    <Stage size="medium">
      <div ref={box} style={{ height: "100%", width: "100%" }}>
        <Canvas
          aria-hidden="true"
          camera={{ far: 2_500, position: [0, 0, 1_000], zoom: 1 }}
          dpr={[1, 1.25]}
          gl={{ alpha: true, antialias: true }}
          orthographic
          style={{ height: "100%", width: "100%" }}
        >
          <ambientLight intensity={1.6} />
          <directionalLight intensity={1.7} position={[2, 4, 3]} />
          <Suspense fallback={null}>
            <AvatarStageActor reducedMotion={false} snapshot={snapshot} />
          </Suspense>
        </Canvas>
      </div>
    </Stage>
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
    const registry = new AvatarTargetRegistry();
    const controller = new AvatarController(registry);
    const runner = new AvatarSequenceRunner((command, signal) =>
      controller.execute(command, signal),
    );
    const director = new AvatarDirector(controller, runner, registry);
    const siteActionExecutor = new SiteActionExecutor(registry, {});
    return { controller, director, registry, runner, siteActionExecutor };
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
        <button
          aria-pressed={debug}
          className="design-gallery-control"
          onClick={() => setDebug((current) => !current)}
          type="button"
        >
          Director console
        </button>
        <span>
          The Director console is compiled into development builds only, so the
          toggle does nothing in a production build.
        </span>
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
            siteActionExecutor={services.siteActionExecutor}
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
        note="The fallback rig. It renders without any downloaded model."
        source="components/avatar/ProceduralAvatar.tsx"
        title="Procedural avatar — poses, facings and tones"
      >
        <ProceduralAvatarFixture />
      </Specimen>

      <Specimen
        note="The shipped configuration: a rigged GLB plus a motion library, with the procedural rig as the fallback."
        source="components/avatar/AvatarAssetAdapter.tsx"
        title="Asset adapter — animation and facing"
      >
        <AvatarAssetAdapterFixture />
      </Specimen>

      <Specimen
        flush
        note="Positions the avatar in screen pixels inside an orthographic canvas."
        source="components/avatar/AvatarStageActor.tsx"
        title="Stage actor"
      >
        <AvatarStageActorFixture />
      </Specimen>

      <Specimen
        flush
        note="The full overlay, wired to a live controller and director."
        source="components/avatar/AvatarOverlay.tsx"
        title="Avatar overlay and Director console"
      >
        <AvatarOverlayFixture />
      </Specimen>
    </>
  );
}
