# The copy deck

The copy deck is a folder of clean Markdown notes, one per page of the
portfolio, that Bradley edits in Obsidian. Nothing parses the notes back. An
agent writes a fresh export, diffs Bradley's folder against it, and applies
the edits to `content/portfolio-content.json` by hand.

## Bradley's loop

1. Open `https://bradleyberkman.com/copy-deck` (unlisted). Locally it is
   `/copy-deck` on the dev server.
2. **Save into Obsidian vault** (Chrome or Edge) asks for a folder; pick the
   vault, or a folder inside it. The notes land in `Portfolio copy/` there,
   overwriting the previous export so Obsidian keeps the same notes between
   rounds. **Download folder (.zip)** is the fallback for any browser; unzip
   it into the vault.
3. Edit the notes. They read like the pages: a title, a bold opening
   sentence, paragraphs, and callouts for notes to self and visuals. Notes for
   the agent (cut this, add a paragraph here, swap the slide order) go in
   place, in Bradley's own words.
4. Give the folder, or just the notes touched, to an agent: *apply the copy
   deck edits*.

## The folder

```
Portfolio copy/
  Bradley Berkman.md              the home page
  Threads/<title>.md              the four essays
  Background/<name>.md            records, one folder per index group
  Solutions/<name>.md
  Products/<name>.md
  Site text.md                    contact rows, buttons, headings, small print,
                                  and text only the Guide chat sees
```

A record or thread note is `# Title`, then `**opening sentence**`, then the
body in authored order. A note to self (copy placeholder) is a `> [!note]`
callout whose first line is the prompt and whose bullets are the questions. A
visual is a `> [!info]` callout when ready or `> [!todo]` when planned: first
line the purpose, then the caption, then `Alt text:` and numbered slide lines
(`1. Title: caption`) when present.

`Site text.md` labels each string by where it shows. Its last section, *Guide
chat only*, holds each record's kind and each thread node's description and
body, which no visitor sees on screen.

## Agent workflow: applying a deck

1. Write the current export from the branch you are working on and diff:

   ```sh
   npm run copy-deck --silent -- /tmp/copy-deck-current
   diff -r /tmp/copy-deck-current "<Bradley's folder>"
   ```

   Everything in the diff is Bradley's edit or a note to you.
2. Map each changed line to a content path with the table below. Apply
   Bradley's words. Do not rewrite around them.
3. Structure notes (add, cut, move a paragraph; reorder slides) go through
   `lib/portfolio-structure.ts` and the content document together, as the
   writing brief describes.
4. Bump `revision` by one, then run `npm test` (the schema and parity tests
   guard the document) before opening the PR.

## Note layout to content path

`<id>` is the record or thread ID in `lib/portfolio-structure.ts`; find it
from the note title (the record's `label` or the thread's `title`). A thread's
own map node is the record `thread-<id>`.

| Note element | Content path |
| --- | --- |
| `# Title` of a record note | `records.<id>.label` |
| Bold line under the title | `records.<id>.summary` |
| Nth plain paragraph in the body | `records.<id>.paragraphs.pN`, counting paragraphs only, in structure body order |
| `> [!note]` first line / its bullets | `records.<id>.placeholders.<block>.prompt` / `.questions.qN` |
| `> [!info]` or `> [!todo]` first line / next line / `Alt text:` | `records.<id>.visuals.<block>.purpose` / `.caption` / `.alt` |
| Numbered slide line | `records.<id>.visuals.<block>.slides[N-1].title` and `.caption` (no schema path; edit the JSON directly) |
| `# Title` / bold line of a thread note | `threads.<id>.title` / `threads.<id>.lede`; body rows follow the record pattern under `threads.<id>` |
| Site text › Contact rows | `contact.email`, `contact.cvLabel`, `contact.socialLabels.<key>` |
| Site text › labelled rows | `interface.<key>`; `COPY_DECK_INTERFACE_LABELS` in `lib/portfolio-copy-deck.ts` maps each label to its key |
| Site text › Guide chat only › `Name: kind` rows | `records.<id>.kind` |
| Site text › Guide chat only › `### Thread` sections | `records.thread-<id>.summary`, then that record's body |

Every field except paragraphs and the three privacy paragraphs is single-line
in the schema; validation rejects a line break there. A paragraph keeps line
breaks, and a line starting with `- ` renders as a bullet.

`lib/portfolio-copy-deck.ts` renders the notes; `lib/portfolio-copy-deck.test.ts`
proves every editable string is present, the folder follows site order, and
no key or internal name leaks into a note. `lib/zip-store.ts` packs the
download.
