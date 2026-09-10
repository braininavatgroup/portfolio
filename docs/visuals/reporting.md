# Reporting visual sources

The reporting case study is text-led. Bradley's opening paragraph is preserved
verbatim. The remaining prose explains the service's rules, what Songstats,
Gmail, and SubmitHub contribute, campaign/placement matching, duplicate evidence,
model interpretation, human review, and how results inform future pitching.

The authentic n8n workflow is shown openly after the verification paragraph.
There is no explanatory graphic or disclosure. Its caption identifies it as a
result-maintenance workflow with activation disabled, not a captured matching
run. The final paragraph is followed by a shallow screenshot of three Gmail
report drafts across three campaigns. The interactive report remains last.

Workflow metadata lives in `reporting-workflow`; the drafts have the
`reporting-email` visual. The drafts screenshot is a native Chrome DevTools capture of Gmail at a
1400 × 840 desktop viewport and device pixel ratio 2, producing a 2800 × 1680
PNG. It replaces the earlier 1× capture without changing the inline text size. CSS crops it to
just the three draft rows, excluding the toolbar and result count. Both workflow
and drafts open full screenshots in the Reader overlay. The drafts screenshot has
Bradley's selected sidebar labels and campaign subject prefixes pixelated; its
private original remains in the local redaction studio library. The drafts
image reserves its original 1400:840 proportions before loading, so Safari can
detect its intersection with the cropped viewport and request the lazy image.

Bradley's final screenshot shows three existing drafts, after the three extra
capture drafts were moved to Trash. Preparing the capture used the real report
generator with existing results for three current campaigns, addressed to Bradley.
No messages were sent, no Airtable records were written, and no dashboards
were changed. The private source snapshot, render previews, immutable creation
artifact, exact draft IDs, and verified cleanup receipt are in
`.context/reporting-drafts-capture/`.

The rejected diagram source is archived
privately in `.context/retired-reporting-diagram/`, and the pixelated inbox
capture remains in `.context/reporting-retired-captures/`.

Implementation references in music-promo: `automations/songstats/songstats-correlate.js`
for track-plus-playlist matching and pitch-claim checks, and
`automations/batch-email-feedback/batch-email-feedback.js` for interpretation,
identity resolution, deduplication, outcome protection, and review routing.
The prose explains the process; the workflow screenshot supplies supporting evidence.

| Asset | Source | Capture treatment |
| --- | --- | --- |
| `reporting-dashboard.png` | Published MAMA SAY report, retrieved September 8, 2026 | Authentic overview capture used only on origins where embedding is unavailable. |
| `reporting-result-workflow.png` | Bradley's supplied `.context/attachments/2omujb/image.png` | Original bytes; empty canvas cropped inline with CSS. |
| `reporting-drafts-2x.png` | Gmail, captured with Chrome DevTools on September 8, 2026 | Native 2× capture with selected labels and subject prefixes pixelated; three-row list cropped inline with CSS. |

The earlier n8n and Airtable captures are no longer public assets or page
content. They remain recoverable in `.context/reporting-retired-captures/`,
with original provenance in `.context/reporting-authentic/`.

The fallback dashboard capture shows 40 placements across seven platforms and
831.7K combined playlist followers. It is a historical capture; the live report
continues to update. The earlier single-email screenshot is retained privately
in `.context/reporting-retired-captures/`.

The live report is embedded on `https://bradleyberkman.com`,
`https://www.bradleyberkman.com`, and `http://localhost:55050` in a 1,280px-tall
Reader frame. Its full content remains available through native scrolling and
the report's own controls. The iframe permits downloads and print dialogs for
the native CSV and PDF buttons, while retaining the sandbox's top-level
navigation restrictions. Its native scrollbars use the report's light theme;
an opaque white backing prevents transparent scrollbar gutters from exposing
the dark Reader underneath. Other preview origins show the authentic dashboard
capture and the full-report link.

The report host's Worker applies `Content-Security-Policy: frame-ancestors`
with those three exact origins only to the MAMA SAY report. Other reports retain
`X-Frame-Options: DENY`. Bradley approved the public origins and then the exact
localhost preview on September 8, 2026. The deployed Worker version is
`042092f0-0f52-459f-be57-25265d278bf8`. The localhost activation packet and
verification receipt are in `.context/reporting-embed/localhost-activation/`.
The five-line source change belongs in music-promo's
`apps/campaign-reports/src/worker.mjs`; its regression tests live in
`apps/campaign-reports/test/worker.test.mjs`.

The activation changed only the Worker version. Verification confirmed the
report manifest, report content, R2 binding, and four existing secrets were
preserved. No report import, release-pointer write, route change, or pipeline
execution was part of activation. The source patch, activation receipt, and
rollback version are saved in `.context/reporting-embed/`, with the source
checkout in `.context/report-host-worktree/`. These source edits await normal
repository review; the portfolio itself has not been published.

The report response used for the dashboard capture has SHA-256
`a00f44d66381324b919c3390f373eaeb856e8dc7e969ef8d11b822669a665e6e`.
The browser rendered that saved response at the report's original origin so its
real CSS, fonts, and scripts resolved normally. Capture requests were restricted
to GET and HEAD. The dashboard was captured at a device scale factor of 2.

Private originals, message metadata, capture code, and retrieval provenance stay
in `.context/reporting-authentic/`. They are not site assets. The three capture drafts used the approved report
generator, without running the collection pipeline or changing campaign records.
No email was sent and the portfolio has not been published. Read and capture
access, draft creation, and the single-report framing exception were explicitly
approved in the portfolio session.
