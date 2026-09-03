# PortfolioReader

Source: [`components/PortfolioReader.tsx`](../../components/PortfolioReader.tsx) ·
Gallery: `/design#reader` · Tests: `components/PortfolioReader.test.tsx`

The embedded dossier is the `<aside>` holding every piece of reading on the site.
Its `data-reader-mode` is `about`, `record`, or `thread`. All share one section
model (64 above a label, rows as `ul > li > button`), with Privacy as the final
in-flow line. It has no kind chip, path line, index mode, or footer navigation.
Containing threads lead a record's Related rows. Paragraphs may carry `[phrase](record:<id>)` /
`[phrase](thread:<id>)` (`.reader-inline-link` buttons) and `[phrase](https://…)`
(new-tab anchors in ink); `- ` lines render as `.reader-list` bullets. It exports
`ReaderPlaceholderFrame`, the draft frame the visual stage reuses. Content comes
from `lib/portfolio-world.ts`; authored text lives in `content/portfolio-content.json`.

## Props

`activeThreadId`, `selectedId`, `onReset`, `onSelect`, and `onSelectThread` are
required. `indexOpen` and `onOpenIndex` are deprecated ignored compatibility
props until the Reading Room shell removes its old callers. `onOpenVisual` is
optional. Mode is
`record` for a non-Why, non-`bradley` `selectedId`, then `thread` when
`activeThreadId` resolves, and `about` otherwise.

## Requires

A `.portfolio-composition` ancestor for tokens and a parent with a resolved
height. The Reader fills its slot. Its scroll column stays centered at 680px
with 24px gutters, which caps content at 632px.

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
  record, or thread selection opens at the top. Moving the mounted Reader
  between Reading Room slots preserves the scroll element itself.
- **Reader has no route back to Contents.** The Reading Room mast and Contents
  panel own Home and selection navigation.
- **`onOpenVisual` is optional, but visual blocks are not.** Omit it and the
  triggers open nothing.
