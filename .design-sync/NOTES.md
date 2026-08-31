# design-sync notes

- 2026-08-31: User confirmed there is NO Storybook in this repo (no config, no stories, no deps) — package shape.
- Repo is a portfolio app (vinext + React 19 + Tailwind 4 + React Three Fiber), not a packaged library: no `dist/`; syncable surface is `components/` (~10 components incl. heavy Three.js scene/avatar components) plus the Tailwind 4 theme in `app/globals.css`.
- Lockfile is `package-lock.json` → install with `npm ci` (package.json's `packageManager: pnpm` is not backed by a pnpm lockfile).
- 2026-08-31: User chose "Not now" — no project created, no sync performed. No projectId pinned.
