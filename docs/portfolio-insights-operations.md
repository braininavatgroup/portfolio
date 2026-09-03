# Portfolio insights operations

This runbook keeps the external visitor dataset useful without treating
Bradley's devices, preview reviews, campaign identities, or crawler requests
as visitor outcomes.

## Exclude a Bradley-controlled browser

Before using the public portfolio from a browser profile, open:

```text
https://bradleyberkman.com/?analytics=off
```

The page stores an analytics opt-out before Clarity can start and removes the
parameter from the address bar. Repeat this once for every browser profile and
device Bradley controls, and repeat it after clearing site storage. Private
browsing windows need their own enrollment each time because their storage is
temporary.

Verify the exclusion in browser developer tools:

1. The page URL no longer contains `analytics=off`.
2. The document contains no `script[data-portfolio-replay]` element.
3. The Network panel contains no request to `clarity.ms/tag` or a Clarity
   collection endpoint.
4. `/privacy` offers **Enable anonymous analytics**, which confirms the stored
   preference is denied.

Re-enabling analytics on `/privacy` changes the stored preference. It takes
effect on the next page load. The password-protected main preview is excluded
independently and should never load Clarity, regardless of the browser's
preference.

## Use opaque job-search links

Generate a random code that carries no human meaning, for example:

```sh
openssl rand -hex 8
```

Add it to a portfolio URL as `campaign=<code>`. The browser removes the
parameter from the visible URL, keeps it only for the current tab session, and
adds it to later portfolio insight signals. Never use a company name, person's
name, email address, job title, or recognizable abbreviation as the code.

Keep the mapping in the private opportunity tracker, outside this repository
and Clarity. A practical row contains:

- opaque campaign code;
- opportunity and recipient class;
- date and channel sent;
- eventual response, interview, offer, or closed outcome.

Clarity answers what an eligible visitor did. The private tracker answers
which outreach and job outcome that anonymous code represents. Do not add the
mapping or outcome to portfolio telemetry.

## Read the signals

Use Clarity for eligible human behavior: entries, content opens and their
selection source, active Reader time, maximum Reader completion, evidence
opens, Guide evidence navigation, and contact-action kinds. Treat Draw, Hold,
and Advance as working analysis lenses, not permanent product categories.

Use Cloudflare analytics for aggregate edge traffic, request geography,
status, bots, and crawler access. Cloudflare requests and Clarity sessions
have different eligibility and counting rules, so their totals are not
expected to match.

An AI crawler request proves only that a crawler accessed a URL. It does not
prove that an AI answer used or cited the portfolio. Citation evidence needs a
separate, reproducible answer check or citation monitor with its own approval,
data policy, and operating record. No such monitor is activated by this work.

## Activation boundary

Analytics fails closed. Clarity starts only when an eligible public document
has `data-portfolio-analytics-context="external"` on its root element. A
missing marker and the main preview's `preview` marker keep it dormant. Adding
the public `external` marker is a separate protected activation change; this
implementation does not deploy or activate it.
