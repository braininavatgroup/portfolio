# Design conventions

Status: house rules, 31 August 2026. Read this before any UI or styling work.

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
2. **Legacy prototype pages.** `/index` (`.stacked-editorial-index`),
   `/privacy`, the graph/scene/drawer/toybox/avatar-director selectors, and the
   non-overlay `.portfolio-header`. These predate the checkpoint. They are kept
   working, not extended.

**Rule 0.1** — New work targets the composition. Do not add new
`--prototype-*` tokens or new legacy-page selectors. The inventory only
shrinks: a `--prototype-*` token with no `var()` reader left is not "frozen",
it is dead, and it goes. Geist used to be named here too; it has been deleted
outright, so there is nothing left to add.

**Rule 0.2** — When you must touch a legacy page, use the `--prototype-*`
tokens already there. Do not "upgrade" it to checkpoint colors as a side
effect; that is a deliberate migration, not a drive-by.

## 1. Never hard-code a color

**Rule 1.1** — `app/globals.css` contains zero raw color literals outside the
`:root` token block. No `#rrggbb`, no `rgb()`, no `rgba()`, no named colors,
anywhere below it. Keep it that way — `tests/design-tokens.test.ts` enforces
it, which is why this no longer quotes a line number that went stale the first
time a token was removed.

**Rule 1.2** — To style something, reference an existing token with `var()`.
If genuinely no token fits, add one to the correct family in `:root` and record
it in `docs/design-tokens.md` in the same change. Adding a token is a visible
decision; a literal is a silent one.

**Rule 1.3** — Derive tints and scrims with `color-mix()` over tokens rather
than adding a near-duplicate token:

