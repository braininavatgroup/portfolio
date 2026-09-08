# PortfolioContents

Source: [`components/PortfolioContents.tsx`](../../components/PortfolioContents.tsx) ·
Gallery: `/design#contents` · Tests: `components/PortfolioContents.test.tsx`

The Reading Room's navigation column. Its Home mast sits above Background, Solutions, Products, and Themes,
in the order defined by `portfolioWorldIndexSections`. Every row uses a short label,
a trailing register mark, and one selection state. Record rows update Reader
and Map through `onSelect`; thread rows use `onSelectThread`.

## Props

`selectedId`, `activeThreadId`, `onHome`, `onSelect`, and `onSelectThread` are
required. Pass `onNavigate` in the mobile shell to switch to Reader after any
Home, record, or thread selection. Pass optional `onClose` in the desktop shell
to make the sidebar control collapse Contents without changing selection.

## Requires

A `.portfolio-composition` ancestor supplies its surface, ink, register, and
focus tokens. Its parent must provide a resolved height so the body can scroll.

## Example

```tsx
import { PortfolioContents } from "components/PortfolioContents";
import { useState } from "react";

export function PortfolioContentsExample() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  return (
    <div className="portfolio-composition">
      <PortfolioContents
        activeThreadId={activeThreadId}
        onHome={() => {
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

- **About is not a row.** The Bradley mast is the only Home entry.
- **The mast carries no brain.** It is the sidebar control and the name on one
  unwrappable line; the Reader bar's brain is the only brain in the top row.
- **Thread selection uses the thread id.** Do not send its backing Story node
  through `onSelect`.
- **`onNavigate` runs after selection.** It is a tab handoff, not a substitute
  for updating the controlled selection.
- **`onClose` is layout-only.** It must not call Home, reset a thread, or invoke
  `onNavigate`.
- **Rows have the only hover fill.** It is limited to fine pointers. Selection
  uses the row's register color and weight rather than the hover background.
