# Design tokens

Status: live inventory for PER-17, 31 August 2026.

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
| `--reader-ink-light` | `#201711` | Brown-black light ink and identity | `--reader-ink-dark` |
| `--reader-ink-dark` | `#f0e6dc` | Dark-mode ink and identity | `--reader-ink-light` |
| `--world-lichen` | `#466700` | Lichen Story register | `--world-acid` |
| `--world-acid` | `#b6df5b` | Acid Story register | `--world-lichen` |
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
| `--reader-summary-light: #413a35` | `--reader-summary-dark: #ded4cb` | Reader summary copy |
| `--reader-body-light: #514a45` | `--reader-body-dark: #c1b7ae` | Reader body copy |
| `--reader-muted-light: #6b6d6d` | `--reader-muted-dark: #aaa098` | Reader labels and metadata |

The live shadow tokens are not mode-switched:
`--reader-media-shadow` `rgb(32 23 17 / 15%)`,
`--reader-gallery-shadow` `rgb(32 23 17 / 10%)`,
`--reader-assistant-shadow` `rgb(32 23 17 / 20%)`, and
`--reader-floating-control-shadow` `rgb(23 23 23 / 14%)`.

### Semantic aliases

| Token | Light value | Dark value | Role |
| --- | --- | --- | --- |
| `--ink` | `--reader-ink-light` | `--reader-ink-dark` | Composition ink |
| `--map-paper` | `--map-silver` | `--map-paper-dark` | World background |
| `--map-paper-near` | `--map-paper-near-light` | `--map-paper-near-dark` | Near-paper surfaces |
| `--map-muted` | `--map-muted-light` | `--map-muted-dark` | Map secondary ink |
| `--map-connector` | `--map-connector-light` | `--map-connector-dark` | Canvas relationship lines, read by `PortfolioWorld` through `getComputedStyle` |
| `--map-line` | `--map-line-light` | `--map-line-dark` | Neutral relationship/rule treatment |
| `--map-line-strong` | `--map-line-strong-light` | `--map-line-strong-dark` | Strong rule treatment |
| `--map-grid` | `--map-grid-light` | `--map-grid-dark` | Placeholder grid |
| `--reader-paper` | `--reader-paper-light` | `--reader-paper-dark` | Dossier surface |
| `--reader-summary` | `--reader-summary-light` | `--reader-summary-dark` | Summary copy |
| `--reader-body` | `--reader-body-light` | `--reader-body-dark` | Body copy |
| `--reader-muted` | `--reader-muted-light` | `--reader-muted-dark` | Labels and metadata |
| `--world-identity` | `--reader-ink-light` | `--reader-ink-dark` | Bradley identity mark |
| `--world-story` | `--world-lichen` | `--world-acid` | Story marks |
| `--world-arc` | `--world-hard-red` | `--world-signal-red` | From argument to instrument marks |
| `--world-warm` | `--world-electric-pink` | `--world-hot-pink` | Operations marks |
| `--world-bridge` | `--world-violet` | `--world-violet-dark` | Bridge marks |
| `--world-cool` | `--world-production-cyan` | `--world-production-cyan-dark` | In Production marks |

`--register` is a record-local alias that selects one `--world-*` register.

### Type and recurring dimensions

| Token | Value | Role | Pair |
| --- | --- | --- | --- |
| `--font-reader` | `"NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif` | Accepted world and reader type stack | None |
| `--portfolio-display-title-size` | `clamp(25px, 2.5vw, 37px)` | World mast and reader Index title | None |
| `--reader-width` | `clamp(460px, 38vw, 560px)`; `100%` at 900px and below | Fixed desktop dossier width | Desktop/mobile |
| `--reader-gutter` | `24px` | Repeated reader and visual-stage gutter | None |
| `--reader-label-size` | `10px` | Repeated label/meta size | None |
| `--reader-copy-size` | `12px` | Repeated reader copy size | None |
| `--reader-row-size` | `15px` | Reader summary/index row size | None |
| `--reader-section-title-size` | `18px` | Reader section heading size | None |
| `--assistant-panel-width` | `18rem` | Accepted 288px assistant panel width | None |
| `--floating-control-size` | `40px` | Assistant trigger and mobile view control | None |
| `--world-hit-area` | `34px` | World node button hit area | None |
| `--cursor-size` | `34px` | Segmented cursor envelope | None |
| `--mobile-controls-inline-end` | `max(14px, env(safe-area-inset-right))` | Mobile floating-control inset | None |

## Legacy prototype tokens

These five aliases still have readers and therefore cannot be removed. All are
deprecated for new composition work. `--accent` and `--accent-ink` used to sit
here; their only readers were light-theme chat rules that could never match,
so both are gone and the lime green with them.

