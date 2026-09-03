# PortfolioReadingRoom

Source: [`components/PortfolioReadingRoom.tsx`](../../components/PortfolioReadingRoom.tsx) · Gallery: `/design#reading-room` ·
Tests: `components/PortfolioReadingRoom.test.tsx`, `components/PortfolioReadingRoom.drag.test.tsx`

The controlled responsive shell. At 1020px and above, Contents sits beside a
main view and two stacked side views; dragging a 40px bar swaps Reader, Map, or
Guide. Below 1020px it becomes Contents, Reader, and Map tabs; Map holds Guide at 52/48.

Panel sizes persist through `react-resizable-panels`; slot assignments and
hidden views persist separately through `lib/reading-room-layout.ts`.

## Props

Pass one controlled `reader`, `map`, and `guide`; `map` accepts optional `compact`
and `nodesInTabOrder`. Selection uses `selectedId`, `selectedSubject`,
`activeThreadId`, `onSelect`, and `onSelectThread`. Home and Guide coordination
use `onHome`, `onGuideReset`, `guideHasThread`, and `onGuideVisibilityChange`.

`mobileTabRequest` reveals Reader or Map; `onEscapeBeforeRoom` can consume Escape
before Guide reset/Home. `storage` is a test/gallery seam; omit it in production.

## Requires

A `.portfolio-composition` ancestor provides tokens. Mount the viewport-filling
shell once; its live Map must size from its slot.

## Example

```tsx
import { galleryAskPortfolio, galleryRenderTurnstile } from "app/design/fixtures";
import { PortfolioChat } from "components/PortfolioChat";
import { PortfolioReader } from "components/PortfolioReader";
import { PortfolioReadingRoom } from "components/PortfolioReadingRoom";
import { PortfolioWorld } from "components/PortfolioWorld";
import { useState } from "react";

export function PortfolioReadingRoomExample() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [guideHasThread, setGuideHasThread] = useState(false);

  return (
    <div className="portfolio-composition">
      <PortfolioReadingRoom
        activeThreadId={activeThreadId}
        guide={(
          <PortfolioChat
            askPortfolio={galleryAskPortfolio}
            onThreadStateChange={setGuideHasThread}
            renderTurnstile={galleryRenderTurnstile}
          />
        )}
        guideHasThread={guideHasThread}
        map={(
          <PortfolioWorld
            activeThreadId={activeThreadId}
            onReset={() => setSelectedId(null)}
            onSelect={(node) => setSelectedId(node.id)}
            selectedId={selectedId}
          />
        )}
        onGuideReset={() => setGuideHasThread(false)}
        onHome={() => {
          setSelectedId(null);
          setActiveThreadId(null);
        }}
        onSelect={(node) => setSelectedId(node.id)}
        onSelectThread={setActiveThreadId}
        reader={(
          <PortfolioReader
            activeThreadId={activeThreadId}
            onReset={() => setSelectedId(null)}
            onSelect={(node) => setSelectedId(node.id)}
            onSelectThread={setActiveThreadId}
            selectedId={selectedId}
          />
        )}
        selectedId={selectedId}
        selectedSubject={null}
      />
    </div>
  );
}
```

## Pitfalls

- **The owner keeps navigation state.** The shell does not own URLs, active
  visuals, citation targets, avatar lifecycle, or Brain Food.
- **Mobile does not read or write desktop panel layout.** A tab change must not
  corrupt the three desktop slots or any persisted panel group.
- **Persistence restores after hydration.** The first client markup uses the
  server-safe defaults, then applies stored slots and panel sizes after mount.
- **Bars are drag handles, not control containers.** Their marks use the
  non-interactive `PortfolioControlGlyph`; every button is a positioned sibling.
- **Dragging adds no ghost and no text.** dnd-kit feedback is `clone` with the
  moving bar hidden; the in-place bar darkens and the target shows fill and border.
- **Hidden views stay mounted.** Collapse and mobile tab changes use `hidden`
  so Guide runtime and controlled view state survive hide/show transitions.
- **Pointer DnD needs a real browser for fidelity proof.** Unit tests cover the
  three pairs and persistence; `/design#reading-room` is the pointer fixture.
