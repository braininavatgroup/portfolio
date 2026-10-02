# PageErrorBeacon

Source: [`components/PageErrorBeacon.tsx`](../../components/PageErrorBeacon.tsx) ·
Tests: `lib/page-error-beacon.test.ts`, `app/error-boundaries.test.tsx`

Renders nothing. While mounted it listens for the page's uncaught `error` and
`unhandledrejection` events and sends each distinct error (name and message)
once per page view to the shared error intake, which files it as a Linear
issue. The logic lives in
[`lib/page-error-beacon.ts`](../../lib/page-error-beacon.ts); the error
boundaries call its `reportPageError` themselves. Mounted once, in
`app/layout.tsx`.

## Props

None.

## Requires

Nothing. It sends only from `https://bradleyberkman.com` and
`https://www.bradleyberkman.com`, the origins the intake accepts, so local dev,
tests and `insights.braininavat.dance` stay silent.

## Example

```tsx
import { PageErrorBeacon } from "components/PageErrorBeacon";

export function PageErrorBeaconExample() {
  // Renders nothing. Mounted once in app/layout.tsx; it sends only on
  // bradleyberkman.com and www, so here it listens and stays silent.
  return <PageErrorBeacon />;
}
```

## Pitfalls

- **React render errors never reach `window`.** A boundary that catches one
  must call `reportPageError(error)`, as `app/error.tsx` and
  `app/global-error.tsx` do.
- **The payload is the error and the path only.** Query strings and hashes are
  stripped from the stack and filename; never add the visitor id, chat text or
  anything else about the visitor.
- **A new origin needs the intake's `BEACON_ORIGINS` first** (agent-runtime
  `workers/biv-errors/wrangler.jsonc`), then
  `PAGE_ERROR_ORIGINS` here.
