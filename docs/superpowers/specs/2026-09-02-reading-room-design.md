# Reading Room design

Status: approved handoff, 2 September 2026.

Source package:
`/Users/bradleyberkman/Downloads/design_handoff_reading_room`.
The package's `README.md` is the visual and behavioral authority. Its
`.dc.html` files are references only and must not ship.

## Product contract

The portfolio becomes a Reading Room built from three existing views:
Reader, Map, and Guide. Desktop presents Contents, one main view, and two
stacked side views. The three views can swap slots by dragging their bars.
The regions resize and collapse, and the layout persists for the browser.

Below 1020px, the portfolio becomes a three-tab application: Contents,
Reader, and Map. The Map tab contains the live Map over the docked Guide at a
fixed 52/48 split. The top and bottom navigation bars remain visible.

The redesign changes presentation only. It does not change the chat route,
provider, grounding, Turnstile, spend controls, refusal behavior, telemetry,
or production activation contracts.

## Desktop

- The viewport has a paper-colored Contents panel, a main slot, and a paper
  right column with top and bottom slots. Surfaces belong to slots, not views:
  the main slot and its bar are near-paper; Contents, both side slots, and
  their bars are paper. A swapped view takes its slot's colour. Map silver is
  not used on desktop.
- Contents defaults to 320/1440 of the viewport and has a 300px minimum.
  Dragging 48px past the minimum collapses it.
- The main slot has a 720px minimum. The right column has a 360px minimum.
  Dragging 48px past the right-column minimum hides both right views.
- Those minimums apply from 1382px up. Between 1020px and 1382px (tablet
  portrait, small laptops) the desktop is compact: Contents 240px, right
  column 320px, main the remainder, so the three regions always fit the
  window and the page never scrolls sideways. The Reader column reflows and
  the side Map is compact, so nothing is clipped.
- The right column defaults to a 40/60 vertical split with 240px minimums,
  so a side slot always shows a usable Guide (bar, avatar area, composer).
  Dragging a side slot to its minimum collapses it to its 40px bar.
- Default slots are main Reader, top Map, bottom Guide.
- Slot assignments, hidden views, and all three panel layouts persist under
  the Reading Room storage namespace.
- Every slot has a 40px bar. The whole bar is the drag handle. Dropping over
  another slot swaps the two assigned views. While dragging, nothing follows
  the pointer and the target shows only its fill and 1px ink border; no view
  name or other text appears.
- The main bar carries the Bradley mast when Contents is hidden. The bottom
  bar can collapse and reopen the bottom slot. The Guide bar exposes a new
  conversation action only after a thread exists.
- Resize separators are a one-pixel hairline at rest and three-pixel ink after
  a short hover delay or while dragging.

## Contents

- The mast is Home. It contains the sidebar control and "Bradley Berkman" on
  one line that never wraps. It carries no brain; the Reader bar's brain is
  the only brain in the top row.
- Groups follow `portfolioWorldIndexSections` in this order: Threads,
  Operations, Music promotions systems, Client systems, In Production.
- Rows are 28px on desktop and 36px on mobile. Text is 15px. Marks are 18px.
- Selection uses the row's register color and weight 500. Fine-pointer hover
  uses an eight-percent ink fill and 6px radius.
- Selecting a row updates the Reader and Map. Mobile selection also switches
  to Reader.

## Reader

- The Reader keeps the existing authored content, inline links, Related rows,
  thread-member rows, contact rows, editor integration, and visual blocks.
- Its pane takes its slot's surface. The column is centred and at most 680px
  wide; a narrower slot reflows it to the slot width. Content is at most 632px
  with a 24px gutter.
- Reader content reflows only when the slot is narrower than 680px; wider
  slots keep the 680px column centred.
- About has no index row. The mast is its Home control.
- The old Index/Home footer control is removed. Privacy remains the final
  in-flow line.
- Reader rows stay hover-free.

## Map

- The current canvas composition, selection, connector, field, seed, drag,
  and visual-stage behavior remains the source of truth.
- The Map sizes from its slot rather than the viewport. Its rest composition
  is centred vertically in the slot, and the field keeps the same inset above
  and below; nothing reserves a band for a floating surface.
- In a side slot, labels remain visible for Bradley, all four threads, the
  selected node, and the hovered node. Other labels appear only on hover.
- Labels for nodes left of 30 percent of the map width sit to the right.
- Map node controls remain real buttons but leave the tab order inside the
  Reading Room. Contents is the keyboard navigation route.
- Selecting a Map node opens the same record in Reader.

## Guide

- The existing production transport and server safety boundaries remain
  unchanged.
- The client presentation uses `assistant-ui` runtime and primitives for the
  thread, messages, suggestions, and composer.
- The avatar area sits above a transcript occupying at most 45 percent of the
  Guide. The transcript is bottom-anchored. The live avatar stands on the
  area's bottom edge and scales to fit the area's height (16px headroom, 80px
  minimum), re-docking after any panel resize, collapse, or reopen.
- User messages are right-aligned bubbles. Assistant messages are plain body
  copy. Valid evidence citations are inline, register-colored links that
  select the cited subject in Map and Reader.
- Production `[E#]` citations remain the wire format. The client maps them to
  the evidence array and Reading Room navigation. The server prompt and event
  protocol do not change.
