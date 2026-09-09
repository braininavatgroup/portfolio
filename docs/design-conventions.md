# Design conventions

Status: house rules, 2 September 2026, restated for the dossier respec. Read
this before any UI or styling work.

This document states how styling is actually written in this repository, as
rules you can follow without inspecting the whole stylesheet. It is a
description of the live code, not a proposal.

Related documents:

- `docs/design-tokens.md` — the full token inventory: every name, its value,
  its role, and its light/dark pair.
- `docs/portfolio-design-system-checkpoint.md` — the accepted visual direction
  and the full node, relationship, and interaction grammar.
- `docs/components/` — one cheat-sheet per component: purpose, the props that
  matter, what has to be around it, a runnable example, and the pitfalls.
  **Read a component's sheet before using or modifying it.** This document
  says how to style; the sheet says what the thing already is.

Where this document and the stylesheet disagree, the stylesheet is right and
this document is stale — fix it here.

## 0. The two surfaces

Every rule below has a different answer depending on which surface you are in.
Identify the surface first.

1. **The accepted composition.** Everything under `.portfolio-composition` —
   the world, the dossier, the assistant, the cursor. Applied in
   `components/PortfolioExperience.tsx`. This is the client-facing portfolio
   and the only surface where new design work happens.
2. **Supporting pages.** `/privacy`, `/design`, and the
   graph/scene/drawer/toybox/avatar-director selectors. These predate the
   checkpoint. They are kept working, not extended.

**Rule 0.1** — New work targets the composition. Do not add new
`--prototype-*` tokens or new legacy-page selectors. The inventory only
shrinks: a token with no `var()` reader left is not "frozen", it is dead, and
it goes. `tests/design-tokens.test.ts` fails on an undocumented token and on a
documented token nothing declares.

**Rule 0.2** — When you must touch a legacy page, use the `--prototype-*`
tokens already there. Do not "upgrade" it to checkpoint colors as a side
effect; that is a deliberate migration, not a drive-by.

## 1. Never hard-code a color

**Rule 1.1** — `app/globals.css` contains zero raw color literals outside the
`:root` token block. No `#rrggbb`, no `rgb()`, no `rgba()`, no named colors,
anywhere below it. `tests/design-tokens.test.ts` enforces it.

**Rule 1.2** — To style something, reference an existing token with `var()`.
If genuinely no token fits, add one to the correct family in `:root` and record
it in `docs/design-tokens.md` in the same change. Adding a token is a visible
decision; a literal is a silent one. The same holds for **spacing and type on
the dossier**: every gap comes from `--reader-space-*` and every voice from
`--reader-type-*` (§3). Geometry that is not spacing stays literal — the 18px
mark box, the 40px control hit box, the 12px figure-frame padding, the 6px
glyph-to-label gap, a stage maximum width.

**Rule 1.3** — Derive tints and scrims with `color-mix()` over tokens rather
than adding a near-duplicate token:

```css
background: color-mix(in srgb, var(--reader-paper) 92%, var(--map-paper));
text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
```

**Rule 1.4** — Colors in rendering code (canvas, WebGL) read from the CSS
tokens through `getComputedStyle`; see `cssColor()` in
`components/PortfolioWorld.tsx`, which reads `--world-<register>` and `--ink`
off the `.portfolio-composition` element. A hex in TypeScript is a *fallback
argument only*. Do not introduce new code-side colors — `docs/design-tokens.md`
lists the ones that already exist and why.

## 2. The token families

Four families are live in the composition. Use the **semantic alias**, never
the light/dark leaf, unless you are writing the mode block itself (§4).

| Family | What it is | Use for |
| --- | --- | --- |
| `--map-*` | The world plane and its neutrals | Canvas background, the dossier's left edge, figure frames, control outlines |
| `--reader-*` | The dossier plane: its paper, copy hierarchy, spacing and type scales | Everything inside `.portfolio-reader` and the stage |
| `--world-*` | The six register colors | Node marks, inline links, anything that must match a node |
| `--prototype-*` | Legacy vocabulary | Legacy pages only (§0.2) |

