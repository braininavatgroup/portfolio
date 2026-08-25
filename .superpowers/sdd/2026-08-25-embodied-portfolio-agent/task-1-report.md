# Task 1 report — safe avatar behavior engine

## Implementation summary

- Added closed avatar contracts for states, animations, directions, tabs, semantic targets, site actions, and avatar commands in `lib/avatar/contracts.ts`.
- Added the centralized procedural placeholder asset configuration in `lib/avatar/config.ts`, including the required animation map and state fallback chains.
- Implemented `parsePortfolioResponseEffects()` in `lib/avatar/validation.ts` with exact-key checks, a data-derived target allowlist from `portfolioData.projects`, safe per-item array sanitization, and wait clamping to `0..10_000`.
- Implemented `resolveAvatarAnimation()` and `adaptCommandsForReducedMotion()` in `lib/avatar/state.ts`.
- Implemented `AvatarTargetRegistry` in `lib/avatar/target-registry.ts` to resolve live bounds without caching rectangles.
- Implemented `AvatarSequenceRunner` in `lib/avatar/sequence-runner.ts` with one active `AbortController`, immediate abort-before-run behavior, and wait cancellation.
- Implemented callback-only `SiteActionExecutor` in `lib/avatar/site-actions.ts` with semantic dispatch and safe `{ ok, reason }` results.
- Added focused Vitest coverage for validation, state fallback, reduced motion, target registration, sequence cancellation, and site-action dispatch.

## Files changed

- `lib/avatar/contracts.ts`
- `lib/avatar/config.ts`
- `lib/avatar/validation.ts`
- `lib/avatar/validation.test.ts`
- `lib/avatar/state.ts`
- `lib/avatar/state.test.ts`
- `lib/avatar/target-registry.ts`
- `lib/avatar/target-registry.test.ts`
- `lib/avatar/sequence-runner.ts`
- `lib/avatar/sequence-runner.test.ts`
- `lib/avatar/site-actions.ts`
- `lib/avatar/site-actions.test.ts`

## Self-review

- The parser rejects unknown keys and unsupported values without discarding independently safe siblings in the same array.
- The target allowlist is derived from live project slugs rather than duplicated by hand.
- Reduced-motion adaptation preserves stable intent by converting `walkTo` into `lookAt` while dropping travel-only commands.
- The sequence runner aborts the prior wait before a later run can resume it, and the test proves the stale post-wait state never executes.
- The executor never touches selectors, URLs, or DOM queries; it only routes typed semantic actions through application-owned callbacks.

## Concerns

- `SiteActionExecutor` currently folds callback failures into `reason: "unsupported"` because the Task 1 contract only allows `missing_target | unsupported`. If later tasks need more runtime diagnostics, that result shape will need an approved extension.

## TDD evidence

### RED 1

Command:

```bash
npx vitest run lib/avatar/validation.test.ts
```

Output:

```text
FAIL  lib/avatar/validation.test.ts
Error: Cannot find module './validation'
```

### GREEN 1

Command:

```bash
npx vitest run lib/avatar/validation.test.ts
```

Output:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
```

### RED 2

Command:

```bash
npx vitest run lib/avatar/state.test.ts lib/avatar/target-registry.test.ts lib/avatar/sequence-runner.test.ts lib/avatar/site-actions.test.ts
```

Output:

```text
FAIL  lib/avatar/state.test.ts
FAIL  lib/avatar/target-registry.test.ts
FAIL  lib/avatar/sequence-runner.test.ts
FAIL  lib/avatar/site-actions.test.ts
Error: Cannot find module './state'
Error: Cannot find module './target-registry'
Error: Cannot find module './sequence-runner'
Error: Cannot find module './site-actions'
```

### GREEN 2

Command:

```bash
npx vitest run lib/avatar/*.test.ts
```

Output:

```text
Test Files  5 passed (5)
Tests      12 passed (12)
```

### Final proof

Command:

```bash
npm test
```

Output:

```text
Test Files  39 passed (39)
Tests      227 passed (227)
Duration   4.62s
```

## Fix Round 1

### Implementation summary

- Fixed `SiteActionExecutor` so callback presence is checked before argument binding. `openProject`, `activateTab`, `scrollTo`, and `spotlight` now correctly return `{ ok: false, reason: "unsupported" }` when the application did not provide the callback.
- Added coverage for every public site-action branch with missing callbacks, plus explicit checks for both public failure reasons: `unsupported` and `missing_target`.
- Added a throwing-callback test proving executor failures are swallowed and reported as `{ ok: false, reason: "unsupported" }`.

### Covering tests

- `reports unsupported when the application did not supply a callback for any action branch`
- `reports a missing target before trying to scroll when no registered element exists`
- `swallows callback failures and reports unsupported instead of throwing`

### Sequence-runner scope

No sequence-runner test was added in this round. Under the Task 1 contract, the no-throw guarantee applies to `SiteActionExecutor`, which now catches callback failures and returns a safe result. `AvatarSequenceRunner` remains a generic command runner and does not own the site-action safety contract, so adding a no-throw assertion there would test behavior outside this review finding.

### RED

Command:

```bash
npx vitest run lib/avatar/site-actions.test.ts
```

Output:

```text
FAIL  lib/avatar/site-actions.test.ts > site action executor > reports unsupported when the application did not supply a callback for any action branch
AssertionError: expected { ok: true } to deeply equal { ok: false, reason: 'unsupported' }
```

### GREEN

Command:

```bash
npx vitest run lib/avatar/site-actions.test.ts
```

Output:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
```

### Final proof

Command:

```bash
npm test
```

Output:

```text
Test Files  39 passed (39)
Tests      230 passed (230)
Duration   3.77s
```
