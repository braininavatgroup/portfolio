# PortfolioReader

Source: [`components/PortfolioReader.tsx`](../../components/PortfolioReader.tsx) · Gallery: `/design#reader` · Tests: `components/PortfolioReader.test.tsx`

The dossier `<aside>` handles About, records, threads, and media evidence. Privacy stays last; `.reader-scroll` owns position and attention tracking.

## Props

All five props are required. Gallery groups open on their first asset. Mode resolves to a selected record, an active thread, then About.

## Requires

A `.portfolio-composition` token ancestor and resolved parent height. The 680px column has 24px gutters. Laptop shells fit the 632px content track after canvas trimming; recordings fill the screen aperture.

## Example

```tsx
import { PortfolioReader } from "components/PortfolioReader";
import { useState } from "react";

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
```

## Pitfalls

- **A story-family `selectedId` does not open a record.** Use `activeThreadId`.
- **`?review=clean` adds `.portfolio-reader-clean-review`;** it is not default.
- **The content area (`.reader-scroll`) scrolls, not the aside.** Each About,
  record, or thread opens at the top. Moving the Reader preserves this element,
  and analytics must observe it rather than document scroll.
- **Reader has no route back to Contents.** Its mast and panel own navigation.
- **Inline links are anchors**, so punctuation wraps with the preceding phrase. Primary clicks use controlled navigation; modified clicks retain the destination URL. Related rows and headings match Contents on mobile and desktop.
- **Inline previews:** `lib/portfolio-link-preview.ts` selects destination overrides or the first ready still, including captured dashboard and touring demos.
  Hover/focus shows images up to 400×280px; touch shows none. Scroll dismisses; load/resize repositions.
  Logo/glyph masks use the register’s RGB inverse with transparent backgrounds; links retain their color.
- **The Reader owns visual state.** Image and gallery overlays stay bounded over a translucent paper wash and slight blur. The overlay names the current
  asset, centers the label and `n of total` navigation, and restores trigger
  focus on close.
- **Videos stay inline.** Framed silent loops enter native fullscreen, with
  iPhone fallback. Exit restores the loop, composition, and cursor. Kickoff and
  pitching use baked local redactions; pitching stops at 2:40. Optional Mux
  playback uses size-aware HLS.js or native HLS, with an MP4 fallback.
- **Reader gallery groups are not overlay pages.** Groups sit in rows of three
  phones or one larger phone; the overlay advances one flattened asset at a time.
  A `layout: "carousel"` gallery renders each group as one [`ReaderCarousel`](./ReaderCarousel.md) strip and never opens the overlay.
- **Lazy screenshots need intrinsic dimensions.** Dubs and Writ asset metadata
  supplies source `width` and `height`, passed through to plain images and
  `MacPanelFrame`. Without them WebKit gives pending images zero height and
  collapses the gallery until decoding finishes.
- **Interactive work samples stay in the Reader;** QuarterlyDashboard and TouringDemo use their full working components without separate full-page links.
- **Campaign reports use native iframes.** `preview: "campaign-report"` uses `href` for the report, `src` for the capture on other preview origins, and always offers the full-report link.
  The 1,280px frame scrolls natively. Allowed origins must match the host's `frame-ancestors`; never proxy reports or strip headers.
