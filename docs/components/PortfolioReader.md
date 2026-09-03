# PortfolioReader

Source: [`components/PortfolioReader.tsx`](../../components/PortfolioReader.tsx) ·
Gallery: `/design#reader` · Tests: `components/PortfolioReader.test.tsx`

The fixed dossier — the `<aside>` holding every piece of reading on the site.
Four modes, derived from props and published as `data-reader-mode`: `home`
(About, titled by its summary), `index`, `record`, and `thread`. All share one
section model (64 above a label, rows as `ul > li > button`), one **Index**
(or **Home**) control laid over the scroll's bottom-left corner, and Privacy
as the last line. No kind chip, path line, or Threads section: a record's containing
threads lead its Related rows. Paragraphs may carry `[phrase](record:<id>)` /
`[phrase](thread:<id>)` (`.reader-inline-link` buttons) and `[phrase](https://…)`
(new-tab anchors in ink); `- ` lines render as `.reader-list` bullets. It exports
`ReaderPlaceholderFrame`, the draft frame the visual stage reuses. Content comes
from `lib/portfolio-world.ts`; authored text lives in `content/portfolio-content.json`. A ready grouped gallery renders every slide as a separate reader visual.

## Props

`activeThreadId`, `selectedId`, `onReset`, `onSelect`, `onSelectThread`
required; `indexOpen`, `onOpenIndex`, and `onOpenVisual` optional. Mode:
`record` for a non-`story`, non-`bradley` `selectedId`; else
`thread` if `activeThreadId`; else `index` if `indexOpen`; else `home`.

## Requires

A `.portfolio-composition` ancestor for the tokens and `--reader-width`.

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
- **`?review=clean` changes the rendering**, adding
  `.portfolio-reader-clean-review`; it is not the default surface.
- **The content area (`.reader-scroll`) scrolls, not the aside.** Index scroll
  position is restored on it by a layout effect keyed on mode; every other
  mode opens at its top. Remounting loses the index position.
- **A record has no Home control.** Its footer offers Index; Home is the index
  state's own control. Escape and blank-space click still reset.
- **`onOpenVisual` is optional, but visual blocks are not.** Omit it and the
  triggers open nothing.
