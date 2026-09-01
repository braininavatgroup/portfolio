# PortfolioAnalytics

Source: [`components/PortfolioAnalytics.tsx`](../../components/PortfolioAnalytics.tsx) ·
Gallery: `/design#analytics` · Tests: `components/PortfolioAnalytics.test.tsx`

Two exports for one concern: privacy-safe session replay. `PortfolioAnalytics`
renders nothing — mounted in `app/layout.tsx`, it starts Microsoft Clarity via
[`lib/portfolio-analytics.ts`](../../lib/portfolio-analytics.ts) (only on the
hostnames that module allows), then reads the stored preference and revokes
consent if it says `denied`. `PortfolioAnalyticsPreference` is the visible
half: the single opt-out button `/privacy` renders. It writes
`portfolio_analytics_consent` to storage and calls
`setPrivacySafeReplayConsent` in the same action.

## Props

Both take an optional `storage` — anything with `getItem`/`setItem`, defaulting
to `window.localStorage`. `PortfolioAnalytics` also takes `hostname` (defaults
to `window.location.hostname`) and `projectId` (defaults to
`PUBLIC_CLARITY_PROJECT_ID`). Types in
[the source](../../components/PortfolioAnalytics.tsx).

## Requires

A browser. Both components do all their work in effects, so they are safe to
render on the server — they just do nothing there.

## Example

Import: `import { PortfolioAnalytics, PortfolioAnalyticsPreference } from "./PortfolioAnalytics";`

```tsx
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

- **`PortfolioAnalyticsPreference` renders `null` on the first paint.** It
  reads storage in a `setTimeout(…, 0)` to keep hydration clean, so the button
  appears one tick late. Do not lay out around it as if it were always there.
- **The consent key is shared** (`portfolio_analytics_consent`). Passing a
  memory `storage` to one export and not the other splits the preference.
- **Storage access is wrapped in `try`/`catch`** — private browsing modes
  throw. The in-memory preference is still applied; persistence is what is
  lost.
- **`storage` is an effect dependency.** Passing a fresh object literal every
  render re-runs the effect each time; hoist it or memoize it.
