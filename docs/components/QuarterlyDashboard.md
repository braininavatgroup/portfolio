# QuarterlyDashboard

Source: [`components/QuarterlyDashboard.tsx`](../../components/QuarterlyDashboard.tsx) ·
Route: `/demos/quarterly-dashboard` · Tests: `components/QuarterlyDashboard.test.tsx`

The complete Ryan + Ryan quarterly pitch-conversion work sample. It generates
its stable record set in memory, calculates every displayed metric, and owns
summary/detail navigation, filters, chart cross-filtering, CSV download, and
print/PDF behavior.

## Props

`returnHref` and `returnLabel` are optional but must be supplied together. The
public route uses them to link back to the real-estate portfolio record. The
fixed generator seed and initial 2026 Q2 period are part of the demo contract.

## Requires

The dashboard styles and `--dashboard-*` tokens in `app/globals.css`. The pure
generator and reporting functions live in
[`lib/quarterly-dashboard.ts`](../../lib/quarterly-dashboard.ts).

## Example

```tsx
import { QuarterlyDashboard } from "components/QuarterlyDashboard";

export function QuarterlyDashboardExample() {
  return <QuarterlyDashboard />;
}
```

## Pitfalls

- Generated rows live only in component memory. Do not replace them with a
  checked-in JSON or CSV fixture.
- Trend calculations intentionally ignore the selected year and quarter while
  honoring stage and competitor filters, so the period comparison remains
  visible.
- The SVG trend targets use `role="button"` because SVG cannot contain HTML
  buttons. Preserve both Enter and Space activation.
- CSV download requires browser `Blob` and object-URL APIs. It must remain in a
  user event rather than running during server render.
- The component owns a full page and should not be mounted inside the Reading
  Room composition.
