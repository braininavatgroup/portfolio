# Public chat preparation

Status: prepared for review; public activation is not authorized by this change.
The current target is `bradley-portfolio-main-preview`, configured by
`wrangler.main-preview.jsonc`. Its password gate is disabled in the checked-in configuration, the chat session
token is required, and the shared allowance is 1,000 model requests per UTC day.

## Proposed public settings

Keep the existing 25 requests/minute per-IP throttle and the global 1,000/day
allowance for the initial public release. These are different limits: one
visitor can hit the minute limit, while all visitors share the daily allowance.
Local wave, dance, swim, and Brain Food commands consume neither allowance nor
model calls. The allowance bounds requests, not a fixed dollar amount. The
model, input size, and 3,000-token output ceiling also determine cost; changing
the allowance requires a separately approved spending scope.

There is no interactive bot check. `PORTFOLIO_CHAT_SESSION_REQUIRED` needs a
`PORTFOLIO_CHAT_IDENTIFIER_SECRET` of at least 32 characters and the bound rate
limiter; the endpoint then requires a session cookie the worker issues from
`/api/portfolio-chat/session`, bound to a digest of the client IP and renewed on
every accepted request. It is a speed bump against scripts that never load the
site, not a wall — the per-IP throttle and the daily allowance are what bound
the damage. Missing dependencies fail closed. No production secret values were
read or verified for this preparation.

## Evidence before activation

Run the launch-guard, budget-object, runtime, handler, transport, and Guide tests
against the candidate commit. They cover missing configuration, invalid and
expired challenges, wrong action/hostname, exhausted allowance, rate limits,
provider failures, and local controls remaining usable. Run the rendered build
checks to prove server-only credentials stay out of client assets. Confirm the
built site key and server challenge flag agree before removing the password.
Use isolated fake bindings to prove exhaustion; do not consume the live budget
merely to test it. The UI distinguishes quota, rate, verification, and service
failures without displaying upstream error details.

## Activation boundary

A separate approval must bind the reviewed commit and build digest, target
Worker/domains, exact settings and secret names, operator, spending/data scope,
expiry, smoke assertions, and the previous healthy Worker version for rollback.
Provision secrets through that operator's scoped capability. Validate challenge
success/failure and one bounded chat request behind the password first, then
remove the password only if the approval explicitly covers public access.
On failure, keep the password and roll back to the recorded healthy version.
The existing preview deployment workflow and access controls are unchanged.
