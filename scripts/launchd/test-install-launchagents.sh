#!/bin/bash
# check() evaluates its single-quoted assertion after run() sets RC and OUT.
# shellcheck disable=SC2016,SC2034
# test-install-launchagents.sh — scripts/launchd/install-launchagents.sh against a fake launchctl.
# Owns: declared jobs install as rendered plain files with a recorded declaration;
# unchanged jobs are left alone; a running changed job is deferred; a job whose
# plist leaves ops/launchd/ is unloaded; other prefixes are untouched; an empty
# ops/launchd/ is refused. Retire when portfolio stops installing launchd jobs.
set -uo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
work=$(mktemp -d "${TMPDIR:-/tmp}/portfolio-launchd-test.XXXXXX")
trap 'rm -rf "$work"' EXIT
pass=0; fail=0
check() { if eval "$2"; then echo "  ok: $1"; pass=$((pass + 1)); else echo "  FAIL: $1${3:+: $3}"; fail=$((fail + 1)); fi; }

# A copy of the repository whose launchd/ the test controls.
mkdir -p "$work/repo/scripts/launchd" "$work/repo/ops/launchd" "$work/home/Library/LaunchAgents" "$work/decl" "$work/fake/registered" "$work/fake/running"
cp "$repo_root/scripts/launchd/install-launchagents.sh" "$work/repo/scripts/launchd/"
P=com.bradleyberkman.portfolio
plist() { printf '<plist><dict><key>Label</key><string>%s</string><key>StandardOutPath</key><string>/Users/bradleyberkman/Library/Logs/%s</string></dict></plist>\n' "$1" "${2:-x.log}"; }
plist "$P.a" > "$work/repo/ops/launchd/$P.a.plist"
plist "$P.b" > "$work/repo/ops/launchd/$P.b.plist"

cat > "$work/fake/launchctl" <<'FAKE'
#!/bin/bash
cmd=$1; shift
echo "$cmd $*" >> "$FAKE/log"
case "$cmd" in
  print) l=${1##*/}; [[ -e "$FAKE/registered/$l" ]] || exit 113
         echo "path = $(cat "$FAKE/registered/$l")"; [[ -e "$FAKE/running/$l" ]] && echo "	pid = 42"; exit 0 ;;
  list) echo "PID Status Label"; for f in "$FAKE/registered"/*; do [[ -e "$f" ]] && echo "- 0 $(basename "$f")"; done ;;
  bootout) rm -f "$FAKE/registered/${1##*/}" ;;
  bootstrap) echo "$2" > "$FAKE/registered/$(basename "$2" .plist)" ;;
esac
FAKE
chmod +x "$work/fake/launchctl"
export FAKE="$work/fake"
run() {
  OUT=$(HOME="$work/home" LAUNCHD_DECLARATIONS_DIR="$work/decl" PORTFOLIO_LAUNCHCTL="$FAKE/launchctl" \
    PORTFOLIO_LAUNCHD_DOMAIN=gui/501 bash "$work/repo/scripts/launchd/install-launchagents.sh" 2>&1); RC=$?
}
live="$work/home/Library/LaunchAgents"

echo "install-launchagents"
run
check "fresh install succeeds" '[[ $RC -eq 0 ]]' "$OUT"
check "jobs are registered from plain live copies" '[[ -f "$live/$P.a.plist" && ! -L "$live/$P.a.plist" && "$(cat "$FAKE/registered/$P.a")" == "$live/$P.a.plist" ]]'
check "plists are rendered for the installing home" 'grep -q "$work/home/Library/Logs" "$live/$P.a.plist" && ! grep -q /Users/bradleyberkman "$live/$P.a.plist"'
check "the declaration records each rendered plist" 'grep -qx "$P.a $(shasum -a 256 "$live/$P.a.plist" | cut -d" " -f1)" "$work/decl/portfolio"'

: > "$FAKE/log"; run
check "unchanged jobs are left alone" '[[ $RC -eq 0 ]] && ! grep -q "^boot" "$FAKE/log"' "$(cat "$FAKE/log")"

plist "$P.b" y.log > "$work/repo/ops/launchd/$P.b.plist"; touch "$FAKE/running/$P.b"
: > "$FAKE/log"; run
check "a running changed job is deferred" '[[ $RC -ne 0 ]] && ! grep -q "^bootout gui/501/$P.b" "$FAKE/log"' "$OUT"
rm "$FAKE/running/$P.b"

rm "$work/repo/ops/launchd/$P.b.plist"
echo "$work/elsewhere" > "$FAKE/registered/com.bradleyberkman.other.x"
run
check "a job whose plist left ops/launchd/ is unloaded" '[[ $RC -eq 0 && ! -e "$FAKE/registered/$P.b" && ! -e "$live/$P.b.plist" ]]' "$OUT"
check "another prefix is untouched" '[[ -e "$FAKE/registered/com.bradleyberkman.other.x" ]]'

rm "$work/repo/ops/launchd/"*.plist
: > "$FAKE/log"; run
check "an empty ops/launchd/ is refused and removes nothing" '[[ $RC -ne 0 && -e "$FAKE/registered/$P.a" ]] && ! grep -q "^bootout" "$FAKE/log"' "$OUT"

echo "install-launchagents: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
