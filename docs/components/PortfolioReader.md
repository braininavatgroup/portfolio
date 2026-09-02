# PortfolioReader

Source: [`components/PortfolioReader.tsx`](../../components/PortfolioReader.tsx) ·
Gallery: `/design#reader` · Tests: `components/PortfolioReader.test.tsx`

The fixed dossier — the `<aside>` holding every piece of reading on the site.
Four modes, derived from props rather than set directly and published as
`data-reader-mode`: `home` (the About record, untitled), `index` (the grouped
list, opened from the footer), `record` (one node), and `thread` (a narrated
path, the only long-form type). All four share this one panel instead of
spawning panels or routes (Rule 6.5). Body paragraphs may carry inline
`[phrase](record:<id>)` / `[phrase](thread:<id>)` links, rendered as
`.reader-inline-link` buttons that call `onSelect` / `onSelectThread`. Content comes from
the validated runtime model exported by
[`lib/portfolio-world.ts`](../../lib/portfolio-world.ts); canonical authored
text lives in `content/portfolio-content.json`. It takes no data props.

## Props

`activeThreadId`, `selectedId`, `onReset`, `onSelect`, `onSelectThread`
required; `indexOpen`, `onOpenIndex`, `onOpenVisual` and `registerAvatarTarget`
optional. Mode is `record` when `selectedId` names a non-`story` node other
than `bradley`, else `thread` when `activeThreadId` is set, else `index` when
`indexOpen`, else `home`. Selecting `bradley` lands on `home`.

## Requires

A `.portfolio-composition` ancestor for the tokens and `--reader-width`
(`clamp(460px, 38vw, 560px)`, `100%` below 900px).

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

- **A `story`-family node in `selectedId` does not open a record.** Stories are
  reached through `activeThreadId`; the story node id alone falls to home.
- **The registered avatar target follows outline type.** What records use
  `portfolio:record:<id>`; everything else uses `portfolio:index`.
- **`?review=clean` changes the rendering**, adding
  `.portfolio-reader-clean-review`. A screenshot taken with it set is not the
  default surface.
- **Index scroll position is restored by a layout effect keyed on mode**;
  every other mode opens at its top. Remounting loses the index position.
- **`onOpenVisual` is optional, but visual blocks are not.** Omit it and the
  triggers render with nothing to open.
