# PortfolioChat

Source: [`components/PortfolioChat.tsx`](../../components/PortfolioChat.tsx) ·
Gallery: `/design#chat` · Tests: `components/PortfolioChat.test.tsx`

The portfolio assistant, and the only temporary floating surface on the site
(design conventions Rule 6.5). Minimized it is a `--floating-control-size`
(40px) trigger anchored bottom-right; open it is an `--assistant-panel-width`
(18rem) panel whose header can be dragged to re-dock it. It streams an answer
from [`lib/portfolio-chat-client.ts`](../../lib/portfolio-chat-client.ts),
renders evidence pills from the grounding events, keeps a transcript through
[`lib/portfolio-chat-conversation.ts`](../../lib/portfolio-chat-conversation.ts),
and reports a `PoseState` on every meaningful beat so the avatar can react.
State is published as `data-open` and `data-input-focused` on the dock.

## Props

`onPoseChange` is the only required prop. `open` / `onOpenChange` make it a
controlled surface (`initiallyOpen` is the uncontrolled alternative);
`askPortfolio` and `renderTurnstile` are injection seams that default to the
real transport and the real widget; `turnstileSiteKey`, `avatarIntegration`,
`registerAvatarTarget`, `spotlightTarget`, and `onLayoutChange` are optional.
Full signature and
[`PortfolioChatAvatarIntegration`](../../components/PortfolioChat.tsx) in the
source.

## Requires

A `.portfolio-composition` ancestor. With no `askPortfolio` override it calls
the chat API, which needs the worker running and configured
(`npm run setup:chat`). A `.design-stage`-style transformed, painted box is
what lets its `position: fixed` dock render inside a card rather than escaping
to the viewport.

## Example

Import: `import { PortfolioChat } from "./PortfolioChat";`

```tsx
export function PortfolioChatExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="portfolio-composition">
      <section className="scene-shell">
        <PortfolioChat
          // Omit both stubs in production: the defaults are
          // `streamPortfolioAnswer` and the real Turnstile renderer.
          askPortfolio={galleryAskPortfolio}
          onOpenChange={setOpen}
          onPoseChange={() => {}}
          open={open}
          renderTurnstile={galleryRenderTurnstile}
        />
      </section>
    </div>
  );
}
```

## Pitfalls

- **Without `askPortfolio` it hits the network.** Any fixture, story, or test
  that mounts it must pass a stub, or every question reaches the real chat
  endpoint.
- **`turnstileSiteKey` gates submission.** Supply it and no question is sent
  until the challenge returns a token; supply it without a working
  `renderTurnstile` and the composer is permanently blocked.
- **`open` and `onOpenChange` are a pair.** Pass `open` without
  `onOpenChange` and the panel can never be closed from inside — the
  controlled value never changes.
- **`onPoseChange` fires often** (focus, typing, first text, evidence,
  completion). Passing an unstable inline handler that sets parent state
  re-renders the panel mid-stream.
- **The dock is `position: fixed`.** Outside a transformed containing block it
  anchors to the viewport, not to its section.
- **`avatarIntegration` callbacks may be async** and are awaited by the turn
  lifecycle; a rejected promise surfaces as a failed turn, not a silent skip.
