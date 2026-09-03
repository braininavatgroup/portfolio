# PortfolioExperience

Source: [`components/PortfolioExperience.tsx`](../../components/PortfolioExperience.tsx) ·
Gallery: `/design#composition` · Tests: `components/PortfolioExperience.test.tsx`

The whole accepted composition in one component. It renders the
`.experience.portfolio-composition` root and supplies one Reader, Map, and Guide
to [`PortfolioReadingRoom`](./PortfolioReadingRoom.md). It remains the sole
owner of selection, URL/history, active visuals, citation routing, the avatar
lifecycle, and live-map Brain Food.
Selection is mirrored into the URL (`?view=graph#thread/<id>/<node>`) with
`pushState`; `popstate` reads it back. Only a selection or thread is in the
URL, so returning home pushes one entry only when one was set; an open visual
never pushes. Opening a visual sends the Room a `viewRequest` for the Map so
it is revealed on every breakpoint, even with the side panes collapsed.
The same callbacks report a generic selection source with the current record
or thread ID. Accepted Guide evidence gets its own target signal; invalid
targets remain no-ops.

## Props

None. Everything is internal state. See
[`PortfolioReader`](./PortfolioReader.md),
[`PortfolioWorld`](./PortfolioWorld.md), [`PortfolioChat`](./PortfolioChat.md)
and [`AvatarOverlay`](./avatar/AvatarOverlay.md). The Reading Room is controlled;
do not move those ownership responsibilities into its layout state.

## Requires

`AvatarOverlay` is lazily imported, so Three.js stays out of the first paint.

## Example

```tsx
import { PortfolioExperience } from "components/PortfolioExperience";

export function PortfolioExperienceExample() {
  // Takes no props and owns all of its own state. It is the whole route body.
  return <PortfolioExperience />;
}
```

## Pitfalls

- **It writes to `window.history`.** Mounting it inside another page — the
  gallery, a test harness — means selecting a node rewrites that page's URL.
- **Two instances fight.** Both push history and install global game controls.
  Render exactly one.
- **Keyboard bindings are ordered globally**: Escape first cancels Brain Food,
  then closes a visual, then resets a Guide thread, then returns to About.
  Exact Shift+G starts Brain Food on the live Map.
- **Visual state includes its opening frame.** Reader gallery groups pass their
  flattened asset offset so the map stage opens on the thumbnail that was
  selected; closing restores focus to that trigger.
