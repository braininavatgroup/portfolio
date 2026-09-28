# Feature map

Every route, record and interactive control a visitor can reach on
bradleyberkman.com and the hosts the same Worker serves, how they reach it, and
what proves it works. `npm run live` reads the tables below. First it checks
each row against this checkout and stops with `STALE` when a row names a file,
record, route or probe that no longer exists, or when a record, route file,
component sheet or probe exists that no row names. Then it drives every row
against production: `FAIL` means production answered wrong, `DOWN` means it
did not answer at all.

A row is `| Feature | Reached at | Source | Check |`. `Reached at` holds the
URL in backticks and, for a control, what the visitor does there. `Source` is
the file the row stands for: a route file, a public file, a worker module,
`content/portfolio-content.json#<record id>`, or a component sheet in
`docs/components/`. `Check` is one of:

- `page` (or `page "text"`): GET answers 200 with a `<title>` (and the text);
  a record row also needs its label from the content file in the HTML. Then
  headless Chromium loads the page and fails on any console error, page error,
  failed request or HTTP error.
- `status 404` (or `status 302 "text"`): GET answers that status, and the body
  (for a redirect, the `Location`) contains the text.
- `sitemap`: `/sitemap.xml` lists exactly the `page` rows on bradleyberkman.com.
- `probe <name>`: a visitor interaction in `scripts/live-probes.mjs`, run once
  in a fresh page at 1440x900 unless the probe sets its own size.
- `uncovered: reason`: reachable, but the live check does not drive it; the
  reason says why and what covers it instead.

Where the tables come from: the Records table is one row per record in
`content/portfolio-content.json`; the Routes table is one row per `page.tsx`
and `route.ts` under `app/` plus what `worker/` and `public/` serve; the
Controls table is at least one row per sheet in `docs/components/`. Add a
record, route or component and its row goes into this file in the same PR;
`tests/feature-map.test.ts` in `npm test` fails until it does.

Analytics beacons (the insight sink, Clarity, Cloudflare RUM) are answered
inside the check's browser, so a run never lands in Bradley's visitor data,
and nothing here sends the Guide a question.

## Routes

| Feature | Reached at | Source | Check |
|---|---|---|---|
| Home: the reading room | `https://bradleyberkman.com/` | `app/page.tsx` | `page "<title>Bradley Berkman"` |
| www serves the same site | `https://www.bradleyberkman.com/` | `app/page.tsx` | `status 200 "<title>Bradley Berkman"` |
| An unknown record is a 404 | `https://bradleyberkman.com/index/not-a-project` | `app/index/[id]/page.tsx` | `status 404` |
| Tour advancing demo, full page | `https://bradleyberkman.com/demos/touring` | `app/demos/touring/page.tsx` | `page "Tour advancing demo"` |
| Quarterly dashboard demo, full page | `https://bradleyberkman.com/demos/quarterly-dashboard` | `app/demos/quarterly-dashboard/page.tsx` | `page "Brokerage Pitch Conversion"` |
| Privacy notice | `https://bradleyberkman.com/privacy`, or Privacy at the foot of any Reader page | `app/privacy/page.tsx` | `page "Privacy"` |
| Design gallery stays off in production | `https://bradleyberkman.com/design` | `app/design/page.tsx` | `status 404` |
| Sitemap | `https://bradleyberkman.com/sitemap.xml` | `app/sitemap.xml/route.ts` | `sitemap` |
| robots.txt names the sitemap | `https://bradleyberkman.com/robots.txt` | `public/robots.txt` | `status 200 "Sitemap:"` |
| CV download | `https://bradleyberkman.com/cv/bradley-berkman-cv.pdf`, or Download CV under Contact | `public/cv/bradley-berkman-cv.pdf` | `status 200 "%PDF-"` |
| Link preview image | `https://bradleyberkman.com/sharing/home.png`, fetched by anything that unfurls a link | `scripts/build-sharing-images.ts` | `status 200 "PNG"` |
| Image optimizer | `https://bradleyberkman.com/_vinext/image?url=%2Fbiv-brain-symbol.png&w=64&q=75` | `worker/index.ts` | `status 200` |
| Guide session opens | `https://bradleyberkman.com/api/portfolio-chat/session`, fetched when the Guide mounts | `app/api/portfolio-chat/session/route.ts` | `status 200 "\"required\":true"` |
| Guide answer route is deployed (POST only) | `https://bradleyberkman.com/api/portfolio-chat` | `app/api/portfolio-chat/route.ts` | `status 405` |
| Insight beacon route is deployed (POST only) | `https://bradleyberkman.com/api/portfolio-insight` | `app/api/portfolio-insight/route.ts` | `status 405` |
| Reviewer feedback stays off in production | `https://bradleyberkman.com/_portfolio-feedback/notes` | `worker/portfolio-feedback.ts` | `status 404 "Feedback is not enabled"` |
| Feedback digest stays off in production | `https://bradleyberkman.com/_portfolio-feedback/admin/notes` | `worker/portfolio-feedback.ts` | `status 404 "Feedback is not enabled"` |
| Insights dashboard is behind Cloudflare Access | `https://insights.braininavat.dance/` | `worker/portfolio-insights-job.ts` | `status 302 ".cloudflareaccess.com/"` |
| Insights dashboard content | `https://insights.braininavat.dance/`, after Access sign-in | `scripts/verify-insights-dashboard.mjs` | `uncovered: Access-gated; the skill's insights lane renders the fixture dashboard and checks it in a browser` |

