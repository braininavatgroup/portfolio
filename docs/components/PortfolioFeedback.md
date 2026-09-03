# PortfolioFeedback

Source: [`components/PortfolioFeedback.tsx`](../../components/PortfolioFeedback.tsx) ·
No `/design` section (see Pitfalls) · Tests: `components/PortfolioFeedback.test.tsx`

Reviewer notes for Bradley on the password-protected preview. Mounted once at
the end of `PortfolioExperience`. It renders nothing unless the worker has set
the readable `portfolio_reviewer` cookie, which a `?r=<code>` link does
([`worker/portfolio-feedback.ts`](../../worker/portfolio-feedback.ts)).

With a reviewer present, "Leave a note" sits at the bottom-left page inset:
a note field, an optional "Point at something on the page" picker, and Send.
The picker highlights the element under the pointer with the Acid ring and on
click records a short selector path, the nearest `portfolio-`/`reader-`
region, visible text, the box, and the click position as a fraction of it.
Sending adds the path, title, viewport, and browser. This visit's notes are
listed so the reviewer can take one back. Nothing is written into the page or
browser storage: a later visit starts empty, and no reviewer sees another's
notes. Bradley pulls the ledger with `npm run feedback` (README).

## Props

Neither is required in production. `reviewer` overrides the cookie for tests
and the example. `transport` is `{ send(draft), remove(id) }`, defaulting to
the worker routes.

## Requires

A `.portfolio-composition` ancestor for the semantic aliases, and a worker
with `PORTFOLIO_FEEDBACK_ENABLED` and the `PORTFOLIO_FEEDBACK` Durable Object.

## Example

```tsx
import { PortfolioFeedback } from "components/PortfolioFeedback";

export function PortfolioFeedbackExample() {
  // In production it takes no props: the reviewer comes from the cookie the
  // worker sets from a `?r=<code>` link, and notes post to the worker's
  // `/_portfolio-feedback/notes` route. Both are seams here, so this example
  // never leaves the page.
  return (
    <div className="portfolio-composition">
      <PortfolioFeedback
        reviewer="alice"
        transport={{
          send: async (draft) => ({ ...draft, reviewer: "alice", id: "example", createdAt: 0 }),
          remove: async () => {},
        }}
      />
    </div>
  );
}
```

## Pitfalls

- **First paint is always empty.** The cookie is read through
  `useSyncExternalStore` with a null server snapshot, so the control appears
  after hydration.
- **The picker captures the click.** `pointerdown`, `pointerup`, and `click`
  are stopped at the document in the capture phase so the world does not
  select or drag the node being pointed at. Escape cancels.
- **No `/design` section**: fixed to the viewport corner, it would float over
  every other specimen.
- **Mobile offset is a literal.** Below 1020px it clears the 56px tab bar in
  `app/globals.css`; change both if the bar changes.
