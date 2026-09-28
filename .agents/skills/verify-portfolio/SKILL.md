---
name: verify-portfolio
description: Verify every production portfolio route, record and interaction through the executable map and a real browser, without recording analytics or sending chat.
---

# Verify portfolio

Install the locked dependencies, then run from the repository root:

```bash
mkdir -p .context/verification
stamp=$(date -u +%Y%m%dT%H%M%SZ)
npm test 2>&1 | tee ".context/verification/portfolio-test-$stamp.txt"
npm run live 2>&1 | tee ".context/verification/portfolio-live-$stamp.txt"
```

The live command checks the running production version, walks `features/features.json`, opens every record and mapped page in Chromium, and exercises the reading-room interactions. Analytics requests are fulfilled locally and chat is never sent, so the run leaves no production data or local process behind. Browser ownership and cleanup live in `scripts/live.mjs`; its `finally` block closes Chromium.

Use `npm run live -- --map-only` to distinguish map drift from a product or browser failure. When a route, content record or interactive control changes, update both `features/README.md` and `features/features.json`; add executable interaction coverage to `scripts/live.mjs` when it can remain read-only.
