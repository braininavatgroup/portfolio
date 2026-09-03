# PortfolioChat

Source: [`components/PortfolioChat.tsx`](../../components/PortfolioChat.tsx) ·
Gallery: `/design#chat` · Tests: `components/PortfolioChat.test.tsx`

The Reading Room's always-mounted Guide body. It adapts the existing
`AskPortfolio` transport to an `@assistant-ui/react` local runtime without
changing server grounding, validation, limits, or the `[E#]` wire format.

Complete answers appear word by word. Valid citations become inline buttons;
`onNavigateEvidence` selects their node, thread, or Home in Map and Reader.

## Props

No prop is required in production. `askPortfolio` and `renderTurnstile` are
test/gallery seams; `turnstileSiteKey` enables challenge gating.
`avatarIntegration`, `registerAvatarDock`, and `onLayoutChange` preserve the
narrow avatar runtime and layout callbacks. The avatar integration accepts only
turn start, first rendered text, and the closed `swim_lap` effect contract.

The Reading Room uses three coordination props:

- `onNavigateEvidence(target, evidence)` receives an inline citation action.
- `onThreadStateChange(hasThread)` reports whether the Guide has messages.
- Changing `resetSignal` aborts the request and clears the entire conversation.

`open`, `onOpenChange`, and `initiallyOpen` are transitional no-ops until the
Reading Room shell replaces the old caller.

## Requires

Use a `.portfolio-composition` ancestor and a slot with a definite height. The
Guide fills the slot and adds no positioning or shadow.

## Example

```tsx
import { galleryAskPortfolio, galleryRenderTurnstile } from "app/design/fixtures";
import { PortfolioChat } from "components/PortfolioChat";

export function PortfolioChatExample() {
  return (
    <div className="portfolio-composition" style={{ height: 480 }}>
      <section style={{ height: "100%" }}>
        <PortfolioChat
          // Omit both stubs in production: the defaults are
          // `streamPortfolioAnswer` and the real Turnstile renderer.
          askPortfolio={galleryAskPortfolio}
          renderTurnstile={galleryRenderTurnstile}
        />
      </section>
    </div>
  );
}
```

## Pitfalls

- Without `askPortfolio`, the Guide calls the production route; tests need a stub.
- A `turnstileSiteKey` without a working renderer keeps submission gated.
- Only canonical, in-range `[E#]` labels with a Reading Room target are actions.
- Output is buffered until completion, so failed partial answers stay hidden.
- Avatar callback failures stay isolated from the text response.
