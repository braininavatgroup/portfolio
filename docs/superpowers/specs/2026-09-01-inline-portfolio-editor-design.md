# Inline portfolio editor design

Date: 1 September 2026

Status: approved direction, pending implementation review

## Purpose

Add a local writing mode to the public portfolio. Bradley can open the running
site, click any static text he can see, edit it in place, and have the result
saved and committed to the current Conductor writing branch. Authoring happens
on the page itself. The portfolio chat is not an authoring interface.

The copy currently rendered from `lib/portfolio-world.ts` and the current
component literals is the canonical edited version. The content migration must
preserve every visible value. A parity test will compare the migrated content
with the pre-migration fixture so the editor cannot silently restore older copy
or rewrite punctuation.

## Scope

Writing mode covers every static user-facing string on the public portfolio
routes and in their reachable states:

- record labels, kinds, summaries, principles, and prose paragraphs;
- copy-placeholder prompts and questions;
- thread titles, ledes, and prose paragraphs;
- contact labels and values that are part of the visible portfolio;
- text inside visual records, including purpose, alt text, captions, and
  controls when present;
- map mast, map hint, canvas-drawn node labels, reader headings, navigation,
  footer links, button labels, empty states, and status messages;
- the static labels, prompts, and status copy inside the portfolio chat,
  without using chat to perform edits;
- the privacy page and any other public route linked from the main portfolio;
- text in the public avatar and toybox states when those states are visible.

The design and component galleries, director console, test fixtures, screen
reader-only descriptions, the editor's own local status UI, generated chat
answers, visitor-entered text, provider errors, and browser or third-party UI
are outside the writing catalog. The editor also does not change IDs, slugs,
relationships, registers, families, map positions, URLs, visual status, or
other structural fields.

The editor is a local development tool. It will not exist in a production
bundle, deployment, preview Worker, or public API.

## Source of truth

Create `content/portfolio-content.json` as the canonical store for editable
text. Its top-level sections separate authored records and threads from a
stable interface-string catalog. Keep structural records, relationships,
positions, and visual metadata in TypeScript. A small content adapter combines
the validated JSON with those structures and exports the same
`portfolioWorldNodes`, `portfolioThreads`, and contact values that current
callers use. Components read their static interface labels from the same
catalog.

Each editable value has a stable path based on an existing record, thread,
route, component, or state ID, never an array index. Paragraphs and placeholder
questions receive stable content IDs during migration so later reordering does
not redirect an edit to the wrong sentence.

Validation runs before application startup and before every write. It rejects:

- unknown record, thread, block, or field IDs;
- structural fields in an edit request;
- non-string values, malformed collections, and values over documented size
  limits;
- content documents missing any required live record or thread;
- edits based on an old document revision.

The content adapter retains the current public data contracts, which keeps the
reader, map, chat grounding, legacy redirects, and tests on one content source.

## Editing experience

Writing mode activates only when both conditions are true:

1. the application is running in Vite development mode;
2. the URL contains `?edit=1`.

Normal local browsing remains read-only. In writing mode, editable elements
use their existing typography and layout. A narrow outline appears on hover or
focus using the existing semantic ink and rule tokens. There is no second
panel or floating editor because the accepted design allows chat as the only
temporary floating surface.

Clicking DOM text places the caret in the rendered element. In writing mode,
the text inside a link or button edits instead of activating the control. Exit
writing mode or open a read-only tab to exercise normal navigation and actions.

Canvas-drawn map labels cannot host a browser caret. Clicking one in writing
mode opens a single plain-text input at the label's screen position. The input
reuses the map label's typography and disappears on save or cancel. It is an
editing control, not another persistent panel or navigation layer.

Plain text and line breaks are supported where the content type allows them.
Single-line fields strip line breaks. Rich-text markup, pasted HTML, and
arbitrary DOM changes are stripped. Escape restores the last saved value for
the active field. Undo and redo use the browser's native editing history while
the field remains active.

The editor session keeps in-memory text overrides keyed by stable content path.
Every visible instance reads those overrides. Editing a record label in the
dossier therefore updates its map label, index row, and related links before
the save completes.

A small status line inside the dossier footer reports `Editing`, `Saving`,
`Saved`, `Committed <short hash>`, or a specific failure. It does not animate
or introduce a new color. The page remains usable while a save is pending.

## Save flow

The client keeps one draft per active field and sends a save after 900
milliseconds without input or immediately on blur. A save request contains:

- the stable content path;
- the plain-text value;
- the content document revision last observed by the client;
- the editor session token issued by the local development server.

The local server validates the request, applies it to the latest document,
writes a temporary sibling file, and renames it over
`content/portfolio-content.json`. The atomic rename prevents a partial JSON
file if the process stops mid-write.

The response returns the new document revision and save state. If the revision
is stale, the server returns a conflict without overwriting either version.
The client leaves the draft visible, marks it as conflicted, and offers retry
after reload. It never resolves competing prose automatically.

