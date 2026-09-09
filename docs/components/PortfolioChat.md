# PortfolioChat

Source: [`components/PortfolioChat.tsx`](../../components/PortfolioChat.tsx) ·
Gallery: `/design#chat` · Tests: `components/PortfolioChat.test.tsx`

The Reading Room's always-mounted Guide adapts `AskPortfolio` to an `@assistant-ui/react` local runtime, preserving grounding, validation, limits, and the `[phrase][E#]` inline-link format and legacy `[E#]` attribution metadata.

Validated text appears as it arrives; `onNavigateEvidence` routes inline citations to Map and Reader.

## Props

No prop is required in production. `askPortfolio` and `openSession` are test/gallery seams.
`avatarIntegration`, `registerAvatarDock`, and `onLayoutChange` preserve the
narrow avatar runtime and layout callbacks. The avatar integration accepts only
turn start, first rendered text, and the closed avatar/game effect contract.
Local play commands bypass model quota and the network. `actionAvailability` filters suggestions and explains unavailable commands; `onToggleAvatar` adds Hide/Show avatar. Brain Food requires desktop with a fine pointer.

Starters and follow-ups show at most three prompts, or two when the Guide is at most 600px wide or the window is at most 1019px. Ordering and typed commands are unchanged. All prompts use the shared node mark, matching their evidence when available and falling back to Bradley's identity glyph. Labels use muted reader ink.

The Reading Room uses three coordination props:

- `onNavigateEvidence(target, evidence)` receives an inline citation action.
- `onThreadStateChange(hasThread)` reports whether the Guide has messages.
- Changing `resetSignal` aborts the request and clears the entire conversation.

## Requires

Use a `.portfolio-composition` ancestor and a slot with a definite height. The
Guide fills the slot and adds no positioning or shadow.

## Example

```tsx
import { galleryAskPortfolio } from "app/design/fixtures";
import { PortfolioChat } from "components/PortfolioChat";

export function PortfolioChatExample() {
  return (
    <div className="portfolio-composition" style={{ height: 480 }}>
      <section style={{ height: "100%" }}>
        <PortfolioChat
          // Omit both stubs in production: the defaults are
          // `streamPortfolioAnswer` and the real session opener.
          askPortfolio={galleryAskPortfolio}
        />
      </section>
    </div>
  );
}
```

## Pitfalls

- Without `askPortfolio`, the Guide calls the production route; tests need a stub.
- There is no visible bot check. The endpoint asks for a session cookie, which `openSession` establishes on mount so the first question is no slower than the rest; the guard renews it on every accepted request. A lapsed session surfaces as `session_required`, which `streamPortfolioAnswer` recovers from once, silently, by re-opening and resending. Do not reintroduce an interactive challenge without a decision to charge visitors for it.
- Copy strips wire markup; links retain their phrase. Only canonical, in-range `[E#]` labels with a Reading Room target are actions.
- Empty suggestions sit above the composer on desktop and mobile; the avatar yields space before the questions when the pane shrinks. Only a conversation enables automatic scrolling.
- The viewport owns scrolling; follow new replies at the bottom, preserve scrollback, and offer the accessible Jump to latest reply chevron in a separate row only while scrolled away from the bottom. The unused row collapses so suggestions sit directly above the composer. Failed streams remove their partial text.
- A send that goes offline fails with one retry.
- Twenty seconds without new text aborts the reply, clears partial text, and offers one retry.
- Avatar callback failures stay isolated from the text response.
- The first server and client render both assume online. Actual `navigator.onLine` state is synchronized after mount to keep hydration stable.
- `useLocalRuntime` owns thread detach and request cancellation on unmount; the
  Guide only clears its local timer and request reference in component cleanup.
