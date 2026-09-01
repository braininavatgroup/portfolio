# PortfolioReader

Source: [`components/PortfolioReader.tsx`](../../components/PortfolioReader.tsx) ·
Gallery: `/design#reader` · Tests: `components/PortfolioReader.test.tsx`

The fixed dossier — the `<aside>` that holds every piece of reading on the
site. It has exactly three modes, derived from its props rather than set
directly and published as `data-reader-mode`: `index` (the portfolio index,
with a Threads group), `record` (one node), and `thread` (a narrated path, the
only long-form type). Index, thread, and record share this one panel instead of
becoming separate panels or routes (design conventions Rule 6.5). All content
comes from [`lib/portfolio-world.ts`](../../lib/portfolio-world.ts); the
component takes no data props.

## Props

`activeThreadId`, `selectedId`, `onReset`, `onSelect`, `onSelectThread` are
required; `onOpenVisual`, `registerAvatarTarget`, and `spotlightTarget` are
optional. See
[`PortfolioReaderProps`](../../components/PortfolioReader.tsx).

Mode is `record` when `selectedId` names a non-`story` node, otherwise `thread`
when `activeThreadId` is set, otherwise `index`.

## Requires

A `.portfolio-composition` ancestor for the tokens and `--reader-width`. It
sizes itself from `--reader-width` (`clamp(460px, 38vw, 560px)`, `100%` below
900px), so a standalone host must set that or accept the default.
`registerAvatarTarget` receives `project:<slug>` for a record and
`portfolio:index` otherwise.

## Example

Import: `import { PortfolioReader } from "./PortfolioReader";`

```tsx
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
  reached through `activeThreadId`; passing the story node id alone falls
  through to the index.
- **`spotlightTarget` must equal the reader's *own* target** —
  `portfolio:index`, or `project:<slug>` for the selected node — or the
  spotlight treatment never applies. Passing `"portfolio:chat"` does nothing
  here.
- **`?review=clean` changes the rendering.** The query string adds
  `.portfolio-reader-clean-review`; a screenshot taken with it set is not the
  default surface.
- **Index scroll position is restored by the component** via a layout effect
  keyed on mode. Remounting the reader instead of changing its props loses it.
- **`onOpenVisual` is optional but visual blocks are not.** Omit it and the
  in-record visual triggers render without a way to open anything.