### Semantic aliases — the ones you actually write

These are defined on `.portfolio-composition` and re-pointed under dark mode.
They are the only color names that belong in new composition CSS.

| Alias | Role |
| --- | --- |
| `--ink` | Primary composition ink: titles, summaries, rows, controls and their labels |
| `--focus-ring` | Acid focus ring in both modes |
| `--map-paper` | World background |
| `--map-paper-near` | Near-paper world surfaces |
| `--map-muted` | Map labels and secondary map ink |
| `--map-line` | The single neutral rule. On the dossier it draws exactly one thing: the left edge |
| `--map-line-strong` | Figure frames, the play ring, the stage border |
| `--map-grid` | Placeholder grids |
| `--reader-paper` | Dossier surface |
| `--reader-body` | Paragraph copy |
| `--reader-muted` | Labels, captions, placeholder meta, footer controls at rest |
| `--world-identity` | Bradley's identity mark and the Contact marks |
| `--world-story` | Story register type, painted with the Arc red pair |
| `--world-arc` | From argument to instrument register |
| `--world-warm` | Operations register |
| `--world-bridge` | Bridge register |
| `--world-cool` | In Production register |

The shadow tokens are *not* mode-switched — use them directly:
`--reader-media-shadow`, `--reader-gallery-shadow`, `--reader-assistant-shadow`.

### Spacing tokens

The dossier runs on an **8-pt rhythm**: every gap and every line-height is a
multiple of 8. `:root` holds the multiples it uses — `--reader-space-1` (8),
`-2` (16), `-3` (24), `-4` (32), `-6` (48, reserved), `-8` (64).

**Rule 2.1** — Space on the dossier is written with these tokens, never with a
number. The recurring meanings: 24 is the page inset (map mast, dossier top,
mobile gutter, chat and stage corners); 32 is the desktop gutter, the
summary-to-body gap, and the index group gap; 64 sits above every section
label; 8 below it; 16 between paragraphs; a figure adds 8 either side of the
16 grid gap.

**Rule 2.2** — Each Reader, Map, and Guide pane begins with a 40px bar and a
one-pixel `--map-line` hairline. The Reader body itself has no rules. Sections,
groups, and Reader rows are separated by space alone. The one standing
exception is `.reader-copy-placeholder`, which draws a dotted
`--map-line-strong` left edge while copy is in progress.

### Other dimension tokens

`--cursor-size` and `--world-hit-area` (`34px`) live in `:root`. Reading Room
pane dimensions belong to its visit-scoped panel layout. The Reader centres a
column of at most 680px with a 632px content maximum and 24px gutters; a
narrower slot reflows the column to its own width.

### Selector-local custom properties

- `--register` — set by `.reader-inline-link[data-register="…"]` to one
  `--world-*` alias, then read as `var(--register, var(--world-identity))`.
  This is the idiom for "this element takes its record's register color."
  An external anchor (`[data-external="true"]`) sets it to `--ink` instead:
  an address off the site belongs to no register.
- `--cursor-a` / `--cursor-b` — set inline by `components/CursorInstrument.tsx`
  from the hovered node's register.

## 3. One type scale

There is one family in the composition: `var(--font-reader)` (`"NHG
portfolio"`, Neue Haas Grotesk, declared by two `@font-face` rules — weight 400
and 500–700 — with Helvetica Neue / Helvetica / Arial fallbacks). The scale is
nine voices held in `:root` as `font` shorthands (`weight size/line-height`),
and a rule reads one as:

```css
font: var(--reader-type-body) var(--font-reader);
```

Tracking, case and colour belong to the rule that reads the voice, and are the
same everywhere the voice appears.

