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
import { Suspense, useState } from "react";
import { CursorInstrument } from "../../components/CursorInstrument";
import { MacMenuBar, MacPanelFrame } from "../../components/MacMenuBar";
import {
  PortfolioAnalytics,
  PortfolioAnalyticsPreference,
} from "../../components/PortfolioAnalytics";
import { PortfolioChat } from "../../components/PortfolioChat";
import { TouringDemo } from "../../components/TouringDemo";
import { PortfolioContents } from "../../components/PortfolioContents";
import { PortfolioExperience } from "../../components/PortfolioExperience";
import { PortfolioFeedback } from "../../components/PortfolioFeedback";
import { PortfolioControlGlyph, PortfolioControlMark, PortfolioNodeMark } from "../../components/PortfolioNodeMark";
import { PortfolioReadingRoom } from "../../components/PortfolioReadingRoom";
import { PortfolioReader } from "../../components/PortfolioReader";
import { PortfolioWorld } from "../../components/PortfolioWorld";
import { QuarterlyDashboard } from "../../components/QuarterlyDashboard";
import { QuarterlyDashboardPreview } from "../../components/QuarterlyDashboardPreview";
import { ReaderCarousel } from "../../components/ReaderCarousel";
import { AvatarAssetAdapter } from "../../components/avatar/AvatarAssetAdapter";
import { AvatarBoundary } from "../../components/avatar/AvatarBoundary";
import { AvatarOverlay } from "../../components/avatar/AvatarOverlay";
import { AvatarStageActor } from "../../components/avatar/AvatarStageActor";
import { useAvatarStage } from "../../components/useAvatarStage";
import { useBrainFoodSession } from "../../components/useBrainFoodSession";
import { AvatarRuntime } from "../../lib/avatar/runtime";
import {
  createMemoryStorage,
  galleryAskPortfolio,
  galleryAvatarSnapshot,
} from "./fixtures";

// #example:QuarterlyDashboard
export function QuarterlyDashboardExample() {
  return <QuarterlyDashboard />;
}
// #example-end

// #example:QuarterlyDashboardPreview
export function QuarterlyDashboardPreviewExample() {
  return (
    <QuarterlyDashboardPreview />
  );
}
// #example-end

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

