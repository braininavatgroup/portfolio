# Portfolio content writing session

This session produces the real content for Bradley's portfolio, ending in one
PR to `main`. The structure is in place; nothing here is about building.

## How this session works

Bradley writes; the agent is the writing partner. The agent's jobs:

- Interview and drill: ask the questions that surface what each piece should
  say (what was the call, what did it produce, how does it run).
- Propose outlines and orderings for Bradley to react to.
- Edit Bradley's drafts — tighten, cut, challenge — and wire his words into
  the content files.

The agent does **not** draft the pieces. If a file is about to receive prose
Bradley didn't say or write, stop and ask instead.

## The content model

A **node** is a dot on the map. Opening one reads one of two content types:

- A **record** — the short piece for one thing, readable in the map reader.
- A **Thread** — a narrated path through the map; the only long-form type.

A record says what a thing is; a Thread says why things belong together.
Nothing else exists. All authored content lives in `lib/portfolio-world.ts`;
chat-only facts live in `lib/portfolio-private-grounding.ts` and are never
rendered. Bodies may interleave authored paragraphs, Bradley-owned copy
placeholders, and planned visual blocks. These workbench blocks intentionally
render on `main`; `?review=clean` hides them for a clean reading pass. Agents
may refine the placeholder brief or ask its questions, but must not silently
replace a Bradley-owned copy placeholder with invented portfolio prose.

## What to produce

1. **13 records** — every non-About node in `portfolioWorldNodes`: `summary`
   (one sentence), optional `principle` (a pull-quote; keepers like "Taste is
   encodable. The approval step stays human." already exist), and `body`
   paragraphs.
2. **The Bradley/About record** — a short bio paragraph (careful; the map and
   chat already carry the detail), real LinkedIn/GitHub/Instagram URLs in
   `portfolioContact`, and the CV file at `public/cv/bradley-berkman-cv.pdf`
   (the link exists and 404s until the file lands).
3. **3 Threads as serialized essays** — expand each `lede`/`body` into a real
   piece. Working claims, all revisable (retitle, re-member, merge to two, or
   add a consulting thread if the material asks):
   - *Choosing what not to automate* → the operations story: one campaign
     walked end-to-end (kickoff → pitching → reporting); where automation
     stops and taste stays should emerge from the walk.
   - *Making work playable* → the In Production story: what the human's hands are
     holding (dubs, writ, yoohoo, personal-os). Complement, not
     overlap: one thread is what you keep, the other is how you hold it.
   - *Finding myself in software* → a real chronological arc with curated
     stops (~6–8 nodes), not all 12.
   A useful lens: each thread answers a question a visitor arrives with
   ("how would this person run my operation?" / "can they build?" /
   "who is this?").
4. **Visual composition** — keep planned visuals inline with the prose as
   structured visual blocks. Each placeholder states what the visitor should
   understand, a likely treatment, and the source status. Visual work can
   proceed in parallel with copy; remove, move, or revise a block when the
   argument changes.
5. **Chat-only grounding** (`lib/portfolio-private-grounding.ts`) — review the
   audience statement and career timeline, then decide what else the bot
   should know that the site shouldn't show: rates/availability posture, names
   it may say aloud, FAQ answers, deflection rules. Add them to `privateFacts`.

## Honesty

Never invent counts, outcomes, screenshots, client claims, or proof. If a
piece leans on material that doesn't exist yet, say so in the prose or leave
it out. `README.md` ("Evidence policy") lists the known missing inputs.

## Before the PR

- Run an `unslop` pass on all prose.
- One drift sweep: no stale duplicates, no orphaned routes or dead links, no
  leftover placeholder URLs; chat grounding reads correctly
  (`lib/portfolio-grounding.test.ts` guards the shape).
- `npm test`, `npm run lint`, `npm run build`, `npm run test:rendered`.
- Open one PR to `main` with the finished content, linked to a Linear issue
  per repo convention (`Fixes BIV-n` / `Refs BIV-n`).