| Token | Value | With | Where |
| --- | --- | --- | --- |
| `--reader-type-display` | 500 36/40 | −0.055em, `--ink`, `text-wrap: balance` | The map mast and every dossier `h1`: home (the throughline), Index, thread, record. Fixed — never `clamp()` |
| `--reader-type-summary` | 400 18/24 | −0.01em, `--ink` | Record summary, thread lede |
| `--reader-type-row` | 400 15/24 | `--ink` | Contents, related, explore, and contact rows |
| `--reader-type-body` | 400 15/24 | `--reader-body`, `text-wrap: pretty` | Paragraphs; the copy-placeholder prompt at weight 500 in `--ink` |
| `--reader-type-mast` | 500 15/20 | `--ink` | Contents mast and group titles |
| `--reader-type-secondary` | 400 13/18 | `--reader-muted`; `--ink` for the active image label | Guide status copy, Reader image-overlay label |
| `--reader-type-caption` | 400 12/16 | `--reader-muted`; `--ink` for control labels | Figure captions, placeholder meta, footer and overlay controls, node-control labels |
| `--reader-type-label` | 500 11/16 | +0.06em, uppercase, `--reader-muted` | Section labels, placeholder labels, the stage eyebrow |
| `--reader-type-tab` | 400 10/12 | +0.02em | Mobile tab labels only |

**Rule 3.1** — One label voice. Every label on the dossier is
`--reader-type-label`; there is no second small-caps style, no per-register
label colour, no badge or kind chip. Nothing on the dossier is smaller than
11px. No test enforces this yet; check it by hand in review.

**Rule 3.2** — The head stack is fixed: title → 16 → summary → 32 → body.
Home and Index have no summary, so their titles carry the 32. No kind chip,
no path line, no register mark in the dossier — the spotlighted node on the
map carries the register.

**Rule 3.3** — Reader copy does not shrink on mobile. The 10/12 tab label is a
navigation-only voice, not a smaller Reader voice. Do not add a coarse-pointer
or short-window size override.

**Rule 3.4** — Canvas labels are code-side constants in
`components/PortfolioWorld.tsx`, not tokens: `FONT` paints record labels at
`400 12.5px` (`11px` compact); `BRADLEY_FONT` paints the root at `500 14px` on
desktop, the one deliberate hierarchy exception, so the map's root reads before
its records. They change by hand if the scale does.

**Monospace is a system stack, for data columns only.**
`--font-prototype-mono` is `ui-monospace, SFMono-Regular, Menlo, …` — no
download — used where the content is literally code: the `/design` gallery's
token and swatch tables. Do not reach for it in the composition.

## 4. Light and dark, exactly

Light values are the default. Dark is a `prefers-color-scheme` media query that
re-points the semantic aliases. Nothing else switches.

**Rule 4.1** — A new composition surface **declares no mode-specific color of
its own.** It uses semantic aliases (§2) and inherits both modes for free. If
your new rule needs a `prefers-color-scheme` block, you have almost certainly
used a light/dark leaf token where an alias belongs. The controls are the
worked case: the brain mask is filled with `currentColor` and reads `--ink`
in both modes with no extra rule.

**Rule 4.2** — If you genuinely add a new mode-aware color, you add three
things and only three:

1. `--thing-light` and `--thing-dark` leaf tokens in the `:root` palette block.
2. `--thing: var(--thing-light)` in the `.portfolio-composition` block.
3. `--thing: var(--thing-dark)` in the `@media (prefers-color-scheme: dark)
   .portfolio-composition` block immediately after it.

Then write `var(--thing)` at the use site, add the row in
`docs/design-tokens.md`, and add the alias to the two `[data-theme]` blocks the
gallery uses — otherwise `/design` will show it stuck in one mode.

**Rule 4.3** — `[data-theme]` **is** a composition mechanism, but only the
gallery drives it. `:where([data-theme="…"]) .portfolio-composition` re-points
every semantic alias, which is how `/design` shows light and dark on one page.
There is no user-facing theme toggle: on the live site the mode comes from
`prefers-color-scheme` alone. Do not wire new composition styling to it — read
the aliases.

**Rule 4.4** — Anything painted behind the composition must follow the mode
too. `body:has(.portfolio-composition)` sets the body background to
`--map-silver` / `--map-paper-dark`, and to the reader paper below 900px,
because iOS Safari otherwise paints default white in toolbar-resize gaps.

