# PortfolioAnalytics

Source: [`components/PortfolioAnalytics.tsx`](../../components/PortfolioAnalytics.tsx) ·
Gallery: `/design#analytics` · Tests: `components/PortfolioAnalytics.test.tsx`

Two exports for one concern: privacy-safe session replay.
`PortfolioAnalytics` renders nothing — mounted in `app/layout.tsx`, it starts
Clarity via
[`lib/portfolio-analytics.ts`](../../lib/portfolio-analytics.ts) on the
hostnames that module allows, then revokes consent if the stored preference
says `denied`. `PortfolioAnalyticsPreference` is the visible half: the opt-out
button `/privacy` renders, which writes `portfolio_analytics_consent` and calls
`setPrivacySafeReplayConsent` in the same action.

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
- **Storage access is wrapped in `try`/`catch`** — private modes throw. The
  in-memory preference still applies; persistence is what is lost.
- **`storage` is an effect dependency.** A fresh object literal each render
  re-runs the effect every time; hoist or memoize it.
