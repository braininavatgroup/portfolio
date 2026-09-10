# Quarterly dashboard demo design

## Goal

Turn the abandoned brokerage dashboard spike into a working, portfolio-ready interactive asset at `/demos/quarterly-dashboard`, with a clear path into and back out of the real-estate case study.

## Product boundary

This slice builds the dashboard and connects it to the existing real-estate portfolio record. It does not add screenshots, long-form case-study copy, Looker Studio, Apps Script, Google authentication, or a server-side data connection.

The dashboard keeps the original teal-and-cream direction. It carries no client name: the title, footer, and generated records describe an unnamed residential brokerage.

## Data contract

No row-level real-estate dataset is stored in Git. A pure deterministic generator creates records in the browser from a fixed numeric seed. The repository contains only types, generator logic, small vocabulary lists, and the seed.

The generated record shape is:

```ts
type Pitch = {
  id: string;
  property: string;
  pitchDate: string;
  stage: "Signed exclusive" | "Lost" | "Open" | "Passed";
  determinationDate?: string;
  listedPrice?: number;
  soldPrice?: number;
  lostTo?: string;
};
```

The fixed corpus spans eight quarters from 2024 Q3 through 2026 Q2. Reloading the route produces the same records and metrics. No generated record is persisted in local storage, cookies, a database, or a checked-in fixture.

## Architecture

`lib/quarterly-dashboard.ts` owns the deterministic generator and all pure reporting functions. `components/QuarterlyDashboard.tsx` owns browser state and accessible interactions. `app/demos/quarterly-dashboard/page.tsx` supplies route metadata and renders the client component.

The route has no API dependency. Filtering, aggregation, CSV serialization, and chart geometry all run locally.

`components/QuarterlyDashboardPreview.tsx` mounts the same
`QuarterlyDashboard` component used by the full route in its embedded mode.
The portfolio visual contract has an `interactive` format with an explicit
preview identifier and destination. That keeps the dashboard in the authored
body order while allowing later interactive artifacts to use the same path.

## Portfolio journey

The existing `real-estate` record remains the entry point. Its body places the
working dashboard directly after the draft case-study copy. The empty planned
operation-map visual is not rendered. The embedded dashboard is the real
component: its tabs, filters, scorecards, full trend, drill-down, export, and
print controls work inside the Reader. It is not an iframe, image, or visual
approximation.

A separate `Open full dashboard` link goes to
`/demos/quarterly-dashboard` in the same tab. Keeping the link outside the
dashboard preserves every embedded control. The full route places a slim
portfolio-return bar above the dashboard with a link to
`/?view=graph#real-estate`. Browser Back also returns to the prior portfolio
state; the explicit link supplies a reliable destination for direct visits and
bookmarks.

The full route does not mount a second portfolio experience, map, reader, or Guide. The dashboard gets the full viewport, while the return bar makes its relationship to the case study explicit.

## Experience

The route opens on Quarterly Summary with the original composition:

- Year, quarter, and lost-to filters
- Pitches, signed exclusives, and conversion scorecards
- An eight-quarter trend chart
- Open-pitch and new-listing cards
- A win/loss-by-competitor panel
- A Pitch Detail view with stage filtering and a sortable table

Interactions are real:

- A trend point changes the selected year and quarter.
- A competitor bar filters the dashboard to lost pitches for that competitor.
- Scorecards and supporting cards open Pitch Detail with the relevant stage selection.
- Tabs move between summary and detail without navigation or lost filter state.
- Download exports the filtered detail rows as CSV.
- Print/PDF invokes the browser print dialog with print-specific layout rules.

The former Schedule control is omitted because the MVP has no delivery service behind it.

## Visual system

The asset deliberately preserves the original client-facing palette rather than restyling itself as the portfolio shell. Demo-only `--dashboard-*` tokens live in the root token block and are recorded in `docs/design-tokens.md`; CSS below the token block contains no raw color literals. Dashboard class names use the `.quarterly-dashboard-*` prefix. Boolean state uses `data-*` attributes.

Desktop preserves the dense 1280px dashboard composition. Below 760px, filters wrap, scorecards and support panels stack, the SVG chart becomes horizontally scrollable, and the detail table scrolls within its own region. Every control remains reachable by keyboard and uses the repository focus-ring token.

## Error and empty states

The generator is total for the fixed seed. Filters that produce zero matches keep the frame in place, show zero-valued summaries, and render `No pitches match the current filters.` in Pitch Detail. CSV export remains available and returns a header-only file for an empty selection.

## Verification

Pure tests prove deterministic generation, filter composition, conversion-rate math, quarterly trend order, and CSV escaping. Component tests prove tab state, trend cross-filtering, scorecard drill-down, competitor filtering, and the empty state. Route tests prove metadata and rendered availability. Browser verification covers desktop and phone widths, console errors, failed requests, and screenshots.

Reader integration tests prove that the real-estate record renders the working
dashboard with no planned-gallery placeholder, that its link reaches the
dashboard route, and that the full route links back to the real-estate record.
Browser verification covers the complete reader-to-dashboard-to-reader journey
at desktop and phone widths.