## Records

Each record opens at `/index/<id>`, from its Contents row, its Map node, a
Related row or an inline link in another record.

| Feature | Reached at | Source | Check |
|---|---|---|---|
| About Bradley | `https://bradleyberkman.com/index/bradley`, or the Bradley Berkman mast in Contents | `content/portfolio-content.json#bradley` | `page` |
| INFAMOUS PR | `https://bradleyberkman.com/index/infamous`, Contents > Background | `content/portfolio-content.json#infamous` | `page` |
| Music promotions agency | `https://bradleyberkman.com/index/music-practice`, Contents > Background | `content/portfolio-content.json#music-practice` | `page` |
| Systems and AI consultancy | `https://bradleyberkman.com/index/systems-consulting`, Contents > Background | `content/portfolio-content.json#systems-consulting` | `page` |
| Product studio | `https://bradleyberkman.com/index/product-studio`, Contents > Background | `content/portfolio-content.json#product-studio` | `page` |
| Campaign kickoff | `https://bradleyberkman.com/index/kickoff`, Contents > Solutions | `content/portfolio-content.json#kickoff` | `page` |
| Campaign pitching | `https://bradleyberkman.com/index/pitching`, Contents > Solutions | `content/portfolio-content.json#pitching` | `page` |
| Campaign reporting | `https://bradleyberkman.com/index/reporting`, Contents > Solutions | `content/portfolio-content.json#reporting` | `page` |
| Real-estate deal tracker | `https://bradleyberkman.com/index/real-estate`, Contents > Solutions | `content/portfolio-content.json#real-estate` | `page` |
| Tour advancing system | `https://bradleyberkman.com/index/touring`, Contents > Solutions | `content/portfolio-content.json#touring` | `page` |
| Dubs | `https://bradleyberkman.com/index/dubs`, Contents > Products | `content/portfolio-content.json#dubs` | `page` |
| Writ | `https://bradleyberkman.com/index/writ`, Contents > Products | `content/portfolio-content.json#writ` | `page` |
| Theme: Making Work Playable | `https://bradleyberkman.com/index/thread-making-work-playable`, Contents > Themes | `content/portfolio-content.json#thread-making-work-playable` | `page` |
| Theme: Philosophy | `https://bradleyberkman.com/index/thread-philosophy`, Contents > Themes | `content/portfolio-content.json#thread-philosophy` | `page` |

## Controls

