#!/bin/bash
# install-launchagents.sh — install the launchd jobs this repository declares.
#
# Every plist in ops/launchd/ is labelled com.bradleyberkman.portfolio.<job>, and
# this installer owns that prefix (BIV-567). For each declared job it:
#
#   not registered        -> copy to ~/Library/LaunchAgents, bootstrap
#   bytes unchanged       -> leave alone
#   bytes changed         -> bootout, copy, bootstrap (deferred while running)
#   live under the prefix but no longer declared -> bootout, remove the copy
#
# Plists are rendered for the installing user: /Users/bradleyberkman becomes
# $HOME. An empty ops/launchd/ is refused rather than read as "remove everything".
# After a pass it writes the machine-local declaration, one "<label> <sha256>"
# line per job, to the directory every repository's installer shares; the
# brain-in-a-vat-group verifier judges launchd state against it.
#
# Usage: scripts/launchd/install-launchagents.sh [--dry-run]
# Environment: LAUNCHD_DECLARATIONS_DIR, PORTFOLIO_LAUNCHAGENTS_LIVE,
#   PORTFOLIO_LAUNCHCTL, PORTFOLIO_LAUNCHD_DOMAIN (test seams)
# Exit 0 when every job reconciled; 1 for errors, refusals or deferrals.
set -uo pipefail

REPO=portfolio
PREFIX="com.bradleyberkman.$REPO."
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
SOURCE="$repo_root/ops/launchd"
LIVE="${PORTFOLIO_LAUNCHAGENTS_LIVE:-$HOME/Library/LaunchAgents}"
DECLARATIONS="${LAUNCHD_DECLARATIONS_DIR:-$HOME/Library/Application Support/com.bradleyberkman.launchd/declared}"
LAUNCHCTL="${PORTFOLIO_LAUNCHCTL:-launchctl}"
DOMAIN="${PORTFOLIO_LAUNCHD_DOMAIN:-gui/$(id -u)}"
DRY_RUN=0

case "${1:-}" in
  "") ;;
  --dry-run) DRY_RUN=1 ;;
  *) echo "usage: $0 [--dry-run]" >&2; exit 64 ;;
esac

errors=0
deferred=0
act() { if [[ "$DRY_RUN" -eq 1 ]]; then echo "would: $*"; else "$@"; fi; }

# 0 registered and idle, 1 not registered, 2 unreadable, 3 running.
state_of() {
  local output rc
  output="$("$LAUNCHCTL" print "$DOMAIN/$1" 2>/dev/null)"; rc=$?
  [[ "$rc" -eq 113 ]] && return 1
  [[ "$rc" -ne 0 ]] && return 2
  printf '%s\n' "$output" | grep -Eq '^[[:space:]]*pid = [1-9]' && return 3
  return 0
}

shopt -s nullglob
plists=("$SOURCE"/*.plist)
if [[ "${#plists[@]}" -eq 0 ]]; then
  echo "refusing: $SOURCE declares no jobs, which is what a broken checkout looks like" >&2
  exit 1
fi

work=$(mktemp -d "${TMPDIR:-/tmp}/portfolio-launchd.XXXXXX")
trap 'rm -rf "$work"' EXIT
mkdir -p "$LIVE" "$DECLARATIONS" || exit 1

declared=()
for source in "${plists[@]}"; do
  label=$(basename "$source" .plist)
  if [[ ! "$label" =~ ^com\.bradleyberkman\.portfolio\.[a-z0-9][a-z0-9-]*$ ]]; then
    echo "refusing $source: label must be $PREFIX<job>" >&2
    errors=$((errors + 1)); continue
  fi
  rendered="$work/$label.plist"
  sed "s#/Users/bradleyberkman#$HOME#g" "$source" > "$rendered"
  declared+=("$label")
  live="$LIVE/$label.plist"

  state_of "$label"; rc=$?
  if [[ "$rc" -eq 2 ]]; then
    echo "refusing $label: launchctl could not answer" >&2
    errors=$((errors + 1)); continue
  fi
  if [[ "$rc" -ne 1 ]] && [[ -f "$live" && ! -L "$live" ]] && cmp -s "$rendered" "$live"; then
    echo "current: $label"; continue
  fi
  if [[ "$rc" -eq 3 ]]; then
    echo "DEFERRED: $label changed while running; rerun once it is idle" >&2
    deferred=$((deferred + 1)); continue
  fi
  if [[ "$rc" -eq 0 ]]; then
    act "$LAUNCHCTL" bootout "$DOMAIN/$label" || { errors=$((errors + 1)); continue; }
  fi
  act rm -f "$live"
  act cp "$rendered" "$live"
  if act "$LAUNCHCTL" bootstrap "$DOMAIN" "$live"; then
    echo "LOADED: $label"
  else
    echo "failed to bootstrap $label" >&2
    errors=$((errors + 1))
  fi
done

# Removal by absence: a live label under this prefix that ops/launchd/ no longer declares.
while IFS= read -r label; do
  [[ -n "$label" ]] || continue
  keep=0
  for wanted in ${declared[@]+"${declared[@]}"}; do [[ "$wanted" == "$label" ]] && keep=1; done
  [[ "$keep" -eq 1 ]] && continue
  state_of "$label"; rc=$?
  if [[ "$rc" -eq 3 ]]; then
    echo "DEFERRED: $label is no longer declared but is running" >&2
    deferred=$((deferred + 1)); continue
  fi
  [[ "$rc" -eq 0 ]] && { act "$LAUNCHCTL" bootout "$DOMAIN/$label" || { errors=$((errors + 1)); continue; }; }
  act rm -f "$LIVE/$label.plist"
  echo "REMOVED: $label (no longer declared)"
done < <({
  "$LAUNCHCTL" list 2>/dev/null | awk 'NR > 1 { print $3 }'
  for path in "$LIVE"/*.plist; do basename "$path" .plist; done
} | awk -v p="$PREFIX" 'index($0, p) == 1' | sort -u)

if [[ "$DRY_RUN" -eq 0 ]]; then
  tmp="$DECLARATIONS/.$REPO.$$"
  if ! for label in ${declared[@]+"${declared[@]}"}; do
    printf '%s %s\n' "$label" "$(shasum -a 256 "$work/$label.plist" | awk '{print $1}')"
  done > "$tmp" || ! mv -f "$tmp" "$DECLARATIONS/$REPO"; then
    echo "failed to write the declaration" >&2
    errors=$((errors + 1))
  fi
fi

echo "declared: ${#declared[@]}    deferred: $deferred    errors: $errors"
[[ "$errors" -eq 0 && "$deferred" -eq 0 ]]
