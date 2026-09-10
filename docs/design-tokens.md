# Design tokens

Status: live inventory for the Reading Room, 2 September 2026.

This document maps the values that already exist in `app/globals.css`. It does
not approve palette changes. `docs/portfolio-design-system-checkpoint.md`
remains the source for the accepted visual direction.

## Usage

The accepted composition uses the mode-aware `--world-*`, `--reader-*`, and
`--map-*` properties. Light values are the default. The dark values apply under
`prefers-color-scheme: dark`, and under `[data-theme]` on or above a
`.portfolio-composition` — which is how `/design` shows both modes at once.

The `--prototype-*` properties are an inventory of still-live CSS that predates
the checkpoint. Their names describe current use only. Do not use them for new
portfolio-composition work.

## Accepted composition

### Checkpoint colors

| Token | Value | Role | Pair |
| --- | --- | --- | --- |
| `--map-silver` | `#c5cbd0` | Silver, light world paper | `--map-paper-dark` |
| `--map-paper-dark` | `#19140f` | Dark world paper | `--map-silver` |
| `--reader-paper-light` | `#eff1f1` | Light reader paper | `--reader-paper-dark` |
| `--reader-paper-dark` | `#292625` | Dark reader paper | `--reader-paper-light` |
| `--reader-report-paper` | `#ffffff` | Opaque backing for the native campaign report, including its scrollbar gutter; matches the external document in both modes | Fixed |
| `--reader-ink-light` | `#201711` | Brown-black light ink and identity | `--reader-ink-dark` |
| `--reader-ink-dark` | `#f0e6dc` | Dark-mode ink and identity | `--reader-ink-light` |
| `--world-lichen` | `#466700` | Retained legacy Lichen leaf; not used by the Reading Room | `--world-acid` |
| `--world-acid` | `#b6df5b` | Reading Room focus ring | `--world-lichen` |
| `--world-hard-red` | `#d7191c` | Hard red Arc register | `--world-signal-red` |
| `--world-signal-red` | `#ff554a` | Signal red Arc register | `--world-hard-red` |
| `--world-electric-pink` | `#d0007e` | Electric pink Operations register | `--world-hot-pink` |
| `--world-hot-pink` | `#ff84d0` | Hot pink Operations register | `--world-electric-pink` |
| `--world-violet` | `#4d1fc5` | Light bridge violet | `--world-violet-dark` |
| `--world-violet-dark` | `#aaa0ff` | Dark bridge violet | `--world-violet` |
| `--world-production-cyan` | `#006e91` | Light In Production cyan | `--world-production-cyan-dark` |
| `--world-production-cyan-dark` | `#62c6df` | Dark In Production cyan | `--world-production-cyan` |

### Supporting mode pairs

These values are live additions to the checkpoint palette. They were not
collapsed into nearby colors.

| Light token and value | Dark token and value | Role |
| --- | --- | --- |
| `--map-paper-near-light: #d2d7db` | `--map-paper-near-dark: #211c18` | Near-paper world surfaces |
| `--map-muted-light: #62676b` | `--map-muted-dark: #a69c92` | Map labels and secondary controls |
| `--map-connector-light: #4f585d` | `--map-connector-dark: #a5afb5` | Canvas relationship lines. Opaque, because `PortfolioWorld` applies its own per-link alpha; the translucent `--map-line` would compound with it |
| `--map-line-light: rgb(32 23 17 / 18%)` | `--map-line-dark: rgb(240 230 220 / 17%)` | Silverpoint rules |
| `--map-line-strong-light: rgb(32 23 17 / 38%)` | `--map-line-strong-dark: rgb(240 230 220 / 34%)` | Strong rules and control outlines |
| `--map-grid-light: rgb(32 23 17 / 3.5%)` | `--map-grid-dark: rgb(240 230 220 / 3.5%)` | Placeholder grids |
| `--reader-body-light: #514a45` | `--reader-body-dark: #c1b7ae` | Reader body copy |
| `--reader-drop-fill-light: rgb(32 23 17 / 8%)` | `--reader-drop-fill-dark: rgb(240 230 220 / 10%)` | Drag targets and control hover fills |
| `--reader-muted-light: #6b6d6d` | `--reader-muted-dark: #aaa098` | Reader labels and metadata |

