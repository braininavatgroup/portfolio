#!/usr/bin/env bash
#
# Install (or remove) the daily `npm run insights` launchd job.
#
#   npm run schedule:insights              # install, runs daily at 07:10 local
#   npm run schedule:insights -- --now     # install and run once immediately
#   npm run schedule:insights -- --remove  # unload and delete the job
#
# Why a schedule at all: Clarity's export reaches back three days and
# Cloudflare's free plan keeps about ten, so the only durable record of the
# launch curve is the history file each run appends to. One run a day spends
# 4 of Clarity's 10 daily requests and leaves room for a manual run.
#
# The job runs the checkout this script lives in. Run it from the canonical
# clone, not an ephemeral worktree, or the job breaks when the worktree goes.
# Source snapshots, history, and the dashboard are written to
# ~/Library/Application Support/biv/portfolio-insights/ (mode 0700, checked
# before install) so they survive checkouts. Tokens come from the login Keychain entries that
# `npm run setup:insights` writes; launchd user agents can read them while
# you are logged in.

set -euo pipefail

LABEL="com.biv.portfolio-insights"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/biv"
LOG="$LOG_DIR/portfolio-insights.log"
HISTORY_DIR="$HOME/Library/Application Support/biv/portfolio-insights"
# PORTFOLIO_INSIGHTS_REPO points the job at a different checkout, for
# installing from a worktree while the canonical clone is the one that runs.
REPO="${PORTFOLIO_INSIGHTS_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
HOUR=7
MINUTE=10

mode="install"
run_now=0
for argument in "$@"; do
  case "$argument" in
    --remove) mode="remove" ;;
    --now) run_now=1 ;;
    *) printf 'Unknown argument: %s\n' "$argument" >&2; exit 2 ;;
  esac
done

[[ "$(uname)" == "Darwin" ]] || { printf 'launchd is macOS only.\n' >&2; exit 1; }
uid="$(id -u)"

unload() {
  launchctl bootout "gui/$uid/$LABEL" >/dev/null 2>&1 || true
}

if [[ "$mode" == "remove" ]]; then
  unload
  rm -f "$PLIST"
  printf 'Removed %s. History in %s is kept.\n' "$LABEL" "$HISTORY_DIR"
  exit 0
fi

[[ -f "$REPO/scripts/portfolio-insights.mjs" ]] || { printf 'Not a portfolio checkout: %s\n' "$REPO" >&2; exit 1; }
if [[ "$REPO" == *"/conductor/workspaces/"* ]]; then
  printf 'Refusing to schedule an ephemeral Conductor worktree (%s).\n' "$REPO" >&2
  printf 'Run this from the canonical clone instead.\n' >&2
  exit 1
fi
node_bin="$(command -v node || true)"
[[ -n "$node_bin" ]] || { printf 'node is not on PATH.\n' >&2; exit 1; }

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

# The history directory holds Airtable names and the dashboard, so it is
# owner-only, and the job is not installed until stat confirms it.
mkdir -p "$HISTORY_DIR"
chmod 700 "$HISTORY_DIR"
history_mode="$(stat -f '%Lp' "$HISTORY_DIR")"
if [[ "$history_mode" != "700" ]]; then
  printf 'Refusing to install: %s is mode %s, not 700.\n' "$HISTORY_DIR" "$history_mode" >&2
  exit 1
fi

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<!-- Installed by scripts/schedule-portfolio-insights.sh in the portfolio repository.
     Reads the portfolio's analytics sources and assigned-link projection, then
     rewrites the private dashboard. Never mutates anything outside $HISTORY_DIR
     and the log. -->
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$node_bin</string>
        <string>$REPO/scripts/portfolio-insights.mjs</string>
        <string>--days</string>
        <string>7</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$REPO</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>$HOUR</integer>
        <key>Minute</key>
        <integer>$MINUTE</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>$LOG</string>
    <key>StandardErrorPath</key>
    <string>$LOG</string>
    <key>RunAtLoad</key>
    <false/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>$HOME</string>
        <key>PATH</key>
        <string>$(dirname "$node_bin"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>PORTFOLIO_INSIGHTS_DIR</key>
        <string>$HISTORY_DIR</string>
    </dict>
</dict>
</plist>
PLIST

plutil -lint "$PLIST" >/dev/null
unload
launchctl bootstrap "gui/$uid" "$PLIST"
printf 'Installed %s: daily at %02d:%02d, checkout %s\n' "$LABEL" "$HOUR" "$MINUTE" "$REPO"
printf 'History: %s\nLog:     %s\n' "$HISTORY_DIR" "$LOG"

if [[ "$run_now" == 1 ]]; then
  launchctl kickstart "gui/$uid/$LABEL"
  printf 'Kicked off a run now; tail the log to watch it.\n'
fi
