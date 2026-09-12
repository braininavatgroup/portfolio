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
KEYCHAIN_WRITER="scripts/store-keychain-secret.swift"
SITE="${PORTFOLIO_SITE:-https://bradleyberkman.com}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

say()  { printf '  %s\n' "$1"; }
done_() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

printf '\n\033[1mReviewer feedback: admin token\033[0m\n\n'

[[ "$(uname)" == "Darwin" ]] || fail "This stores the token in the macOS Keychain; run it on your Mac."
[[ -f "$CONFIG" ]] || fail "Run from the portfolio repository; $CONFIG not found."
[[ -f "$KEYCHAIN_WRITER" ]] || fail "Missing $KEYCHAIN_WRITER; nothing can be stored safely."
# The token reaches the Keychain over stdin, which needs the Swift writer.
# Without a toolchain there is no safe path, and a token on the command line —
# readable by every process running as this user — is not a fallback.
/usr/bin/xcrun --find swift >/dev/null 2>&1 || \
  fail "Storing the token without exposing it needs Swift. Run xcode-select --install, then re-run."

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
# Delete first so the writer always takes its create path: the item's access
# controls name /usr/bin/security alone, so only it can remove the old entry
# without macOS asking for an authorization the writer does not hold. No secret
# reaches the delete's command line, and it is a no-op when nothing is stored.
/usr/bin/security delete-generic-password \
  -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" >/dev/null 2>&1 || true
printf '%s' "$TOKEN" | /usr/bin/xcrun swift -suppress-warnings \
  "$KEYCHAIN_WRITER" "$KEYCHAIN_SERVICE" "$KEYCHAIN_ACCOUNT" \
  "Portfolio reviewer feedback admin token" \
  || fail "Could not store the token: any previous value was removed, so re-run."
READBACK="$(/usr/bin/security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" -w)"
[[ "$READBACK" == "$TOKEN" ]] || fail "Keychain readback did not match."
done_ "Keychain entry written and read back"

say "Checking the digest route on ${SITE}…"
# The header reaches curl on stdin so the token never appears in argv.
STATUS="$(printf 'authorization: Bearer %s\n' "$TOKEN" | curl -s -o /dev/null -w '%{http_code}' \
  -H @- "$SITE/_portfolio-feedback/admin/notes" || true)"
unset TOKEN READBACK
case "$STATUS" in
  200) done_ "Digest route answers 200 — feedback is live. Try: npm run feedback" ;;
  303|404) say "Digest route answers $STATUS: the feedback build is not deployed yet. The secret is in place; once the PR is deployed, \`npm run feedback\` will work." ;;
  *)   say "Digest route answered $STATUS. The secret is set; check the deployment before relying on it." ;;
esac

printf '\n  Mint reviewer links with: npm run feedback -- --link <code>\n\n'
