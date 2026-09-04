# QuarterlyDashboardPreview

Source: [`components/QuarterlyDashboardPreview.tsx`](../../components/QuarterlyDashboardPreview.tsx) ·
Gallery: `/design` · Tests: `components/QuarterlyDashboardPreview.test.tsx`

The compact reader entry point for the quarterly dashboard. It calculates the
same fixed 2026 Q2 summary and eight-quarter trend as the full work sample, then
links to that route without embedding an iframe or storing another dataset.

## Props

`href` is the full dashboard route. `label` is the visible artifact title.
`onOpen` is optional and records the evidence-open action in the reader.

## Requires

The reporting functions in
[`lib/quarterly-dashboard.ts`](../../lib/quarterly-dashboard.ts) and the
dashboard and reader tokens in `app/globals.css`.

## Example

```tsx
import { QuarterlyDashboardPreview } from "components/QuarterlyDashboardPreview";

export function QuarterlyDashboardPreviewExample() {
  return (
    <QuarterlyDashboardPreview
      href="/demos/quarterly-dashboard"
      label="Quarterly pitch conversion dashboard"
    />
  );
}
```

## Pitfalls

- This is a compact summary, not a scaled copy of `QuarterlyDashboard`.
- Keep the period and generator seed aligned with the full dashboard default.
- The whole preview is one link. Do not add nested controls inside it.
- Keep generated rows in memory; do not add a checked-in preview fixture.