- Initial suggestions rotate by visit in groups of three: two portfolio
  questions and one playful avatar prompt. Follow-ups use the cited subject
  when possible and otherwise use the default bank.
- The composer sends on Enter while preserving IME and Shift+Enter behavior.
  Send is filled when text exists and muted otherwise.
- A new-conversation control clears visible messages, bounded conversation
  history, visit state, errors, suggestions, and the current request.
- After ten seconds without text, show the 18px twirl and the exact line
  "Still thinking. The records are long."
- A failed turn shows "Something went wrong. Try again" with an inline retry
  action. Retry resends the last failed question exactly once.
- Offline disables the composer at 60 percent opacity and uses the exact
  placeholder "The Guide is offline".
- If the provider returns one validated answer event, the client may reveal
  that answer word by word. This does not alter server streaming.

## Mobile

- The top bar is 44px. The Bradley mast has a 20px inset and returns to About.
- The bottom bar is 56px and contains Contents, Reader, and Map tabs.
- Contents and Reader fill the space between the bars.
- The Map tab contains Map at 52 percent and Guide at 48 percent.
- A selected non-About record shows a paper chip at the Map's top-left with
  its mark, short label, and Read action. Read switches to Reader.
- The avatar placeholder is 96px square at the Map's bottom-right until the
  live avatar is available there.
- Only existing Map motion animates. Tabs, resize, collapse, swap, and record
  changes are instant.

## Marks, assets, and color

- Marks render in an 18px box with viewBox `-9 -9 18 18`, 1.45 stroke, round
  caps, and miter joins. Brain renders at 15px.
- Story spokes use exact 60-degree proportions `0.433` and `0.25`.
- Component is an equilateral triangle with circumradius `0.56`.
- Operation's inner radius is half its outer radius.
- Close uses endpoints at `+/-0.367` of the 15-unit mark size.
- Add sidebar-left, sidebar-right, panel-bottom, reader, send, copy, new-chat,
  chevron, and read-arrow control marks.
- Map is the supplied hexagon with brain-pattern interior. Guide is the
  supplied ellipse bubble with brain-pattern interior and 1.15 ring weight.
- Replace PNG brain references with `/biv-brain-symbol.svg` and add
  `/biv-twirl-sprite.png` from the handoff. Strip non-rendering SVG metadata
  while preserving the supplied path and viewBox.
- Story keeps its register type but `--world-story` points to the arc red pair.
  No green appears in the Reading Room.
- Light surfaces are paper `#eff1f1`, near-paper `#d2d7db`, and map silver
  `#c5cbd0`. Dark surfaces are paper `#292625`, near-paper `#211c18`, and map
  `#19140f`. Desktop uses only paper and near-paper; mobile keeps the Mobile
  Prototype's three: paper bars, near-paper pages, map silver for the Map and
  its composer.
- The focus ring is 2px Acid `#b6df5b`, offset 2px, radius 6px, and
  `:focus-visible` only.
- Desktop has no shadows. Controls, chips, and composer use 6px radius. User
  bubbles use `12px 12px 2px 12px`.

## Resolved handoff conflicts

- `README.md` is newer than repeated/stale sections in `github.md`.
- The breakpoint is 1020px, not the repository's previous 900px.
- Contents minimum is 300px, not the stale 240px note.
- Current `react-resizable-panels` v4 uses `Group`, `Panel`, `Separator`, and
  `useDefaultLayout`; it replaces the handoff's obsolete v3 component names
  while preserving the specified behavior.
- Current dnd-kit uses `@dnd-kit/react`; it replaces the handoff's legacy
  package naming while preserving bar-as-handle slot swapping.
- The supplied SVG is nonempty and is accepted after metadata removal and
  visual verification.
- The README's drop-target view name and Contents-mast brain are superseded by
  the interactive prototype (`ReadingRoomTile.dc.html` renders an empty
  overlay; the prototype mast shows no brain) and Bradley's corrections of
  3 September 2026.
- The mobile Map is compact, as `Mobile Prototype.dc.html` passes
  `compact=true`; the desktop main slot is the only non-compact Map.
- The README's `body { overflow-x: auto }` canvas is superseded (Bradley,
  3 September, iPad portrait): the page never scrolls sideways; a narrower
  desktop shrinks its panel minimums instead.
- Mobile: the document never scrolls; the shell is the dynamic viewport with
  the tab bar in the home-indicator safe area, and a focused composer gives
  the Guide the whole page while the keyboard is up.
- Bradley's mockup captures of 3 September fix desktop surfaces by slot
  (measured: main `#d2d7db`/`#211c18`, sides and Contents `#eff1f1`/`#292625`,
  composer always near-paper); the README's per-view mapping is superseded.

## Acceptance proof

- Pure layout transitions and persistence have deterministic tests.
- Mark geometry, citation mapping, Guide state changes, Contents selection,
  Reader navigation, embedded Map sizing, mobile tabs, and desktop swap and
  collapse behavior have component or unit tests.
- Existing chat client/server safety tests remain green.
- Full tests, typecheck, lint, dead-code check, and production build pass.
- Browser verification covers 1440x900 and 390x844 in light and dark for
  About, Contents, a thread, a record, Guide initial/answer/error/offline
  states, swapping, collapse, and mobile Read navigation.
