# Portfolio content writing session

You are writing the real content for Bradley's portfolio. All structure is in
place; this session is writing only, and it ends in one PR to `main` with the
finished content.

## The content model

Two content types exist. A **node** is a mini-study: the complete piece for one
thing, a few hundred words, readable in the reader panel and at `/index/<id>`.
A **thread** is a narrated path through nodes: the only long-form type. A node
says what a thing is; a thread says why things belong together. Nothing else
exists.

All authored content lives in `lib/portfolio-world.ts`. Chat-only facts live in
`lib/portfolio-private-grounding.ts` and are never rendered in the UI. The
current node bodies and thread ledes are migrated placeholders — treat every
word as replaceable.

## What to write

1. **13 node mini-studies** — every non-About node in `portfolioWorldNodes`.
   Each gets a `summary` (one sentence), optional `principle` (a pull-quote —
   the existing ones like "Taste is encodable. The approval step stays human."
   are keepers), `body` paragraphs (the actual piece), and an honest
   `evidence` list.
2. **The Bradley/About record** — a short bio paragraph (careful, no résumé
   dump; the map and chat already carry the detail), confirm the contact block:
   real LinkedIn/GitHub/Instagram URLs in `portfolioContact`, and drop the CV
   file at `public/cv/bradley-berkman-cv.pdf` (the link exists and 404s until
   the file lands).
3. **3 threads as serialized essays** — expand each `lede`/`body` from two
   paragraphs into a real piece. Working claims, all revisable (retitle,
   re-member, merge to two, or add a consulting thread if the material asks):
   - *Choosing what not to automate* → the operations story: one campaign
     walked end-to-end (kickoff → pitching → reporting); where automation
     stops and taste stays should emerge from the walk.
   - *Making work playable* → the products story: what the human's hands are
     holding (dubs, writ, yoohoo, alarm, personal-os). Complement, not
     overlap: thread 2 is what you keep, thread 1 is how you hold it.
   - *Finding myself in software* → a real chronological arc with curated
     stops (~6–8 nodes), not all 13.
   A useful lens: each thread should answer a question a visitor arrives with
   ("how would this person run my operation?" / "can they build?" /
   "who is this?").
4. **Chat-only grounding** (`lib/portfolio-private-grounding.ts`) — review the
   audience statement and career timeline, then decide what else the bot
   should know that the site shouldn't show: rates/availability posture, names
   it may say aloud, FAQ answers, deflection rules. Add them to
   `privateFacts`.

## Per mini-study (suggested, not required)

A checklist, not a template — the page renders prose, not sections. Feel free
to revise or discard it:

- What was the judgment call?
- What did it produce?
- How does it run (and who else could run it)?

## Evidence

Mark every item `available` / `partial` / `needed` honestly — the labels
render, and honesty is the feature. `README.md` ("Evidence policy") lists the
known missing inputs. Never invent counts, outcomes, screenshots, or proof.

## Before the PR

- Run an `unslop` pass on all prose.
- One drift sweep: no stale duplicates, no orphaned routes or dead links, no
  leftover placeholder URLs, chat grounding reads correctly
  (`lib/portfolio-grounding.test.ts` guards the shape).
- `npm test`, `npm run lint`, `npm run build`, `npm run test:rendered`.
- Open one PR to `main` with the finished content.