| Token | Value | Current role | Pair |
| --- | --- | --- | --- |
| `--background` | `#f4f1e8` | Prototype page background | `--foreground` |
| `--foreground` | `#17211e` | Prototype primary ink | `--background` |
| `--line` | `#bdc8c1` | Prototype rules | None |
| `--muted` | `#52645e` | Prototype secondary ink | None |
| `--surface` | `#fffdf8` | Prototype panels | None |

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
| `--prototype-night-shadow-panel`; `--prototype-night-shadow-heavy` | `#07100f3d`; `#07100f6b` | Increasing prototype shadow opacities |
| `--prototype-night-ink` | `#07100f` | Dark prototype ink |
| `--prototype-stage-map`; `--prototype-stage-map-rule` | `#07110e`; `#38584d` | Avatar stage-map surface and rule |
| `--prototype-chat-surface`; `--prototype-chat-rule` | `#091310b8`; `#29443d` | Prototype chat panel and internal rules |
| `--prototype-input-surface`; `--prototype-input-ink` | `#101f1b`; `#f0f5f2` | Prototype chat input surface and ink |
| `--prototype-token-ink` | `#11160a` | Ink on toybox token |
| `--prototype-director-control`; `--prototype-director-control-rule`; `--prototype-director-control-ink` | `#11231e`; `#3e6258`; `#e7f2eb` | Avatar director control surface, rule, and ink |
| `--prototype-director-control-active`; `--prototype-director-active-rule`; `--prototype-director-active-ink` | `#294b3f`; `#b3e36e`; `#f4ffd8` | Avatar director active control |
| `--prototype-director-heading`; `--prototype-director-status`; `--prototype-disabled-ink` | `#c8dbd1`; `#d9e8df`; `#809088` | Avatar director heading, status, and disabled copy |
| `--prototype-label-ink-light`; `--prototype-label-ink-light-muted` | `#263a33`; `#536d12` | Light label and green-muted label ink |
| `--prototype-rule-dark` | `#28433c` | Repeated dark editorial rule |
| `--prototype-error-surface`; `--prototype-error-rule`; `--prototype-error-ink` | `#2e1014`; `#ff9a9a`; `#fff0f0` | Avatar renderer failure treatment |
| `--prototype-tool-rule` | `#496a61` | Local tool/input rule and ink |
| `--prototype-link-hover` | `#526b00` | Prototype hover/link greens |
| `--prototype-focus-outline-light`; `--prototype-focus-outline` | `#688500`; `#76951a` | Light and dark focus outlines |
| `--prototype-label-ink`; `--prototype-muted-ink` | `#8ab5a9`; `#91a49d` | Prototype labels and secondary copy |
| `--prototype-toybox-accent`; `--prototype-toybox-focus` | `#99bd4c`; `#b8df62` | Toybox accent and focus outline |
| `--prototype-copy-ink`; `--prototype-lede-ink` | `#a7b7b1`; `#b7c4bf` | Prototype copy, lede, and legend ink |
| `--prototype-stage-map-target`; `--prototype-stage-map-target-rule` | `#d38f5d70`; `#e4a06d` | Avatar stage-map target |
| `--prototype-toybox-scrim-light`; `--prototype-toybox-scrim-dark` | `rgb(197 203 208 / 10%)`; `rgb(25 20 15 / 12%)` | Toybox scrims by color scheme |
| `--prototype-toybox-shadow`; `--prototype-toybox-drag-shadow`; `--prototype-toybox-ground-shadow` | `rgba(20, 28, 14, 0.12)`; `rgba(20, 28, 14, 0.2)`; `rgba(20, 28, 14, 0.48)` | Toybox collectible, drag, and ground shadows |

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
- `components/avatar/ProceduralAvatar.tsx` owns material colors `#18352f`,
  `#e7b28d`, `#14211f`, `#1b3a33`, `#102a25`, and translucent `#11251f`.
- `components/avatar/AvatarAssetAdapter.tsx` owns the solid material color
  `#3a4954`.

## Discrepancies

Inventory findings, not corrections. Four of the eight recorded here have since
been closed; what remains is listed with why it stays.

**Closed.** The lime accent is gone — `--accent` and `--accent-ink` had no
readers left once the light-theme chat rules that referenced them turned out to
be unreachable, so the palette no longer carries a colour the checkpoint does
not name. Geist is gone entirely, including Geist Mono, so Neue Haas Grotesk is
now the shared voice in fact and not only in the checkpoint. That also removes
two of the five yellow-greens and two of the near-Lichen greens below.

**Open, deliberately.**

1. The file header still defines and uses the surviving prototype palette
   (`--background`, `--foreground`, `--line`, `--muted`, `--surface`). Its cream
   paper, green-black ink and green-gray neutrals do not match the checkpoint's
   Silver world, reader paper and brown-black ink. They still have readers on
   the legacy pages, so they stay until those pages migrate.
2. The prototype highlight `#d7ff6f`, toybox accent `#99bd4c`, toybox focus
   `#b8df62`, and checkpoint Acid `#b6df5b` are four separate live yellow-green
   values. They remain separate.
3. Prototype green link/label values `#536d12`, `#526b00` and focus values
   `#688500` / `#76951a` sit near checkpoint Lichen `#466700` but are not equal.
   They remain separate.
4. The legacy dark UI uses a teal/green palette, including `#07100f`, `#28433c`
   and their nearby values. The checkpoint's dark world and reader are
   brown-black `#19140f` and `#292625` with warm ink `#f0e6dc`.
5. The accepted composition contains supporting neutrals absent from the
   checkpoint: `--map-paper-near-*`, `--map-muted-*`, `--reader-summary-*`,
   `--reader-body-*`, `--reader-muted-*`, and the line/grid opacities. They are
   documented as live extensions, not inferred checkpoint decisions.
6. The `#fffdf8` alpha surfaces and the green-black shadow opacities differ by
   small alpha increments. The live values remain exact; they are not merged.
7. Canvas/WebGL rendering still owns the code-side colors listed above. The
   checkpoint names world-register colors, but does not specify these canvas
   label, cursor fallback, or avatar material colors.

The primary accepted composition colors, desktop reader width, 40px assistant
trigger, and 18rem assistant panel agree with the checkpoint.
