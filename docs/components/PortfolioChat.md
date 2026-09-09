# PortfolioChat

Source: [`components/PortfolioChat.tsx`](../../components/PortfolioChat.tsx) · Gallery: `/design#chat` · Tests: `components/PortfolioChat.test.tsx`

The Reading Room's always-mounted Guide adapts `AskPortfolio` to an `@assistant-ui/react` local runtime, preserving grounding, validation, limits, and the `[phrase][E#]` inline-link format and legacy `[E#]` attribution metadata.

Validated text appears as it arrives; `onNavigateEvidence` routes inline citations to Map and Reader.

## Props

No prop is required in production. `askPortfolio` and `openSession` are test/gallery seams. `avatarIntegration`, `registerAvatarDock`, and `onLayoutChange` preserve the narrow avatar runtime and layout callbacks. The avatar integration accepts only turn start, first rendered text, and the closed avatar/game effect contract. Local play commands bypass model quota and the network. `actionAvailability` filters suggestions and explains unavailable commands; `onToggleAvatar` adds Hide/Show avatar. Brain Food requires desktop with a fine pointer.

Starters and follow-ups show at most three prompts, or two when the Guide is at most 600px wide or the window is at most 1019px. Ordering and typed commands are unchanged. All prompts use the shared node mark, matching their evidence when available and falling back to Bradley's identity glyph. Labels use muted reader ink.

The Reading Room uses three coordination props:

- `onNavigateEvidence(target, evidence)` receives an inline citation action.
- `onThreadStateChange(hasThread)` reports whether the Guide has messages.
- Changing `resetSignal` aborts the request and clears the entire conversation.

## Requires

Use a `.portfolio-composition` ancestor and a slot with a definite height. The Guide fills the slot and adds no positioning or shadow.

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
- Empty suggestions sit above the composer on desktop and mobile; the avatar yields space before the questions when the pane shrinks. Empty suggestions never trigger automatic scrolling.
- The viewport uses assistant-ui top turn anchoring. A tall first question stays aligned while the opening pane settles, leaving its last four lines and the pending reply in view. This alignment ends at the first reply text, and any wheel, touch, pointer, or keyboard interaction cancels it. The library itself only anchors follow-ups. A new follow-up brings its question and the beginning of its reply into view once; growing text preserves the reading position. There is no jump-to-latest button or reserved control row; visitors scroll the transcript normally. Failed streams remove their partial text.
- A send that goes offline fails with one retry. A session failure on a public HTTP URL offers the same page over HTTPS, where the required Secure session cookie can be retained. It does not weaken the cookie or session gate.
- Thinking changes to Thinking long and hard after four seconds without initial text and disappears when text arrives. Twenty seconds without new text aborts the reply, clears partial text, and offers one retry. A completed stream with no visible answer also offers retry.
- Avatar callback failures stay isolated from the text response.
- The first server and client render both assume online. Actual `navigator.onLine` state is synchronized after mount to keep hydration stable.
- `useLocalRuntime` owns thread detach and request cancellation on unmount; the Guide only clears its local timer and request reference in component cleanup.

Long composer text grows the desktop form to its three-line limit; mobile keeps a scrollable single-line field. Long unbroken words and URLs wrap inside sent bubbles and answers.

Guide actions use `PortfolioControlGlyph` directly: compact copy (16px) and inline send (18px). Suggestions use the evidence-linked node marks from main. There is no Guide-specific SVG renderer.
