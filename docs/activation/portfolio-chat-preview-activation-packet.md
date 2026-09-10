# Portfolio site-preview chat activation packet

Status: BIV-317 authorizes and records the bounded single-operator preview. Its
current live or contained state, immutable version IDs, artifact digest, smoke
evidence, and exact expiry are maintained on the Linear issue. This packet owns
the deployment and rollback procedure.

## Bound release

- Target Worker: `bradley-portfolio-preview`.
- Access boundary: the generated
  `bradley-portfolio-preview.<account-subdomain>.workers.dev` hostname returned
  by Wrangler. The URL is intentionally usable by anyone who obtains it.
- Routes: Workers.dev only. Do not add a custom domain, zone route, or public
  portfolio hostname.
- Operator: Bradley is the only intended visitor during this site preview.
- Window: seven days from the successful deployment timestamp, unless Bradley
  ends or extends it first. Record the exact expiry with the deployment proof.
- Artifact: check out the exact independently reviewed PR head after GitHub
  records that tree as merged to `main`, build it once, and record its commit and
  deterministic `dist/` digest before any upload.

## Runtime configuration

`wrangler.preview.jsonc` owns the non-secret release configuration:

| Setting | Value |
| --- | --- |
| `PORTFOLIO_CHAT_SESSION_REQUIRED` | `false` |
| `PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT` | `1000` |
| `OPENAI_PORTFOLIO_MODEL` | `gpt-5.6-sol` |
| `OPENAI_PORTFOLIO_REASONING_EFFORT` | `low` |
| `OPENAI_PORTFOLIO_VERBOSITY` | `low` |

The provider ceiling is 3,000 output tokens, shared between model reasoning and
the visible answer. Store `OPENAI_API_KEY` only as an encrypted Worker secret.
The site's Workers.dev boundary owns pre-launch access; chat has no access-code
endpoint, session cookie, or preview-attempt limiter. Do not configure
a chat session token, `PORTFOLIO_CHAT_IDENTIFIER_SECRET`, or a chat route limiter for this
single-operator Worker. Those public controls are a separate dormant launch
configuration and must be activated only through an independently reviewed
change. The OpenAI Agents SDK runner has one text agent, one model turn, no
tools or handoffs, no persistent session, response storage disabled, and tracing
disabled.

The config binds `PORTFOLIO_CHAT_BUDGET` to
`PortfolioChatBudgetObject` and provisions it with the `v1`
`new_sqlite_classes` migration. This UTC-day budget is the provider spend
boundary for the solo preview.

## Proof before deployment

Record all proof against one commit:

1. `npm test`, `npm run lint`, `npx tsc --noEmit`, and
   `npm run test:rendered` pass.
2. `tests/preview-worker-config.test.mjs` confirms Wrangler accepts the built
   Worker, the SQLite migration, the Workers.dev-only route, and the absence of
   secret or chat-specific preview configuration.
3. The deterministic offline evaluation passes.
4. Client and build artifacts contain none of the planted secret sentinels.
5. The exact-head pull request is approved, merged, and still matches the
   artifact selected for deployment. Record the commit and a sorted SHA-256
   digest of every file under `dist/` before the first upload.

Generate the build digest without changing the artifact:

```sh
find dist -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256
```

## Live smoke matrix

After deployment, record the hostname, Worker version, deployment timestamp,
seven-day expiry, and each result below:

| Check | Expected result |
| --- | --- |
| Page | Workers.dev root returns the portfolio without a custom-domain route |
| Direct chat | A grounded question streams through `/api/portfolio-chat` without a second chat-specific unlock flow |
| Removed route | The built application route table does not register `/api/portfolio-chat/preview` |
| Conversation | One follow-up uses at most six in-memory user and assistant messages; reload clears them |
| Budget | The Durable Object receives a limit of 1,000 and rejects exhaustion before provider construction |
| Provider failure | The route returns the redacted provider error contract without leaking upstream detail |
| Secret isolation | No key, prompt, answer, IP address, access token, or secret appears in client assets or structured telemetry |
| Configuration | The endpoint is always registered and a missing provider dependency returns the redacted configuration error before provider construction |

The budget exhaustion and provider-failure checks use deterministic local or
isolated test inputs. They do not consume the live 1,000-request allowance merely
to force failure states.

## Containment and rollback

The chat route has no deployment gate. Before replacing an existing release,
record its healthy Worker version ID as `STABLE_VERSION_ID`. The primary
containment action is an exact version rollback, which does not depend on the
state of the checkout or `dist/` at incident time:

```sh
npx wrangler rollback "$STABLE_VERSION_ID" \
  --config wrangler.preview.jsonc \
  --message "BIV-317 preview rollback" \
  --yes
```

Verify the known-good page and chat response after rollback. If there is no
healthy prior version and the hostname itself must stop serving, delete only the
dedicated Worker:

```sh
npx wrangler delete bradley-portfolio-preview \
  --config wrangler.preview.jsonc
```

Do not run `--force`. Record the contained or deleted state in BIV-317 before
closing the preview window.
