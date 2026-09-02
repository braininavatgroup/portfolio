// Token metadata for the /design gallery.
//
// Only names and roles are authored here. Every *value* is read back out of
// the live stylesheet at runtime, so the gallery cannot drift from
// app/globals.css the way a hand-copied table would.

export const semanticAliases: readonly { token: string; role: string }[] = [
  { token: "--ink", role: "Composition ink" },
  { token: "--map-paper", role: "World background" },
  { token: "--map-paper-near", role: "Near-paper surfaces" },
  { token: "--map-muted", role: "Map secondary ink" },
  { token: "--map-connector", role: "Canvas relationship lines, read by PortfolioWorld" },
  { token: "--map-line", role: "Neutral relationship and rule treatment" },
  { token: "--map-line-strong", role: "Strong rule treatment" },
  { token: "--map-grid", role: "Placeholder grid" },
  { token: "--reader-paper", role: "Dossier surface" },
  { token: "--reader-summary", role: "Summary copy" },
  { token: "--reader-body", role: "Body copy" },
  { token: "--reader-muted", role: "Labels and metadata" },
  { token: "--world-identity", role: "Bradley identity mark" },
  { token: "--world-story", role: "Story marks" },
  { token: "--world-arc", role: "From argument to instrument marks" },
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
  { token: "--mobile-controls-inline-end", role: "Mobile floating-control inset — declared only inside the 600px block, so it is empty at desktop" },
];

export const fontTokens: readonly { token: string; role: string }[] = [
  { token: "--font-reader", role: "The site's type stack — Neue Haas Grotesk everywhere" },
  { token: "--font-prototype-mono", role: "System monospace. Only where the content is literally code — this gallery's source paths and token names" },
];
