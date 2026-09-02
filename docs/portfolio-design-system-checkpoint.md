# Portfolio design-system checkpoint

Status: accepted design direction, 26 August 2026. This document records the
client-facing composition. Its static HTML snapshot
(`public/design-system-current.html`) was retired once it drifted from the
authored content; it remains recoverable from git history. This is not a
production-integration specification.

## Composition

- The portfolio is one spatial world paired with one fixed dossier. The world
  is exploratory; the dossier is the stable reading plane.
- The desktop dossier uses `clamp(460px, 38vw, 560px)`. The canvas owns the
  remaining width and resizes around it.
- The Index, Story, and focused-record states share the dossier instead of
  becoming separate panels or routes inside the composition.
- Chat is the only temporary floating surface. The avatar remains attached to
  its dock rather than becoming another navigation system.

## Visual language

- Neue Haas Grotesk is the shared typographic voice. Map labels are compact and
  notational; the dossier uses a more open rhythm for sustained reading.
- Light mode uses Silver `#C5CBD0`, reader `#EFF1F1`, and brown-black ink
  `#201711`. Dark mode uses world `#19140F`, reader `#292625`, and ink
  `#F0E6DC`.
- Operations use Electric pink `#D0007E` in light mode and Hot pink `#FF84D0`
  in dark mode. Bridges use violet `#4D1FC5` / `#AAA0FF`; In Production work uses cyan
  `#006E91` / `#62C6DF`.
- `Making work playable`, `Authorship`, and `Philosophy` use Lichen `#466700`
  / Acid `#B6DF5B`. `From argument to instrument` uses Hard red `#D7191C` /
  Signal red `#FF554A`.
- Selection introduces no new color. Marks retain their native register.

## Node and relationship grammar

- Bradley uses the Brain in a Vat symbol without a containing shape. In the
  world overview it is a 21px identity anchor with a 14px medium label;
  factual marks and labels remain smaller. Stories use an Asterisk.
- Factual marks share one optical envelope and stroke weight: operation uses a
  double circle, component an open triangle, engagements an open diamond, and
  In Production work a circle with a center.
- Labels use the same typographic voice and sit below their marks. Bradley's
  larger, medium-weight label is the sole hierarchy exception.
- Relationships use one Silverpoint treatment: thin, straight, neutral, and
  arrowless. Their internal classifications remain backstage.
- Bradley has no Story connectors at rest. Selecting Bradley reveals the four
  Story links; selecting a Story foregrounds its authored constellation.
- Nodes can be moved individually. Blank-space dragging does not move the
  field, while a blank-space click resets the focused composition.

## Cursor and interaction

- Fine-pointer devices use one segmented cursor across the website. It closes
  on every press and inverts its arm and center treatment over actionable
  surfaces and draggable nodes.
- Selecting a node recomposes the graph and opens the same subject in the
  dossier. Browser history preserves direct node and Story states.
- Empty space, the Index control, and Escape return the world to its overview.

## AssistantModal shell

- The assistant begins minimized as a 40px outlined conversation control. Its
  open panel is 18rem / 288px wide.
- The header is the only drag surface. Desktop dragging is constrained to the
  canvas; the panel cannot cross into the dossier or leave the viewport.
- Minimizing preserves the panel position for the visit and restores the
  trigger at its lower-right corner. The trigger is hidden while the panel is
  open, and the dossier contains no duplicate chat action.
- At 900px and below, the graph is removed. Opening chat temporarily hides the
  dossier; minimizing chat restores it. Header dragging is disabled there.
- The visible question, answer, evidence pills, composer, arrow control,
  radius, and spacing remain the accepted provisional interior. This checkpoint
  does not redesign production chat or alter its transport, grounding, access,
  spend, telemetry, refusal, or failure contracts.

## Deferred work

- Focused records, dense evidence, outcomes, caveats, and proof are a separate
  editorial session.
- Production translation must start from the then-current application and put
  any future UI library or transport behind the existing safety and grounding
  boundaries.
- Final motion, physical-device rendering, touch feel, and accessibility remain
  acceptance-walk work rather than reasons to change this checkpoint silently.

## Verification

The checkpoint carries a semantic contract test for the combined canvas,
dossier, cursor, avatar, AssistantModal, and Brain symbol. The composition was
also exercised at 1440×900 in light and dark modes and at 390×844, including
open/minimized chat, constrained drag, position restoration, node selection,
and mobile dossier handoff.
