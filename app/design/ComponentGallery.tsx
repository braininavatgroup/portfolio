"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { CursorInstrument } from "../../components/CursorInstrument";
import { PortfolioAnalyticsPreference } from "../../components/PortfolioAnalytics";
import { PortfolioChat } from "../../components/PortfolioChat";
import { PortfolioHeader } from "../../components/PortfolioHeader";
import { PortfolioNodeMark } from "../../components/PortfolioNodeMark";
import { PortfolioReader } from "../../components/PortfolioReader";
import { PortfolioWorld } from "../../components/PortfolioWorld";
import type { PortfolioVisualBlock } from "../../lib/portfolio-world";
import {
  createMemoryStorage,
  galleryAskPortfolio,
  galleryFamilies,
  galleryFamilyRegister,
  galleryPlannedVisual,
  galleryRegisters,
  galleryRenderTurnstile,
} from "./fixtures";
import { Section, Specimen, Stage } from "./gallery-ui";

const noop = () => {};

/**
 * Wraps a fixture in the class the accepted composition puts on its root, so
 * the component receives `--reader-width`, the type stack, and the mode
 * tokens exactly as it does on the live page.
 */
function Composition({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`experience experience-graph portfolio-composition ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}

function NodeMarkGrid() {
  return (
    <>
      <div className="design-mark-grid">
        {galleryFamilies.map((family) => (
          <div className="design-mark-cell" key={family}>
            <PortfolioNodeMark family={family} register={galleryFamilyRegister[family]} />
            <small>
              {family}
              <br />
              {galleryFamilyRegister[family]}
            </small>
          </div>
        ))}
      </div>
      <p className="design-note" style={{ marginTop: "18px" }}>
        The same mark in every register, to show that selection introduces no
        new color and the register alone carries the classification.
      </p>
      <div className="design-mark-grid">
        {galleryRegisters.map((register) => (
          <div className="design-mark-cell" key={register}>
            <PortfolioNodeMark family="operation" register={register} />
            <small>operation · {register}</small>
          </div>
        ))}
      </div>
    </>
  );
}

function HeaderStates() {
  return (
    <>
      {(["bradley", "map", "index"] as const).map((activeView) => (
        <div key={activeView} style={{ marginBottom: "14px" }}>
          <p className="design-note" style={{ marginBottom: "6px" }}>
            activeView=&quot;{activeView}&quot;, flow layout
          </p>
          <Composition>
            <PortfolioHeader activeView={activeView} />
          </Composition>
        </div>
      ))}
      <p className="design-note" style={{ marginBottom: "6px" }}>
        overlay — absolutely positioned over the world
      </p>
      <Stage size="short">
        <Composition>
          <PortfolioHeader activeView="map" overlay />
        </Composition>
      </Stage>
    </>
  );
}

const readerStates = [
  {
    label: "Index",
    note: "No selection: the dossier is the portfolio index.",
    activeThreadId: null,
    selectedId: null,
  },
  {
    label: "Record",
    note: "A factual node opened in the reader.",
    activeThreadId: null,
    selectedId: "reporting",
  },
  {
    label: "Thread",
    note: "A narrated path, the only long-form type.",
    activeThreadId: "making-work-playable",
    selectedId: null,
  },
  {
    label: "Record inside a thread",
    note: "A member record read while its thread stays active.",
    activeThreadId: "making-work-playable",
    selectedId: "kickoff",
  },
] as const;

function ReaderStates() {
  return (
    <>
      {readerStates.map((state) => (
        <Specimen
          flush
          key={state.label}
          note={state.note}
          source="components/PortfolioReader.tsx"
          title={`Reader — ${state.label}`}
        >
          <Stage>
            <Composition style={{ ["--reader-width" as string]: "100%" }}>
              <PortfolioReader
                activeThreadId={state.activeThreadId}
                onReset={noop}
                onSelect={noop}
                onSelectThread={noop}
                selectedId={state.selectedId}
              />
            </Composition>
          </Stage>
        </Specimen>
      ))}
      <Specimen
        flush
        note="spotlightTarget matches the reader's own avatar target, which adds the spotlight treatment."
        source="components/PortfolioReader.tsx"
        title="Reader — spotlit"
      >
        <Stage>
          <Composition style={{ ["--reader-width" as string]: "100%" }}>
            <PortfolioReader
              activeThreadId={null}
              onReset={noop}
              onSelect={noop}
              onSelectThread={noop}
              selectedId={null}
              spotlightTarget="portfolio:index"
            />
          </Composition>
        </Stage>
      </Specimen>
    </>
  );
}

function WorldStates() {
  const [visual, setVisual] = useState<PortfolioVisualBlock | null>(null);

  const states = [
    { label: "Overview", note: "At rest. Bradley carries no Story connectors.", activeThreadId: null, selectedId: null },
    { label: "Node selected", note: "Selecting a node recomposes the field around it.", activeThreadId: null, selectedId: "reporting" },
    { label: "Story selected", note: "A Story foregrounds its authored constellation.", activeThreadId: "making-work-playable", selectedId: null },
  ] as const;

  return (
    <>
      {states.map((state) => (
        <Specimen
          flush
          key={state.label}
          note={state.note}
          source="components/PortfolioWorld.tsx"
          title={`World — ${state.label}`}
        >
          <Stage>
            {/* The world reserves the dossier width on the live page; the
                gallery gives it the whole stage. */}
            <Composition style={{ ["--reader-width" as string]: "0px" }}>
              <section className="scene-shell">
                <PortfolioWorld
                  activeThreadId={state.activeThreadId}
                  onReset={noop}
                  onSelect={noop}
                  selectedId={state.selectedId}
                />
              </section>
            </Composition>
          </Stage>
        </Specimen>
      ))}

      <Specimen
        flush
        note="A planned visual opened over the map."
        source="components/PortfolioWorld.tsx — activeVisual"
        title="World — visual open"
      >
        <div className="design-lazy">
          <button
            className="design-gallery-control"
            onClick={() => setVisual((current) => (current ? null : galleryPlannedVisual))}
            type="button"
          >
            {visual ? "Close visual" : "Open visual"}
          </button>
        </div>
        <Stage>
          <Composition
            className={visual ? "portfolio-visual-open" : ""}
            style={{ ["--reader-width" as string]: "0px" }}
          >
            <section className="scene-shell">
              <PortfolioWorld
                activeThreadId={null}
                activeVisual={visual}
                onCloseVisual={() => setVisual(null)}
                onReset={noop}
                onSelect={noop}
                selectedId="reporting"
              />
            </section>
          </Composition>
        </Stage>
      </Specimen>
    </>
  );
}

function ChatStates() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="design-lazy">
        <button
          className="design-gallery-control"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? "Minimize panel" : "Open panel"}
        </button>
        <span>
          Answers come from a gallery stub, so asking a question never reaches
          the chat API.
        </span>
      </div>
      <Stage>
        <Composition>
          <section className="scene-shell">
            <PortfolioChat
              askPortfolio={galleryAskPortfolio}
              onOpenChange={setOpen}
              onPoseChange={noop}
              open={open}
              renderTurnstile={galleryRenderTurnstile}
            />
          </section>
        </Composition>
      </Stage>
    </>
  );
}

const cursorStates = [
  { label: "Idle over the page", action: "false", held: "false" },
  { label: "Over an actionable surface", action: "true", held: "false" },
  { label: "Pressed", action: "true", held: "true" },
] as const;

function CursorStates() {
  return (
    <>
      <Specimen
        note="The states the instrument switches between. Rendered as static markup so all three are visible at once."
        source="components/CursorInstrument.tsx"
        title="Cursor — states"
      >
        <div className="portfolio-composition design-mark-grid" style={{ background: "transparent" }}>
          {cursorStates.map((state) => (
            <div className="design-mark-cell" key={state.label}>
              <span
                aria-hidden="true"
                className="cursor-instrument"
                data-action={state.action}
                data-held={state.held}
                data-visible="true"
                style={{ position: "relative", transform: "none" }}
              >
                <i className="cursor-arm cursor-arm-n" />
                <i className="cursor-arm cursor-arm-e" />
                <i className="cursor-arm cursor-arm-s" />
                <i className="cursor-arm cursor-arm-w" />
                <i className="cursor-pin" />
              </span>
              <small>{state.label}</small>
            </div>
          ))}
        </div>
      </Specimen>
      <Specimen
        flush
        note="The real component, mounted here as well as in the root layout. It tracks the pointer and reads its color from the nearest composition."
        source="components/CursorInstrument.tsx"
        title="Cursor — live"
      >
        <Stage size="short">
          <Composition>
            <CursorInstrument />
          </Composition>
        </Stage>
      </Specimen>
    </>
  );
}

function AnalyticsStates() {
  return (
    <div className="portfolio-composition" style={{ background: "transparent" }}>
      <p className="design-note">
        Backed by an in-memory store, so clicking here does not change the real
        analytics preference.
      </p>
      <div className="privacy-analytics-preference" style={{ display: "flex", gap: "12px" }}>
        <PortfolioAnalyticsPreference storage={createMemoryStorage("granted")} />
        <PortfolioAnalyticsPreference storage={createMemoryStorage("denied")} />
      </div>
      <p className="design-note" style={{ marginTop: "12px" }}>
        <code>PortfolioAnalytics</code> itself renders nothing — it only starts
        privacy-safe replay — so it has no visual state to show.
      </p>
    </div>
  );
}

export function ComponentGallery() {
  return (
    <>
      <Section
        id="marks"
        note="One optical envelope and one stroke weight across every family. The register supplies the color."
        title="Node marks"
      >
        <Specimen source="components/PortfolioNodeMark.tsx" title="Families and registers">
          <div className="portfolio-composition" style={{ background: "transparent" }}>
            <NodeMarkGrid />
          </div>
        </Specimen>
      </Section>

      <Section id="header" note="The wordmark plus the single Map view control." title="Header">
        <Specimen source="components/PortfolioHeader.tsx" title="States">
          <HeaderStates />
        </Specimen>
      </Section>

      <Section
        id="reader"
        note="The fixed dossier. Index, thread, and record share it rather than becoming separate panels."
        title="Reader"
      >
        <ReaderStates />
      </Section>

      <Section
        id="world"
        note="A 2D canvas, not Three.js. It renders eagerly."
        title="World"
      >
        <WorldStates />
      </Section>

      <Section
        id="chat"
        note="The only temporary floating surface. Minimized it is a 40px control; open it is an 18rem panel."
        title="Chat"
      >
        <Specimen flush source="components/PortfolioChat.tsx" title="Minimized and open">
          <ChatStates />
        </Specimen>
      </Section>

      <Section id="cursor" note="One segmented cursor across the site on fine-pointer devices." title="Cursor">
        <CursorStates />
      </Section>

      <Section id="analytics" note="The privacy page's opt-in control." title="Analytics preference">
        <Specimen source="components/PortfolioAnalytics.tsx" title="Opted in and opted out">
          <AnalyticsStates />
        </Specimen>
      </Section>
    </>
  );
}
