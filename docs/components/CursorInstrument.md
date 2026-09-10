# CursorInstrument

Source: [`components/CursorInstrument.tsx`](../../components/CursorInstrument.tsx) ·
Gallery: `/design#cursor` · Tests: `components/CursorInstrument.test.tsx`

The site's only pointer on fine-pointer devices, where `app/globals.css` forces
`cursor: none`. Four arms and a pin follow `pointermove`, invert over anything
actionable and compress while a pointer is held. It takes its colour from the
nearest `.portfolio-composition` — `--ink`, or the register named by a hovered
node's `data-cursor-color` — and sets `--cursor-a` (that colour) and
`--cursor-b` (its exact bitwise inverse) inline. Mounted once, in
`app/layout.tsx`, and `aria-hidden`.

## Props

None. All state comes from window pointer events.

## Requires

Nothing to render. To be *coloured* correctly it needs a
`.portfolio-composition` somewhere in the document; with none it falls back to
`--foreground` on `:root`, then to `#201711`.

## Example

```tsx
import { CursorInstrument } from "components/CursorInstrument";

export function CursorInstrumentExample() {
  // Mounted once, in the root layout, outside the composition. It reads its
  // color from the nearest `.portfolio-composition`, so a page without one
  // falls back to `--foreground`.
  return (
    <div className="portfolio-composition">
      <CursorInstrument />
    </div>
  );
}
```

## Pitfalls

- **It is already mounted.** `app/layout.tsx` renders one; a second paints a
  second cursor on the same pointer.
- **Only these selectors invert it:** `button, a, input, textarea, select,
  [role='button'], [role='link'], [data-world-node]`. A clickable `<div>`
  without a role reads as dead surface (Rule 6.7).
- **`data-cursor-color` names a custom property**, not a colour:
  `data-cursor-color="--world-warm"`. It is read off the composition element,
  so the property must be defined there.
- **The inverse needs a 6-digit hex.** A token resolving to any other notation
  makes `--cursor-b` `#ffffff`.
- **`cursor: none` is scoped to `@media (pointer: fine)`**, and the instrument
  is hidden on coarse pointers. Do not compensate in JS.
