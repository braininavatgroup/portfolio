# PortfolioReadingRoom

Source: [`components/PortfolioReadingRoom.tsx`](../../components/PortfolioReadingRoom.tsx) · Gallery: `/design#reading-room` · Tests: `components/PortfolioReadingRoom.test.tsx`, `components/PortfolioReadingRoom.drag.test.tsx`

At 1020px and above, Contents sits beside three slots; dragging a 40px bar swaps Reader, Map, or Guide. Below 1020px, Contents, Reader, and Map become tabs;
Map holds Guide at 52/48. Sizes, slots, and collapse state last only for the visit.
Fresh loads restore Reader main, Map upper right, Guide lower right,
default sizes, and open panels. There is no manual reset control.

## Props

Pass one controlled `reader`, `map`, and `guide`; `map` accepts optional `compact`
and `nodesInTabOrder`. Selection uses `selectedId`, `selectedSubject`,
`activeThreadId`, `onSelect`, and `onSelectThread`. Home and Guide coordination
use `onHome`, `onGuideReset`, `guideHasThread`, and `onGuideVisibilityChange`;
`onLayoutChange` fires after every resize, collapse, reopen, or swap.
`viewRequest` reveals a view (reopens its column or slot; switches tab below
1020px); `mobileTabRequest` picks a mobile tab; `onEscapeBeforeRoom` can consume
Escape before Guide reset/Home. `storage` is an in-memory test seam; never inject browser storage.
`avatarHidden` and `onToggleAvatar` place the avatar toggle in the Guide bar on desktop and beside the selected record in the mobile toolbar. Both mobile controls are 40px high with matching borders. The record label opens Reader without an extra Read suffix. The toggle follows the Guide when panes swap and is absent while its desktop pane is minimized. The canvas fills the height below the toolbar. `gameMode` temporarily makes Map full-window; stored layout resumes on exit.

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

- **Initial sizes are not resize limits.** `readingRoomInitialSizes` preserves the opening composition; `readingRoomMinimums` permits Contents down to 180px, main to 420px, and side panes to 240px.
- **The owner keeps navigation state**: URLs, visuals, citations, avatar, Brain Food.
- **Mobile does not read or write desktop panel layout.** A tab change must not
  corrupt the three desktop slots or any visit-scoped panel group.
- **Browser layouts are ignored.** Server and client start from the same defaults.
  In-memory preferences survive responsive transitions, but not refreshes.
- **Bars are drag handles, not control containers.** Their marks use the
  non-interactive `PortfolioControlGlyph`; buttons are positioned siblings, and fine pointers show `grab` or `grabbing`.
- **Dragging adds no ghost and no text.** dnd-kit feedback is `clone` with the
  moving bar hidden; the in-place bar darkens and the target shows fill and border.
- **A swap moves DOM, not React.** Each view renders once in its first-run slot
  and its host is reparented, so the Guide thread and Map state survive a drag.
- **Collapse belongs to the slot.** Swaps preserve collapsed slots; main stays visible and hidden views stay mounted.
- **Escape belongs to native fullscreen.** The Room must not also reset Guide or return Home when the browser exits a Reader video.
- **Pointer DnD needs a real browser.** Unit tests cover the pairs; `/design#reading-room` is the pointer fixture.
