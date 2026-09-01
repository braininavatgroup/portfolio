// Token metadata for the /design gallery.
//
// Only names and roles are authored here. Every *value* is read back out of
// the live stylesheet at runtime, so the gallery cannot drift from
// app/globals.css the way a hand-copied table would.

export type NamedPair = {
  name: string;
  role: string;
  light: string;
  dark: string;
};

/** The checkpoint palette, as named in docs/portfolio-design-system-checkpoint.md. */
export const checkpointPairs: readonly NamedPair[] = [
  {
    name: "Silver / world paper",
    role: "World background",
    light: "--map-silver",
    dark: "--map-paper-dark",
  },
  {
    name: "Reader paper",
    role: "Dossier surface",
    light: "--reader-paper-light",
    dark: "--reader-paper-dark",
  },
  {
    name: "Brown-black ink / warm ink",
    role: "Composition ink and identity",
    light: "--reader-ink-light",
    dark: "--reader-ink-dark",
  },
  {
    name: "Lichen / Acid",
    role: "Story register",
    light: "--world-lichen",
    dark: "--world-acid",
  },
  {
    name: "Hard red / Signal red",
    role: "Finding register",
    light: "--world-hard-red",
    dark: "--world-signal-red",
  },
  {
    name: "Electric pink / Hot pink",
    role: "Operations register",
    light: "--world-electric-pink",
    dark: "--world-hot-pink",
  },
  {
    name: "Violet",
    role: "Bridge register",
    light: "--world-violet",
    dark: "--world-violet-dark",
  },
  {
    name: "Production cyan",
    role: "In Production register",
    light: "--world-production-cyan",
    dark: "--world-production-cyan-dark",
  },
];

/** Live extensions to the checkpoint palette that still switch by mode. */
export const supportingPairs: readonly NamedPair[] = [
  {
    name: "Near paper",
    role: "Near-paper world surfaces",
    light: "--map-paper-near-light",
    dark: "--map-paper-near-dark",
  },
  {
    name: "Map muted",
    role: "Map labels and secondary controls",
    light: "--map-muted-light",
    dark: "--map-muted-dark",
  },
  {
    name: "Silverpoint rule",
    role: "Relationship and rule treatment",
    light: "--map-line-light",
    dark: "--map-line-dark",
  },
  {
    name: "Strong rule",
    role: "Strong rules and control outlines",
    light: "--map-line-strong-light",
    dark: "--map-line-strong-dark",
  },
  {
    name: "Placeholder grid",
    role: "Placeholder grids",
    light: "--map-grid-light",
    dark: "--map-grid-dark",
  },
  {
    name: "Reader summary",
    role: "Reader summary copy",
    light: "--reader-summary-light",
    dark: "--reader-summary-dark",
  },
  {
    name: "Reader body",
    role: "Reader body copy",
    light: "--reader-body-light",
    dark: "--reader-body-dark",
  },
  {
    name: "Reader muted",
    role: "Reader labels and metadata",
    light: "--reader-muted-light",
    dark: "--reader-muted-dark",
  },
];

/**
 * Mode-aware aliases. The gallery resolves these against two probe elements —
 * one forced light, one forced dark — so both columns are true even while the
 * page itself is showing a single mode.
 */
export const semanticAliases: readonly { token: string; role: string }[] = [
  { token: "--ink", role: "Composition ink" },
  { token: "--map-paper", role: "World background" },
  { token: "--map-paper-near", role: "Near-paper surfaces" },
  { token: "--map-muted", role: "Map secondary ink" },
  { token: "--map-line", role: "Neutral relationship and rule treatment" },
  { token: "--map-line-strong", role: "Strong rule treatment" },
  { token: "--map-grid", role: "Placeholder grid" },
  { token: "--reader-paper", role: "Dossier surface" },
  { token: "--reader-summary", role: "Summary copy" },
  { token: "--reader-body", role: "Body copy" },
  { token: "--reader-muted", role: "Labels and metadata" },
  { token: "--world-identity", role: "Bradley identity mark" },
  { token: "--world-story", role: "Story marks" },
  { token: "--world-finding", role: "Finding marks" },
  { token: "--world-warm", role: "Operations marks" },
  { token: "--world-bridge", role: "Bridge marks" },
  { token: "--world-cool", role: "In Production marks" },
];

/** Shadow tokens, which the live stylesheet does not switch by mode. */
export const shadowTokens: readonly string[] = [
  "--reader-stage-shadow",
  "--reader-media-shadow",
  "--reader-gallery-shadow",
  "--reader-assistant-shadow",
  "--reader-floating-control-shadow",
];

/** Prototype aliases that predate the checkpoint and remain referenced. */
export const legacyAliases: readonly { token: string; role: string }[] = [
  { token: "--accent", role: "Prototype actions and light-theme controls" },
  { token: "--accent-ink", role: "Ink on --accent" },
  { token: "--background", role: "Prototype page background" },
  { token: "--foreground", role: "Prototype primary ink" },
  { token: "--line", role: "Prototype rules" },
  { token: "--muted", role: "Prototype secondary ink" },
  { token: "--surface", role: "Prototype panels" },
];

export const dimensionTokens: readonly { token: string; role: string }[] = [
  { token: "--portfolio-display-title-size", role: "World mast and reader Index title" },
  { token: "--reader-width", role: "Fixed desktop dossier width" },
  { token: "--reader-gutter", role: "Repeated reader and visual-stage gutter" },
  { token: "--reader-label-size", role: "Repeated label and meta size" },
  { token: "--reader-copy-size", role: "Repeated reader copy size" },
  { token: "--reader-row-size", role: "Reader summary and index row size" },
  { token: "--reader-section-title-size", role: "Reader section heading size" },
  { token: "--assistant-panel-width", role: "Accepted assistant panel width" },
  { token: "--floating-control-size", role: "Assistant trigger and mobile view control" },
  { token: "--world-hit-area", role: "World node button hit area" },
  { token: "--cursor-size", role: "Segmented cursor envelope" },
  { token: "--mobile-controls-inline-end", role: "Mobile floating-control inset" },
];

export const fontTokens: readonly { token: string; role: string }[] = [
  { token: "--font-reader", role: "Accepted world and reader type stack" },
  { token: "--font-prototype-sans", role: "Prototype sans stack" },
  { token: "--font-prototype-sans-short", role: "Prototype sans stack, short fallback" },
  { token: "--font-prototype-mono", role: "Prototype mono stack" },
];

/**
 * Reads every custom property declared on `:root` straight out of the
 * document's own stylesheets. This is how the prototype inventory stays
 * complete without restating ~150 values in gallery code.
 */
export function readRootCustomProperties(): ReadonlyMap<string, string> {
  const properties = new Map<string, string>();
  if (typeof document === "undefined") return properties;

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // A cross-origin stylesheet (the hosted webfonts) cannot be inspected.
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      if (rule.selectorText !== ":root") continue;
      for (const property of Array.from(rule.style)) {
        if (!property.startsWith("--")) continue;
        properties.set(property, rule.style.getPropertyValue(property).trim());
      }
    }
  }

  return properties;
}

export function isPrototypeToken(token: string) {
  return token.startsWith("--prototype-");
}
