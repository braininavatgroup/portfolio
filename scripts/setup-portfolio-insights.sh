#!/usr/bin/env bash
#
# One-shot setup for `npm run insights`.
#
#   npm run setup:insights
#
# Walks you through minting the two read-only tokens the insights report needs
# — a Cloudflare API token and a Clarity Data Export token — and stores each in
# your macOS login Keychain. Neither can be minted by a script: Cloudflare will
# not let an API token create another API token, and Clarity has no token API,
# so both come from a dashboard you drive yourself.
#
# Run it from Terminal or iTerm as yourself. Each token is verified with a live
# read before it is stored, and is never printed or written to disk. Re-running
# rotates whichever token you paste and keeps the other.

set -euo pipefail

KEYCHAIN_SERVICE="biv-portfolio-insights"
ZONE_TAG="624bf95296a4ce1f2a927e5013537bc2"
ACCOUNT_TAG="d459e1fdd68165fbc952d009070658d7"
RUM_SITE_TAG="bc27c8ff1dab471ea19546ac65ac42e2"
CLARITY_PROJECT="yatoiqtrjm"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'

say()   { printf '  %s\n' "$1"; }
step()  { printf '  %s→%s %s\n' "$YELLOW" "$RESET" "$1"; }
note()  { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
done_() { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
warn()  { printf '  %s! %s%s\n' "$YELLOW" "$1" "$RESET"; }
fail()  { printf '  %s✗ %s%s\n' "$RED" "$1" "$RESET" >&2; exit 1; }
rule()  { printf '\n%s%s%s\n\n' "$BOLD" "$1" "$RESET"; }

[[ "$(uname)" == "Darwin" ]] || fail "This stores tokens in the macOS Keychain; run it on your Mac."
[[ -f "scripts/portfolio-insights.mjs" ]] || fail "Run from the portfolio repository."
command -v curl >/dev/null 2>&1 || fail "curl is required."

open_url() { open "$1" >/dev/null 2>&1 || warn "Open it yourself: $1"; }

# store ACCOUNT LABEL <<< "$TOKEN" — writes, reads back, and clears the value.
store() {
  local account="$1" label="$2" token="$3" readback
  /usr/bin/security add-generic-password -U \
    -s "$KEYCHAIN_SERVICE" -a "$account" -l "$label" -w "$token" >/dev/null
  readback="$(/usr/bin/security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$account" -w)"
  [[ "$readback" == "$token" ]] || fail "Keychain readback did not match for $account."
  done_ "Stored in your login Keychain ($KEYCHAIN_SERVICE / $account)"
}

printf '\n%sPortfolio insights: analytics tokens%s\n' "$BOLD" "$RESET"
note "Two stages. Ctrl-C any time; a token already stored stays stored."

# ── Stage 1 · Cloudflare ────────────────────────────────────────────────────
rule "Stage 1/2 · Cloudflare API token"
say "One token covering both halves of the Cloudflare picture: Web Analytics"
say "(what browsers did) and edge requests (what every client asked for,"
say "including crawlers that never run JavaScript)."
printf '\n'
step "Opening the API tokens page. Select Create Token → Custom token."
open_url "https://dash.cloudflare.com/profile/api-tokens"
printf '\n'
say "Name it:            portfolio-insights"
say "Permissions:        Account · Account Analytics · Read"
say "                    Zone    · Zone Analytics    · Read"
say "Account resources:  Include · Bradley@braininavat.dance's Account"
say "Zone resources:     Include · Specific zone · bradleyberkman.com"
note "Both permission rows matter: Account Analytics alone gives Web Analytics"
note "but not the edge and crawler data, which is the gap this closes."
printf '\n'
printf '  %sPaste the token (input hidden, Enter to skip):%s ' "$BOLD" "$RESET"
read -rs CF_TOKEN || true
printf '\n\n'

if [[ -n "${CF_TOKEN:-}" ]]; then
  say "Verifying against Web Analytics and the zone…"
  RUM_QUERY="{\"query\":\"query{viewer{accounts(filter:{accountTag:\\\"$ACCOUNT_TAG\\\"}){rumPageloadEventsAdaptiveGroups(limit:1,filter:{siteTag:\\\"$RUM_SITE_TAG\\\"}){count}}}}\"}"
  if curl -sS -X POST https://api.cloudflare.com/client/v4/graphql \
      -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
      -d "$RUM_QUERY" | grep -q '"rumPageloadEventsAdaptiveGroups"'; then
    done_ "Web Analytics readable"
  else
    fail "Web Analytics is not readable with that token. Check the Account Analytics · Read row."
  fi

  ZONE_QUERY="{\"query\":\"query{viewer{zones(filter:{zoneTag:\\\"$ZONE_TAG\\\"}){httpRequests1dGroups(limit:1,filter:{date_geq:\\\"2026-01-01\\\"}){sum{requests}}}}}\"}"
  if curl -sS -X POST https://api.cloudflare.com/client/v4/graphql \
      -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
      -d "$ZONE_QUERY" | grep -q '"httpRequests1dGroups"'; then
    done_ "Zone analytics readable — crawler and bot traffic will appear"
  else
    warn "Zone analytics is NOT readable. The report still works, but the edge"
    warn "and crawler section will say so. Add Zone Analytics · Read and re-run."
  fi
  store "cloudflare-api-token" "Portfolio insights Cloudflare analytics token" "$CF_TOKEN"
else
  note "Skipped. CLOUDFLARE_API_TOKEN in the environment also works."
fi
unset CF_TOKEN

# ── Stage 2 · Clarity ───────────────────────────────────────────────────────
rule "Stage 2/2 · Clarity Data Export token"
say "Clarity holds the behaviour half: sessions, scroll depth, engagement time,"
say "and the frustration signals. Only a project admin can mint the token."
printf '\n'
step "Opening the Clarity project settings. Go to Settings → Data Export."
open_url "https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT}/settings"
printf '\n'
say "Select Generate new API token."
say "Name it:  portfolio-insights"
note "4–32 characters, no spaces. Copy it now: Clarity shows it once."
printf '\n'
warn "Verifying spends 1 of the project's 10 API requests for today."
printf '\n'
printf '  %sPaste the token (input hidden, Enter to skip):%s ' "$BOLD" "$RESET"
read -rs CLARITY_TOKEN || true
printf '\n\n'

if [[ -n "${CLARITY_TOKEN:-}" ]]; then
  say "Verifying against the export API…"
  STATUS="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $CLARITY_TOKEN" -H "Content-Type: application/json" \
    "https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1" || true)"
  case "$STATUS" in
    200) done_ "Export API answers 200" ;;
    401|403) fail "Clarity answered $STATUS: the token is rejected. Mint a fresh one." ;;
    429) warn "Clarity answered 429: today's 10 requests are already spent. Storing the token unverified." ;;
    *)   warn "Clarity answered $STATUS. Storing the token; check it with \`npm run insights\`." ;;
  esac
  store "clarity-api-token" "Portfolio insights Clarity export token" "$CLARITY_TOKEN"
else
  note "Skipped. CLARITY_API_TOKEN in the environment also works."
fi
unset CLARITY_TOKEN

rule "Done"
say "Read the launch signals with:"
printf '\n    npm run insights\n\n'
note "Clarity allows 10 requests per project per day and each run spends 4, so"
note "two full runs a day is the sustainable rhythm. Add --no-clarity for more."
note "Every run appends to .context/insights/history.jsonl, which is gitignored"
note "and is what builds a record past each source's short retention window."
printf '\n'