**Rule 4.5** — Where an element can be evaluated before the composition's
aliases resolve (the chat dock), the live code uses a defensive fallback:
`var(--reader-paper, var(--reader-paper-light))`,
`var(--ink, var(--reader-ink-light))`. Match the surrounding block; do not add
fallbacks elsewhere.

## 5. Where CSS lives and how classes are named

**Rule 5.1** — All CSS lives in `app/globals.css`. There are no CSS modules, no
`.css` files beside components, no styled-components, and no `<style>` blocks.
Add your rules to the section that already owns the region.

**Rule 5.2** — There is **no Tailwind**. Every component carries semantic
class names only. `tests/design-tokens.test.ts` fails on a reintroduced
`@import "tailwindcss"`, `@theme`, or `@apply`.

**Rule 5.3** — Inline `style` is reserved for values only JavaScript can know:
cursor position and colors (`CursorInstrument`) and the dragged assistant dock
position (`PortfolioChat`). Everything else is a class.

**Rule 5.4** — Class naming, in two families:

- `.portfolio-<region>[-<part>]` names a top-level composition region and its
  structural parts: `.portfolio-composition`, `.portfolio-world`,
  `.portfolio-world-mast`, `.portfolio-world-node`, `.portfolio-reader`,
  `.portfolio-reader-footer`, `.portfolio-chat`, `.portfolio-chat-panel`,
  `.portfolio-chat-head`, `.portfolio-chat-thread`, `.portfolio-chat-composer`,
  `.portfolio-chat-trigger`, `.portfolio-node-mark`,
  `.portfolio-control-mark`, `.portfolio-mobile-view-control`,
  `.portfolio-feedback`.
- `.reader-<part>` names the dossier's interior, once you are inside
  `.portfolio-reader`: `.reader-scroll`, `.reader-content`,
  `.reader-summary`, `.reader-composed-body`, `.reader-record-section`,
  `.reader-index-group`, `.reader-rows`, `.reader-index-row`,
  `.reader-visual-trigger`, `.reader-placeholder-frame`,
  `.reader-footer-links`, and so on. Do not prefix these with `portfolio-`.

The cursor uses its own flat `.cursor-*` names. `.avatar-*` and `.scene-*` are
shared with the legacy surface.

**Rule 5.5** — Boolean state is a `data-` attribute on the element, selected as
`[data-state="true"]`: `data-open`, `data-visible`, `data-action`, `data-held`,
`data-has-thread`, `data-input-focused`, `data-register`,
`data-control`. A modifier class is used only when a whole region changes
mode, and it is appended to that region's own class, as with
`.portfolio-reader-clean-review` on the dossier. Never a `.is-` or `.active`
class.

**Rule 5.6** — Declarations inside a rule are alphabetical. Selectors are flat;
no CSS nesting is used. Related one-line rules may be written on a single line
where the file already does so.

**Rule 5.7** — The Reading Room breakpoint is **1020px**. At 1020px and above,
use the desktop Contents, main, and right-column layout. Below 1020px, use the
three-tab mobile layout at the full viewport width. The 600px block remains for
phone safe-area insets. The 980px, 900px, 760px breakpoints belong to supporting
or pre-Reading-Room selectors and are not the Reading Room contract.

**Rule 5.8** — The house focus treatment is
`outline: 2px solid var(--focus-ring); outline-offset: 2px` with a 6px radius.
`--focus-ring` is Acid `#b6df5b` in both modes. Apply it only through
`:focus-visible`. Never remove focus without replacing it.

**Rule 5.9** — Hover is fine-pointer only, and instant. Every `:hover` rule in
the dossier sits inside `@media (pointer: fine)`; coarse pointers get no hover
state. Dossier elements have no `transition` — rows, links, figures and footer
controls change state at once. Anything that does animate (the chat panel, the
avatar) keeps its `@media (prefers-reduced-motion: reduce)` entry reducing the
duration to `1ms`, matching the existing block at the end of the file.

## 6. Standing constraints from the checkpoint and the respec

