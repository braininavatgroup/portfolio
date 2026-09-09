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
  { token: "--reader-body", role: "Body copy" },
  { token: "--reader-drop-fill", role: "Drag-target and chrome-hover fill" },
  { token: "--reader-muted", role: "Labels and metadata" },
  { token: "--world-identity", role: "Bradley identity mark" },
  { token: "--world-story", role: "Story marks" },
  { token: "--world-arc", role: "Arc register marks" },
  { token: "--world-warm", role: "Operations marks" },
  { token: "--world-bridge", role: "Bridge marks" },
  { token: "--world-cool", role: "In Production marks" },
  { token: "--world-chem", role: "Chemical register — the Brain Food status line" },
];

/** Shadow tokens, which the live stylesheet does not switch by mode. */
export const shadowTokens: readonly string[] = [
  "--reader-stage-shadow",
  "--reader-media-shadow",
  "--reader-gallery-shadow",
  "--reader-assistant-shadow",
];
export const dimensionTokens: readonly { token: string; role: string }[] = [
  { token: "--reader-space-1", role: "8 — label to content, row padding, figure margin" },
  { token: "--reader-space-2", role: "16 — paragraph gap, title to summary, band padding" },
  { token: "--reader-space-3", role: "24 — the page inset; mobile gutter" },
  { token: "--reader-space-4", role: "32 — desktop gutter, summary to body, index group gap" },
  { token: "--reader-space-6", role: "48 — reserved; unused in the approved states" },
  { token: "--reader-space-8", role: "64 — above every section label" },
  { token: "--reader-type-display", role: "36/40 · 500 — mast and every dossier title" },
  { token: "--reader-type-summary", role: "18/24 — record summary, thread lede" },
  { token: "--reader-type-row", role: "16/24 — index, related, explore, contact rows" },
  { token: "--reader-type-body", role: "15/24 — paragraphs" },
  { token: "--reader-type-caption", role: "12/16 — captions, footer and control labels, placeholder meta" },
  { token: "--reader-type-label", role: "11/16 · 500 · uppercase — section and placeholder labels, stage eyebrow" },
  { token: "--world-hit-area", role: "World node button hit area" },
  { token: "--cursor-size", role: "Segmented cursor envelope" },
  { token: "--mobile-controls-inline-end", role: "Mobile chat inset — declared only inside the 600px block, so it is empty at desktop" },
];

export const fontTokens: readonly { token: string; role: string }[] = [
  { token: "--font-reader", role: "The site's type stack — Neue Haas Grotesk everywhere" },
  { token: "--font-prototype-mono", role: "System monospace. Only where the content is literally code — this gallery's source paths and token names" },
];
