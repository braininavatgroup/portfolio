# Design infrastructure plan

Status: agreed direction, 31 August 2026. Authored with Claude from a planning
session; execution is intended to happen in separate Conductor sessions, one
work package at a time.

## Why

The look of this site currently exists in two half-connected forms: an accepted
design direction (`docs/portfolio-design-system-checkpoint.md`, 26 Aug 2026)
and a 3,850-line `app/globals.css` that is mid-migration toward it — the NHG
typeface, the `--world-*` / `--reader-*` / `--map-*` variable families, and the
checkpoint palette are live, but the original prototype tokens (`--accent:
#c8f347`, `--background: #f4f1e8`, Geist font references) still sit at the top
of the file, and roughly 146 distinct raw hex values are scattered through it
un-named. Every AI agent session (Claude or OpenAI, in Conductor or elsewhere)
has to reverse-engineer this state before it can style anything, and each does
it slightly differently.

This plan builds four durable, tool-agnostic assets that turn the implied
design language into a declared one. They live in this repo; external tools
(Claude Design, Paper, any future design tool) are treated strictly as readers
or build targets, never as the home of any of this.

**Scope rule for every work package: map faithfully, do not redesign.** The
goal of v1 is a complete, honest map of what exists. Improvements, palette
rethinks, and redundancy cleanup are follow-up work, done deliberately (likely
in Claude Design) once the whole system is visible in one place. Where the live
CSS and the checkpoint disagree, record the discrepancy — do not resolve it.

Decisions already made (do not re-ask):

- Token pass is a faithful inventory + completion of the naming layer. No
  visual changes; rendered output must be pixel-identical afterward.
- The gallery route is public. The site is password-protected overall, and the
  gallery is welcome as a meta part of the portfolio.
- Everything goes in gallery v1, including the Three.js avatar/world pieces.
- No Storybook. The in-app gallery route is the workbench; revisit only if the
  component count grows well beyond the current ~10.

## Work package 1 — Token inventory and naming layer

Deliverable: `app/globals.css` where every color, font, and recurring
spacing/size decision is a named CSS variable, plus `docs/design-tokens.md`
describing the token vocabulary.

- Inventory every raw hex/rgb value in `app/globals.css` and in any inline
  styles or class strings in `components/` and `app/`. Group identical and
  near-identical values.
- Extend the existing variable families rather than inventing new naming
  schemes: `--world-*`, `--reader-*`, `--map-*` are established; follow the
  checkpoint's own names (Silver, Electric pink, Lichen, Acid, Hard red, etc.)
  when naming checkpoint colors.
- Replace raw values with `var(--…)` references. Duplicated near-values get
  one token and a note in the discrepancy list, only if visually identical in
  context; otherwise keep both and note them.
- Explicitly reconcile the file header: the legacy prototype tokens
  (`--accent`, old `--background`/`--surface`, Geist references) either map
  into the current system or are marked deprecated-but-in-use in
  `docs/design-tokens.md`. Do not delete anything still referenced.
- Record every live-CSS-vs-checkpoint disagreement in a "Discrepancies" section
  of `docs/design-tokens.md` for the future improvement session.
- Wire the color tokens into the Tailwind theme (`@theme`) so utilities exist
  for them, without restyling anything.
- Acceptance: no behavior/visual change (existing tests pass; spot-check light
  and dark modes at desktop and 390px width); zero raw color values left in
  `globals.css` outside the token definitions themselves; `docs/design-tokens.md`
  lists every token with its value(s), role, and light/dark pairing.

## Work package 2 — House rules (conventions doc + agent wiring)

Depends on WP1 (it names the tokens). Deliverable: `docs/design-conventions.md`
plus a pointer from `AGENTS.md`.

- Write the styling idiom as enumerable rules an agent can follow without
  guessing: style via the named tokens (list the families); the two typographic
  voices (NHG display/reading usage per the checkpoint; where mono is used);
  light/dark is driven by `prefers-color-scheme` with `[data-theme]` overrides —
  state exactly how a new surface must implement both; never hard-code a hex
  value; where component CSS lives and how classes are named
  (`.portfolio-*` etc.).
