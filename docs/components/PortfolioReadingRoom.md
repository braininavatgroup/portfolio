# PortfolioReadingRoom

Source: [`components/PortfolioReadingRoom.tsx`](../../components/PortfolioReadingRoom.tsx) · Gallery: `/design#reading-room` · Tests: `components/PortfolioReadingRoom.test.tsx`, `components/PortfolioReadingRoom.drag.test.tsx`

At 1020px and above, Contents sits beside a main view and two stacked side views;
dragging a 40px bar swaps Reader, Map, or Guide. Below 1020px, Contents, Reader,
and Map become tabs; Map holds Guide at 52/48. Panel sizes use `react-resizable-panels`; slots and collapsed
slots use `lib/reading-room-layout.ts`. Both are remembered in memory for the
mounted visit only. Fresh loads and refreshes always start with Reader in main,
Map upper right, Guide lower right, default sizes, and open panels. Desktop
Reset layout restores those defaults without remounting the views or clearing
the article or conversation. It is disabled during Brain Food.

## Props

Pass one controlled `reader`, `map`, and `guide`; `map` accepts optional `compact`
and `nodesInTabOrder`. Selection uses `selectedId`, `selectedSubject`,
`activeThreadId`, `onSelect`, and `onSelectThread`. Home and Guide coordination
use `onHome`, `onGuideReset`, `guideHasThread`, and `onGuideVisibilityChange`;
`onLayoutChange` fires after every resize, collapse, reopen, or swap.
`viewRequest` reveals a view (reopens its column or slot; switches tab below
1020px); `mobileTabRequest` picks a mobile tab; `onEscapeBeforeRoom` can consume
Escape before Guide reset/Home. `storage` is an in-memory test seam; never inject browser storage.
`avatarHidden` and `onToggleAvatar` place Hide/Show beside Read in the mobile toolbar. The canvas occupies the remaining height below that row; Read has no arrow. `gameMode` temporarily makes Map full-window; stored slots, tabs, sizes, and collapsed states resume on exit.

## Requires

A `.portfolio-composition` ancestor provides tokens. Mount the viewport-filling
shell once; its live Map must size from its slot.

## Example

```tsx
import { galleryAskPortfolio } from "app/design/fixtures";
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

- **The owner keeps navigation state**: URLs, visuals, citations, avatar, Brain Food.
- **Mobile does not read or write desktop panel layout.** A tab change must not
  corrupt the three desktop slots or any visit-scoped panel group.
- **Browser layouts are ignored.** Old localStorage entries are neither read
  nor written. Server and client start from the same default slots. In-memory
  panel preferences survive responsive transitions within the mounted visit.
- **Bars are drag handles, not control containers.** Their marks use the
  non-interactive `PortfolioControlGlyph`; buttons are positioned siblings, and fine pointers show `grab` or `grabbing`.
- **Dragging adds no ghost and no text.** dnd-kit feedback is `clone` with the
  moving bar hidden; the in-place bar darkens and the target shows fill and border.
- **A swap moves DOM, not React.** Each view renders once in its first-run slot
  and its host is reparented, so the Guide thread and Map state survive a drag.
- **Collapse belongs to the slot.** `hidden` names the views in collapsed slots;
  a swap re-derives it, main never collapses, and hidden views stay mounted.
- **Escape belongs to native fullscreen.** The Room must not also reset Guide or return Home when the browser exits a Reader video.
- **Pointer DnD needs a real browser.** Unit tests cover the pairs; `/design#reading-room` is the pointer fixture.
