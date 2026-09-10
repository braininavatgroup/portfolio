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
- Apply an edited copy deck when Bradley brings one; `docs/content/copy-deck.md`
  is the procedure.

The agent does **not** draft the pieces. If a file is about to receive prose
Bradley didn't say or write, stop and ask instead.

## The content model

A **node** is a dot on the map. Opening one reads one of two content types:

- A **record** — the short piece for one thing, readable in the map reader.
- A **Thread** — a narrated path through the map; the only long-form type.

A record says what a thing is; a Thread says why things belong together.
Nothing else exists. All authored text lives in `content/portfolio-content.json`;
`lib/portfolio-structure.ts` owns the current IDs, relationships, positions,
and block order; and `lib/portfolio-world.ts` validates and combines them.
Chat-only facts live in `lib/portfolio-private-grounding.ts` and are never
rendered. Bodies may interleave authored paragraphs, Bradley-owned copy
placeholders, and planned visual blocks. A paragraph may link a phrase to
another record or Thread inline as `[phrase](record:<id>)` or
`[phrase](thread:<id>)`; the id must exist in the structure or the content
document fails validation, and the assistant sees the plain phrase. An outside
address is `[phrase](https://…)`, opened in a new tab; the assistant sees the
phrase and the address. Lines beginning with `- ` inside a paragraph render as
a bulleted list. These workbench blocks intentionally
render on `main`; `?review=clean` hides them for a clean reading pass. Agents
may refine the placeholder brief or ask its questions, but must not silently
replace a Bradley-owned copy placeholder with invented portfolio prose.

## What to produce

1. **11 records** — every non-About, non-Why node in `portfolioWorldNodes`: `summary`
   (one sentence) and `body` paragraphs. Records have no principle field; the
   pull-quotes were retired on 2026-09-02.
2. **The Bradley/About record** — a short bio paragraph (careful; the map and
   chat already carry the detail), real LinkedIn/GitHub/Instagram URLs in
   `portfolioContact`, and the CV file at `public/cv/bradley-berkman-cv.pdf`
   (the link exists and 404s until the file lands).
3. **2 Themes as serialized essays** — expand each `lede`/`body` into a real
   piece. The current structural contracts are:
   - *Making work playable* → kickoff, pitching, reporting, real estate,
     touring, Dubs, and Writ.
   - *Philosophy* → pitching, reporting, real estate, touring, and Writ; it
     also carries the "From argument to instrument" arc as a second note.
   A useful lens: each thread answers a question a visitor arrives with
   ("how would this person run my operation?" / "can they build?" /
   "who is this?").
4. **Visual composition** — keep planned visuals inline with the prose as
   structured visual blocks. Each placeholder states what the visitor should
   understand, a likely treatment, the source status, and one of three media
   formats: image, video, or gallery. The reader block is the entry point, not
   the final viewing surface: clicking it opens the visual at useful scale in
   the map pane (and switches a phone or tablet into the map view). Ready image
   and gallery assets use `src`; a ready video uses `src` and `captionsSrc`,
   and may supply a `poster`. Visual work can proceed in
   parallel with copy; remove, move, or revise a block when the argument
   changes.
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
