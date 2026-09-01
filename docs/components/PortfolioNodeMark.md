# PortfolioNodeMark

Source: [`components/PortfolioNodeMark.tsx`](../../components/PortfolioNodeMark.tsx) ·
Gallery: `/design#marks`

The one register mark. It draws the primitives
[`lib/portfolio-node-mark.ts`](../../lib/portfolio-node-mark.ts) returns for a
family into a 15px SVG with `stroke: currentColor`, and carries `data-family`
and `data-register` so CSS supplies the color. The `identity` family is the
exception: it renders `.portfolio-node-brain`, a mask of
`/biv-brain-symbol.png` filled with `currentColor` and no containing shape.
Every mark shares one optical envelope and one stroke weight — the register is
the only thing that varies (design conventions Rule 6.4).

## Props

`family: PortfolioWorldFamily` and `register: PortfolioWorldRegister`, both
required, both from [`lib/portfolio-world.ts`](../../lib/portfolio-world.ts).
Eight families, six registers; a node's own `family` / `register` fields are the
intended source.

## Requires

An ancestor that defines the `--world-*` custom properties — in practice
`.portfolio-composition`. The mark is `aria-hidden`, so it never carries the
label; whatever wraps it must.

## Example

Import: `import { PortfolioNodeMark } from "./PortfolioNodeMark";`

```tsx
export function PortfolioNodeMarkExample() {
  // The mark takes its shape from `family` and its color from `register`,
  // and must sit inside a `.portfolio-composition` for `--world-*` to resolve.
  return (
    <div className="portfolio-composition">
      <PortfolioNodeMark family="operation" register="warm" />
    </div>
  );
}
```

## Pitfalls

- **Outside `.portfolio-composition` it renders in inherited text color.** The
  registers are composition-scoped aliases.
- **This is the one composition component with no `"use client"`**, because it
  has no state. Keep it that way; a client boundary here is pure cost.
- **Do not restyle per mark type.** A new family joins the existing envelope;
  it does not get its own size, weight, or label treatment.
- **`family` and `register` are independent props.** The live pairing lives in
  the content, not here — the gallery's `galleryFamilyRegister` map records it.
