"use client";

// One live instance per component, driven through its states by a control
// strip. The gallery used to mount one tree per state, which put five
// PortfolioReaders, four animating world canvases and two chats on the page at
// once — and made comparing two states a 681px scroll between two boxes.

import { useState, type CSSProperties, type ReactNode } from "react";
import { PortfolioAnalyticsPreference } from "../../components/PortfolioAnalytics";
import { PortfolioChat } from "../../components/PortfolioChat";
import { PortfolioContactMark, PortfolioControlGlyph, PortfolioControlMark, PortfolioNodeMark } from "../../components/PortfolioNodeMark";
import { PORTFOLIO_GLYPH_SIZES } from "../../lib/portfolio-glyph-metrics";
import { portfolioControlMarkKinds } from "../../lib/portfolio-control-mark";
import { portfolioContactMarkKinds } from "../../lib/portfolio-contact-mark";
import { PortfolioReader } from "../../components/PortfolioReader";
import { PortfolioReadingRoom } from "../../components/PortfolioReadingRoom";
import { PortfolioWorld } from "../../components/PortfolioWorld";
import {
  createMemoryStorage,
  galleryFamilies,
  galleryFamilyRegister,
  galleryAskPortfolio,
} from "./fixtures";
import { Section, Specimen, Stage, StateStrip } from "./gallery-ui";

const noop = () => {};

/**
 * The composition root, exactly as `PortfolioExperience` writes it. Full
 * Reading Room specimens use a viewport-width stage so panel constraints are
 * exercised at their shipped size.
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
      className={`experience portfolio-composition ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}

function NodeMarkGrid() {
  return (
    <div className="portfolio-composition" style={{ background: "transparent" }}>
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
        {portfolioContactMarkKinds.map((kind) => (
          <div className="design-mark-cell" key={kind}>
            <PortfolioContactMark kind={kind} />
            <small>
              contact
              <br />
              {kind}
            </small>
          </div>
        ))}
        {portfolioControlMarkKinds.map((kind) => (
          <div className="design-mark-cell" key={kind}>
            <PortfolioControlMark aria-label={kind} kind={kind} label={kind} />
            <small>control</small>
          </div>
        ))}
      </div>
      <div className="design-mark-grid" aria-label="Control size specimens">
        {Object.keys(PORTFOLIO_GLYPH_SIZES).map(size => (
          <div className="design-mark-cell" key={size}>
            <PortfolioControlGlyph kind="copy" size={size as keyof typeof PORTFOLIO_GLYPH_SIZES} />
            <small>{size} · {PORTFOLIO_GLYPH_SIZES[size as keyof typeof PORTFOLIO_GLYPH_SIZES]}px</small>
          </div>
        ))}
      </div>
      <p className="design-note" style={{ marginTop: "18px" }}>
        Glyph is a function of family, colour of register, and the two axes are
        independent. Story keeps its register type while sharing Arc red. Map
        and Guide clip the SVG brain pattern inside their outlines. Contact
        marks share the envelope in the identity colour.
      </p>
    </div>
  );
}

const readerStates = [
  { value: "home", label: "Home", activeThreadId: null, selectedId: null },
  { value: "record", label: "Record", activeThreadId: null, selectedId: "reporting" },
  {
    value: "thread",
    label: "Thread",
    activeThreadId: "making-work-playable",
    selectedId: null,
  },
  {
    value: "member",
    label: "Record in thread",
    activeThreadId: "making-work-playable",
    selectedId: "dubs",
  },
] as const;

function ReaderStates() {
  const [state, setState] = useState<(typeof readerStates)[number]["value"]>("home");
  const active = readerStates.find((candidate) => candidate.value === state)!;

  return (
    <>
      <StateStrip
        label="Reader state"
        onChange={setState}
        options={readerStates}
        value={state}
      />
      <Stage bleed>
        <Composition>
          <PortfolioReader
            activeThreadId={active.activeThreadId}
            onReset={() => setState("home")}
            onSelect={noop}
            onSelectThread={noop}
            selectedId={active.selectedId}
          />
        </Composition>
      </Stage>
    </>
  );
}

const worldStates = [
  { value: "overview", label: "Overview", activeThreadId: null, selectedId: null },
  { value: "node", label: "Node selected", activeThreadId: null, selectedId: "reporting" },
  {
    value: "thread",
    label: "Thread active",
    activeThreadId: "making-work-playable",
    selectedId: null,
  },
] as const;

function WorldStates() {
  const [state, setState] = useState<(typeof worldStates)[number]["value"]>("overview");
  const active = worldStates.find((candidate) => candidate.value === state)!;

  return (
    <>
      <StateStrip
        label="World state"
        onChange={setState}
        options={worldStates}
        value={state}
      />
      <div className="design-lazy">
        <span>One instance — the camera eases between states, which three frozen stages could not show.</span>
      </div>
      <Stage bleed>
        <Composition>
          <section className="scene-shell">
            <PortfolioWorld
              activeThreadId={active.activeThreadId}
              onReset={() => setState("overview")}
              onSelect={noop}
              selectedId={active.selectedId}
            />
          </section>
        </Composition>
      </Stage>
    </>
  );
}

function ChatStates() {
  return (
    <>
      <div className="design-lazy">
        <span>
          Live, against a stub — asking a question never reaches the chat API.
          The Guide is always docked; its Reading Room bar owns collapse and
          new-chat controls on the live page.
        </span>
      </div>
      <Stage bleed>
        <Composition>
          <section className="scene-shell">
            <PortfolioChat
              askPortfolio={galleryAskPortfolio}
            />
          </section>
        </Composition>
      </Stage>
    </>
  );
}

function ReadingRoomMap({
  compact,
  nodesInTabOrder,
}: {
  compact?: boolean;
  nodesInTabOrder?: boolean;
}) {
  return (
    <div
      className="design-reading-room-map"
      data-compact={compact}
      data-tab-order={nodesInTabOrder}
    >
      Map
    </div>
  );
}

function ReadingRoomState() {
  const [storage] = useState(() => createMemoryStorage());

  return (
    <Stage bleed size="viewport">
      <Composition>
        <PortfolioReadingRoom
          activeThreadId={null}
          guide={<div className="design-reading-room-guide">Guide</div>}
          guideHasThread={false}
          map={<ReadingRoomMap />}
          onGuideReset={noop}
          onHome={noop}
          onSelect={noop}
          onSelectThread={noop}
          reader={<div className="design-reading-room-reader">Reader</div>}
          selectedId={null}
          selectedSubject={null}
          storage={storage}
        />
      </Composition>
    </Stage>
  );
}

/**
 * The arms and pin are painted from `--cursor-a` / `--cursor-b`, which are set
 * inline by the component and declared in no stylesheet. A static copy that
 * omits them paints nothing at all — which is what this specimen used to do.
 */
