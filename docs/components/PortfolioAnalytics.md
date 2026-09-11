# PortfolioAnalytics

Source: [`components/PortfolioAnalytics.tsx`](../../components/PortfolioAnalytics.tsx) ·
Gallery: `/design#analytics` · Tests: `components/PortfolioAnalytics.test.tsx`

Two exports cover privacy-safe replay and insight signals. `PortfolioAnalytics`
renders nothing and starts Clarity through
[`lib/portfolio-analytics.ts`](../../lib/portfolio-analytics.ts) only for an
allowed host with `external` context and no opt-out. The next eligible load
forwards a saved `granted` to Clarity's consent API; an absent one stays
absent. `?analytics=off` enrolls a Bradley-controlled browser, an opaque
`?campaign=<code>` is kept for the tab, and both leave the URL before Clarity
starts. The first eligible insight event writes a random tab id to
`sessionStorage` (`biv_portfolio_insight_session_v1`) that only the first-party
beacon carries. `privacy.p1` describes that beacon, so a new field needs a
copy-deck change first. `PortfolioAnalyticsPreference` is the `/privacy` control.

## Props

Both take an optional `storage` (anything with `getItem`/`setItem`, defaulting
to `window.localStorage`). `PortfolioAnalytics` also takes `hostname` and
`projectId`.

## Requires

Nothing. Both work in effects, so on the server they render and do nothing.

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
  storage in a `setTimeout(…, 0)`, so the button arrives a tick late.
- **The consent key is shared.** Passing a memory `storage` to one export and
  not the other splits the preference.
- **Analytics fails closed without document context.** The root element must
  carry `data-portfolio-analytics-context="external"`. The main-preview Worker
  writes `preview`, which must remain ineligible.
- **Personal exclusion is per browser profile.** Use `?analytics=off` and see
  the [operator runbook](../portfolio-insights-operations.md), which also
  holds the sink's row layout.
- **Storage access is wrapped in `try`/`catch`** — private modes throw. The
  in-memory preference still applies; persistence is what is lost.
- **`storage` is an effect dependency.** A fresh object literal each render
  re-runs the effect every time; hoist or memoize it.