```css
background: color-mix(in srgb, var(--reader-paper) 92%, var(--map-paper));
background: color-mix(in srgb, var(--ink) 5%, transparent);
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
| `--map-*` | The world plane and its neutrals | Canvas background, rules, grids, secondary map ink |
| `--reader-*` | The dossier plane | Dossier paper, copy hierarchy, shadows |
| `--world-*` | The six register colors | Node marks, register badges, anything that must match a node |
| `--prototype-*` | Legacy vocabulary | Legacy pages only (§0.2) |

### Semantic aliases — the ones you actually write

These are defined on `.portfolio-composition` and re-pointed under dark mode.
They are the only color names that belong in new composition CSS.

| Alias | Role |
| --- | --- |
| `--ink` | Primary composition ink |
| `--map-paper` | World background |
| `--map-paper-near` | Near-paper world surfaces |
| `--map-muted` | Map labels and secondary controls |
| `--map-line` | The single neutral rule / relationship treatment |
| `--map-line-strong` | Strong rules and control outlines |
| `--map-grid` | Placeholder grids |
| `--reader-paper` | Dossier surface |
| `--reader-summary` | Summary copy |
| `--reader-body` | Body copy |
| `--reader-muted` | Labels and metadata |
| `--world-identity` | Bradley's identity mark |
| `--world-story` | Story register |
| `--world-finding` | Finding register |
| `--world-warm` | Operations register |
| `--world-bridge` | Bridge register |
| `--world-cool` | In Production register |

The shadow tokens are *not* mode-switched — use them directly:
`--reader-stage-shadow`, `--reader-media-shadow`, `--reader-gallery-shadow`,
`--reader-assistant-shadow`, `--reader-floating-control-shadow`.

### Dimension tokens

Defined in `:root`: `--font-reader`, `--assistant-panel-width` (`18rem`),
`--floating-control-size` (`40px`), `--reader-gutter` (`24px`),
`--reader-label-size` (`10px`), `--reader-copy-size` (`12px`),
`--reader-row-size` (`15px`), `--reader-section-title-size` (`18px`),
`--cursor-size` (`34px`), `--world-hit-area` (`34px`).

Defined on `.portfolio-composition` because they are composition-scoped:
`--portfolio-display-title-size` (`clamp(25px, 2.5vw, 37px)`) and
`--reader-width` (`clamp(460px, 38vw, 560px)`, overridden to `100%` at
900px and below). `--mobile-controls-inline-end` is defined on
`.portfolio-composition` inside the 600px block only.

**Rule 2.1** — Reuse a dimension token before inventing a magic number. Reader
padding uses `var(--reader-gutter)`; a floating control is
`var(--floating-control-size)`; anything that must clear the dossier computes
from `var(--reader-width)`.

### Selector-local custom properties

Three custom properties are set *by the markup or by a narrow selector*, not by
the theme:

- `--register` — set by `.reader-kind[data-register="…"]` to one `--world-*`
  alias, then read as `var(--register, var(--world-identity))`. This is the
  idiom for "this element takes its record's register color."
- `--cursor-a` / `--cursor-b` — set inline by `components/CursorInstrument.tsx`
  from the hovered node's register.
- `--legend-color` — set by `.legend-spec` / `.legend-system` /
  `.legend-artifact`. Legacy only.

## 3. The two typographic voices

Both voices are Neue Haas Grotesk. There is one family in the composition:
`var(--font-reader)` (`"NHG portfolio"`, declared by two `@font-face` rules —
weight 400 and 500–700 — loaded from `braininavat.systems`, with Helvetica Neue
/ Helvetica / Arial fallbacks). It is set once on
`.portfolio-composition` and inherits everywhere. Do not set `font-family` on a
new composition selector.

**Voice A — display and reading.** Tight tracking, near-single line height,
large sizes.

| Use | Rule |
| --- | --- |
| Mast and index title | `var(--portfolio-display-title-size)`, weight 500, `letter-spacing: -0.055em`, `line-height: 0.98` (`.portfolio-world-mast`, `.reader-index-content > h1`, `.reader-topbar button`) |
| Record title | `clamp(34px, 4vw, 53px)`, weight 400, `letter-spacing: -0.065em`, `line-height: 0.92` (`.reader-content h1`) |
| Section heading | `var(--reader-section-title-size)`, weight 500, `letter-spacing: -0.025em` (`.reader-index-group h2`) |
| Summary | `var(--reader-row-size)`, `letter-spacing: -0.015em`, `line-height: 1.43` |
| Body | `var(--reader-copy-size)`, `line-height: 1.48`, color `var(--reader-body)` |

**Voice B — notation.** Small, uppercase, positive tracking. Used for labels,
eyebrows, metadata, and map annotation.

| Use | Rule |
| --- | --- |
| Stage / control label | `var(--reader-label-size)`, uppercase, `letter-spacing: 0.07em` |
| Placeholder label | `var(--reader-label-size)`, weight 600, uppercase, `letter-spacing: 0.08em` |
| Record section label | `11px`, weight 500, uppercase, `letter-spacing: 0.06em`, color `var(--reader-muted)` |
| Kind / path metadata | `9px`, weight 400, `letter-spacing: 0.025em`, color `var(--reader-muted)` |
| Canvas node label | `400 12.5px` (`11px` compact), the `FONT` constant in `components/PortfolioWorld.tsx` |

**Rule 3.1** — A new label uses Voice B at an existing size. Do not add a new
uppercase size.

**Monospace is a system stack, for data columns only.**
`--font-prototype-mono` is `ui-monospace, SFMono-Regular, Menlo, …` — no
download. It is used by the `/design` gallery's swatch and token tables, where
hex values need to align, plus the toybox eyebrow, the legacy header nav and
the editorial index meta. Do not reach for it in the composition's reading or
notation voices; those are Voice A and Voice B above.

## 4. Light and dark, exactly

Light values are the default. Dark is a `prefers-color-scheme` media query that
re-points the semantic aliases. Nothing else switches.

**Rule 4.1** — A new composition surface **declares no mode-specific color of
its own.** It uses semantic aliases (§2) and inherits both modes for free. If
your new rule needs a `prefers-color-scheme` block, you have almost certainly
used a light/dark leaf token where an alias belongs.

**Rule 4.2** — If you genuinely add a new mode-aware color, you add three
things and only three:

1. `--thing-light` and `--thing-dark` leaf tokens in the `:root` palette block.
2. `--thing: var(--thing-light)` in the `.portfolio-composition` block.
3. `--thing: var(--thing-dark)` in the `@media (prefers-color-scheme: dark)
   .portfolio-composition` block immediately after it.

Then write `var(--thing)` at the use site, add the row in
`docs/design-tokens.md`, and add the alias to the two `[data-theme]` blocks the
gallery uses — otherwise `/design` will show it stuck in one mode.
(`tests/design-tokens.test.ts` fails on an undocumented token, so the doc row
is enforced, not a courtesy.)

**Rule 4.3** — `[data-theme]` **is** a composition mechanism, but only the
gallery drives it. `:where([data-theme="…"]) .portfolio-composition` re-points
every semantic alias, which is how `/design` shows light and dark on one page.
There is no user-facing theme toggle: on the live site the mode comes from
`prefers-color-scheme` alone. `data-theme="light"` is additionally set on
exactly one legacy element (`app/index/page.tsx`) to force the prototype light
palette there. Do not wire new composition styling to it — read the aliases.

**Rule 4.4** — Anything painted behind the composition must follow the mode
too. `body:has(.portfolio-composition)` sets the body background to
`--map-silver` / `--map-paper-dark`, and to the reader paper below 900px,
because iOS Safari otherwise paints default white in toolbar-resize gaps.

**Rule 4.5** — Where an element can be evaluated before the composition's
aliases resolve (the fixed floating controls and the chat panel), the live code
uses a defensive fallback: `var(--reader-paper, var(--reader-paper-light))`,
`var(--ink, var(--reader-ink-light))`. Match the surrounding block; do not add
fallbacks elsewhere.

## 5. Where CSS lives and how classes are named

**Rule 5.1** — All CSS lives in `app/globals.css`. There are no CSS modules, no
`.css` files beside components, no styled-components, and no `<style>` blocks.
Add your rules to the section that already owns the region.

**Rule 5.2** — There is **no Tailwind**. It was removed once it turned out to
be serving two utility classes across the whole repository, one of which broke
this rule while duplicating an inline style beside it. Every component carries
semantic class names only. `tests/design-tokens.test.ts` fails on a
reintroduced `@import "tailwindcss"`, `@theme`, or `@apply`.

**Rule 5.3** — Inline `style` is reserved for values only JavaScript can know:
cursor position and colors (`CursorInstrument`) and the dragged assistant dock
position (`PortfolioChat`). Everything else is a class.

**Rule 5.4** — Class naming, in two families:

- `.portfolio-<region>[-<part>]` names a top-level composition region and its
  structural parts: `.portfolio-composition`, `.portfolio-world`,
  `.portfolio-world-mast`, `.portfolio-world-node`, `.portfolio-reader`,
  `.portfolio-reader-footer`, `.portfolio-chat`, `.portfolio-chat-panel`,
  `.portfolio-chat-head`, `.portfolio-chat-thread`, `.portfolio-chat-composer`,
  `.portfolio-chat-trigger`, `.portfolio-visual-stage`,
  `.portfolio-visual-stage-head`, `.portfolio-node-mark`,
  `.portfolio-mobile-view-toggle`.
- `.reader-<part>` names the dossier's interior, once you are inside
  `.portfolio-reader`: `.reader-topbar`, `.reader-content`,
  `.reader-index-row`, `.reader-record-section`, `.reader-kind`,
  `.reader-summary`, `.reader-visual-trigger`, and so on. Do not prefix these
  with `portfolio-`.

The cursor uses its own flat `.cursor-*` names. `.avatar-*` and `.scene-*` are
shared with the legacy surface.

**Rule 5.5** — Boolean state is a `data-` attribute on the element, selected as
`[data-state="true"]`: `data-open`, `data-visible`, `data-action`, `data-held`,
`data-has-thread`, `data-input-focused`, `data-visual-open`, `data-register`.
A modifier class is used only when a whole region changes mode, and it is
appended to that region's own class: `.portfolio-visual-open` and
`.portfolio-mobile-map-open` on the composition root,
`.portfolio-reader-clean-review` on the dossier, `.avatar-spotlight` on
whichever region the avatar is pointing at. Never a `.is-` or `.active` class.

**Rule 5.6** — Declarations inside a rule are alphabetical. Selectors are flat;
no CSS nesting is used. Related one-line rules may be written on a single line
where the file already does so.

**Rule 5.7** — The composition's breakpoint is **900px**
(`max-width: 900px`, with `min-width: 901px` for the desktop-only assistant
sizing), plus a 600px block for phone-scale safe-area insets and a
`max-height: 820px and (pointer: fine)` block for short desktop windows. The
980px breakpoint belongs to legacy pages. 760px is shared: it is a legacy
breakpoint that also carries a handful of composition header and chat rules,
predating the checkpoint — read it before touching the header at phone widths,
and do not add to it. Do not add a new breakpoint.

**Rule 5.8** — The house focus treatment is
`outline: 2px solid var(--ink); outline-offset: 2px`, and the composition now
supplies it by default: a zero-specificity
`:where(.portfolio-composition) a, button, input, textarea:focus-visible` rule.
Before that, any control without its own rule fell through to the unscoped
legacy rules and drew a 3px olive ring — including `.reader-index-row`, the
dossier's main navigation. Override it only to differ deliberately: floating
controls use a 3px offset, world nodes a 1px outline. Never remove focus
without replacing it.

**Rule 5.9** — Anything that animates gets a
`@media (prefers-reduced-motion: reduce)` entry reducing the duration to `1ms`,
matching the existing block at the end of the file.

## 6. Standing constraints from the checkpoint

These are product decisions, not preferences. See
`docs/portfolio-design-system-checkpoint.md` for the full grammar.

**Rule 6.1 — Selection introduces no new color.** A selected, hovered, active,
or focused mark keeps its native register color. Express state with opacity,
weight, scale, the rule treatment, or the focus outline. There is no "selected
blue."

**Rule 6.2 — One label treatment.** Labels use a single typographic voice
(Voice B, §3) and sit below their marks. No second label style, no per-register
label color, no badges other than the existing `.reader-kind[data-register]`.

**Rule 6.3 — One relationship treatment.** Relationships are a single
Silverpoint line: thin, straight, neutral, arrowless. CSS rules and borders use
`var(--map-line)`, or `var(--map-line-strong)` when a boundary must read as an
edge; the canvas connectors in `PortfolioWorld` use `var(--map-connector)`,
which is opaque because that code applies its own per-link alpha. Do not encode
link type as color, dash, thickness, or arrowhead — classifications stay
backstage.

**Rule 6.4 — Marks share one envelope.** Register marks are authored against
`PORTFOLIO_NODE_MARK_SIZE = 15` in `lib/portfolio-node-mark.ts`, which yields
an 18-unit viewBox rendered in an 18px box, with `stroke: currentColor` and
`stroke-width: 1.45`, colored only by `--world-<register>` via `data-register`.
Author new geometry against 15, not 18, or it draws 20% oversized. Bradley's
symbol
(`.portfolio-node-brain`) is a 15px mask of `/biv-brain-symbol.png` filled with
`currentColor` and has no containing shape. A new mark type joins that
envelope; it does not get its own size or weight.

**Rule 6.5 — One temporary floating surface.** Chat is it. Do not add a second
overlay, popover, or navigation layer; the dossier holds Index, Story, and
record states rather than spawning panels or routes.

**Rule 6.6 — The dossier width is fixed.** Desktop is
`clamp(460px, 38vw, 560px)`; the canvas resizes around it. Below 900px the
world is removed and the dossier is full width.

**Rule 6.7 — Cursor contract.** On `pointer: fine`, `cursor: none` is forced
globally and `.cursor-instrument` is the only pointer. Consequences for new UI:

- An actionable element must match
  `button, a, input, textarea, select, [role='button'], [role='link'],
  [data-world-node]` or the cursor will not invert over it. Prefer a real
  `<button>`; add `role` only if you cannot.
- A draggable world node carries `data-world-node` and
  `data-cursor-color="--world-<register>"`, naming the custom property the
  cursor reads.
- Do not set `cursor:` on a composition element — it is overridden by
  `!important` on fine pointers and the instrument is hidden on coarse ones.

**Rule 6.8 — Escape and empty space reset.** Blank-space click, the Index
control, and Escape return the world to overview. Blank-space drag does not pan
the field. Preserve this if you touch world interaction.

## 7. One idiomatic example

A new dossier row that carries its record's register — semantic class in the
`.reader-*` family, alias tokens only, register via `data-register` and
`--register`, Voice B label, focus outline. No hex, no utility class, no mode
block:

```tsx
<button className="reader-source-row" data-register={record.register} type="button">
  <span className="reader-source-label">{record.kind}</span>
  <span>{record.title}</span>
