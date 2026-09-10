# AvatarBoundary

Source: [`components/avatar/AvatarBoundary.tsx`](../../../components/avatar/AvatarBoundary.tsx) · Tests: `components/PortfolioExperience.test.tsx`

Contains a render or lazy-load failure inside the optional avatar layer. It removes the failed subtree and reports the failure without taking down the portfolio.

## Props

`children` and `onFailure` are required.

## Requires

A client React tree.

## Example

```tsx
import { AvatarBoundary } from "components/avatar/AvatarBoundary";
import { useState } from "react";

export function AvatarBoundaryExample() {
  const [failed, setFailed] = useState(false);

  return (
    <AvatarBoundary onFailure={() => setFailed(true)}>
      {failed ? null : <p>The avatar renderer.</p>}
    </AvatarBoundary>
  );
}
```

## Pitfalls

- It catches render errors, not arbitrary asynchronous errors.
- The failed subtree stays removed for the lifetime of this boundary instance.
