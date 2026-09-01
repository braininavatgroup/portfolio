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
| `--world-hard-red` | `#d7191c` | Hard red Finding register | `--world-signal-red` |
| `--world-signal-red` | `#ff554a` | Signal red Finding register | `--world-hard-red` |
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

The live shadow tokens are not mode-switched: `--reader-stage-shadow`
`rgb(32 23 17 / 18%)`, `--reader-media-shadow` `rgb(32 23 17 / 15%)`,
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
| `--world-finding` | `--world-hard-red` | `--world-signal-red` | Finding marks |
| `--world-warm` | `--world-electric-pink` | `--world-hot-pink` | Operations marks |
| `--world-bridge` | `--world-violet` | `--world-violet-dark` | Bridge marks |
| `--world-cool` | `--world-production-cyan` | `--world-production-cyan-dark` | In Production marks |

`--register` is a record-local alias that selects one `--world-*` register.
`--legend-color` is selector-local and points to `--prototype-legend-spec`,
`--prototype-legend-system`, or `--prototype-legend-artifact`.

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

These seven aliases remain referenced and therefore cannot be removed. All are
deprecated for new composition work.

| Token | Value | Current role | Pair |
| --- | --- | --- | --- |
| `--accent` | `#c8f347` | Prototype actions and light-theme controls | `--accent-ink` |
| `--accent-ink` | `#182300` | Ink on `--accent` | `--accent` |
| `--background` | `#f4f1e8` | Prototype page background | `--foreground` |
| `--foreground` | `#17211e` | Prototype primary ink | `--background` |
| `--line` | `#bdc8c1` | Prototype rules | None |
| `--muted` | `#52645e` | Prototype secondary ink | None |
| `--surface` | `#fffdf8` | Prototype panels | None |

The prototype font aliases remain active for pre-composition selectors:
`--font-prototype-sans` resolves to Geist plus Arial/Helvetica fallbacks,
`--font-prototype-sans-short` resolves to Geist plus generic sans-serif, and
`--font-prototype-mono` resolves to Geist Mono plus monospace.

### Prototype palette inventory

No light/dark pairing is implied unless both tokens appear in the same row.

