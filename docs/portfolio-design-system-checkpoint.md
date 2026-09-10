# Portfolio design-system checkpoint

Status: accepted design direction, 26 August 2026; map composition grammar
revised 2 September 2026. This document records the client-facing
composition. Its static HTML snapshot
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
- At rest the map is Bradley's own composition: Bradley at twelve o'clock,
  one trunk down to a junction, and the four Stories branching from it.
  Selecting Bradley opens that tree a little and reseats the field;
  deselecting closes it.
- Every spotlight — a Story or any record — is one composition: Bradley on
  top, the spotlit node beneath him on the trunk, its relations around it.
  There is no thread lock. Clicking any node lands on that node's own
  composition; the four Stories are only the entry point.
- Relations land in zones, not on coordinates. A zone is a sector and a
  distance band with members in order. The two large Stories are authored as
  zone maps; up to four relations take the loose fan, which hangs from the
  trunk and rotates with the record's signature; more form a star grouped by
  family. No relation lands in the trunk's cone. One seed per page load picks
  the pose inside those rules, so a record returns to the same pose within a
  visit and takes a fresh one after reload.
- Records outside a composition form the field: dimmed, deeper, dispersed
  evenly through the composition's own footprint, never under a lit label or
  on a lit line, and never closer together than a label. The region grows
  outward only when the footprint lacks room, so the map stays compact in a
  small window without scaling.
- Every connector stops outside each endpoint's envelope — the tightest
  circle around the mark plus its label box — with a 2px clearance. A line
  that cannot fit is not drawn. Related nodes may land below the selected
  record, but their rays clear its label; clearance changes the relation's
  angle, not its screen-space radius or side. Every related label keeps 8px
  clear of non-incident lit lines, including the Bradley-to-spotlight trunk.
- Every map click moves something. Bradley leans at least a minimum toward
  the spotlit record and shifts a minimum distance between compositions. The
  only still click is empty map at rest.
- Nodes can be held and dragged and spring back to their composition on
  release; nothing is persisted. Blank-space dragging does not move the
  field, while a blank-space click resets the focused composition.

## Cursor and interaction

- Fine-pointer devices use one segmented cursor across the website. It closes
  on every press and inverts its arm and center treatment over actionable
  surfaces and draggable nodes.
- Selecting a node recomposes the graph and opens the same subject in the
  dossier. Browser history preserves direct node and Story states.
- Empty space, the Index control, and Escape return the world to its overview.

## AssistantModal shell

- The assistant begins minimized as the Chat node control — three dots in the
  mark envelope with a 40px hit box, no ring — at the map area's 24/24
  corner. Its open panel is 18rem / 288px wide.
- The header is the only drag surface. Desktop dragging is constrained to the
  canvas; the panel cannot cross into the dossier or leave the viewport.
- Minimizing preserves the panel position for the visit and restores the
  trigger at its lower-right corner. The trigger is hidden while the panel is
  open, and the dossier contains no duplicate chat action.
- At 900px and below, the graph is removed. Opening chat temporarily hides the
  dossier; minimizing chat restores it. Header dragging is disabled there.
- The visible question, answer, evidence pills, composer, radius, and spacing
  remain the accepted provisional interior; its Send and Minimize glyphs are
  node controls. This checkpoint
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
dossier, cursor, avatar, AssistantModal, and Brain symbol. The map's
composition rules — zones, field, envelope, tree junction, minimum shift —
carry unit tests under `lib/portfolio-world-*.test.ts`, which assert the
rules rather than coordinates. The composition was also exercised at 1440×900
in light and dark modes and at 390×844, including open/minimized chat,
constrained drag, node selection, and mobile dossier handoff, and every record
and Story state was reviewed at 1440×900 with a pinned seed.