// #example:PortfolioFeedback
export function PortfolioFeedbackExample() {
  // In production it takes no props: the reviewer comes from the cookie the
  // worker sets from a `?r=<code>` link, and notes post to the worker's
  // `/_portfolio-feedback/notes` route. Both are seams here, so this example
  // never leaves the page.
  return (
    <div className="portfolio-composition">
      <PortfolioFeedback
        reviewer="alice"
        transport={{
          send: async (draft) => ({ ...draft, reviewer: "alice", id: "example", createdAt: 0 }),
          remove: async () => {},
        }}
      />
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

// #example:MacMenuBar
export function MacMenuBarExample() {
  // The bar fills whatever column it sits in, keeps the Writ icon on the
  // midline, and re-spaces or sheds items as the column resizes. The panel
  // frame hangs a captured panel from it; the capture's canvas is centred on
  // the panel so centring the image centres the panel under the icon.
  return (
    <div className="portfolio-composition" style={{ width: 560 }}>
      <MacMenuBar />
      <MacPanelFrame
        alt="Writ output priority list"
        src="/visuals/writ/output-priority.png"
      />
    </div>
  );
}
// #example-end

// #example:ReaderCarousel
export function ReaderCarouselExample() {
  // One strip of client marks. It scrolls on its own, pauses under the
  // pointer or keyboard focus, drags freely, and stays still for visitors who
  // prefer reduced motion. Wrap it in a reader figure for the caption voice.
  const assets = [
    { alt: "Adriatique — Electronic music duo", label: "Adriatique", src: "/visuals/clients/adriatique.webp" },
    { alt: "Satori — Electronic music artist", label: "Satori", src: "/visuals/clients/satori.webp" },
    { alt: "WhoMadeWho — Electronic music band", label: "WhoMadeWho", src: "/visuals/clients/wmw.webp" },
    { alt: "Armada Music — Record Label", label: "Armada Music", src: "/visuals/clients/armada.webp" },
    { alt: "The Orchard — Music Distribution", label: "The Orchard", src: "/visuals/clients/the-orchard.webp" },
    { alt: "Higher Ground — Record Label", label: "Higher Ground", src: "/visuals/clients/hgsquare.webp" },
  ];
  return (
    <div className="portfolio-composition" style={{ width: 560 }}>
      <figure className="reader-visual-block reader-visual-carousel" data-media-surface="floating">
        <ReaderCarousel assets={assets} label="Clients. A few marquee names." />
        <figcaption>
          <strong>Clients</strong>
          <span>A few marquee names.</span>
        </figcaption>
      </figure>
    </div>
  );
}
// #example-end

// #example:PortfolioNodeMark
export function PortfolioNodeMarkExample() {
  // The mark takes its shape from `family` and its color from `register`,
  // and must sit inside a `.portfolio-composition` for `--world-*` to resolve.
  // Patterned Map and Guide controls use the same SVG brain asset as identity.
  // The accessible names come from `aria-label`.
  return (
    <div className="portfolio-composition">
      <PortfolioNodeMark family="identity" register="identity" />
      <PortfolioControlGlyph kind="reader" />
      <PortfolioControlMark aria-label="Show portfolio map" kind="map" label="Map" />
      <PortfolioControlMark aria-label="Open the Guide" kind="chat" label="Guide" />
    </div>
  );
}
// #example-end

// #example:PortfolioReadingRoom
export function PortfolioReadingRoomExample() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [guideHasThread, setGuideHasThread] = useState(false);

  return (
    <div className="portfolio-composition">
      <PortfolioReadingRoom
        activeThreadId={activeThreadId}
        guide={(
          <PortfolioChat
            askPortfolio={galleryAskPortfolio}
            onThreadStateChange={setGuideHasThread}
          />
        )}
        guideHasThread={guideHasThread}
        map={(
          <PortfolioWorld
            activeThreadId={activeThreadId}
            onReset={() => setSelectedId(null)}
            onSelect={(node) => setSelectedId(node.id)}
            selectedId={selectedId}
          />
        )}
        onGuideReset={() => setGuideHasThread(false)}
        onHome={() => {
          setSelectedId(null);
          setActiveThreadId(null);
        }}
        onSelect={(node) => setSelectedId(node.id)}
        onSelectThread={setActiveThreadId}
        reader={(
          <PortfolioReader
            activeThreadId={activeThreadId}
            onReset={() => setSelectedId(null)}
            onSelect={(node) => setSelectedId(node.id)}
            onSelectThread={setActiveThreadId}
            selectedId={selectedId}
          />
        )}
        selectedId={selectedId}
        selectedSubject={null}
      />
    </div>
  );
}
// #example-end

// #example:PortfolioContents
export function PortfolioContentsExample() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  return (
    <div className="portfolio-composition">
      <PortfolioContents
        activeThreadId={activeThreadId}
        onHome={() => {
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
          compact
          nodesInTabOrder={false}
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
  return (
    <div className="portfolio-composition" style={{ height: 480 }}>
      <section style={{ height: "100%" }}>
        <PortfolioChat
          // Omit both stubs in production: the defaults are
          // `streamPortfolioAnswer` and the real session opener.
          askPortfolio={galleryAskPortfolio}
        />
      </section>
    </div>
  );
}
// #example-end

// #example:PortfolioExperience
export function PortfolioExperienceExample() {
  // Takes no props and owns all of its own state. It is the whole route body.
  return <PortfolioExperience />;
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
          animation="swim_forward"
          facing="right"
          reducedMotion={false}
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
  const [runtime] = useState(() => new AvatarRuntime(() => ({
    dock: { x: 210, y: 396 },
    obstacles: [],
    viewport: { width: 420, height: 420, floorY: 396 },
  })));
  runtime.show();

  return (
    <div className="portfolio-composition">
      <AvatarOverlay reducedMotion={false} runtime={runtime} />
    </div>
  );
}
// #example-end

// #example:AvatarBoundary
export function AvatarBoundaryExample() {
  const [failed, setFailed] = useState(false);

  return (
    <AvatarBoundary onFailure={() => setFailed(true)}>
      {failed ? null : <p>The avatar renderer.</p>}
    </AvatarBoundary>
  );
}
// #example-end

// #example:useAvatarStage
export function UseAvatarStageExample() {
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Owns the stage services and the element registrations. The two inputs are
  // the only thing it needs to know about the page: whether the assistant is
  // on screen, and whether the user has asked for reduced motion.
  const { avatarMounted, registerAvatarStage } = useAvatarStage({
    assistantOpen,
    reducedMotion: false,
  });

  return (
    <section ref={registerAvatarStage}>
      <h1>Bradley Berkman</h1>
      <button onClick={() => setAssistantOpen((open) => !open)} type="button">
        {assistantOpen ? "Hide" : "Show"} the assistant
      </button>
      <p>{avatarMounted ? "Stage ready." : "Mounting…"}</p>
    </section>
  );
}
// #example-end

// #example:useBrainFoodSession
export function UseBrainFoodSessionExample() {
  const [runtime] = useState(() => new AvatarRuntime(() => ({
    dock: { x: 800, y: 700 },
    obstacles: [],
    viewport: { width: 900, height: 724, floorY: 700 },
  })));
  const session = useBrainFoodSession({
    avatarRuntime: runtime,
    edibleNodeCount: 16,
    enabled: true,
    reducedMotion: false,
  });

  return <p>{session.active ? `${session.remaining} left` : "Press Shift+G"}</p>;
}
// #example-end


// #example:TouringDemo
export function TouringDemoExample() {
  return <TouringDemo embedded />;
}
// #example-end
