# Portfolio repository instructions

- Before any UI or styling work, read `docs/design-conventions.md`. It states
  the house style as enumerable rules: the token families, the two typographic
  voices, exactly how light and dark are implemented, class naming, and the
  standing constraints from the design-system checkpoint. `docs/design-tokens.md`
  is the full token inventory; `docs/portfolio-design-system-checkpoint.md` is
  the accepted visual direction.
- After creating a Git worktree manually, run `bash scripts/bootstrap-worktree.sh` inside it before any package-dependent command. The repository hook normally does this automatically after Conductor has activated it; the command is an idempotent fallback.