The live shadow tokens are not mode-switched:
`--reader-media-shadow` `rgb(32 23 17 / 15%)`,
`--reader-gallery-shadow` `rgb(32 23 17 / 10%)`, and
`--reader-assistant-shadow` `rgb(32 23 17 / 20%)`.

### Semantic aliases

| Token | Light value | Dark value | Role |
| --- | --- | --- | --- |
| `--ink` | `--reader-ink-light` | `--reader-ink-dark` | Composition ink |
| `--focus-ring` | `--world-acid` | `--world-acid` | 2px Reading Room focus ring |
| `--map-paper` | `--map-silver` | `--map-paper-dark` | World background |
| `--map-paper-near` | `--map-paper-near-light` | `--map-paper-near-dark` | Near-paper surfaces |
| `--map-muted` | `--map-muted-light` | `--map-muted-dark` | Map secondary ink |
| `--map-connector` | `--map-connector-light` | `--map-connector-dark` | Canvas relationship lines, read by `PortfolioWorld` through `getComputedStyle` |
| `--map-line` | `--map-line-light` | `--map-line-dark` | Neutral relationship/rule treatment |
| `--map-line-strong` | `--map-line-strong-light` | `--map-line-strong-dark` | Strong rule treatment |
| `--map-grid` | `--map-grid-light` | `--map-grid-dark` | Placeholder grid |
| `--reader-paper` | `--reader-paper-light` | `--reader-paper-dark` | Dossier surface |
| `--reader-body` | `--reader-body-light` | `--reader-body-dark` | Body copy |
| `--reader-drop-fill` | `--reader-drop-fill-light` | `--reader-drop-fill-dark` | Drag-target and chrome-hover fill |
| `--reader-muted` | `--reader-muted-light` | `--reader-muted-dark` | Labels and metadata |
| `--world-identity` | `--reader-ink-light` | `--reader-ink-dark` | Bradley identity mark |
| `--world-story` | `--world-hard-red` | `--world-signal-red` | Story marks; Story remains a distinct register type but shares Arc's red pair |
| `--world-arc` | `--world-hard-red` | `--world-signal-red` | From argument to instrument marks |
| `--world-warm` | `--world-electric-pink` | `--world-hot-pink` | Operations marks |
| `--world-bridge` | `--world-violet` | `--world-violet-dark` | Bridge marks |
| `--world-cool` | `--world-production-cyan` | `--world-production-cyan-dark` | In Production marks |
| `--world-chem` | `--world-lichen` | `--world-acid` | Chemical register — the Brain Food status line |

`--register` is a link-local alias that selects one `--world-*` register; `.reader-inline-link[data-register]` and the node marks set it.

### Spacing

The dossier's 8-pt scale. Every gap and line-height on the dossier is a
multiple of 8; these are the multiples it uses.

| Token | Value | Use |
| --- | --- | --- |
| `--control-shape` | `none` | Set inline by patterned controls (Map, Guide): the outline mask that `.portfolio-control-pattern` intersects with the 170% brain |
| `--reader-space-1` | `8px` | Label to content; row padding; figure margin |
| `--reader-space-2` | `16px` | Paragraph gap; title to summary; mobile bottom inset |
| `--reader-space-3` | `24px` | The page inset (mast, dossier top and bottom, chat and stage corners); mobile gutter |
| `--reader-space-4` | `32px` | Desktop gutter; summary to body; index group gap; content to Privacy line |
| `--reader-space-6` | `48px` | Reserved; unused in the approved states |
| `--reader-space-8` | `64px` | Above every section label |

### Type

One type scale, held as `font` shorthands (`weight size/line-height`) and
written as `font: var(--reader-type-*) var(--font-reader)`. Tracking, case,
and colour belong to the rule that reads the voice. The 10px tab voice is the
only voice below 11px and appears only in mobile navigation. Nothing is
`clamp()`ed.