| Token(s) | Value(s) | Live role |
| --- | --- | --- |
| `--prototype-black`; `--prototype-white` | `#000`; `#ffffff` | Mask and explicit white surface |
| `--prototype-highlight`; `--prototype-highlight-shadow` | `#d7ff6f`; `#d7ff6f70` | Prototype active/focus highlight and glow |
| `--prototype-night-ink` | `#07100f` | Dark prototype ink |
| `--prototype-night-shadow-subtle`; `--prototype-night-shadow-focus`; `--prototype-night-shadow-panel`; `--prototype-night-shadow-heavy` | `#07100f26`; `#07100f38`; `#07100f3d`; `#07100f6b` | Increasing prototype shadow opacities |
| `--prototype-night-toolbar`; `--prototype-night-focus` | `#07100fd9`; `#07100fe8` | Dark toolbar and focused-node surfaces |
| `--prototype-stage-map`; `--prototype-stage-map-rule` | `#07110e`; `#38584d` | Avatar stage-map surface and rule |
| `--prototype-chat-surface`; `--prototype-chat-rule` | `#091310b8`; `#29443d` | Prototype chat panel and internal rules |
| `--prototype-body-gradient-start`; `--prototype-body-gradient-end`; `--prototype-body-rule` | `#1c302c`; `#0b1614`; `#38564f` | Body placeholder gradient and rule |
| `--prototype-scene-surface` | `#0c1715` | Scene fallback surface |
| `--prototype-control-surface`; `--prototype-focus-rule` | `#0d1b18cc`; `#45685f` | Dark control surface and border |
| `--prototype-drawer-surface`; `--prototype-drawer-rule`; `--prototype-drawer-copy`; `--prototype-drawer-control-rule` | `#0d1b18eb`; `#3c5f56`; `#b0bfba`; `#6f8e85` | Node drawer surface, rule, copy, and control rule |
| `--prototype-glass-highlight`; `--prototype-glass-middle`; `--prototype-glass-edge`; `--prototype-glass-rule` | `#d9fff340`; `#3d76651f`; `#0f292455`; `#b4e3d663` | Glass-head gradient and outline |
| `--prototype-glass-glow`; `--prototype-glass-inner-glow` | `#6dffd72b`; `#a8dfd122` | Glass-head outer and inner glow |
| `--prototype-input-surface`; `--prototype-input-ink` | `#101f1b`; `#f0f5f2` | Prototype chat input surface and ink |
| `--prototype-input-placeholder-light` | `#65756f` | Light input placeholder |
| `--prototype-token-ink` | `#11160a` | Ink on toybox token |
| `--prototype-director-control`; `--prototype-director-control-rule`; `--prototype-director-control-ink` | `#11231e`; `#3e6258`; `#e7f2eb` | Avatar director control surface, rule, and ink |
| `--prototype-director-control-active`; `--prototype-director-active-rule`; `--prototype-director-active-ink` | `#294b3f`; `#b3e36e`; `#f4ffd8` | Avatar director active control |
| `--prototype-director-heading`; `--prototype-director-status`; `--prototype-disabled-ink` | `#c8dbd1`; `#d9e8df`; `#809088` | Avatar director heading, status, and disabled copy |
| `--prototype-output-ink` | `#15241f` | Output-node ink |
| `--prototype-grid-dark`; `--prototype-grid-light` | `#15302a66`; `#8fa09835` | Prototype room grids |
| `--prototype-evidence-available`; `--prototype-evidence-available-light` | `#a9edc2`; `#257447` | Evidence available, dark/light treatment |
| `--prototype-evidence-partial`; `--prototype-evidence-partial-light` | `#f0ce87`; `#855d00` | Evidence partial, dark/light treatment |
| `--prototype-evidence-needed`; `--prototype-evidence-needed-light` | `#ef9d91`; `#a24437` | Evidence needed, dark/light treatment |
| `--prototype-label-ink-light`; `--prototype-label-ink-light-muted` | `#263a33`; `#536d12` | Light label and green-muted label ink |
| `--prototype-root-ink`; `--prototype-root-shadow` | `#263c35`; `#34463e24` | Root-node ink and shadow |
| `--prototype-approach-ink`; `--prototype-approach-rule` | `#274d44`; `#9eaea6` | Approach-node ink and rule |
| `--prototype-rule-dark` | `#28433c` | Repeated dark editorial rule |
| `--prototype-error-surface`; `--prototype-error-rule`; `--prototype-error-ink` | `#2e1014`; `#ff9a9a`; `#fff0f0` | Avatar renderer failure treatment |
| `--prototype-control-ink-light`; `--prototype-control-rule-light` | `#30413b`; `#9fafa7` | Light controls |
| `--prototype-panel-shadow-light`; `--prototype-focus-shadow-light` | `#33483f14`; `#33483f18` | Light panel and focus shadows |
| `--prototype-node-shadow`; `--prototype-dossier-shadow` | `#34463e18`; `#34463e1f` | Node and dossier shadows |
| `--prototype-node-rule` | `#aab8b1` | Shared output/root node rule |
| `--prototype-toolbar-rule` | `#34534b` | Graph toolbar rule |
| `--prototype-instinct-ink`; `--prototype-instinct-rule` | `#41675e`; `#afbbb5` | Instinct-node ink and rule |
| `--prototype-tool-rule`; `--prototype-tool-ink` | `#496a61`; `#8db5a9` | Local tool/input rule and ink |
| `--prototype-domain-ink`; `--prototype-domain-rule`; `--prototype-domain-surface` | `#526816`; `#aeb985`; `#f1f3dee8` | Domain-node ink, rule, and surface |
| `--prototype-link-hover`; `--prototype-dossier-link` | `#526b00`; `#526d12` | Prototype hover/link greens |
| `--prototype-dossier-eyebrow`; `--prototype-dossier-rule` | `#59736a`; `#cbd3ce` | Dossier eyebrow and rule |
| `--prototype-brain-highlight`; `--prototype-brain-gradient-middle`; `--prototype-brain-gradient-edge` | `#eeffbd`; `#b3d86a`; `#607839` | Brain placeholder gradient |
| `--prototype-focus-outline-light`; `--prototype-focus-outline` | `#688500`; `#76951a` | Light and dark focus outlines |
| `--prototype-loading-ink` | `#89a49b` | Scene loading ink |
| `--prototype-label-ink`; `--prototype-muted-ink`; `--prototype-secondary-ink` | `#8ab5a9`; `#91a49d`; `#8da69e` | Prototype labels and secondary copy |
| `--prototype-focus-rule-light` | `#8da098` | Light focused-node rule |
| `--prototype-toybox-accent`; `--prototype-toybox-focus` | `#99bd4c`; `#b8df62` | Toybox accent and focus outline |
| `--prototype-copy-ink`; `--prototype-lede-ink`; `--prototype-legend-ink` | `#a7b7b1`; `#b7c4bf`; `#a9bbb5` | Prototype copy, lede, and legend ink |
| `--prototype-legend-spec`; `--prototype-legend-system`; `--prototype-legend-artifact` | `#8ec5b7`; `#70a595`; `#f1ead7` | Selector-local legend swatches; no checkpoint pair |
| `--prototype-seed`; `--prototype-seed-glow` | `#b4d4ca`; `#a8dfd155` | Graph seed and glow |
| `--prototype-domain-control-ink` | `#c8d5d0` | Domain-control ink and fallback |
| `--prototype-stage-map-target`; `--prototype-stage-map-target-rule` | `#d38f5d70`; `#e4a06d` | Avatar stage-map target |
| `--prototype-node-label`; `--prototype-focus-ink` | `#d5e0dc`; `#eef7f2` | Default and focused node ink |
| `--prototype-section-rule` | `#e2e6e3` | Light dossier section rule |
| `--prototype-surface-soft`; `--prototype-surface-node`; `--prototype-surface-panel`; `--prototype-surface-root`; `--prototype-surface-focus` | `#fffdf8dc`; `#fffdf8e8`; `#fffdf8ed`; `#fffdf8ee`; `#fffdf8f5` | Five preserved prototype surface opacities |
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

