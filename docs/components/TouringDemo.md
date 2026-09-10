# TouringDemo

Source: [`components/TouringDemo.tsx`](../../components/TouringDemo.tsx). Route: `/demos/touring`.

A guided, editable work sample for one fictional show. Manager and promoter views
lead to the artist’s day sheet and planned calendar details. The same component
runs in the Reader and at the full route.

## Requires

`embedded` uses a labelled section and h2 instead of main and h1. The embed
has no link to the standalone page.
The embedded variant needs a `.portfolio-composition` ancestor; the route variant
supplies it. All styles use existing Reader tokens in `app/globals.css`.

## Example

```tsx
import { TouringDemo } from "components/TouringDemo";

export function TouringDemoExample() {
  return <TouringDemo embedded />;
}
```

## Pitfalls

The source tool’s registry, field ownership, outstanding-work calculation,
date formatting, day-sheet projection, chase template merger, and event planner
are vendored in `lib/touring-engine`. `provenance.json` pins their consulting
commit and source hashes. `demo.mjs` is the portfolio’s in-memory interaction
adapter. It holds no Google adapters, secrets, server calls, or persistence.

Partial saves deliberately work: a supplied driver name removes that field from
the missing list and follow-up while the pickup request remains. Empty inputs
preserve saved values, matching the source store. Reset creates a fresh fixture.
Calendar’s day-sheet link targets this mounted component, preserving current
answers instead of opening a fresh demo. The day sheet labels the source’s landing and takeoff fields as “Arrival for
show” and “Departure after show,” matching the calendar planner’s separate
arrival and departure events. Native Gmail thread delivery, PDF
export via Google Docs, and calendar delivery are not simulated.

Tests live in `lib/touring-demo.test.ts` and `components/TouringDemo.test.tsx`.
The user requested GitHub execution, so do not infer a local test result.
