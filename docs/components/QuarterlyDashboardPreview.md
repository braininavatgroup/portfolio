# QuarterlyDashboardPreview

Source: [`components/QuarterlyDashboardPreview.tsx`](../../components/QuarterlyDashboardPreview.tsx) ·
Gallery: `/design` · Tests: `components/QuarterlyDashboardPreview.test.tsx`

The reader entry point for the quarterly dashboard. It mounts
`QuarterlyDashboard embedded`, so the tabs, filters, scorecards, chart,
drill-down, CSV download, and print action are the same working component used
by the standalone route. The embed has no link to the standalone page.

## Props

No props.

## Requires

`QuarterlyDashboard`, its reporting functions in
[`lib/quarterly-dashboard.ts`](../../lib/quarterly-dashboard.ts), and the
dashboard and reader tokens in `app/globals.css`.

## Example

```tsx
import { QuarterlyDashboardPreview } from "components/QuarterlyDashboardPreview";

export function QuarterlyDashboardPreviewExample() {
  return (
    <QuarterlyDashboardPreview />
  );
}
```

## Pitfalls

- Do not rebuild a visual approximation here. This wrapper must mount the real
  dashboard component.
- The dashboard controls remain interactive inside the Reader.
- Keep generated rows in memory; do not add a checked-in preview fixture.