These are inventory findings, not corrections.

1. The file header still defines and uses the prototype palette
   (`--accent`, `--background`, `--foreground`, `--line`, `--muted`, and
   `--surface`). Its lime accent, cream paper, green-black ink, and green-gray
   neutrals do not match the checkpoint's pink operations color, Silver world,
   reader paper, and brown-black ink.
2. Geist and Geist Mono remain active across pre-composition pages, debug
   controls, the toybox, and legacy panels. The checkpoint says Neue Haas
   Grotesk is the shared typographic voice. The accepted `.portfolio-composition`
   does use NHG.
3. The prototype highlight `#d7ff6f`, header accent `#c8f347`, toybox accent
   `#99bd4c`, toybox focus `#b8df62`, and checkpoint Acid `#b6df5b` are five
   separate live yellow-green values. They remain separate.
4. Prototype green link/label values `#526d12`, `#536d12`, `#526b00`, focus
   values `#688500` / `#76951a`, and domain ink `#526816` sit near checkpoint
   Lichen `#466700` but are not equal. They remain separate.
5. The legacy dark UI uses a teal/green palette, including `#07100f`,
   `#0d1b18`, `#28433c`, and their nearby values. The checkpoint's dark world
   and reader are brown-black `#19140f` and `#292625` with warm ink `#f0e6dc`.
6. The accepted composition contains supporting neutrals absent from the
   checkpoint: `--map-paper-near-*`, `--map-muted-*`, `--reader-summary-*`,
   `--reader-body-*`, `--reader-muted-*`, and the line/grid opacities. They are
   documented as live extensions, not inferred checkpoint decisions.
7. The five `#fffdf8` alpha surfaces and the several green-black shadow
   opacities differ by small alpha increments. The live values remain exact;
   this pass does not merge them.
8. Canvas/WebGL rendering still owns the code-side colors listed above. The
   checkpoint names world-register colors, but does not specify these canvas
   label, cursor fallback, or avatar material colors.

The primary accepted composition colors, desktop reader width, 40px assistant
trigger, and 18rem assistant panel agree with the checkpoint.
