# PortfolioAnalytics

Source: [`components/PortfolioAnalytics.tsx`](../../components/PortfolioAnalytics.tsx) ·
Gallery: `/design#analytics` · Tests: `components/PortfolioAnalytics.test.tsx`

Two exports cover privacy-safe replay and insight signals. `PortfolioAnalytics`
renders nothing and starts Clarity through
[`lib/portfolio-analytics.ts`](../../lib/portfolio-analytics.ts) only for an
allowed host with explicit `external` context and no opt-out. A saved
`granted` is forwarded to Clarity's consent API on that load, so an opt-in
survives a reload; an absent preference stays absent. `?analytics=off` enrolls
a Bradley-controlled browser before bootstrap. An opaque `?campaign=<code>` is
captured for the tab. Both parameters are removed before Clarity starts. The
first eligible, valid insight event writes a random tab id to `sessionStorage`
(`biv_portfolio_insight_session_v1`). Only the first-party beacon carries it,
never Clarity, and an ineligible or opted-out visit writes none. `PortfolioAnalyticsPreference` is the `/privacy` control.

## Props

Both take an optional `storage` (anything with `getItem`/`setItem`, defaulting
to `window.localStorage`). `PortfolioAnalytics` also takes `hostname` and
`projectId`.

## Requires

Nothing. Both do all their work in effects, so they are safe to render on the
server — they just do nothing there.

## Example

```tsx
import { createMemoryStorage } from "app/design/fixtures";
import { PortfolioAnalytics, PortfolioAnalyticsPreference } from "components/PortfolioAnalytics";

export function PortfolioAnalyticsExample() {
  return (
    <>
      {/* Renders nothing. In the real layout it takes no props and reads
          window.location.hostname and window.localStorage. */}
      <PortfolioAnalytics
        hostname="bradleyberkman.com"
        storage={createMemoryStorage()}
      />
      {/* The opt-out control, as /privacy renders it. */}
      <PortfolioAnalyticsPreference storage={createMemoryStorage("granted")} />
    </>
  );
}
```

## Pitfalls

- **`PortfolioAnalyticsPreference` renders `null` on first paint.** It reads
  storage in a `setTimeout(…, 0)` to keep hydration clean, so the button
  arrives a tick late. Do not lay out around it as if it were always there.
- **The consent key is shared.** Passing a memory `storage` to one export and
  not the other splits the preference.
- **Analytics fails closed without document context.** The root element must
  carry `data-portfolio-analytics-context="external"`. The main-preview Worker
  writes `preview`, which must remain ineligible.
- **Personal exclusion is per browser profile.** Use `?analytics=off` and see
  the [operator runbook](../portfolio-insights-operations.md).
- **Re-enabling after a pre-bootstrap opt-out applies on the next page load.**
  Nothing to notify on that page: the next eligible load forwards the write.
- **Storage access is wrapped in `try`/`catch`** — private modes throw. The
  in-memory preference still applies; persistence is what is lost.
- **`storage` is an effect dependency.** A fresh object literal each render
  re-runs the effect every time; hoist or memoize it.
