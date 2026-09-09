# PortfolioChat

Source: [`components/PortfolioChat.tsx`](../../components/PortfolioChat.tsx) ·
Gallery: `/design#chat` · Tests: `components/PortfolioChat.test.tsx`

The Reading Room's always-mounted Guide adapts `AskPortfolio` to an `@assistant-ui/react` local runtime, preserving grounding, validation, limits, and the `[phrase][E#]` inline-link format and legacy `[E#]` attribution metadata.

Validated text appears as it arrives; `onNavigateEvidence` routes inline citations to Map and Reader.

## Props

No prop is required in production. `askPortfolio` and `renderTurnstile` are
test/gallery seams; `turnstileSiteKey` enables challenge gating.
`avatarIntegration`, `registerAvatarDock`, and `onLayoutChange` preserve the
narrow avatar runtime and layout callbacks. The avatar integration accepts only
turn start, first rendered text, and the closed avatar/game effect contract.
Local play commands bypass model quota, network, and Turnstile. `actionAvailability` filters suggestions and explains unavailable commands; `onToggleAvatar` adds Hide/Show avatar. Brain Food requires desktop with a fine pointer.

Starters and follow-ups show at most three prompts, or two when the Guide is at most 600px wide or the window is at most 1019px. Ordering and typed commands are unchanged.

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
- A `turnstileSiteKey` without a working renderer keeps submission gated. The real loader renders after the async script loads; do not call Turnstile `ready()` on an async/defer script. Failed loads expose Retry verification and replace the failed script. Verification UI appears only when interaction is needed and fits the pane width.
- Copy strips wire markup; links retain their phrase. Only canonical, in-range `[E#]` labels with a Reading Room target are actions.
- Empty suggestions stay at the top when the pane shrinks, and the avatar yields space before the questions. Only a conversation enables automatic scrolling.
- The viewport owns scrolling; follow new replies at the bottom, preserve scrollback, and offer the accessible Jump to latest reply chevron in a separate row. Failed streams remove their partial text.
- A send that loses eligibility (offline, expired challenge) fails with one retry.
- Avatar callback failures stay isolated from the text response.
- The first server and client render both assume online. Actual
  `navigator.onLine` state is synchronized after mount to keep hydration stable.
- `useLocalRuntime` owns thread detach and request cancellation on unmount; the
  Guide only clears its local timer and request reference in component cleanup.
