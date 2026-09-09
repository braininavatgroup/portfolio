/** Shared rendering contract. Artwork owns its optical position; consumers
 * choose a context size, never a per-icon scale or translation. */
export const PORTFOLIO_GLYPH = {
  // Presentation only: preserve authored paths, layout envelopes, and hit areas.
  artworkScale: 0.9,
  control: { surface: 20, ink: 18, stroke: 1.25 },
  node: { surface: 18, stroke: 1.45 },
  lineCap: "round",
  lineJoin: "round",
} as const;

export const PORTFOLIO_GLYPH_SIZES = {
  standard: 20,
  inline: 18,
  compact: 16,
  small: 14,
} as const;
export type PortfolioGlyphSize = keyof typeof PORTFOLIO_GLYPH_SIZES;