These are product decisions, not preferences. See
`docs/portfolio-design-system-checkpoint.md` for the full grammar.

**Rule 6.1 — Selection introduces no new color.** A selected, hovered, active,
or focused mark keeps its native register color. Express state with opacity,
weight, scale, or the outline. There is no "selected blue."

**Rule 6.2 — Shared navigation rows.** Contents and Reader rows are 28px on desktop and 36px on
mobile. They use 15px type, an 18px trailing mark, register-coloured selected
text at weight 500, and an eight-percent ink hover fill with a 6px radius on
fine pointers. Related, Explore this thread, and Contact use the same row treatment inside Reader. Related headings match Contents group titles. The mark never changes.

**Rule 6.3 — One relationship treatment.** Relationships are a single
Silverpoint line: thin, straight, neutral, arrowless. The canvas connectors in
`PortfolioWorld` use `var(--map-connector)`, opaque because that code applies
its own per-link alpha. Do not encode link type as color, dash, thickness, or
arrowhead — classifications stay backstage. Every connector stops outside each
endpoint's envelope: the mark's tightest circle (`portfolioNodeMarkRadius`)
plus its painted label box (`lib/portfolio-node-envelope.ts`), with
`CONNECTOR_CLEARANCE` of 2px. A line whose ray clears the label starts past
the mark; clipping never bends the line or invents a different origin. At a
stable spotlight, related nodes may sit below the selected record, but a ray
that would cross its label is rotated at the same screen-space radius and on
the same side until it clears the nearest top corner by 2px. This label-clear
pass runs after overlap relaxation. A line whose envelopes touch is dropped
(`connectorSegment` returns `null`), and each end eases toward its new start so
the clip never snaps mid-motion. Every related label also clears every
non-incident lit segment by 8px; the smallest modest sideways node nudge wins,
so a sloping trunk cannot brush the first or last word. The tree at rest is one
trunk from Bradley to a junction (`lib/portfolio-story-tree.ts`) and branches
from there; nothing draws Bradley-to-Story lines directly. In the fully connected overview, straight connectors are interrupted eight pixels around intervening labels so a dense web never paints across text.

**Rule 6.4 — Factual marks share one envelope.** Register marks are authored against
`PORTFOLIO_NODE_MARK_SIZE = 15` in `lib/portfolio-node-mark.ts`, which yields
an 18-unit viewBox rendered in an 18px box, with `stroke: currentColor`, round
joins, and `stroke-width: 1.45`, colored only by `--world-<register>` via `data-register`.
Author new geometry against 15, not 18, or it draws 20% oversized. Bradley's
symbol (`.portfolio-node-brain`) is an 18px mask of `/biv-brain-symbol.svg`
filled with `currentColor`. `PortfolioWorld` loads the same SVG and paints it at
21px for the canvas root node. Map and Guide marks clip the SVG brain pattern
inside their supplied hexagon and bubble outlines. Controls preserve the approved A geometry on a 20px surface with a 1.25px
non-scaling stroke. Node/contact marks use 1.45px. Shared constants in
`lib/portfolio-glyph-metrics.ts` govern rendering; geometry checks validate
authored paths without fitting or repositioning them at runtime.

**Rule 6.5 — Controls are node marks.** Use `PortfolioControlMark` for Reading
Room chrome and actions. Bar controls may use a 32px square hit area with a 6px
hover fill on fine pointers. Send is the deliberate exception to bare controls,
using a filled 28px or 32px square when text exists. Disabled controls use
opacity alone. Do not draw a control as a typographic glyph.

**Rule 6.6 — Guide is docked.** Guide occupies a Reading Room slot on desktop
and the lower 48 percent of the Map tab on mobile. It is not a floating chat
surface. Temporary overlays remain reserved for bounded product needs.

**Rule 6.7 — Layout resets on load.** Every fresh load starts with Reader in
main, Map upper right, Guide lower right, and Contents on the left, at default
sizes with panels open. Resizing, swapping, and collapsing last only for the
mounted visit; browser storage never restores a layout. There is no manual
layout-reset control in the interface.
Panels remain user-resizable within their specified minimums. Reader content is a centred column of at most
680px inside its slot, with a 632px content maximum and 24px gutters; a slot
narrower than 680px reflows it rather than clipping it.

