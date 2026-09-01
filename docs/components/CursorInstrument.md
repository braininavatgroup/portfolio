# CursorInstrument

Source: [`components/CursorInstrument.tsx`](../../components/CursorInstrument.tsx) ·
Gallery: `/design#cursor` · Tests: `components/CursorInstrument.test.tsx`

The site's only pointer on fine-pointer devices. `app/globals.css` forces
`cursor: none` globally, and this component draws the replacement: four arms
and a pin that follow `pointermove`, invert over anything actionable, and
compress while a pointer is held. It takes its color from the nearest
`.portfolio-composition` — `--ink` normally, or the register color named by a
hovered world node's `data-cursor-color` — and sets `--cursor-a` (that color)
and `--cursor-b` (its exact bitwise inverse) as inline custom properties. It is
mounted once, in `app/layout.tsx`, and is `aria-hidden`.

## Props

None. All state comes from window pointer events. See
[the source](../../components/CursorInstrument.tsx) for the `CursorState` shape.

## Requires

Nothing to render. To be *colored* correctly it needs a
`.portfolio-composition` somewhere in the document; with none it falls back to
`--foreground` on `:root`, then to `#201711`.

## Example

Import: `import { CursorInstrument } from "./CursorInstrument";`

```tsx
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

- **It is already mounted.** `app/layout.tsx` renders one. A second instance
  paints a second cursor on the same pointer.
- **Only these selectors invert it:** `button, a, input, textarea, select,
  [role='button'], [role='link'], [data-world-node]`. A clickable `<div>`
  without a role reads as dead surface (design conventions Rule 6.7).
- **`data-cursor-color` names a custom property**, not a color:
  `data-cursor-color="--world-warm"`. It is read off the composition element
  with `getComputedStyle`, so the property must be defined there.
- **The inverse is computed from a 6-digit hex.** A token that resolves to any
  other notation (`rgb()`, `color()`, 3-digit hex) makes `--cursor-b`
  `#ffffff`.
- **Coarse pointers hide it** in CSS; do not compensate in JS.
