# Public launch checklist

Status: pending. Owner: the agent assigned the public-launch change.

Read this when preparing to publish the portfolio, remove the preview login,
or enable public analytics. Finish the copy pass first. This checklist records
the launch work; it does not authorize deployment or changes to live controls.

## Finish the current copy pass

- [x] Integrate Reporting commit `e0808f7` with the reviewed copy, preserving
  the four-week reporting comparison. Reporting’s hover uses its dashboard capture.
  Reconcile any later Reporting changes before the final combined review.
- [x] Replace the six Touring screenshots with the approved interactive demo
  from `f535106`; use its capture for the hover preview. Include the demo and
  capture in the artifact review below.
- [ ] Bradley reviews every artifact that will be publicly accessible,
  including screenshots, videos, PDFs, downloads, and interactive demos.
  Redact sensitive information from the underlying files and demo data,
  including client details, contact information, financial information, and
  credentials. Check thumbnails, captions, metadata, and linked files too.
  Bradley signs off on the final redacted versions before launch.
- [ ] Run the required GitHub checks against the combined PR head and complete
  Bradley's final visual walk.

## Prepare the public-launch change

- [ ] Repair Clarity's saved opt-in handling. When an eligible page starts
  Clarity, forward an explicitly saved `granted` preference to the consent API.
  Preserve preview exclusion and the behavior for absent or denied consent.
  GitHub must prove: opt out, enable on an excluded page, reload, and forward
  the saved consent. Sources: `components/PortfolioAnalytics.tsx` and
  `lib/portfolio-analytics.ts`.
- [ ] Prepare public access. The current domain uses
  `PORTFOLIO_MAIN_PREVIEW_PASSWORD_REQUIRED=true` in
  `wrangler.main-preview.jsonc`. The public candidate must serve the portfolio
  and `/privacy` without a preview cookie or login redirect. Remove the
  preview-only search exclusion from public portfolio pages; retain deliberate
  exclusions for private/supporting routes. Verify public chat protections
  still work after removing the preview password boundary.
- [ ] Prepare public analytics. Eligible public HTML must carry
  `data-portfolio-analytics-context="external"`. Keep local development and
  private previews excluded, and preserve personal browser opt-outs. Check
  Clarity's actual consent/cookie settings against the reviewed Privacy notice.
  See [insights operations](../portfolio-insights-operations.md).

## Activate and verify

- [ ] Obtain Bradley's explicit approval for the tested launch artifact,
  target, control changes, and rollback under the workspace's production
  authority rules. Merge approval alone does not activate public access or
  tracking.
- [ ] After the approved deployment, inspect the actual domain while signed
  out: no portfolio login redirect, no preview-only search exclusion, and the
  reviewed Privacy page is accessible.
- [ ] Verify Clarity on that deployed artifact: eligible public visits behave
  according to consent, opted-out browsers do not load the tag after reload,
  re-enabling survives reload, and chat text remains masked in replay.

Mark each item complete with its PR/check or observation. Do not mark the
launch complete while any item is unchecked. Record the deployed commit and
verification evidence in the launch PR.
