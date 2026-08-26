#!/bin/sh

set -eu

openai_api_key="$(security find-generic-password -s openai-api-key -w)"
if [ -z "$openai_api_key" ]; then
  echo "The macOS Keychain item 'openai-api-key' is empty." >&2
  exit 1
fi

OPENAI_API_KEY="$openai_api_key" exec npm run dev -- "$@"