| Token | Value | Tracking · colour | Use |
| --- | --- | --- | --- |
| `--reader-type-display` | `500 36px/40px` | −0.055em · `--ink` | Map mast and every dossier `h1`: home, Index, thread, record. `text-wrap: balance` |
| `--reader-type-summary` | `400 18px/24px` | −0.01em · `--ink` | Record summary, thread lede |
| `--reader-type-row` | `400 15px/24px` | 0 · `--ink` | Contents, related, explore, and contact rows |
| `--reader-type-body` | `400 15px/24px` | 0 · `--reader-body` | Paragraphs. `text-wrap: pretty` |
| `--reader-type-mast` | `500 15px/20px` | 0 · `--ink` | Contents mast and group titles |
| `--reader-type-secondary` | `400 13px/18px` | 0 · `--reader-muted` | Guide secondary status copy |
| `--reader-type-caption` | `400 12px/16px` | 0 · `--reader-muted` | Figure captions, placeholder meta, footer controls, control labels (`--ink`), stage count |
| `--reader-type-label` | `500 11px/16px` | +0.06em · uppercase · `--reader-muted` | Section labels, placeholder labels, stage eyebrow |
| `--reader-type-tab` | `400 10px/12px` | +0.02em · navigation ink | Mobile tab labels only |

### Recurring dimensions

| Token | Value | Role | Pair |
| --- | --- | --- | --- |
| `--font-reader` | `"NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif` | Accepted world and reader type stack | None |
| `--world-hit-area` | `34px` | World node button hit area | None |
| `--world-hud-top` | `calc(var(--reader-space-3) + 48px)` | Top inset for world overlay text; drops to `--reader-space-3` wherever the world's own mast is hidden | None |
| `--cursor-size` | `34px` | Segmented cursor envelope | None |
| `--mobile-controls-inline-end` | `max(14px, env(safe-area-inset-right))` | Mobile chat inset | None |
| `--mac-menu-bar-gap-left` | `16px` | Spacing between live menu bar glyphs left of the centre icon; set inline by `MacMenuBar` from the measured column | None |
| `--mac-menu-bar-gap-right` | `16px` | The same for the right side, chosen independently so both halves fill the column | None |
| `--mac-menu-bar-glyph-invert` | `0` | Amount the dark template glyphs in a live menu bar are inverted; `1` in dark mode | Light `0` / Dark `1` |

Geometry that is not spacing stays literal: the 18px mark box and 15-unit
envelope, the 40px control hit box, the 12px figure-frame padding, the 6px
glyph-to-label gap, and the stage's 920px / 560px maxima.

## Legacy prototype tokens

Two page-level aliases remain for routes outside the accepted composition.
They are deprecated for new composition work.

## Quarterly dashboard demo

The `/demos/quarterly-dashboard` work sample preserves its original fixed
client-facing palette. These tokens do not participate in portfolio light or
dark mode and must not be reused by the accepted composition.

| Token | Value | Role |
| --- | --- | --- |
| `--dashboard-teal` | `#6fb1b8` | Dashboard canvas and pitch series |
| `--dashboard-teal-deep` | `#4a8c92` | Page ground, values, and active data points |
| `--dashboard-sage` | `#7a9b5e` | Signed and positive states |
| `--dashboard-terracotta` | `#b8553a` | Lost states and competitor bars |
| `--dashboard-mustard` | `#c9a435` | Signed-exclusive trend series |
| `--dashboard-peach` | `#e59a6e` | Conversion trend and open states |
| `--dashboard-cream` | `#f5ebd5` | Dashboard panels |
| `--dashboard-cream-soft` | `#fbf6e8` | Table heading surface |
| `--dashboard-charcoal` | `#2c2a26` | Primary dashboard ink |
| `--dashboard-charcoal-muted` | `#6b6661` | Secondary dashboard ink |
| `--bar-width` | `0%` | Selector-local competitor bar width, replaced inline from the filtered count |

