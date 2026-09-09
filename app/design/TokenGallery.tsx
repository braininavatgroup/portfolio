"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { portfolioInterfaceText } from "../../lib/portfolio-world";
import { Section } from "./gallery-ui";
import {
  dimensionTokens,
  fontTokens,
  semanticAliases,
  shadowTokens,
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

/**
 * Each specimen renders the sample inside the real class, under
 * `.portfolio-composition`, so size, weight, tracking and line-height all come
 * from the cascade. The previous version restated them as literals and four of
 * five had drifted — on the page whose job is to be the source of truth for
 * type.
 */
const typeSpecimens: readonly {
  label: string;
  selector: string;
  render: (sample: string) => ReactNode;
}[] = [
  {
    label: "Display — mast and every dossier title",
    selector: ".portfolio-world-mast",
    render: (sample) => <div className="portfolio-world-mast">{sample}</div>,
  },
  {
    label: "Summary",
    selector: ".reader-summary",
    render: (sample) => <p className="reader-summary">{sample}</p>,
  },
  {
    label: "Row",
    selector: ".reader-index-row",
    render: (sample) => (
      <ul className="reader-rows">
        <li>
          <button className="reader-index-row" type="button">
            <span>{sample}</span>
          </button>
        </li>
      </ul>
    ),
  },
  {
    label: "Body copy",
    selector: ".reader-composed-body > p",
    render: (sample) => (
      <div className="reader-composed-body">
        <p>{sample}</p>
      </div>
    ),
  },
  {
    label: "Caption",
    selector: ".reader-visual-block figcaption",
    render: (sample) => (
      <figure className="reader-visual-block">
        <figcaption>{sample}</figcaption>
      </figure>
    ),
  },
  {
    label: "Label",
    selector: ".reader-record-section h2",
    render: (sample) => (
      <div className="reader-record-section">
        <h2>{sample}</h2>
      </div>
    ),
  },
];

export function TokenGallery() {
  const lightProbe = useRef<HTMLDivElement>(null);
  const darkProbe = useRef<HTMLDivElement>(null);
  const [readers, setReaders] = useState<{ light: ModeReader; dark: ModeReader }>({
    light: emptyReader,
    dark: emptyReader,
  });
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
  }, []);

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
        note="Every value is resolved from the live stylesheet through two forced-mode probes, so the columns cannot drift. These aliases are the only colour names new composition CSS should use."
        source="app/globals.css — .portfolio-composition"
        title="Color tokens"
      >
        <ModeTable
          caption="Semantic composition colour aliases and their light and dark values"
          readDark={readers.dark}
          readLight={readers.light}
          rows={semanticAliases}
        />
        <p className="design-note" style={{ margin: "18px 0 0" }}>
          Shadows below are not mode-switched; both columns are expected to
          match. The remaining <code>--prototype-*</code> values are a shrinking
          inventory of pre-checkpoint CSS, listed with their roles in{" "}
          <code>docs/design-tokens.md</code> — deliberately not rendered here.
          Their count is asserted by <code>tests/design-tokens.test.ts</code>
          rather than restated, because it moves every time one is retired.
        </p>
        <ModeTable
          caption="Shadow tokens"
          readDark={readers.dark}
          readLight={readers.light}
          rows={shadowTokens.map((token) => ({ token, role: "Shadow, not mode-switched" }))}
        />
      </Section>

      <Section
        id="tokens-type"
        note="Neue Haas Grotesk is the whole site's voice. Each specimen renders in the live class it names, so the sizes and tracking are read from the stylesheet rather than restated."
        source="app/globals.css"
        title="Type"
      >
        <ModeTable
          caption="Font tokens"
          readDark={readers.dark}
          readLight={readers.light}
          rows={fontTokens}
          showSwatch={false}
        />
        {/* Both modes, side by side. The table above resolves the tokens to
            text, which tells you the value and shows you nothing — and type is
            the one place where the value is not the point. Each pair pins
            [data-theme] on its own .portfolio-composition, the same mechanism
            the composition uses for prefers-color-scheme. */}
        {typeSpecimens.map((specimen) => (
          <div className="design-type-specimen" key={specimen.selector}>
            <p className="design-type-specimen-label">
              {specimen.label} · <code>{specimen.selector}</code>
            </p>
            <div className="design-mode-pair">
              {(["light", "dark"] as const).map((mode) => (
                <div
                  className="design-mode-pane portfolio-composition"
                  data-mode={mode}
                  data-theme={mode}
                  key={mode}
                >
                  {specimen.render(portfolioInterfaceText["index.throughline"])}
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section
        id="tokens-spacing"
        note="The repeated dimensions the composition names. There is no abstract 4/8pt scale in this stylesheet; these are the real recurring values."
        source="app/globals.css — :root"
        title="Spacing and dimensions"
      >
        <ModeTable
          caption="Dimension tokens"
          readDark={readers.dark}
          readLight={readers.light}
          rows={dimensionTokens}
          showSwatch={false}
        />
      </Section>
    </>
  );
}