| Feature | Reached at | Source | Check |
|---|---|---|---|
| Contents opens a record and a theme | `https://bradleyberkman.com/`, click Tour Advancing System, then Philosophy | `docs/components/PortfolioContents.md` | `probe contents-select` |
| The mast returns home | `https://bradleyberkman.com/index/writ`, click Bradley Berkman atop Contents | `docs/components/PortfolioContents.md` | `probe contents-home` |
| A Map node opens its record | `https://bradleyberkman.com/`, click the Dubs node | `docs/components/PortfolioWorld.md` | `probe map-select` |
| An inline link selects in place | `https://bradleyberkman.com/`, click INFAMOUS PR in the About text | `docs/components/PortfolioReader.md` | `probe reader-inline-link` |
| Contact links | `https://bradleyberkman.com/`, Contact at the foot of About | `docs/components/PortfolioReader.md` | `probe reader-contact` |
| Gallery viewer opens, counts and closes | `https://bradleyberkman.com/index/writ`, click a gallery figure, then Escape | `docs/components/PortfolioReader.md` | `probe reader-gallery-viewer` |
| Reader videos play inline | `https://bradleyberkman.com/index/kickoff`, scroll to the recording | `docs/components/PortfolioReader.md` | `probe reader-video` |
| Campaign report embed loads | `https://bradleyberkman.com/index/reporting`, scroll to the report | `docs/components/PortfolioReader.md` | `probe reader-report-embed` |
| Mac menu bar over Writ captures | `https://bradleyberkman.com/index/writ`, the gallery figures | `docs/components/MacMenuBar.md` | `probe mac-menu-bar` |
| Client carousel links show hover and focus | `https://bradleyberkman.com/#music-practice` and `#infamous`, hover or tab to a client | `docs/components/ReaderCarousel.md` | `probe carousel-links` |
| Back and forward follow selection | `https://bradleyberkman.com/`, open Writ, browser Back, Forward | `docs/components/PortfolioExperience.md` | `probe history` |
| Old hash links still open a record | `https://bradleyberkman.com/?view=graph#touring`, the demos' return links | `docs/components/PortfolioExperience.md` | `probe legacy-hash` |
| Panels resize by dragging | `https://bradleyberkman.com/` at 1020, 1280 and 1440px, drag each separator | `docs/components/PortfolioReadingRoom.md` | `probe reading-room-resize` |
| Contents hides and comes back | `https://bradleyberkman.com/`, Hide Contents, then Show Contents | `docs/components/PortfolioReadingRoom.md` | `probe reading-room-collapse` |
| Phone tabs switch views | `https://bradleyberkman.com/` at 390px, Map, Contents and Reader tabs | `docs/components/PortfolioReadingRoom.md` | `probe mobile-tabs` |
| Toolbar marks and actions stay aligned | `https://bradleyberkman.com/`, the pane bars | `docs/components/PortfolioNodeMark.md` | `probe toolbar-geometry` |
| Guide opens a session and takes a question | `https://bradleyberkman.com/`, the Guide pane: starters, type, Ask enables | `docs/components/PortfolioChat.md` | `probe guide-composer` |
| Guide answers a question | `https://bradleyberkman.com/`, send a question | `docs/components/PortfolioChat.md` | `uncovered: each answer is a paid model call and a stored transcript; components/PortfolioChat.test.tsx, tests/built-worker-chat.test.mjs and npm run eval:chat cover it` |
| Avatar renders and hides | `https://bradleyberkman.com/`, the Guide pane, Hide avatar, Show avatar | `docs/components/avatar/AvatarOverlay.md` | `probe avatar` |
| Avatar model loads | `https://bradleyberkman.com/`, the Guide pane | `docs/components/avatar/AvatarAssetAdapter.md` | `probe avatar` |
| Avatar stands in its pane | `https://bradleyberkman.com/`, the Guide pane | `docs/components/avatar/AvatarStageActor.md` | `probe avatar` |
| Avatar runtime starts | `https://bradleyberkman.com/`, the Guide pane | `docs/components/useAvatarStage.md` | `probe avatar` |
| A renderer failure stays contained | `https://bradleyberkman.com/` | `docs/components/avatar/AvatarBoundary.md` | `probe avatar` |
| Brain Food starts and ends | `https://bradleyberkman.com/`, Shift+G, then Escape | `docs/components/useBrainFoodSession.md` | `probe brain-food` |
| The site cursor follows and inverts | `https://bradleyberkman.com/`, move the pointer over a button | `docs/components/CursorInstrument.md` | `probe cursor` |
| Analytics start only on the public host | `https://bradleyberkman.com/`, any page load | `docs/components/PortfolioAnalytics.md` | `probe analytics-context` |
| Privacy opt-out and opt-in | `https://bradleyberkman.com/privacy`, Opt out, then Enable | `docs/components/PortfolioAnalytics.md` | `probe privacy-preference` |
| Reviewer notes | `https://bradleyberkman.com/?r=<code>`, Leave a note | `docs/components/PortfolioFeedback.md` | `uncovered: off in production (the Routes rows prove the 404); a note writes to the feedback ledger; worker/portfolio-feedback.test.ts and components/PortfolioFeedback.test.tsx cover it` |
| Tour demo: promoter saves, artist sees the day sheet | `https://bradleyberkman.com/demos/touring`, Open the promoter form, Save, Artist, Reset | `docs/components/TouringDemo.md` | `probe touring-demo` |
| Tour demo inside its record | `https://bradleyberkman.com/index/touring`, the embedded demo, Promoter | `docs/components/TouringDemo.md` | `probe touring-embed` |
| Quarterly dashboard: filter, drill down, CSV | `https://bradleyberkman.com/demos/quarterly-dashboard`, Quarter Q1, Pitch Detail, Download CSV | `docs/components/QuarterlyDashboard.md` | `probe quarterly-dashboard` |
| Quarterly dashboard inside its record | `https://bradleyberkman.com/index/real-estate`, the embedded dashboard, Quarter Q1 | `docs/components/QuarterlyDashboardPreview.md` | `probe quarterly-embed` |
