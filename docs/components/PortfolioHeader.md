# PortfolioHeader

Source: [`components/PortfolioHeader.tsx`](../../components/PortfolioHeader.tsx) ·
Gallery: `/design#header` · Tests: `components/PortfolioHeader.test.tsx`

The flat index's wordmark and Map link. Both are real `next/link` anchors: the
wordmark returns to `/`, and Map opens the canonical map URL.

## Props

No props.

## Requires

Nothing beyond `next/link`.

## Example

```tsx
import { PortfolioHeader } from "components/PortfolioHeader";

export function PortfolioHeaderExample() {
  return (
    <div className="flat-index">
      <PortfolioHeader />
    </div>
  );
}
```

## Pitfalls

- **It belongs to `/index`**, inside `.flat-index`. The map composition has its
  own masthead and does not mount this header.
