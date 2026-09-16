# PortfolioFeedback

Source: [`components/PortfolioFeedback.tsx`](../../components/PortfolioFeedback.tsx) ·
No `/design` section (see Pitfalls) · Tests: `components/PortfolioFeedback.test.tsx`

Reviewer notes for Bradley on the deployed site. Mounted once at the end of
`PortfolioExperience`, it renders only when the worker cookie and URL name match.
A `?r=<code>` link creates both ([worker](../../worker/portfolio-feedback.ts)); an
ordinary site URL stays clean even when the browser retains an older cookie.

With a reviewer present, "Leave a note" sits at the bottom-left page inset.
"Point at something on the page" anchors a note to one element (selector
path, nearest region, text, box, click fraction). Selecting text in the
composition offers "Comment on selection", which quotes the run with 40
characters of context each side; a quoted note can switch to "Suggest an
edit" and send a replacement plus an optional why. Each sent note gets a
numbered pin on its element for the rest of the visit and a row to take it
back. Nothing persists into the page or browser storage, so a later visit
starts empty and no reviewer sees another's notes.

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

- **First paint is always empty.** The cookie and URL marker are read through
  `useSyncExternalStore` with a null server snapshot.
- **The picker captures the click.** `pointerdown`, `pointerup`, and `click`
  are stopped at the document in the capture phase. Escape cancels.
- **Pins anchor to elements, not to quotes.** A quote's pin sits on the
  containing paragraph and follows pane scrolls through a capture-phase
  `scroll` listener; a hidden element gets no pin.
- **A placeholder code asks for a name.** `?r=[name]` lands as `name`; the panel
  then requires "Your name" and sends it as `reviewerName` on every note.
- **No `/design` section**: fixed to the viewport corner, it would float over every other specimen.
