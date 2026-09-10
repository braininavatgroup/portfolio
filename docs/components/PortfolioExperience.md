# PortfolioExperience

Source: [`components/PortfolioExperience.tsx`](../../components/PortfolioExperience.tsx) ·
Gallery: `/design#composition` · Tests: `components/PortfolioExperience.test.tsx`

The whole accepted composition in one component. It renders the
`.experience.portfolio-composition` root and supplies one Reader, Map, and Guide
to [`PortfolioReadingRoom`](./PortfolioReadingRoom.md). It remains the sole
owner of selection, URL/history, citation routing, the avatar lifecycle, and
live-map Brain Food. Chat’s `brain_food` effect enters temporary game layout;
completion or exit restores it without changing selection or URL.
The Guide receives live avatar readiness, motion preference, game support, and Hide/Show state. Hiding cancels the game and pauses the avatar. The Reader owns its image and gallery viewer.
Selection is mirrored into the canonical URL (`/index/<node>?view=graph`) with
`pushState`; `popstate` reads it back. Legacy hash links still resolve. Only a selection or thread is in the
URL, so returning home pushes one entry only when one was set; opening or
closing Reader media never pushes or changes the active Reading Room view.
The same callbacks report a generic selection source with the current record
or thread ID. Accepted Guide evidence gets its own target signal; invalid
targets remain no-ops.

## Props

`initialNodeId?: string | null` selects a record during server rendering of its
canonical route. The home route omits it. Subsequent selection is internal state. See
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
  while the Reader's capture handler closes an open image or gallery viewer
  before the Room resets a Guide thread or returns to About. Exact Shift+G
  starts Brain Food on the live Map.
