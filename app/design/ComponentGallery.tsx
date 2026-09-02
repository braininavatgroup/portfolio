"use client";

// One live instance per component, driven through its states by a control
// strip. The gallery used to mount one tree per state, which put five
// PortfolioReaders, four animating world canvases and two chats on the page at
// once — and made comparing two states a 681px scroll between two boxes.

import { useState, type CSSProperties, type ReactNode } from "react";
import { PortfolioAnalyticsPreference } from "../../components/PortfolioAnalytics";
import { PortfolioChat } from "../../components/PortfolioChat";
import { PortfolioContactMark, PortfolioNodeMark } from "../../components/PortfolioNodeMark";
import { portfolioContactMarkKinds } from "../../lib/portfolio-contact-mark";
import { PortfolioReader } from "../../components/PortfolioReader";
import { PortfolioWorld } from "../../components/PortfolioWorld";
import {
  createMemoryStorage,
  galleryFamilies,
  galleryFamilyRegister,
  galleryAskPortfolio,
  galleryPlannedVisual,
  galleryRenderTurnstile,
} from "./fixtures";
import { Section, Specimen, Stage, StateStrip } from "./gallery-ui";

const noop = () => {};

/**
 * The composition root, exactly as `PortfolioExperience` writes it. No
 * `--reader-width` override: the live value is `clamp(460px, 38vw, 560px)` on
 * desktop and `100%` below 900px, and forcing a third value rendered a layout
 * the site cannot produce.
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
      </div>
      <p className="design-note" style={{ marginTop: "18px" }}>
        Glyph is a function of family, colour of register, and the two axes are
        independent — the register column in the Color section carries the same
        six values with their token names. The contact marks share the envelope
        in the identity colour: node primitives for email, CV, and Instagram,
        filled silhouettes for GitHub and LinkedIn like the brain symbol.
      </p>
    </div>
  );
}

const readerStates = [
  { value: "home", label: "Home", activeThreadId: null, selectedId: null },
  { value: "index", label: "Index", activeThreadId: null, selectedId: null },
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
            indexOpen={state === "index"}
            onOpenIndex={() => setState("index")}
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
  const [visualOpen, setVisualOpen] = useState(false);
  const active = worldStates.find((candidate) => candidate.value === state)!;
  const visual = visualOpen ? galleryPlannedVisual : null;

  return (
    <>
      <StateStrip
        label="World state"
        onChange={setState}
        options={worldStates}
        value={state}
      />
      <div className="design-lazy">
        <button
          aria-pressed={visualOpen}
          className="design-gallery-control"
          onClick={() => setVisualOpen((current) => !current)}
          type="button"
        >
          {visualOpen ? "Close visual" : "Open visual"}
        </button>
        <span>One instance — the camera eases between states, which three frozen stages could not show.</span>
      </div>
      <Stage bleed>
        <Composition className={visual ? "portfolio-visual-open" : ""}>
          <section className="scene-shell">
            <PortfolioWorld
              activeThreadId={active.activeThreadId}
              activeVisual={visual}
              onCloseVisual={() => setVisualOpen(false)}
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
  const [open, setOpen] = useState(true);

  return (
    <>
      <div className="design-lazy">
        <span>
          Live, against a stub — asking a question never reaches the chat API.
          The trigger minimises it; the dock is inset by{" "}
          <code>--reader-width</code>, as on the live page.
        </span>
      </div>
      <Stage bleed>
        <Composition>
          <section className="scene-shell">
            <PortfolioChat
              askPortfolio={galleryAskPortfolio}
              onOpenChange={setOpen}
              open={open}
              renderTurnstile={galleryRenderTurnstile}
            />
          </section>
        </Composition>
      </Stage>
    </>
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
        note="One optical envelope and one stroke weight across every family. The register supplies the colour."
        source="components/PortfolioNodeMark.tsx"
        title="Node marks"
      >
        <NodeMarkGrid />
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
        note="The only temporary floating surface. Minimised it is a 40px control; open it is an 18rem panel."
        source="components/PortfolioChat.tsx"
        title="Chat"
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
