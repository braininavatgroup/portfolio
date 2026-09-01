"use client";

import { useEffect, useRef, useState } from "react";
import { Section, Specimen } from "./gallery-ui";
import {
  checkpointPairs,
  dimensionTokens,
  fontTokens,
  isPrototypeToken,
  legacyAliases,
  readRootCustomProperties,
  semanticAliases,
  shadowTokens,
  supportingPairs,
  type NamedPair,
} from "./gallery-tokens";

type ModeReader = (token: string) => string;

const emptyReader: ModeReader = () => "";

function Swatch({ value }: { value: string }) {
  return (
    <span
      aria-hidden="true"
      className="design-token-swatch"
      style={{ background: value || "transparent" }}
    />
  );
}

function PairGrid({ pairs, read }: { pairs: readonly NamedPair[]; read: ModeReader }) {
  return (
    <div className="design-swatch-grid">
      {pairs.map((pair) => {
        const light = read(pair.light);
        const dark = read(pair.dark);
        return (
          <div className="design-swatch" key={pair.light}>
            <div className="design-swatch-chips">
              <span
                className="design-swatch-chip"
                style={{ background: light || "transparent" }}
              >
                <span>{light || "—"}</span>
              </span>
              <span
                className="design-swatch-chip"
                style={{ background: dark || "transparent" }}
              >
                <span>{dark || "—"}</span>
              </span>
            </div>
            <div className="design-swatch-meta">
              <strong>{pair.name}</strong>
              <small>{pair.role}</small>
              <code>{pair.light}</code>
              <code>{pair.dark}</code>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModeTable({
  caption,
  readDark,
  readLight,
  rows,
  showSwatch = true,
}: {
  caption: string;
  readDark: ModeReader;
  readLight: ModeReader;
  rows: readonly { token: string; role: string }[];
  showSwatch?: boolean;
}) {
  return (
    <table className="design-token-table">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Token</th>
          <th scope="col">Role</th>
          <th scope="col">Light</th>
          <th scope="col">Dark</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ role, token }) => {
          const light = readLight(token);
          const dark = readDark(token);
          return (
            <tr className="design-token-row" key={token}>
              <td>
                <code>{token}</code>
              </td>
              <td>{role}</td>
              <td>
                {showSwatch ? <Swatch value={light} /> : null} <code>{light || "—"}</code>
              </td>
              <td>
                {showSwatch ? <Swatch value={dark} /> : null} <code>{dark || "—"}</code>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const typeSpecimens = [
  { label: "World mast / Index title", size: "var(--portfolio-display-title-size)", letterSpacing: "-0.055em", weight: 500 },
  { label: "Reader section title", size: "var(--reader-section-title-size)", letterSpacing: "-0.02em", weight: 500 },
  { label: "Index row", size: "var(--reader-row-size)", letterSpacing: "-0.01em", weight: 400 },
  { label: "Reader copy", size: "var(--reader-copy-size)", letterSpacing: "0", weight: 400 },
  { label: "Label / meta", size: "var(--reader-label-size)", letterSpacing: "0.06em", weight: 500 },
] as const;

const spacingScale = [
  { label: "Reader gutter", value: "var(--reader-gutter)" },
  { label: "Assistant panel width", value: "var(--assistant-panel-width)" },
  { label: "Floating control", value: "var(--floating-control-size)" },
  { label: "World node hit area", value: "var(--world-hit-area)" },
  { label: "Cursor envelope", value: "var(--cursor-size)" },
  { label: "Desktop reader width", value: "var(--reader-width)" },
] as const;

export function TokenGallery() {
  const lightProbe = useRef<HTMLDivElement>(null);
  const darkProbe = useRef<HTMLDivElement>(null);
  const [readers, setReaders] = useState<{ light: ModeReader; dark: ModeReader }>({
    light: emptyReader,
    dark: emptyReader,
  });
  const [rootProperties, setRootProperties] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    const light = lightProbe.current;
    const dark = darkProbe.current;
    if (!light || !dark) return;
    const lightStyle = getComputedStyle(light);
    const darkStyle = getComputedStyle(dark);
    setReaders({
      light: (token) => lightStyle.getPropertyValue(token).trim(),
      dark: (token) => darkStyle.getPropertyValue(token).trim(),
    });
    setRootProperties(readRootCustomProperties());
  }, []);

  const prototypeTokens = [...rootProperties.entries()]
    .filter(([token]) => isPrototypeToken(token))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      {/* Two hidden probes carry the composition token block under a forced
          mode, so both columns stay true while the page shows one mode. */}
      <div
        aria-hidden="true"
        className="portfolio-composition design-token-probe"
        data-theme="light"
        ref={lightProbe}
      />
      <div
        aria-hidden="true"
        className="portfolio-composition design-token-probe"
        data-theme="dark"
        ref={darkProbe}
      />

      <Section
        id="tokens-color"
        note="Values are read out of app/globals.css at runtime, so this page cannot drift from the stylesheet. Names follow docs/design-tokens.md."
        title="Color tokens"
      >
        <Specimen
          note="Left chip is the light value, right chip the dark value."
          source="docs/portfolio-design-system-checkpoint.md"
          title="Checkpoint palette"
        >
          <PairGrid pairs={checkpointPairs} read={readers.light} />
        </Specimen>

        <Specimen
          note="Live additions to the checkpoint palette. Recorded, not approved."
          source="docs/design-tokens.md — Supporting mode pairs"
          title="Supporting mode pairs"
        >
          <PairGrid pairs={supportingPairs} read={readers.light} />
        </Specimen>

        <Specimen
          note="What a component actually consumes. Resolved from the forced-mode probes."
          source="app/globals.css — .portfolio-composition"
          title="Semantic aliases"
        >
          <ModeTable
            caption="Semantic composition color aliases and their light and dark values"
            readDark={readers.dark}
            readLight={readers.light}
            rows={semanticAliases}
          />
        </Specimen>

        <Specimen
          note="These are not mode-switched. Both columns are expected to match."
          source="app/globals.css — :root"
          title="Shadows"
        >
          <ModeTable
            caption="Shadow tokens"
            readDark={readers.dark}
            readLight={readers.light}
            rows={shadowTokens.map((token) => ({ token, role: "Shadow" }))}
          />
        </Specimen>

        <Specimen
          note="Deprecated for new composition work, still referenced by the pre-checkpoint UI."
          source="docs/design-tokens.md — Legacy prototype tokens"
          title="Legacy prototype aliases"
        >
          <ModeTable
            caption="Legacy prototype color aliases"
            readDark={readers.dark}
            readLight={readers.light}
            rows={legacyAliases}
          />
        </Specimen>

        <Specimen
          note={`Complete inventory of the ${prototypeTokens.length} --prototype-* values, enumerated from the :root rule itself.`}
          source="app/globals.css — :root"
          title="Prototype palette inventory"
        >
          <div className="design-swatch-grid">
            {prototypeTokens.map(([token, value]) => (
              <div className="design-swatch" key={token}>
                <div className="design-swatch-chips">
                  <span className="design-swatch-chip" style={{ background: value }}>
                    <span>{value}</span>
                  </span>
                </div>
                <div className="design-swatch-meta">
                  <code>{token}</code>
                </div>
              </div>
            ))}
          </div>
          {prototypeTokens.length === 0 ? (
            <p className="design-note">
              The stylesheet was not readable from script, so this inventory is
              empty. See docs/design-tokens.md for the authored list.
            </p>
          ) : null}
        </Specimen>
      </Section>

      <Section
        id="tokens-type"
        note="Neue Haas Grotesk is the shared voice of the accepted composition; Geist remains live on the pre-checkpoint pages. Both stacks are shown."
        title="Type"
      >
        <Specimen source="app/globals.css" title="Font stacks">
          <ModeTable
            caption="Font tokens"
            readDark={readers.dark}
            readLight={readers.light}
            rows={fontTokens}
            showSwatch={false}
          />
        </Specimen>

        <Specimen
          note="Rendered in --font-reader at the sizes the composition actually uses."
          source="--font-reader"
          title="Specimens"
        >
          <div className="portfolio-composition" style={{ background: "transparent" }}>
            {typeSpecimens.map((specimen) => (
              <div className="design-type-specimen" key={specimen.label}>
                <p style={{ color: "var(--map-muted)", fontSize: "var(--reader-label-size)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {specimen.label} · {specimen.size}
                </p>
                <p
                  style={{
                    fontSize: specimen.size,
                    fontWeight: specimen.weight,
                    letterSpacing: specimen.letterSpacing,
                    lineHeight: 1.1,
                  }}
                >
                  Make complexity legible enough to act on.
                </p>
              </div>
            ))}
          </div>
        </Specimen>
      </Section>

      <Section
        id="tokens-spacing"
        note="The repeated dimensions the composition names. There is no abstract 4/8pt scale in this stylesheet; these are the real recurring values."
        title="Spacing and dimensions"
      >
        <Specimen source="app/globals.css" title="Recurring dimensions">
          <ModeTable
            caption="Dimension tokens"
            readDark={readers.dark}
            readLight={readers.light}
            rows={dimensionTokens}
            showSwatch={false}
          />
          <p className="design-note">
            <code>--mobile-controls-inline-end</code> is declared only inside the
            900px breakpoint, so it resolves to an empty value on a wide viewport.
          </p>
        </Specimen>

        <Specimen note="Each bar is drawn at its token width." source="app/globals.css" title="Scale">
          <div className="portfolio-composition" style={{ background: "transparent" }}>
            {spacingScale.map((step) => (
              <div className="design-spacing-row" key={step.label}>
                <span>
                  {step.label} <code>{step.value}</code>
                </span>
                <span className="design-spacing-bar" style={{ width: step.value }} />
              </div>
            ))}
          </div>
        </Specimen>
      </Section>
    </>
  );
}
