# PortfolioReader

Source: [`components/PortfolioReader.tsx`](../../components/PortfolioReader.tsx) ·
Gallery: `/design#reader` · Tests: `components/PortfolioReader.test.tsx`

The fixed dossier — the `<aside>` holding every piece of reading on the site.
Three modes, derived from props rather than set directly and published as
`data-reader-mode`: `index`, `record` (one node), and `thread` (a narrated
path, the only long-form type). All three share this one panel instead of
spawning panels or routes (Rule 6.5). Content comes from
[`lib/portfolio-world.ts`](../../lib/portfolio-world.ts); it takes no data
props.

## Props

`activeThreadId`, `selectedId`, `onReset`, `onSelect`, `onSelectThread`
required; `onOpenVisual` and `registerAvatarTarget` optional.
Mode is `record` when `selectedId` names a non-`story` node, else `thread` when
`activeThreadId` is set, else `index`.

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
  reached through `activeThreadId`; the story node id alone falls to the index.
- **The registered avatar target follows the slug, not the mode.** It is
  `project:<slug>` only when the node has a `projectSlug`; five non-story nodes
  (including `bradley`) have none, so their *records* register
  `portfolio:index`.
- **`?review=clean` changes the rendering**, adding
  `.portfolio-reader-clean-review`. A screenshot taken with it set is not the
  default surface.
- **Index scroll position is restored by a layout effect keyed on mode.**
  Remounting instead of changing props loses it.
- **`onOpenVisual` is optional, but visual blocks are not.** Omit it and the
  in-record triggers render with nothing to open.