| Token | Value | Current role | Pair |
| --- | --- | --- | --- |
| `--background` | `#f4f1e8` | Prototype page background | `--foreground` |
| `--foreground` | `#17211e` | Prototype primary ink | `--background` |

There is one typeface. `--font-reader` is Neue Haas Grotesk and everything
uses it. The two Geist aliases were deleted with Geist itself, and
`--font-prototype-mono` is now system monospace held to a single job: content
that is literally code — the gallery's source paths and token names. It is not
a label style.

### Prototype palette inventory

No light/dark pairing is implied unless both tokens appear in the same row.

| Token(s) | Value(s) | Live role |
| --- | --- | --- |
| `--prototype-highlight` | `#d7ff6f` | Prototype active/focus highlight and glow |
| `--prototype-white` | `#ffffff` | Explicit white surface |
| `--prototype-night-shadow-panel` | `#07100f3d` | Prototype panel shadow |
| `--prototype-night-ink` | `#07100f` | Dark prototype ink |
| `--prototype-chat-surface`; `--prototype-chat-rule` | `#091310b8`; `#29443d` | Prototype chat panel and internal rules |
| `--prototype-input-surface`; `--prototype-input-ink` | `#101f1b`; `#f0f5f2` | Prototype chat input surface and ink |
| `--prototype-rule-dark` | `#28433c` | Repeated dark editorial rule |
| `--prototype-tool-rule` | `#496a61` | Local tool/input rule and ink |
| `--prototype-focus-outline-light` | `#688500` | Prototype focus outline |
| `--prototype-label-ink`; `--prototype-muted-ink` | `#8ab5a9`; `#91a49d` | Prototype labels and secondary copy |

## Colors outside `globals.css`

The WP1 scan also found production color literals in rendering code. They are
not CSS declarations, so this pass records but does not rewrite them:

- `components/PortfolioWorld.tsx` uses `#201711` and `#4f585d` as CSS-token
  read fallbacks only. The `#4F585D` / `#A5AFB5` pair this section previously
  recorded was not label contrast — it was the relationship-line color, chosen
  from `matchMedia` and so invisible to `[data-theme]`. It is now the
  `--map-connector` token and is read through `getComputedStyle`.
- `components/CursorInstrument.tsx` uses `#201711`, `#dfe8ee`, and `#ffffff`
  as color parsing/runtime fallbacks. Its normal colors still come from the
  active `--world-*` and `--ink` values.
- `components/avatar/AvatarAssetAdapter.tsx` owns the solid material color
  `#3a4954`.

## Discrepancies

Inventory findings, not corrections.

**Open, deliberately.**

1. The file header still defines and uses `--background` and `--foreground`.
   Their cream paper and green-black ink do not match the checkpoint's Silver
   world, reader paper and brown-black ink.
2. The prototype highlight `#d7ff6f`, checkpoint Acid `#b6df5b`, and Lichen
   `#466700` remain separate live values.
3. The legacy dark UI uses a teal/green palette, including `#07100f`, `#28433c`
   and their nearby values. The checkpoint's dark world and reader are
   brown-black `#19140f` and `#292625` with warm ink `#f0e6dc`.
4. The accepted composition contains supporting neutrals absent from the
   checkpoint: `--map-paper-near-*`, `--map-muted-*`, `--reader-body-*`,
   `--reader-drop-fill-*`, `--reader-muted-*`, and the line/grid opacities. They are
   documented as live extensions, not inferred checkpoint decisions.
5. The explicit white alpha surfaces and green-black shadow opacities differ by
   small alpha increments. The live values remain exact; they are not merged.
7. Canvas/WebGL rendering still owns the code-side colors listed above. The
   checkpoint names world-register colors, but does not specify these canvas
   label, cursor fallback, or avatar material colors.

The primary accepted composition colors agree with the checkpoint. Reading
Room panel dimensions now live in persisted panel state rather than root
tokens. Chrome uses bare node-envelope glyphs with explicit hit boxes.
