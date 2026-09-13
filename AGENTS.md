# Portfolio repository instructions

Global policy: read [global AGENTS.md](https://github.com/braininavatgroup/dotfiles/blob/main/agents/AGENTS.md) (installed at `~/.codex/AGENTS.md`; source checkout `~/Spaces/dotfiles/agents/AGENTS.md`). This file owns only repository-specific instructions.

- Before any UI or styling work, read `docs/design-conventions.md`. It states
  the house style as enumerable rules: the token families, the two typographic
  voices, exactly how light and dark are implemented, class naming, and the
  standing constraints from the design-system checkpoint. `docs/design-tokens.md`
  is the full token inventory; `docs/portfolio-design-system-checkpoint.md` is
  the accepted visual direction.
- Before using or modifying a component in `components/`, read its sheet in
  `docs/components/` — one page each on what it is for, the props that matter,
  what has to be around it, a runnable example, and what breaks silently.
  `docs/components/README.md` is the index. `/design` renders the same
  components in their states.
- After creating a Git worktree manually, run `bash scripts/bootstrap-worktree.sh` inside it before any package-dependent command. The repository hook normally does this automatically after Conductor has activated it; the command is an idempotent fallback.
- Copy edits arrive as an edited copy deck (a folder of Markdown notes exported from `/copy-deck`
  on the live site). Read `docs/content/copy-deck.md` before applying one: it
  says how to diff the deck against a fresh export and where each key lives in
  `content/portfolio-content.json`.
- Social video for the portfolio is authored as a JSON spec under
  `scripts/clip-studio/specs/` and rendered with `npm run clip:render`. Read
  `docs/clip-studio.md` before changing a spec or the renderer; `--still` gives
  a single frame in seconds, which is how to iterate on wording and framing.
