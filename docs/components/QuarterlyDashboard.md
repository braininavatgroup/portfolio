# QuarterlyDashboard

Source: [`components/QuarterlyDashboard.tsx`](../../components/QuarterlyDashboard.tsx) ·
Route: `/demos/quarterly-dashboard` · Tests: `components/QuarterlyDashboard.test.tsx`

The complete listing pitch-conversion work sample. It generates its stable
record set in memory, calculates every displayed metric, and owns summary and
detail navigation, filters, chart cross-filtering, CSV download, and print.

## Props

`embedded` renders the complete dashboard as a labelled `section` with an
`h2`, no page-level ID, no outer margin, and no shell shadow. Its controls
and state remain live. Without it, the root is the route's `main#main-content`
and the title is an `h1`.

`returnHref` and `returnLabel` are optional but must be supplied together; the
public route uses them to link back to the real-estate portfolio record. The
fixed seed and initial 2026 Q2 period are part of the dashboard contract.

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
- Use `embedded` inside another page. A page must not contain a nested
  `main#main-content`.
- Responsive rules live in a `@container quarterly-dashboard` query, because
  the embedded copy sits in a column far narrower than the window. The root is
  the container, so nothing inside may change the root's padding or width.
- The dashboard names no client.
