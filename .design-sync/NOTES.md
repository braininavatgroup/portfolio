# design-sync notes

- 2026-08-31: User confirmed there is NO Storybook in this repo (no config, no stories, no deps) — package shape.
- Repo is a portfolio app (vinext + React 19 + Tailwind 4 + React Three Fiber), not a packaged library: no `dist/`; syncable surface is `components/` (~10 components incl. heavy Three.js scene/avatar components) plus the Tailwind 4 theme in `app/globals.css`.
- Lockfile is `package-lock.json` → install with `npm ci` (package.json's `packageManager: pnpm` is not backed by a pnpm lockfile).
- 2026-08-31: User chose "Not now" — no project created, no sync performed. No projectId pinned.
- 2026-08-31 planning session outcomes (see `docs/design-infrastructure-plan.md`):
  - A future sync should run only AFTER the token/conventions/gallery work packages land — it then mostly packages existing assets.
  - Everything is in scope, including the Three.js avatar/world components; user wants the full map, no scoping down.
  - `docs/design-conventions.md` (once it exists) is the natural `readmeHeader` source.
  - `docs/portfolio-design-system-checkpoint.md` is the accepted design direction; `app/globals.css` is mid-migration toward it — expect legacy prototype tokens alongside the checkpoint palette until the WP1 token pass lands.