**Rule 6.8 — One page inset.** The map mast, the dossier's first line, the
chat dock's corner, and the dossier content all sit 24 from their area's edges;
the mast and the dossier title share the display voice and the same top, so
they sit on one baseline across the seam.

**Rule 6.9 — Privacy is the bottom line.** The former Index/Home footer control
is removed. About has no Contents row, and the Bradley mast is its Home control.
Privacy remains Reader's last in-flow line, right-aligned in the caption voice
and reached by scrolling to the end.

**Rule 6.10 — Cursor contract.** On `pointer: fine`, `cursor: none` is forced
globally and `.cursor-instrument` is the only pointer. Consequences for new UI:

- An actionable element must match
  `button, a, input, textarea, select, [role='button'], [role='link'],
  [data-world-node]` or the cursor will not invert over it. Prefer a real
  `<button>`; add `role` only if you cannot.
- A world node — draggable while held, springing back on release — carries
  `data-world-node` and `data-cursor-color="--world-<register>"`, naming the
  custom property the cursor reads.
- Do not set `cursor:` on a composition element — it is overridden by
  `!important` on fine pointers and the instrument is hidden on coarse ones.
- A true-fullscreen video is the exception: restore `cursor: auto !important`
  on the fullscreen element because the browser's top layer cannot contain the
  fixed custom cursor.
- The standalone local [avatar pose editor](avatar-pose-editor.md) uses the
  native pointer for bone handles and camera controls. It is served by Vite
  from `scripts/`, outside the public application and its cursor component.

**Rule 6.11 — Escape and empty space reset.** Blank-space click, the Index
control, and Escape return the world to overview. Blank-space drag does not
pan the field. A held node follows the pointer and springs back on release;
nothing about a drag is persisted. Preserve this if you touch world
interaction.

**Rule 6.12 — One map grammar: spine, zones, field, seed.** Every map state
is one composition and the camera never moves.

- **Spine.** Bradley at twelve o'clock; the spotlit node (a Story or any
  record) beneath him on the trunk; its relations around it. Rest is the case
  where the four Stories hang from the junction. There is no thread lock —
  any click lands on that node's own composition.
- **Zones** (`lib/portfolio-world-zones.ts`). Place is a rule, coordinates
  are not. A zone is a sector (screen degrees) and a band (world units) with
  members in order; members take equal slots, alternate near and far, and
  jitter inside their slot. `AUTHORED_ZONES` holds the two large Stories;
  `looseZones` seats up to four relations and hangs from the trunk's tilt,
  rotated by the record's signature so siblings differ; `starZones` seats
  more, grouped by family and split at the family boundary nearest the
  middle. `clearTrunkCone` keeps every relation out of the trunk's cone,
  wider for wide labels. `MAX_SPOTLIGHT_LEAN`, `BRADLEY_MIN_LEAN`, and
  `MIN_SHIFT` keep the spotlit node beneath Bradley and make every click a
  legible move. Author a new composition as zones; never as pixel offsets.
- **Field** (`lib/portfolio-world-field.ts`). Records outside the composition
  are dimmed, deeper, and dispersed evenly through the composition's own
  footprint, never under a lit label or on a lit line, and never closer than
  `FIELD.spacing`. The region grows outward only when the footprint lacks
  room. The lit nodes settle in the overlap solver first; the field seats
  around the settled positions and stays out of the solver. Pass every drawn
  lit line to `fieldGoals`, or the field may sit on it.
- **Seed.** One seed per page load (`setWorldSeed`), mixed with the
  composition's id, so a record keeps its pose within a visit and takes a new
  one after reload. `?seed=<n>` pins it in dev. Tests pass an explicit rng
  (`stillRng`, `createRng`) and assert the rules — sector, band, order,
  clearance, spacing — not coordinates.

## 7. One idiomatic example

