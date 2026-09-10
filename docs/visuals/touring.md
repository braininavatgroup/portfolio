# Touring work sample

The Touring case study uses one working component in the Reader and at
`/demos/touring`. Bradley approved replacing its six screenshots with a guided,
editable experience on 8 September 2026.

The work sample follows the portfolio’s other evidence: product views and
working controls, no explanatory illustration or imitation Google chrome.
The fictional Maya Vale show comes from the consulting repository’s advancing
fixture. A visitor can supply one or both missing transport details, inspect
the narrower follow-up, then read the same answers in the artist’s day sheet.
Venue, set time and day-of contact are editable too. Calendar events use the
same record and link back to the current mounted day sheet.

`lib/touring-engine/provenance.json` pins the consulting source commit, file
hashes and limited compatibility edits. The actual registry, ownership filter,
status derivation, day-sheet projection, date formatter, chase-template merger,
and calendar planner are included. `demo.mjs` is the small local interaction
adapter; the React component is a guided presentation of those outputs.
No Google adapters, client stores or credentials are connected. The imported
submission helper shares a source module with token utilities; the demo never
calls token minting or resolution.
It does not demonstrate real Gmail thread delivery, Google Docs PDF export,
Calendar writes, or durable retry behavior. The prose distinguishes the demo
from those capabilities of the source tool.

The article uses a single restrained demo disclosure. No data is saved outside
component memory. Reset restores the fixture. Navigation between views keeps
answers; reopening the full-page route starts an independent show.

`public/visuals/touring/advance-demo.png` is a Chrome capture of the initial
working component, used only for the Touring inline-link hover. It was captured
at a 1400 × 840 viewport and 2× density, cropped to the show header and outstanding
work. It contains no fabricated UI or image-generation edits.

The six retired stills are recoverable from Git and from mumbai’s private
`.context/touring-capture-refresh/20260908T195305Z/originals/`, with matching hashes
in `manifest.json`. The source captures, viewport receipts and browser walkthrough
are in that run’s `candidates/` folder. The bratislava-v1 privacy-review session
has a coordination handoff identifying the changed scope.

No deployment or Google-account action was part of this change. Tests were
written for GitHub execution, following Bradley’s instruction not to run them
locally.
