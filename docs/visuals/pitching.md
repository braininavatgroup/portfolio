# Pitching video

The public pitching recording ends at 2:40, before the later draft-send sequence.
The cutoff is baked into `public/visuals/campaign/pitch-pipeline-preview.mp4`,
so fullscreen playback, seeking, and downloading cannot expose the later footage.

The pitching visual uses that local file without a Mux playback ID. The previous
Mux stream ran 3:34.68 and must not be restored as an alternative unless its
replacement has the same approved cutoff and media treatment. The uncut local
MP4 is removed from `public/`.

The caption track contains only a note that the recording has no spoken dialogue,
so there are no timed cues extending past the cutoff.

`lib/portfolio-pitching-media.test.ts` reads the actual MP4 movie duration and checks
that the uncut public file and streaming alternative are absent.
