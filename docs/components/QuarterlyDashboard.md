# QuarterlyDashboard

Source: [`components/QuarterlyDashboard.tsx`](../../components/QuarterlyDashboard.tsx) ·
Route: `/demos/quarterly-dashboard` · Tests: `components/QuarterlyDashboard.test.tsx`

The complete brokerage pitch-conversion work sample. It generates its records
in memory, calculates every metric, and owns summary/detail navigation,
filters, chart cross-filtering, CSV download, and print.

## Props

`embedded` renders it as a labelled `section` with an `h2`, no page-level ID,
no outer margin, and no shell shadow; its controls stay live. Without it the
root is the route's `main#main-content` and the title is an `h1`.

`returnHref` and `returnLabel` are optional but go together; the public route
links back to the real-estate record. The fixed seed and initial 2026 Q2
period are part of the contract.

## Requires

The dashboard styles and `--dashboard-*` tokens in `app/globals.css`. Its pure
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

- Rows live only in component memory; never swap in a checked-in fixture.
- The competitor choice scopes only the loss highlight and detail rows. Applied
  to the whole population it leaves no won or open pitches, so the headline
  would read 0 signed and 0%. Trend and scorecards force `lostTo` to `all`.
- Counts and conversion rate sit on separate left and right axes, coloured
  like the series each governs. The scales are not comparable; keep both.
- Only the trend lines live in the chart's stretched 0-100 space, with
  `vector-effect="non-scaling-stroke"`. Points, axes, and labels are HTML at
  the same percentages; SVG text there would shrink to a few pixels.
- CSV download needs `Blob` and object-URL APIs, so it must stay in a user
  event rather than running during server render.
- Use `embedded` inside another page; a page must not nest `main#main-content`.
- Responsive rules live in a `@container quarterly-dashboard` query, because
  the embedded copy sits in a column far narrower than the window. The root is
  the container, so nothing inside may change the root's padding or width.
- The dashboard names no client.
