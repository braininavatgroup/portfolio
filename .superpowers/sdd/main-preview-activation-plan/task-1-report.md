# Task 1 report

## Scope

- Updated the focused auth test expectations in `worker/main-preview-auth.test.ts` so every protected response now requires `X-Robots-Tag: noindex, nofollow, noarchive`.
- Updated the shared protected-response header constant in `worker/main-preview-auth.ts` so both wrapped downstream responses and private responses emit the approved value.
- Updated the activation packet smoke matrix in `docs/activation/portfolio-main-preview-activation-packet.md` to match the approved contract.

## TDD evidence

1. Changed the focused auth test first.
2. Ran `node_modules/.bin/vitest run worker/main-preview-auth.test.ts` and captured the expected failure: 7 assertions still received `noindex, nofollow`.
3. Made the minimal production change by centralizing the protected header value as `noindex, nofollow, noarchive`.
4. Re-ran `node_modules/.bin/vitest run worker/main-preview-auth.test.ts` and the focused suite passed: 14 tests passed.

## Notes

- I used the existing local Vitest binary after `pnpm` was not available on `PATH` in this worktree session.
- No gates, secrets, deployment settings, or activation controls were changed.