Writing the content file must not trigger a page reload or steal the caret.
The Vite plugin suppresses hot-update propagation for this one file while an
editor session is active. Reloading the page reads the newly saved content.

## Local server and Git boundary

A focused Vite development plugin owns the write endpoint. It runs in the
local Node process that already starts the Vite server, so the Cloudflare
Worker application and production route graph receive no filesystem or Git
capability.

At development-server startup, the plugin records:

- the repository root resolved by Git;
- the current branch name;
- the content file's absolute path;
- a random editor session token.

The plugin enables writes only when the branch is named and is not `main` or
`master`. Every request rechecks that HEAD remains on the startup branch and
that the content path stays inside the repository root. It accepts requests
only from the running development server's origin with the session token.
The editor obtains that token from a same-origin development-only session
endpoint after the page loads. Production builds omit both endpoints and the
client that calls them.

After a successful atomic save, the plugin schedules a content-only commit
after two seconds without another save. Later saves reset that timer. The
commit includes only `content/portfolio-content.json`, uses the configured bot
identity, runs repository hooks, and uses the message `content: update
portfolio copy`. It does not stage, commit, reset, or clean any other path.

The response distinguishes a durable file save from a Git commit. If Git
cannot commit, the content remains saved in the working tree and the UI shows
the Git error. The plugin never pushes, opens a pull request, deploys, or
changes branch.

On shutdown, the plugin attempts one bounded commit flush if saved content is
still uncommitted. The content file remains recoverable from the working tree
if that flush fails.

## Repository cleanup

Delete only:

`/.superpowers/sdd/2026-08-25-embodied-portfolio-agent/`

The directory contains one orphaned task report added by the old avatar pull
request. No live code or documentation references it. The cleanup does not
remove the still-referenced material under `docs/superpowers/`; broader
planning-artifact cleanup is a separate task.

## Components

### Content schema and adapter

Owns the JSON document types, runtime validation, stable content paths, and
conversion into the existing world and thread exports. It has no browser,
filesystem, or Git dependency.

### Editable text component

Owns `contentEditable` behavior, plain-text normalization, keyboard handling,
draft state, and accessible edit semantics. It receives a stable content path
and renders as the semantic HTML element chosen by its caller.

### Canvas label editor

Owns map-label hit testing, the anchored single-line input, live canvas draft
updates, Enter and blur save, and Escape restore. It changes no node geometry
or map interaction outside writing mode.

### Editor session client

Owns debouncing, revision tracking, request cancellation, retry state, and the
shared save status. It is compiled only for development and becomes inert
unless `?edit=1` is present.

### Vite writing plugin

Owns the local endpoint, token and origin checks, schema validation, atomic
writes, branch guards, content-only commits, and shutdown flushing. It is not
imported by application or Worker code.

## Error handling

- Invalid content paths and payloads return `400` and do not touch disk.
- Missing or invalid editor authorization returns `403`.
- A detached, protected, or changed branch returns `409`.
- A stale content revision returns `409` with the current revision.
- An atomic-write failure returns `500` and preserves the previous file.
- A commit failure returns a successful save with `commit: failed` and the
  Git error safe for local display.
- A network failure leaves the draft in place and retries only after another
  input, blur, or explicit retry. It never discards the visible draft.

## Verification

Durable tests will cover:

- migrated content parity against the current authored copy;
- content schema acceptance and rejection;
- stable-path updates and stale-revision conflicts;
- atomic-write preservation on failure;
- branch, origin, token, and repository-path guards;
- content-only Git staging and commits in a temporary repository containing
  unrelated staged and unstaged changes;
- debounce, blur save, Escape restore, plain-text paste, and save-state UI;
- direct editing for static text inside links and buttons without activating
  their normal actions;
- canvas-label editing and immediate synchronization across duplicate visible
  instances;
- unchanged rendering outside writing mode;
- no editor code or write route in the production build;
- existing portfolio, grounding, rendered-route, type, lint, and build checks.

Browser verification attaches to the existing Conductor workspace server. It
will exercise the editor at 1440 by 900 and 390 by 844 in light and dark mode.
The test will edit a temporary worktree fixture rather than Bradley's canonical
copy, verify the resulting content-only commit, and restore no files because
the fixture is disposable.

## Acceptance criteria

- Opening `/?edit=1` in the local Conductor run makes every static visible
  string on the public portfolio directly editable without using chat or
  changing the normal visual composition.
- A completed edit survives reload and appears as a content-only commit on the
  branch that started the development server.
- Existing copy is unchanged immediately after migration.
- Normal local mode and every production build remain read-only.
- Unrelated worktree changes are never staged, committed, reset, or cleaned.
- Conflicting edits fail visibly instead of overwriting newer prose.
- The orphaned `.superpowers/sdd/2026-08-25-embodied-portfolio-agent`
  directory is absent.