</button>
```

```css
.reader-source-row {
  appearance: none;
  background: transparent;
  border: 0;
  border-top: 1px solid var(--map-line);
  color: var(--ink);
  display: grid;
  font-size: var(--reader-copy-size);
  gap: 4px;
  padding: 10px 0 12px;
  text-align: left;
  width: 100%;
}

.reader-source-row[data-register="story"] { --register: var(--world-story); }
.reader-source-row[data-register="finding"] { --register: var(--world-finding); }

.reader-source-label {
  color: var(--register, var(--world-identity));
  font-size: var(--reader-label-size);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.reader-source-row:hover .reader-source-label {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.reader-source-row:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}
```

It reads correctly in dark mode without a single additional line, because every
color is a semantic alias. Hover changes the rule, not the color (Rule 6.1).

## 8. Before you open the PR

- [ ] No color literal outside the `:root` block in `app/globals.css`.
- [ ] Every new color is a semantic alias, not a `-light` / `-dark` leaf.
- [ ] No new `prefers-color-scheme` block (or, if unavoidable, all three parts
      of Rule 4.2 plus the `[data-theme]` blocks and the tokens doc row).
- [ ] Class names follow `.portfolio-<region>-<part>` or `.reader-<part>`.
- [ ] State is a `data-` attribute; no `.is-` classes; no Tailwind utilities.
- [ ] Declarations alphabetized; no new breakpoint.
- [ ] `:focus-visible` present; reduced-motion entry if it animates.
- [ ] Selection added no new color; one label voice; one line treatment.
- [ ] `docs/design-tokens.md` updated if you added a token.
- [ ] Checked at 1440×900 and 390×844, in light and dark.
