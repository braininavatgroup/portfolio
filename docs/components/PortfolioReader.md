# PortfolioReader

Source: [`components/PortfolioReader.tsx`](../../components/PortfolioReader.tsx) · Gallery: `/design#reader` · Tests: `components/PortfolioReader.test.tsx`

The dossier `<aside>` handles `about`, `record`, and `thread` modes, linked prose,
and image, gallery, video, and dashboard evidence. Privacy stays last in flow;
`.reader-scroll` owns position and attention tracking.

## Props

All five props are required. Each gallery group opens on its first asset. Mode
resolves to an ordinary selected record, then an active thread, then About.

## Requires

A `.portfolio-composition` token ancestor and resolved parent height. The
680px column has 24px gutters. Laptop shells fit its 632px content track after
their transparent canvas is trimmed; the full recording fills the screen aperture.

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
- **The Reader owns visual state.** Image and gallery overlays stay bounded
  over a translucent paper wash and slight blur. The overlay names the current
  asset, centers the label and `n of total` navigation, and restores trigger
  focus on close.
- **Ready videos do not use the Reader overlay.** A framed, silent loop prefers
  Mux HLS (`muxPlaybackId`) with a sharp-screen floor and keeps its MP4 fail-safe.
  Capable browsers use size-aware HLS.js; native HLS is the fallback. It enters
  fullscreen, with iPhone fallback; exit restores the loop, full composition,
  and system cursor.
- **Reader gallery groups are not overlay pages.** The dossier keeps the
  authored groups in shared rows of either three equal phones or one larger
  phone, while the overlay advances one flattened asset at a time.
- **Interactive dashboards stay in the Reader;** their full-page links report their own opens.
