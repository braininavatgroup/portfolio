# PortfolioChat

Source: [`components/PortfolioChat.tsx`](../../components/PortfolioChat.tsx) ·
Gallery: `/design#chat` · Tests: `components/PortfolioChat.test.tsx`

The Reading Room's always-mounted Guide body. It adapts the existing
`AskPortfolio` transport to an `@assistant-ui/react` local runtime without
changing server grounding, validation, limits, or the `[E#]` wire format.

Validated text appears as it arrives; `onNavigateEvidence` routes inline citations to Map and Reader.

## Props

No prop is required in production. `askPortfolio` and `renderTurnstile` are
test/gallery seams; `turnstileSiteKey` enables challenge gating.
`avatarIntegration`, `registerAvatarDock`, and `onLayoutChange` preserve the
narrow avatar runtime and layout callbacks. The avatar integration accepts only
turn start, first rendered text, and the closed avatar/game effect contract.
Local play commands bypass model quota, network, and Turnstile. `actionAvailability` filters suggestions and explains unavailable commands; `onToggleAvatar` adds Hide/Show avatar. Brain Food requires desktop with a fine pointer.

Suggestion lists show at most three prompts. They show at most two when the
Guide is 600px wide or narrower, or the window uses the compact layout at 1019px
or below. This applies to both starters and follow-ups; prompt ordering and typed
commands are unchanged.

The Reading Room uses three coordination props:

- `onNavigateEvidence(target, evidence)` receives an inline citation action.
- `onThreadStateChange(hasThread)` reports whether the Guide has messages.
- Changing `resetSignal` aborts the request and clears the entire conversation.

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
- The viewport owns scrolling; follow new replies at the bottom, preserve scrollback, and offer Latest reply. Failed streams remove their partial text.
- A send that loses eligibility (offline, expired challenge) fails with one retry.
- Avatar callback failures stay isolated from the text response.
- The first server and client render both assume online. Actual
  `navigator.onLine` state is synchronized after mount to keep hydration stable.
- `useLocalRuntime` owns thread detach and request cancellation on unmount; the
  Guide only clears its local timer and request reference in component cleanup.
