"use client";

// The minimal usage example from every sheet in docs/components/, as real
// compiled source. `tests/component-sheets.test.ts` asserts each sheet quotes
// its marked region here verbatim, and `sheet-examples.test.tsx` renders the
// ones that do not need WebGL — so a sheet's example cannot rot into something
// that no longer type-checks or no longer mounts.
//
// Each region is delimited by `// #example:<Sheet>` and `// #example-end`.
// Keep the region self-contained: the sheet shows it on its own, under a
// heading that names the import.

import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useState } from "react";
import { CursorInstrument } from "../../components/CursorInstrument";
import {
  PortfolioAnalytics,
  PortfolioAnalyticsPreference,
} from "../../components/PortfolioAnalytics";
import { PortfolioChat } from "../../components/PortfolioChat";
import { PortfolioExperience } from "../../components/PortfolioExperience";
import { PortfolioHeader } from "../../components/PortfolioHeader";
import { PortfolioNodeMark } from "../../components/PortfolioNodeMark";
import { PortfolioReader } from "../../components/PortfolioReader";
import { PortfolioWorld } from "../../components/PortfolioWorld";
import { AvatarAssetAdapter } from "../../components/avatar/AvatarAssetAdapter";
import { AvatarDirectorConsole } from "../../components/avatar/AvatarDirectorConsole";
import { AvatarOverlay } from "../../components/avatar/AvatarOverlay";
import { AvatarStageActor } from "../../components/avatar/AvatarStageActor";
import { ProceduralAvatar } from "../../components/avatar/ProceduralAvatar";
import { AvatarToyboxBoundary } from "../../components/avatar-toybox/AvatarToyboxBoundary";
import { AvatarToyboxOverlay } from "../../components/avatar-toybox/AvatarToyboxOverlay";
import { useAvatarToyboxSession } from "../../components/avatar-toybox/useAvatarToyboxSession";
import { createAvatarStageServices } from "../../lib/avatar/stage-services";
import { defaultAvatarTone } from "../../lib/avatar/contracts";
import {
  createMemoryStorage,
  galleryAskPortfolio,
  galleryAvatarSnapshot,
  galleryRenderTurnstile,
} from "./fixtures";

// #example:CursorInstrument
export function CursorInstrumentExample() {
  // Mounted once, in the root layout, outside the composition. It reads its
  // color from the nearest `.portfolio-composition`, so a page without one
  // falls back to `--foreground`.
  return (
    <div className="portfolio-composition">
      <CursorInstrument />
    </div>
  );
}
// #example-end

// #example:PortfolioAnalytics
export function PortfolioAnalyticsExample() {
  return (
    <>
      {/* Renders nothing. In the real layout it takes no props and reads
          window.location.hostname and window.localStorage. */}
      <PortfolioAnalytics
        hostname="bradleyberkman.com"
        storage={createMemoryStorage()}
      />
      {/* The opt-out control, as /privacy renders it. */}
      <PortfolioAnalyticsPreference storage={createMemoryStorage("granted")} />
    </>
  );
}
// #example-end

// #example:PortfolioHeader
export function PortfolioHeaderExample() {
  // Flow layout, as on /index. `overlay` instead gives the absolutely
  // positioned variant the composition uses.
  return (
    <div className="flat-index">
      <PortfolioHeader activeView="map" />
    </div>
  );
}
// #example-end

// #example:PortfolioNodeMark
export function PortfolioNodeMarkExample() {
  // The mark takes its shape from `family` and its color from `register`,
  // and must sit inside a `.portfolio-composition` for `--world-*` to resolve.
  return (
    <div className="portfolio-composition">
      <PortfolioNodeMark family="operation" register="warm" />
    </div>
  );
}
// #example-end

// #example:PortfolioReader
export function PortfolioReaderExample() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  return (
    <div className="portfolio-composition">
      <PortfolioReader
        activeThreadId={activeThreadId}
        onReset={() => {
          setSelectedId(null);
          setActiveThreadId(null);
        }}
        onSelect={(node) => setSelectedId(node.id)}
        onSelectThread={setActiveThreadId}
        selectedId={selectedId}
      />
    </div>
  );
}
// #example-end

// #example:PortfolioWorld
export function PortfolioWorldExample() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="portfolio-composition">
      <section className="scene-shell">
        <PortfolioWorld
          activeThreadId={null}
          onReset={() => setSelectedId(null)}
          onSelect={(node) => setSelectedId(node.id)}
          selectedId={selectedId}
        />
      </section>
    </div>
  );
}
// #example-end

// #example:PortfolioChat
export function PortfolioChatExample() {
  const [open, setOpen] = useState(false);

  // `experience` is load-bearing, not decoration: `.experience .portfolio-chat`
  // is what makes the dock `position: fixed`. Under `.portfolio-composition`
  // alone the legacy base rule wins and you get the centred, absolutely
  // positioned prototype chat instead.
  return (
    <div className="experience experience-graph portfolio-composition">
      <section className="scene-shell">
        <PortfolioChat
          // Omit both stubs in production: the defaults are
          // `streamPortfolioAnswer` and the real Turnstile renderer.
          askPortfolio={galleryAskPortfolio}
          onOpenChange={setOpen}
          open={open}
          renderTurnstile={galleryRenderTurnstile}
        />
      </section>
    </div>
  );
}
// #example-end

