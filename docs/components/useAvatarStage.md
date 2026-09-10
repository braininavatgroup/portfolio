# useAvatarStage

Source: [`components/useAvatarStage.ts`](../../components/useAvatarStage.ts) ·
Gallery: `/design#composition` (via `PortfolioExperience`) · Tests:
`components/useAvatarStage.test.tsx`, `components/PortfolioExperience.test.tsx`

Owns the fixed avatar runtime, the map and chat element registrations, and the
effects that keep its dock in step with scroll, resize, Guide visibility, and
the visitor's motion preference. The registered Guide avatar area supplies the
dock's bottom-center point once it has positive layout dimensions. Swimming
can cross this empty area; Reader remains an obstacle. The stage includes Guide
even when the Map ends to its left.

## Arguments

`assistantOpen` and `reducedMotion`, both required. See the return type in
[`components/useAvatarStage.ts`](../../components/useAvatarStage.ts).

## Requires

A browser. Every effect touches `window` or `document`, so it must run under a
client component. The map and chat callback refs provide the runtime geometry.

## Example

```tsx
import { useAvatarStage } from "components/useAvatarStage";
import { useState } from "react";

export function UseAvatarStageExample() {
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Owns the stage services and the element registrations. The two inputs are
  // the only thing it needs to know about the page: whether the assistant is
  // on screen, and whether the user has asked for reduced motion.
  const { avatarMounted, registerAvatarStage } = useAvatarStage({
    assistantOpen,
    reducedMotion: false,
  });

  return (
    <section ref={registerAvatarStage}>
      <h1>Bradley Berkman</h1>
      <button onClick={() => setAssistantOpen((open) => !open)} type="button">
        {assistantOpen ? "Hide" : "Show"} the assistant
      </button>
      <p>{avatarMounted ? "Stage ready." : "Mounting…"}</p>
    </section>
  );
}
```

## Pitfalls

- **Call it once per page.** Each call constructs a separate runtime.
- **`avatarMounted` is false on the first paint** — deliberately, so the page
  paints before the avatar does. Gate the overlay on it or the stage measures
  a layout that has not settled.
- **Registration is by callback ref, not by effect.** Passing a `useRef` object
  instead of the returned function registers nothing and fails silently.
- **Geometry is installed before visibility in layout effects.** Moving the
  stage reader into a passive effect exposes the viewport fallback on the first
  visible layout, even when the dock has already registered.
- **A zero-size avatar area is not a dock.** Before layout settles, the runtime
  uses its bounded viewport fallback so queued motion still has a valid origin.
- **The dock reports its height.** `dockHeight` is the avatar area's height and
  drives the actor's scale; panel resizes reach the hook through the Reading
  Room's `onLayoutChange`.