- Fold in the checkpoint's standing constraints that any styling agent must
  respect (selection introduces no new color; one label treatment; one
  relationship treatment; cursor rules), with a link to the checkpoint for the
  full grammar.
- Add one short idiomatic example: a small piece of UI built the house way.
- Add a line to `AGENTS.md`: before any UI/styling work, read
  `docs/design-conventions.md`.
- Validate every name the doc uses against the actual post-WP1 stylesheet.
- Acceptance: an agent given only this doc + the stylesheet can add a new
  styled element that a reviewer cannot distinguish from house style.

## Work package 3 — `/design` gallery route

Depends on WP1 conceptually but can start in parallel once WP1 is underway.
Deliverable: a public route (proposed: `/design`) rendering every component in
its enumerated states, plus the token palette itself.

- Sections: (1) tokens — color swatches with names and light/dark values, type
  specimens, spacing scale; (2) each component under `components/` in its
  meaningful states/variants. Everything is in scope, including the heavy
  pieces: `PortfolioWorld`, `PortfolioExperience`, `ProceduralAvatar` /
  `AvatarStageActor`, the avatar toybox, `CursorInstrument`,
  `PortfolioNodeMark`, `PortfolioHeader`, `PortfolioChat`, `PortfolioReader`.
- Lazy-load the Three.js components so the route stays usable; where a
  component needs providers/context or canned data to render standalone, build
  small fixture wrappers in the gallery code (not in the components).
- The gallery is part of the portfolio: it should follow the house style (WP2)
  and is allowed to be a designed artifact in its own right — but function
  first; make it beautiful in the later improvement pass.
- Must work on any feature branch via the normal dev server so it serves as
  the review surface for styling changes in Conductor sessions.
- Include a light/dark toggle (reusing the site's `[data-theme]` mechanism).
- Acceptance: every component listed above renders on the route in at least
  its primary states, in both modes, with no console errors; page loads
  without blocking on the 3D pieces.

## Work package 4 — Per-component cheat-sheets

Depends on WP3 (writing them surfaces states the gallery should show; keep the
two in sync). Deliverable: `components/<Name>.md` next to each component (or a
`docs/components/` folder — executor's choice, but be consistent).

- For each component: one-paragraph purpose; the props/options that matter
  (derived from the TypeScript types — do not restate every type, link the
  source); required context/providers/assets; one minimal working usage
  example (ideally the same fixture the gallery uses); known pitfalls (what
  silently breaks, e.g. missing provider, SSR constraints on the 3D pieces).
- Agent-drafted from source and tests, then human-skimmed. Keep each under a
  page.
- Add a pointer from `AGENTS.md` / `docs/design-conventions.md`: before using
  or modifying a component, read its sheet.
- Acceptance: sheets exist for all components in WP3's list; each example is
  copy-paste runnable (verified in the gallery or a test).

## After the kit exists

1. Improvement session: with the full map visible (tokens doc + gallery),
   review redundancies and the recorded discrepancies against the checkpoint;
   decide palette/typography cleanups deliberately. Likely done visually in
   Claude Design.
2. Run `/design-sync` (Claude Code) to compile the kit into a Claude Design
   project — at that point it mostly packages work already done. Config notes
   live in `.design-sync/`.
3. Trial Paper (paper.design) the same week against the same kit; pick the
   design-iteration workflow from experience.
4. iOS repos: replicate the pattern — token file, house rules, SwiftUI
   `#Preview` blocks as the gallery equivalent. No Claude Design sync there
   (web-only).

## Sequencing for Conductor

Run WP1 alone first (it touches one huge file; keep the diff reviewable and
verify the no-visual-change acceptance carefully). WP2 and WP3 can then run as
parallel sessions; WP4 follows WP3. Each WP is written to be handed to a fresh
session as a standalone task together with this file for context.
