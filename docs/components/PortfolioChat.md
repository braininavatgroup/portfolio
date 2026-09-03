# PortfolioChat

Source: [`components/PortfolioChat.tsx`](../../components/PortfolioChat.tsx) ·
Gallery: `/design#chat` · Tests: `components/PortfolioChat.test.tsx`

The portfolio assistant, and the only temporary floating surface on the site
(Rule 6.6). Minimized it is the Chat node control at the map area's 24/24
corner; open it is an 18rem panel whose
header can be dragged to re-dock it. It streams an answer from
[`lib/portfolio-chat-client.ts`](../../lib/portfolio-chat-client.ts), renders
evidence pills, keeps a transcript, and reports turn start, first answer text,
and the optional swim action so the avatar can react. State shows as `data-open` and
`data-input-focused`.

## Props

No prop is required. `open`/`onOpenChange` make it
controlled (`initiallyOpen` is the uncontrolled alternative); `askPortfolio`
and `renderTurnstile` are injection seams defaulting to the real transport and
widget; `turnstileSiteKey`, `avatarIntegration`, `registerAvatarDock`, and
`onLayoutChange` are optional.

## Requires

`.experience` **and** `.portfolio-composition` on an ancestor.
`.experience .portfolio-chat` is what makes the dock `position: fixed`; under
`.portfolio-composition` alone the base fallback remains centred and
absolutely positioned.

## Example

```tsx
import { galleryAskPortfolio, galleryRenderTurnstile } from "app/design/fixtures";
import { PortfolioChat } from "components/PortfolioChat";
import { useState } from "react";

export function PortfolioChatExample() {
  const [open, setOpen] = useState(false);

  // Match the production composition so the dock uses its fixed positioning.
  return (
    <div className="experience portfolio-composition">
      <section className="scene-shell">
        <PortfolioChat
          // Omit both stubs in production: the defaults are
          // `streamPortfolioAnswer` and the real Turnstile renderer.
          askPortfolio={galleryAskPortfolio}
          onOpenChange={setOpen}
          open={open}
          renderTurnstile={galleryRenderTurnstile}
        />
      </section>
    </div>
  );
}
```

## Pitfalls

- **Without `askPortfolio` it hits the chat API**, which needs the worker
  running (`npm run setup:chat`). Any fixture or test must pass a stub.
- **`turnstileSiteKey` gates submission.** Supply it without a working
  `renderTurnstile` and the composer is permanently blocked.
- **`open` and `onOpenChange` are a pair.** Pass `open` alone and the panel can
  never be closed from inside — the controlled value never changes.
- **`avatarIntegration` rejections are swallowed.** Its callbacks run through
  `runAvatarWorkSafely`, which catches; avatar work is explicitly not allowed
  to interrupt a turn. A failing integration is silent, not a failed turn.
- **Dragging is refused at ≤900px**, where the dock is laid out differently.
