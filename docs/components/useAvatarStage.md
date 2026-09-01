# useAvatarStage

Source: [`components/useAvatarStage.ts`](../../components/useAvatarStage.ts) ·
Gallery: `/design#avatar` · Tests: `components/PortfolioExperience.test.tsx`

Owns everything the avatar needs in order to stand somewhere sensible: the
stage services (controller, director, registry, sequence runner), the element
registrations that children hand up through callback refs, and the effects
keeping the stage in step with scroll, resize, tab visibility and the user's
motion preference. Also owns `PortfolioAvatarActionState` — which project the
assistant considers open, plus a turn counter for discarding effects that
arrive after the user has moved on.

## Arguments

`assistantOpen` and `reducedMotion`, both required. That is the whole seam: the
avatar never needs to know what is selected, only whether the assistant is on
screen. See the return type in
[`components/useAvatarStage.ts`](../../components/useAvatarStage.ts).

## Requires

A browser. Every effect touches `window` or `document`, so it must run under a
client component — the hook carries `"use client"`. Nothing else: the services
are constructed lazily on first render, and an unregistered target simply makes
the matching command a no-op rather than an error.

## Example

```tsx
import { useAvatarStage } from "components/useAvatarStage";
import { useState } from "react";

export function UseAvatarStageExample() {
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Owns the stage services and the element registrations. The two inputs are
  // the only thing it needs to know about the page: whether the assistant is
  // on screen, and whether the user has asked for reduced motion.
  const { avatarMounted, registerAvatarStage, registerHero } = useAvatarStage({
    assistantOpen,
    reducedMotion: false,
  });

  return (
    <section ref={registerAvatarStage}>
      <h1 ref={registerHero}>Bradley Berkman</h1>
      <button onClick={() => setAssistantOpen((open) => !open)} type="button">
        {assistantOpen ? "Hide" : "Show"} the assistant
      </button>
      <p>{avatarMounted ? "Stage ready." : "Mounting…"}</p>
    </section>
  );
}
```

## Pitfalls

- **Call it once per page.** Each call constructs its own services, so a second
  caller gets a second director animating a second avatar over the same DOM.
- **`avatarMounted` is false on the first paint** — deliberately, so the page
  paints before the avatar does. Gate the overlay on it or the stage measures
  a layout that has not settled.
- **Registration is by callback ref, not by effect.** Passing a `useRef` object
  instead of the returned function registers nothing and fails silently.
- **Registry teardown is its own effect** and must stay that way. It used to
  ride on the listener effect's cleanup, which tore down registrations that
  effect never created; adding one reactive dep there would wipe the registry
  mid-session with the children's refs already fired.