// #example:PortfolioExperience
export function PortfolioExperienceExample() {
  // Takes no props and owns all of its own state. It is the whole route body;
  // the only thing it needs from outside is `#avatar-toybox-root` in the
  // layout, which app/layout.tsx already renders.
  return <PortfolioExperience />;
}
// #example-end

// #example:ProceduralAvatar
export function ProceduralAvatarExample() {
  return (
    <Canvas camera={{ fov: 30, position: [0, 0, 4] }} gl={{ alpha: true }}>
      <ambientLight intensity={1.6} />
      <directionalLight intensity={1.7} position={[2, 4, 3]} />
      {/* The rig is about 1.85 units tall, ~1.71 of it above the origin, so
          drop it to centre that mass on the camera target. */}
      <group position={[0, -0.76, 0]}>
        <ProceduralAvatar
          animation="idle_3"
          facing="front"
          pointing={null}
          reducedMotion={false}
          tone={defaultAvatarTone}
        />
      </group>
    </Canvas>
  );
}
// #example-end

// #example:AvatarAssetAdapter
export function AvatarAssetAdapterExample() {
  return (
    <Canvas camera={{ fov: 30, position: [0, 0, 4] }} gl={{ alpha: true }}>
      <ambientLight intensity={1.6} />
      <directionalLight intensity={1.7} position={[2, 4, 3]} />
      <Suspense fallback={null}>
        <AvatarAssetAdapter
          anchor="center"
          animation="walking"
          facing="right"
          pointing={null}
          reducedMotion={false}
          tone={defaultAvatarTone}
        />
      </Suspense>
    </Canvas>
  );
}
// #example-end

// #example:AvatarStageActor
export function AvatarStageActorExample() {
  // Screen-pixel positioning only works under an orthographic camera at zoom 1.
  const snapshot = galleryAvatarSnapshot({ position: { x: 210, y: 396 } });

  return (
    <Canvas
      camera={{ far: 2_500, position: [0, 0, 1_000], zoom: 1 }}
      gl={{ alpha: true }}
      orthographic
    >
      <ambientLight intensity={1.6} />
      <directionalLight intensity={1.7} position={[2, 4, 3]} />
      <Suspense fallback={null}>
        <AvatarStageActor reducedMotion={false} snapshot={snapshot} />
      </Suspense>
    </Canvas>
  );
}
// #example-end

// #example:AvatarOverlay
export function AvatarOverlayExample() {
  // The five services, built once, exactly as PortfolioExperience builds them.
  const [services] = useState(() => {
    return createAvatarStageServices();
  });
  const [enabled, setEnabled] = useState(true);
  const registerStage = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;
      services.registry.registerStage(element);
      services.controller.refreshStage(true);
    },
    [services],
  );

  return (
    <div className="portfolio-composition" ref={registerStage}>
      <AvatarOverlay
        controller={services.controller}
        director={services.director}
        enabled={enabled}
        onEnabledChange={setEnabled}
        reducedMotion={false}
        registry={services.registry}
        runner={services.runner}
      />
    </div>
  );
}
// #example-end

// #example:AvatarDirectorConsole
export function AvatarDirectorConsoleExample() {
  const [services] = useState(() => {
    return createAvatarStageServices();
  });

  // In the composition this is reached through `AvatarOverlay`'s
  // `development` + `debug` props, never mounted directly.
  return (
    <AvatarDirectorConsole
      controller={services.controller}
      director={services.director}
      onEnabledChange={() => {}}
      registry={services.registry}
      runner={services.runner}
    />
  );
}
// #example-end

// #example:useAvatarToyboxSession
export function UseAvatarToyboxSessionExample() {
  const session = useAvatarToyboxSession({
    canOpen: () => true,
    collectibles: [{ id: "dubs", label: "Dubs", tokenKind: "document" }],
    reducedMotion: false,
  });

  // Shift+G opens it too, once `canOpen()` returns true.
  return (
    <button onClick={session.open} type="button">
      Open the toybox ({session.status})
    </button>
  );
}
// #example-end

// #example:AvatarToyboxOverlay
export function AvatarToyboxOverlayExample() {
  const session = useAvatarToyboxSession({
    canOpen: () => true,
    collectibles: [{ id: "dubs", label: "Dubs", tokenKind: "document" }],
    reducedMotion: false,
  });

  // Renders null until `session.isOpen`, then portals into
  // `#avatar-toybox-root`. The boundary closes the session if WebGL fails.
  return (
    <>
      <button onClick={session.open} type="button">
        Open the toybox
      </button>
      <AvatarToyboxBoundary onFailure={() => session.close("Renderer failed.")}>
        <AvatarToyboxOverlay session={session} />
      </AvatarToyboxBoundary>
    </>
  );
}
// #example-end

// #example:AvatarToyboxBoundary
export function AvatarToyboxBoundaryExample() {
  const [failed, setFailed] = useState(false);

  // Catches a render-time throw from the subtree, renders nothing in its
  // place, and calls `onFailure` once. It does not catch async or WebGL
  // context-loss errors — those arrive through the session instead.
  return (
    <AvatarToyboxBoundary onFailure={() => setFailed(true)}>
      {failed ? null : <p>The toybox renderer.</p>}
    </AvatarToyboxBoundary>
  );
}
// #example-end
