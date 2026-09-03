# PortfolioReader

Source: [`components/PortfolioReader.tsx`](../../components/PortfolioReader.tsx) · Gallery: `/design#reader` · Tests: `components/PortfolioReader.test.tsx`

The embedded dossier is the `<aside>` holding all site reading. Its
`data-reader-mode` is `about`, `record`, or `thread`; all share one section
model, with Privacy as the final in-flow line and no footer navigation.
Paragraphs support record, thread, and external inline links plus list lines.
`ReaderPlaceholderFrame` is the draft frame reused by the visual stage. Content
comes from `lib/portfolio-world.ts`; authored text lives in the content JSON.
Ready galleries render every slide as a separate visual. The persistent
`.reader-scroll` supplies attention and completion observations: time stops
when hidden, unfocused, or idle, and completion follows nested scroll rather
than body scroll. Actions report only safe IDs and kinds.

## Props

`activeThreadId`, `selectedId`, `onReset`, `onSelect`, and `onSelectThread` are
required. `onOpenVisual` is optional and receives the block, trigger, and the
flattened opening frame; each grouped-gallery trigger opens on its own first
asset. Mode is `record` for a non-Why, non-`bradley` `selectedId`, then
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
- **`onOpenVisual` is optional, but visual blocks are not.** Omit it and the
  triggers open nothing.
- **Reader gallery groups are not stage pages.** The dossier keeps the authored groups, while the map stage advances one flattened asset at a time.
