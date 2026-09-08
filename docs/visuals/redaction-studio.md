# Portfolio redaction studio

The studio is a local tool for ongoing media review. Open it from any checkout:

```sh
npm run media:studio
```

The server prints its URL. The default is http://127.0.0.1:55080, or the workspace's
`CONDUCTOR_PORT`. `PORTFOLIO_STUDIO_PORT` overrides either. It runs one small Node
process; opening it does not start a site build, encoder, simulator, or playback.
Stop it with Ctrl-C. Only one studio or catalog scan may open a library at once.

## Your saved work

On this Mac, selections, revision backups, and original media live in:

```text
~/Library/Application Support/portfolio-redaction-studio/
```

On other platforms the default is `~/.local/share/portfolio-redaction-studio/`.
Set `PORTFOLIO_STUDIO_DATA_DIR` to use another private library or a test fixture.
Back up the entire folder with your normal Mac backup. Exported selections contain
coordinates and fingerprints, not the original media. Both are needed to recover
an editing project. The library stays outside Git and the public website.

The September 8 project was migrated with its existing asset IDs, selections,
review flags, and revisions intact. Each original is stored by its SHA-256 hash.
Replacing a published image or video cannot replace the original being reviewed.
The studio checks that fingerprint before serving media or accepting selections.

## Make another pass

1. Pick a screenshot or video, then draw a box over the content to hide.
2. Choose Blur, Pixelate, or Solid and set its strength or color.
3. Name the target. For moving content, choose **Same target here** at another
   checkpoint and adjust its box. Marking every frame is unnecessary.
4. Set the asset to **Apply my selections**. **Keep unchanged** and **Defer** leave
   its saved boxes inactive. Review flags help organize a pass; they are not proof
   that every frame has been checked.
5. Export `portfolio-redaction-selections.json` and give it to the finishing agent.
   Changes also autosave locally, with older revisions in `backups/`.
6. Review the rendered result before publishing it. The studio itself never uploads
   media or publishes selections.

A follow-content target previews only at its marked checkpoints. A finishing pass
must follow the selected content through scrolling, movement, occlusion, and later
appearances. A fixed-area target holds its box within its chosen start/end interval.
Strength is measured in source pixels; coordinates use the entire original frame.
Do not infer additional private content or expand the selected scope automatically.

Import accepts only matching source fingerprints. A second tab with an older
revision cannot overwrite newer saves. If a crash leaves `library.lock`, inspect
its PID and confirm that process has stopped before removing that one stale file.

## New or replaced media

Stop the studio, then run:

```sh
npm run media:scan
npm run media:studio
```

The scan needs `ffprobe` for video metadata. It reads the ready portfolio visuals
and hover previews from the current checkout, snapshots new source bytes, and
retains existing sources and selections. Changed footage receives a new asset ID;
old timestamps must not be silently transferred onto a reshoot. Touring and Dubs
start deferred. The catalog includes historical originals so existing selections
remain editable after a site update.

After publishing a render, the finishing agent records it in the private
`publications.json` array. Each entry has `sourceHash`, `src` for the published
URL path, and `sha256` for the published bytes. A scan then recognizes those bytes
as a treated version of an existing original instead of adding a second source.
A later reshoot with a different fingerprint is still added normally.

Finishing scripts, plans, and checks for this pass are retained privately under
`finishing/2026-09-08/`. Generic studio code is in `scripts/media-studio/`.
The `/review/` route can serve the local rendered-review files in `review/`.

## Published campaign media

Kickoff and pitching use baked redactions in local MP4s, without an untreated Mux
alternative. Pitching ends at 2:40; the later draft-send sequence is absent from
its downloadable file. The kickoff poster, pitching poster, and reporting drafts
screenshot have the matching selected treatments. The new kickoff dropdown uses
blur strength 6 during its visible and scrolling appearances.

The reporting live report and its fallback cover remain the separately approved,
named campaign example. This pass does not anonymize the entire reporting page.
Touring and Dubs are outside this delivery.

Run `npm run test:media-studio` for model, immutable-source, catalog, save-conflict,
local-access, and range-request checks. The public pitching cutoff is tested in
`lib/portfolio-pitching-media.test.ts` against the actual MP4 header.
