# PortfolioReader

Source: [`components/PortfolioReader.tsx`](../../components/PortfolioReader.tsx) · Gallery: `/design#reader` · Tests: `components/PortfolioReader.test.tsx`

The dossier `<aside>` handles `about`, `record`, and `thread` reading modes with
Privacy as its final in-flow line. Paragraphs support inline links and lists;
visuals support image, gallery, and video evidence. Images and galleries stay
transparent and open over the Reader. Videos loop muted inside an official
Apple frame composited over standard video, pausing offscreen or behind their
full-viewport raw player. `.reader-scroll` owns position and attention tracking;
time stops while hidden, unfocused, or idle. Analytics emit only safe IDs and kinds.

## Props

`activeThreadId`, `selectedId`, `onReset`, `onSelect`, and `onSelectThread` are
required. Each grouped-gallery trigger opens the Reader overlay on its own
first asset. Mode is `record` for a non-Why, non-`bradley` `selectedId`, then
`thread` when `activeThreadId` resolves, and `about` otherwise.

## Requires

A `.portfolio-composition` ancestor for tokens and a parent with a resolved
height. The Reader fills its slot. Its scroll column is centered at up to
680px with 24px gutters, which caps content at 632px; narrower slots reflow it.

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

- **A `story`-family node in `selectedId` does not open a record.** Stories
  are reached through `activeThreadId`.
- **`?review=clean` changes the rendering,** adding
  `.portfolio-reader-clean-review`; it is not the default surface.
- **The content area (`.reader-scroll`) scrolls, not the aside.** Each About,
  record, or thread opens at the top. Moving the Reader preserves this element,
  and analytics must observe it rather than document scroll.
- **Reader has no route back to Contents.** The Reading Room mast and Contents
  panel own Home and selection navigation.
- **Visual state belongs to the Reader.** Escape and close return focus to the
  trigger. Videos use a static device shell and hardware-decodable inline MP4;
  the controlled raw player portals to the viewport. Other overlays stay bounded.
- **Reader gallery groups are not overlay pages.** The dossier keeps the
  authored groups, while the overlay advances one flattened asset at a time.