const cursorStates = [
  { label: "Idle", action: "false", held: "false" },
  { label: "Over an actionable surface", action: "true", held: "false" },
  { label: "Pressed", action: "true", held: "true" },
] as const;

function CursorStates() {
  return (
    <div className="portfolio-composition design-mark-grid" style={{ background: "transparent" }}>
      {cursorStates.map((state) => (
        <div className="design-mark-cell" key={state.label}>
          <span
            aria-hidden="true"
            className="cursor-instrument"
            data-action={state.action}
            data-held={state.held}
            data-visible="true"
            style={
              {
                "--cursor-a": "var(--ink)",
                "--cursor-b": "var(--map-paper)",
                position: "relative",
                transform: "none",
              } as CSSProperties
            }
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
  );
}

/**
 * The composition, part by part, in the order it assembles: the vocabulary of
 * marks, then the header, then the two surfaces that face each other, then the
 * one that floats over them.
 */
export function CompositionSections() {
  return (
    <>
      <Section
        id="marks"
        note="Approved A artwork, shared context sizes, and explicit control / node strokes. The register supplies the colour."
        source="components/PortfolioNodeMark.tsx"
        title="Node marks"
      >
        <NodeMarkGrid />
      </Section>

      <Section
        id="reading-room"
        note="The responsive Contents, main, and stacked-side workspace. Drag any pane bar onto another to exchange their views."
        source="components/PortfolioReadingRoom.tsx"
        title="Reading Room"
      >
        <ReadingRoomState />
      </Section>

      <Section
        id="world"
        note="A 2D canvas, not Three.js, sized around the dossier. It renders eagerly."
        source="components/PortfolioWorld.tsx"
        title="World"
      >
        <WorldStates />
      </Section>

      <Section
        id="reader"
        note="The fixed dossier, at its shipped width. Index, thread and record share it rather than becoming separate panels."
        source="components/PortfolioReader.tsx"
        title="Reader"
      >
        <ReaderStates />
      </Section>

      <Section
        id="chat"
        note="The docked Guide body. The Reading Room bar owns its visibility and new-chat control."
        source="components/PortfolioChat.tsx"
        title="Guide"
      >
        <ChatStates />
      </Section>

    </>
  );
}

/** The cursor the whole site wears. */
export function CursorSection() {
  return (
      <Section
        id="cursor"
        note="One segmented cursor across the site on fine-pointer devices. The live instrument is already tracking your pointer — it is mounted in the root layout."
        source="components/CursorInstrument.tsx"
        title="Cursor"
      >
        <Specimen
          note="Static copies, given the two custom properties the live component sets inline."
          title="States"
        >
          <CursorStates />
        </Specimen>
      </Section>

  );
}

/** The privacy page's consent control — ambient, but not part of the site's
 * chrome; it lives on a page of its own. */
export function AnalyticsSection() {
  return (
      <Section
        id="analytics"
        note="The privacy page's opt-in control. Backed by an in-memory store, so clicking here does not change the real preference — and the button toggles between both of its states."
        source="components/PortfolioAnalytics.tsx"
        title="Analytics preference"
      >
        <div className="portfolio-composition privacy-analytics-preference" style={{ background: "transparent" }}>
          <PortfolioAnalyticsPreference storage={createMemoryStorage("granted")} />
        </div>
      </Section>
  );
}
