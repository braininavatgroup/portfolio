#!/usr/bin/env bash

set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
cd "$repository_root"

if [[ "${PORTFOLIO_BOOTSTRAP_CONFIGURE_HOOKS:-1}" != "0" ]]; then
  git config --local core.hooksPath .githooks
fi

lockfile="package-lock.json"
marker="node_modules/.portfolio-package-lock"

if [[ ! -f "$lockfile" ]]; then
  printf 'Cannot bootstrap this worktree: %s is missing.\n' "$lockfile" >&2
  exit 1
fi

node_version="$(node --version)"
lock_hash="$(git hash-object "$lockfile")"
fingerprint="$lock_hash $node_version"

if [[ -x node_modules/.bin/vinext && -f "$marker" ]] &&
  [[ "$(<"$marker")" == "$fingerprint" ]]; then
  printf 'Workspace dependencies are current.\n'
  exit 0
fi

printf 'Installing workspace dependencies with npm ci…\n'
npm ci
printf '%s\n' "$fingerprint" > "$marker"
printf 'Workspace dependencies are ready.\n'
