#!/usr/bin/env bash
#
# One-shot setup for reviewer feedback on the permanent main preview.
#
#   npm run setup:feedback
#
# Mints a fresh admin token, sets it as the Worker secret
# PORTFOLIO_FEEDBACK_ADMIN_TOKEN on bradley-portfolio-main-preview through your
# own Wrangler login, and stores the same value in your macOS login Keychain so
# `npm run feedback` finds it without an environment variable. The token is
# never printed, written to disk in the repository, or passed as an argument.
#
# Run it from Terminal or iTerm as yourself: it needs your Cloudflare login
# (`npx wrangler login` once, if `npx wrangler whoami` fails) and your Keychain.
# Re-running rotates the token in both places.

set -euo pipefail

CONFIG="wrangler.main-preview.jsonc"
SECRET_NAME="PORTFOLIO_FEEDBACK_ADMIN_TOKEN"
KEYCHAIN_SERVICE="biv-portfolio-feedback"
KEYCHAIN_ACCOUNT="admin-token"
SITE="${PORTFOLIO_SITE:-https://bradleyberkman.com}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

say()  { printf '  %s\n' "$1"; }
done_() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

printf '\n\033[1mReviewer feedback: admin token\033[0m\n\n'

[[ "$(uname)" == "Darwin" ]] || fail "This stores the token in the macOS Keychain; run it on your Mac."
[[ -f "$CONFIG" ]] || fail "Run from the portfolio repository; $CONFIG not found."

say "Checking your Cloudflare login…"
if ! npx wrangler whoami >/dev/null 2>&1; then
  fail "Wrangler is not logged in. Run \`npx wrangler login\` as yourself, then re-run."
fi
done_ "Wrangler is logged in"

# 64 hex characters: well above the 32-character minimum the Worker enforces.
TOKEN="$(openssl rand -hex 32)"

say "Setting $SECRET_NAME on the main preview Worker…"
printf '%s' "$TOKEN" | npx wrangler secret put "$SECRET_NAME" --config "$CONFIG" >/dev/null
done_ "Worker secret set"

say "Storing the token in your login Keychain ($KEYCHAIN_SERVICE)…"
/usr/bin/security add-generic-password -U \
  -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" \
  -l "Portfolio reviewer feedback admin token" \
  -w "$TOKEN" >/dev/null
READBACK="$(/usr/bin/security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" -w)"
[[ "$READBACK" == "$TOKEN" ]] || fail "Keychain readback did not match."
done_ "Keychain entry written and read back"

say "Checking the digest route on ${SITE}…"
STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
  -H "authorization: Bearer $TOKEN" "$SITE/_portfolio-feedback/admin/notes" || true)"
unset TOKEN READBACK
case "$STATUS" in
  200) done_ "Digest route answers 200 — feedback is live. Try: npm run feedback" ;;
  303|404) say "Digest route answers $STATUS: the feedback build is not deployed yet. The secret is in place; once the PR is deployed, \`npm run feedback\` will work." ;;
  *)   say "Digest route answered $STATUS. The secret is set; check the deployment before relying on it." ;;
esac

printf '\n  Mint reviewer links with: npm run feedback -- --link <code>\n\n'
