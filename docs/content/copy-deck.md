# The copy deck

The copy deck is one Markdown document holding every piece of text on the
portfolio, once, in the order a visitor reads it. It is how Bradley edits copy:
export from the live site, edit in Google Docs or Obsidian, hand the edited
deck to an agent. Nothing parses the deck back. The agent reads the diff and
applies the edits by hand.

## Bradley's loop

1. Open `https://bradleyberkman.com/copy-deck` (unlisted; `/copy-deck.md` is
   the raw file). Locally it is `/copy-deck` on the dev server.
2. Pick a destination:
   - **New Google Doc** opens `docs.new` and copies the deck. Paste it in. With
     Tools › Preferences › *Enable Markdown* on, Google Docs turns the headings
     and `key` spans into real formatting. When done, File › Download ›
     Markdown gives the deck back with its keys intact.
   - **New Obsidian note** copies the deck and opens Obsidian with a new note
     from the clipboard, in the last-opened vault.
   - **Download** saves `portfolio-copy-deck-<date>.md`.
3. Edit the text under any `key` line. Keep the `key` lines and `## … · `id``
   headings; rewrite everything else. Notes for the agent (cut this, add a
   paragraph here, change the slide caption) go in place.
4. Give the deck, or just the sections touched, to an agent: *apply the copy
   deck edits*.

## What the deck contains, in order

| Group | Sections |
| --- | --- |
| About | The home record (`record:bradley`) |
| Threads | The four essays, each with its own map node under `node.*` keys |
| Operations, Music promotions systems, Client systems, In Production | Records in index order |
| Contact | Email, CV label, social labels |
| Interface strings | Buttons, headings, status lines, privacy page |

Each section carries context lines (`> …`) saying where the text appears. A
record's body follows the authored block order: paragraphs, copy placeholders
(prompt and questions), and visual text (purpose, caption, alt). Gallery slide
titles and captions appear as context only; the schema has no path for them.

## Agent workflow: applying a deck

1. Export the current deck from the branch you are working on:

   ```sh
   npm run copy-deck --silent > /tmp/copy-deck.current.md
   diff /tmp/copy-deck.current.md <edited-deck.md>
   ```

   The header date will differ; everything else in the diff is Bradley's edit
   or a note to you. If the deck came out of Google Docs, expect escaped
   punctuation (`\-`, `\[`) and `*` bullets; unescape and use `- ` bullets.
2. For each changed field, edit the value in `content/portfolio-content.json`
   at the path below. Apply Bradley's words. Do not rewrite around them.
3. Structure notes (add, cut, move a paragraph; slide text) go through
   `lib/portfolio-structure.ts` and the content document together, as the
   writing brief describes.
4. Bump `revision` by one, then run `npm test` (the schema and parity tests
   guard the document) before opening the PR.

## Key to content path

Inside `## … · `record:<id>``:

| Deck key | Content path |
| --- | --- |
| `label`, `kind`, `summary` | `records.<id>.label` / `.kind` / `.summary` |
| `p3` | `records.<id>.paragraphs.p3` |
| `placeholder.<block>.prompt` | `records.<id>.placeholders.<block>.prompt` |
| `placeholder.<block>.q2` | `records.<id>.placeholders.<block>.questions.q2` |
| `visual.<block>.purpose` (`caption`, `alt`) | `records.<id>.visuals.<block>.purpose` |

Inside `## … · `thread:<id>``: `title` and `lede` are `threads.<id>.title` and
`threads.<id>.lede`; body keys follow the record pattern under `threads.<id>`;
`node.*` keys are the thread's map node, `records.thread-<id>.*`.

`contact`: `email`, `cvLabel`, and `social.<key>` are `contact.email`,
`contact.cvLabel`, and `contact.socialLabels.<key>`. `interface`: every key is
`interface.<key>`.

Fields marked *(one line)* are single-line in the schema; a line break in the
deck becomes a space. Paragraph fields keep line breaks, and a line starting
with `- ` renders as a bullet.

`lib/portfolio-copy-deck.ts` renders the deck; `lib/portfolio-copy-deck.test.ts`
proves every editable string appears exactly once and in site order.