A new dossier section — a label in the one label voice, rows in the one row
shape, spacing and type from tokens, no rule, no hex, no mode block:

```tsx
<section className="reader-record-section">
  <h2>Sources</h2>
  <ul className="reader-rows">
    {sources.map((node) => (
      <li key={node.id}>
        <button className="reader-index-row" onClick={() => onSelect(node)} type="button">
          <span>{node.label}</span>
          <PortfolioNodeMark family={node.family} register={node.register} />
        </button>
      </li>
    ))}
  </ul>
</section>
```

It needs no new CSS at all: `.reader-record-section` supplies the 64 above and
the label voice, `.reader-index-row` the responsive Contents row, the trailing mark, the
fine-pointer ring and the focus ring. If a section genuinely needs a rule of
its own, it reads like this:

```css
.reader-source-note {
  color: var(--reader-muted);
  font: var(--reader-type-caption) var(--font-reader);
  margin: var(--reader-space-1) 0 0;
  text-wrap: pretty;
}
```

It reads correctly in dark mode without a single additional line, because every
color is a semantic alias, and it sits on the grid because every length is a
spacing token.

## 8. Before you open the PR

- [ ] No color literal outside the `:root` block in `app/globals.css`.
- [ ] Every new color is a semantic alias, not a `-light` / `-dark` leaf.
- [ ] Every dossier length is a `--reader-space-*` token; every voice a
      `--reader-type-*` token; nothing under 11px; no `clamp()`.
- [ ] No rule inside the dossier; sections separated by space alone.
- [ ] Any new control is a `PortfolioControlMark`.
- [ ] No new `prefers-color-scheme` block (or, if unavoidable, all three parts
      of Rule 4.2 plus the `[data-theme]` blocks and the tokens doc row).
- [ ] Class names follow `.portfolio-<region>-<part>` or `.reader-<part>`.
- [ ] State is a `data-` attribute; no `.is-` classes; no Tailwind utilities.
- [ ] Declarations alphabetized; no new breakpoint.
- [ ] `:focus-visible` present; hover inside `@media (pointer: fine)`; no
      `transition` on dossier elements.
- [ ] Selection added no new color; one label voice; one row shape.
- [ ] `docs/design-tokens.md` updated if you added or retired a token.
- [ ] Checked at 1440×900 and 390×844, in light and dark: home, Index, a
      thread, a record, a record with an image overlay open, chat open. The mast
      and the dossier title share a top edge at 24.

## 9. Mobile review pass

- Reader inline navigation uses real anchors with controlled primary-click navigation. This lets links wrap with surrounding punctuation and preserves modified-click behavior.
- The default map uses a loose seeded field across its measured canvas at every aspect ratio. Overview connections are thinner and quieter than selected-map connections. Its upper tree connects Bradley to Themes, and factual and membership relationships remain visible throughout the overview. All overview records have labels beneath their marks, bounded to two lines. Straight connectors leave two pixels around each intervening label line and fade over seven pixels at clipped ends. Full names remain on their accessible buttons.
- The mobile map toolbar occupies a real row. The canvas measures the remaining area, including during selection and resizing. Read has no arrow; Hide/Show avatar shares the row.
- Reader and identity nodes use the approved brain crop `translate(1.15 3.17) rotate(-37) scale(1.6)` inside the family’s circular outline. Map and Guide use the approved patterned silhouettes with independently rotated and offset crops at 1.65 scale in an 18px control envelope. The avatar uses the approved connected-bust silhouette; hidden state is a solid silhouette in muted ink. Inactive tabs use muted ink without separately fading the pattern. All glyph artwork renders at the shared 0.9 scale, including map nodes, contacts, and Guide controls; layout envelopes and click targets retain their authored sizes.
- Guide brings each new follow-up and the beginning of its reply into view once. Growing answers and deliberate scrollback preserve reading position. There is no jump-to-latest button or reserved control row; visitors scroll the transcript normally.
- Guide links use the model's natural phrase, validated against that sentence's evidence. Standalone attribution markers remain in the wire history but add no source-title text to the rendered answer.
