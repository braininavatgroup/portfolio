# Clip studio

A local tool that turns the avatar's animation clips into a short vertical
video for social posts. It is authoring tooling under `scripts/`, not an
application route, and nothing it produces is published by the portfolio build.

## First run on a new machine

The studio itself needs nothing but this repository: `npm run clip:studio`
serves the page, and the preview, the painted backgrounds, and play mode all
work straight away.

Two things are needed to write a video, and each is checked before any work
starts, so a missing one is named rather than found twenty seconds in:

```sh
brew install ffmpeg     # writes the MP4, and converts a recorded take
npm run clip:setup      # the browser the renderer steps frames through
```

`clip:setup` is only needed if the machine has no Playwright at all. The
renderer takes one from wherever it finds it — `PLAYWRIGHT_MODULE`, a
project-local install, the global one, or a copy npx has unpacked — and if that
package's own browser build is missing it falls back to the newest one already
in the shared cache.

The falling-map background plays a film from the music-promo repository; see
[Films](#films). Without it, every other background still works.

## Making a clip

```sh
npm run clip:render -- --spec portfolio-launch
```

That renders `scripts/clip-studio/specs/portfolio-launch.json` to
`.context/clips/<spec>-<timestamp>.mp4` at 1080×1920, 30fps, H.264 — the
Instagram Reels shape — and writes a matching `-poster.png` for the first frame.

Useful flags:

| Flag | Effect |
| --- | --- |
| `--spec <name>` | Which spec under `specs/` to render. Defaults to the first. |
| `--still <seconds>` | Render one PNG at that time instead of the video. Fast enough to iterate on wording and framing. |
| `--strip <seconds>` | Render a PNG every `<seconds>` across the whole clip, into one directory. One browser, many frames: the way to read how a clip actually moves without watching it. |
| `--out <path>` | Write somewhere other than `.context/clips`. |
| `--audio <file>` | Mux an audio track and cut it to the video's length. |
| `--open` | Open the finished file. |

A 20-second render is 600 frames and takes something like ten minutes, because
every frame is stepped and captured deterministically rather than recorded in
real time. `--still` and `--strip` answer most questions in seconds; leave the
video for when the clip is settled. A render in flight writes to a `.part.mp4`
and only takes its real name once ffmpeg has finished, so an interrupted render
never leaves a file that will not open.

Anything else on the machine competing for cores makes a render crawl — the
studio's own preview most of all. Pause the preview before rendering.

## Playing it yourself

```sh
npm run clip:studio
```

Then open `http://127.0.0.1:55090`. The page opens in **Play** mode, where you
drive the figure and record the take. Nothing but the scene is inside the frame
— no score, timer, or controls.

Two modes:

- **Brain Food** — the portfolio's game. The map's nodes are the food, and the
  figure swims after them under your hand.
- **Falling nodes** — the map rains past a figure floating in place. Drops carry
  a depth, so near ones are larger, faster, and pass in front of the figure
  while far ones drift behind it. Drops that leave the bottom return at the top,
  so a take never runs out.

Controls:

- Arrow keys or WASD move. Dragging on the frame steers toward the pointer.
- **Record** starts and stops a take; so does the space bar. The take is the
  canvas alone, so nothing in the page around it is captured. It is converted to
  1080×1920 H.264 at `.context/clips/take-<timestamp>.mp4`.
- Beside the frame: the mode, the clip, the figure's speed, node size, how many
  nodes fall, and whether nodes and their labels are drawn.
- **Hide nodes** takes a comma-separated list of record ids to keep out of a
  take. It starts at `infamous`.
- **Background** applies in both modes — kind, film, drift, and colour. A film
  plays on its own clock here rather than being seeked, and **drift** is its
  playback rate: 1 is the film's own pace, 2 runs it twice as fast, 0 holds it.
- The elapsed seconds and the count eaten (or falling) sit in the panel, outside
  the recording.

In the rain, the figure's attitude is yours to set rather than a preset:

- **Turn** points its length in the frame — 90° is head up — **Roll** turns it
  about that length (0 lies it on its back facing the camera), and **Tilt** tips
  it toward or away from the camera.
- Right-drag on the frame — or Shift with the left button — turns and tilts, the
  way a look control works anywhere else; the wheel rolls. `Z`/`X`, `Q`/`E`, and
  `R`/`F` do the same from the keyboard, held rather than tapped, with Shift for
  about twice the rate. **Face me** (`C`) points the figure at the camera.
- **Float** switches between the floating body and standing upright. Upright has
  no attitude to set, so the three controls grey out with it.

### Triggering animations

The **Animations** panel lists every clip in the model. Clicking one plays it
through once over the float and then returns to the **base clip**;
shift-clicking queues it behind whatever is running. `1`–`9` fire the first
nine, Shift queues, and `Esc` drops back to the base clip. Live playback
crossfades between clips rather than cutting, so a gesture can be dropped into a
take while it records.

The panel's settings — mode, clip, attitude, tumble — are kept in the browser,
so a reload picks up the take you had set up. Everything about the scene itself
lives in the spec, in the shared Scene and Background groups.

### The falling map

The rain is a volume, not a sheet. Each drop has a real position in depth,
spread from six units behind the figure to just in front of the camera, and it
creeps toward the camera as it falls; perspective then sets its size, and the
ones past the figure's own plane are painted over it. Four controls shape the
fall:

- **Camera drift** — a slow orbit, dolly, and roll under the framing, none of
  them in step with each other, so the frame moves around the figure instead of
  holding still. The map is projected through a camera parked on the shot's own
  framing, so the drift, the sway, and a beat's swing move the figure's camera
  only: the fall is weather being fallen through, not something on the lens.
- **Trails** — how far a fast near drop smears along its fall, behind it rather
  than ahead of it.
- **Camera sway** — a slow handheld drift.
- **Echo** — how much of the last frame is kept, pushed slightly outward under
  the new one. It turns the fall into a tunnel; past about 0.5 it smears.
- **Tumble** — a constant slow turn on all three attitude axes, underneath your
  keys, at rates that never resolve into a repeat.
- **Haze** — fades distant drops toward the paper, so depth reads through
  atmosphere rather than only through size.

Two things about turning a figure that has no ground under it. The swim's own
orientation folds at exactly head-up and head-down, which is why a floating
figure is rotated outright from turn, roll, and tilt rather than through a
heading. And of those three, **turn** is the only one that cannot hide the
figure's front: it rotates in the frame's own plane. Roll and tilt turn the
front away, and past a right angle they trade places with each other. A fall
that has to stay readable therefore tumbles on turn, and swings roll and tilt
rather than winding them on.

A swim clip rests prone, head toward the camera; a standing clip rests on its
feet, facing it. The same attitude needs a different base for each, so the
renderer picks one per clip and crosses between them with the animation — a
dance played inside a float would otherwise land face down where a swim lands
face up.

The nodes are the map's own: each record's family mark and register colour from
`lib/portfolio-structure.ts`, drawn at the portfolio's proportions. On a bright
film, switching the theme to `light` in the Scripted panel's Frame group gives
the labels dark ink, which reads better.

Because a take is captured live, it runs at whatever frame rate the machine
holds — usually 30fps in this scene. The scripted renderer below is the one to
use when an exact, repeatable clip matters.

## Scripted clips

Switch the panel to **Scripted**. It plays and scrubs a spec on the left, and
every value in the spec is a control on the right.

- **Shots** — the running order. Select one to edit it; add, duplicate, reorder,
  or delete it. Each shot has its clip, seconds, framing, transition, camera
  orbit and dolly, playback speed, where it starts inside the clip, and its text
  block.
- **Scene** and **Background** — the same controls Play mode uses; they sit
  above both panels and drive both, because they are the spec's own values.
- **Frame** — name, seconds, theme, size, frame rate, dip depth, watermark, and
  the brand mark.
- **Spec JSON** — the whole spec as text, for pasting one in or out.

The Shots header reads `5 · 17.0s of 20.0s`: what the shots add up to against
the clip's length. When they disagree a **Fit clip to shots** button appears,
which sets the length to the shots — the commonest way to wedge a spec is a
shot list that no longer fits, and only the last shot can be trimmed.

Every edit repaints the current frame immediately. An edit the renderer would
reject leaves the last good frame up and says why. **Save** writes the spec
file; **Render MP4** saves and then runs the same headless renderer the command
line uses, reporting frame progress as it goes.

Edits are kept in the browser as a working copy as you make them, so a reload
picks up an unsaved session rather than losing it. Save writes the file and
clears the copy. Play mode's own settings — its mode, clip, speed, and attitude
— are kept the same way.

Playing the timeline lets a film background run on its own clock; a parked or
scrubbed frame is seeked exactly, as every frame of a render is. Seeking a film
thirty times a second cannot keep up in real time, which is what used to make
the background stall a few seconds into playback.

Renaming a spec and saving writes a new file, which is how to keep a variant.
The page reads the same modules the renderer does, so what plays is what
exports. Set `PORTFOLIO_CLIP_PORT` to move it off 55090.

## Writing a spec

A spec is one JSON file per clip, named for its file. Shots run back to back in
order; the timeline is trimmed to `duration`, so a 15-second clip stays 15
seconds no matter how the shots are cut.

```json
{
  "name": "portfolio-launch",
  "duration": 15,
  "theme": "dark",
  "watermark": "bradleyberkman.com",
  "mark": true,
  "shots": [
    {
      "clip": "Wave_One_Hand",
      "duration": 3,
      "framing": "full",
      "orbit": [-14, -4],
      "text": { "kicker": "Portfolio", "title": "Bradley Berkman" }
    }
  ]
}
```

Spec fields: `name`, `width`, `height`, `fps`, `duration`, `theme`
(`dark` or `light`), `palette`, `background`, `rain`, `vignette`, `texture`,
`grain`, `dipDepth`, `echo`, `echoStyle`, `trails`, `sway`, `cameraDrift`,
`blend`, `hidden`, `watermark`, `mark`, `shots`.

`palette` overrides theme colours one key at a time, registers included:
`"palette": { "registers": { "identity": "#b6df5b" } }` recolours the map's
identity mark — the brand's brain — and leaves the rest of the palette alone.

`texture` is the overlay the finished frame carries: `none`, `grain` (still film
speckle), `flicker` (grain resampled about twelve times a second, which reads as
film rather than dirt on the lens), `scanlines`, or `dots`. `grain` is its
strength.

`echo` keeps a fraction of the last frame under the new one. `echoStyle` is
`fall`, which lifts it so a ghost trails above a falling mark, or `tunnel`,
which pushes it outward from the centre. Only the figure and the map echo; the
background stays crisp, because ghosting a film's hard edges reads as grey dirt
rather than as a trail.

`background` is `{ kind, speed, intensity, rules, glow, film }`. The kinds are
`aurora` (drifting pools of register colour, the default), `grid` (a floor
running to a horizon, scrolling toward the viewer), `rings` (contours breathing
out from behind the figure), `sweep` (bands of light crossing the frame),
`paper` (the flat token gradient), and `video`. `speed` scales the drift — `0`
holds it still — and `intensity` scales the colour, or a film's opacity against
the paper. `rules` draws the silverpoint grid over the top; `glow` is the soft
pool of accent light behind the figure.

### Films

`kind: "video"` plays a film behind the figure. `nmf-story` is the wave the
music-promo Instagram story workflow uses. The studio does not own it: it is
read from `~/Projects/music-promo/packages/nmf-story/background.mp4`, or from
`PORTFOLIO_CLIP_NMF_STORY`. That source is H.264, which a plain Chromium build
cannot decode, so the studio transcodes it to VP9 once into
`node_modules/.cache/clip-studio/films` — about half a minute, on first use
only. A render prepares the film up front; the editor waits on the same
conversion the first time you pick it.

Shot fields:

- `clip`: any animation baked into `public/avatars/bradley-quiet-portrait.glb`.
  `Idle`, `Wave_One_Hand`, `Agree_Gesture`, `Walking`, `Running`,
  `Full_Turn_Left`, the four swim clips, and eight dances.
- `duration`, `rate`, `offset`, `loop`: how much of the clip plays, how fast,
  and from where. Short clips loop inside a longer shot.
- `framing`: `full`, `wide`, `mid`, `closeup`, `hero`, or `swim`.
- `motion`: `stand` keeps the figure on its feet; `swim` hands it to the Brain
  Food chase; `float` puts it in the air, below. A standing shot cancels its
  clip's own horizontal travel — several dances walk across the floor and would
  otherwise leave the frame — while keeping the bounce.
- `place`: `{ from: [x, y], to: [x, y] }` — where the figure sits in the frame
  over the shot.
- `track`: the animations played inside this one shot, below.
- `beats`: moments where the camera and the figure come to attention, below.
- `orbit`: degrees around the figure, `[start, end]`, eased across the shot.
  Negative turns one way, positive the other; `0` faces the camera.
- `dolly`: distance multiplier, `[start, end]`. Below 1 moves in.
- `transition`: `cut`, or `dip` to fade through the background at the shot's
  start.
- `text`: `kicker`, `title`, `subtitle`, `place` (`lower`, `upper`, `center`),
  `align`, and `delay`. Each block fades in and out inside its own shot, over a
  scrim that keeps it legible against the figure. `lower` clears Instagram's
  caption and button area.

A spec that names a missing clip, an unknown framing, or a duration its shots
cannot reach is rejected up front, with the reason.

## One shot, several animations

A clip of one continuous scene is one shot with a **track**, not a list of
shots. The camera, the motion, and the scene run straight through; only the
animation hands over, exactly the way clicking one in the Animations panel does.

```json
"track": [
  { "at": 0, "clip": "Swim_Forward", "rate": 0.55 },
  { "at": 8.5, "clip": "All_Night_Dance", "rate": 0.8, "fade": 0.45, "offset": 2.6 },
  { "at": 15, "clip": "Swim_Forward", "rate": 0.5, "fade": 0.7 }
]
```

Each entry has `at`, `clip`, and optionally `fade`, `rate`, `offset`, and
`loop`. The track must start at 0. `offset` chooses which part of a long
animation plays — useful when a particular move should land under a beat.

Where a spec does use several shots, `blend` is how long each takes to cross
into the one before it: the outgoing shot keeps playing while its clip, place,
attitude, and camera all interpolate into the incoming one, so a boundary is a
move rather than a cut. A blend is not a dissolve, and `dip` is; for one
continuous scene, use one shot and leave `blend` at 0.

### Beats

A **beat** is a moment inside a shot where the camera and the figure come to
attention, and then let go again:

```json
"beats": [
  {
    "at": 13.1, "in": 1.2, "hold": 1.2, "out": 1.2,
    "orbit": 0, "sweep": 58, "dolly": 0.62,
    "turn": 90, "roll": 0, "tilt": 0,
    "place": [0, 1.8], "highlight": 0.5
  }
]
```

It eases in over `in`, holds, and releases over `out`. `sweep` swings the camera
out and lands it at `orbit` — square on — and only on the way in; swinging again
on the way out takes the camera off the figure just as it should be holding it.
`dolly` pushes in, `turn`, `roll`, and `tilt` square the figure up, `place`
centres it, and `highlight` steps the background back while the light on the
figure comes up. Everything underneath — the tumble, the fall, the drift —
carries on and comes back.

## The Brain Food swim

`motion: "swim"` gives a shot the game's movement and nothing else — no food,
no score, no controls. The figure chases a point, turns at the portfolio's own
2.2 radians a second, and loses speed while it turns, so hard changes of
direction read as banks. Pair it with a swim clip and the `swim` framing, which
holds the whole area it moves through:

```json
{
  "clip": "Swim_Forward",
  "duration": 15,
  "framing": "swim",
  "motion": "swim",
  "swimSpeed": 1,
  "seed": 7,
  "rate": 0.8
}
```

`seed` picks the chase: the same seed always swims the same path, and a
different one is a different take. `swimSpeed` scales how fast it moves, and
`offset` starts the shot part-way into a chase. The prone clip is turned about
the hips to face the way it is going, the way the portfolio's stage does it, and
the contact pool under the figure is dropped for the shot.

`scripts/clip-studio/specs/portfolio-swim.json` is a 15-second swim over the
`nmf-story` wave.

## Falling, scripted

A scripted spec films the same scene play mode plays, from the same values:
`rain`, `echo`, `echoStyle`, `trails`, `sway`, `cameraDrift`, and `hidden` are
the Scene group's controls. Play mode steps the rain frame by frame; a render
seeks, so `public/rain.mjs` gives the same fall as a pure function of time.

A shot with `motion: "float"` takes the figure off the chase and puts it in the
air:

```json
{
  "clip": "swimming_to_edge",
  "duration": 3.5,
  "framing": "swim",
  "motion": "float",
  "float": { "turn": [250, 90], "roll": [200, 0], "tilt": [120, 0], "spin": [1.6, 0] },
  "place": { "from": [-0.4, 1.1], "to": [0, 1.85] }
}
```

Each angle runs from its first value to its second across the shot, eased, and
`spin` scales a tumble on top of them — so a shot whose spin ends at 0 is one
that catches itself. The tumble is integrated exactly rather than sampled, so
seeking to a frame gives the angle playing to it would.

`rates` is how fast each axis tumbles at a spin of 1, in degrees a second, and
`wobble` is `{ roll, tilt, period }` — a swing on those two rather than a wind.
Together they are how a fall keeps its front to the camera: tumble on `turn`,
swing the other two.

```json
"float": {
  "turn": [178, 92], "roll": [0, 0], "tilt": [0, 0],
  "spin": [1, 0.9],
  "rates": { "turn": 38, "roll": 0, "tilt": 0 },
  "wobble": { "roll": 24, "tilt": 16, "period": 6.5 }
}
```

The contact pool under the figure is dropped whenever the fall is on or the
figure floats — nothing is standing on anything, and a pool of light under the
feet only reads as a halo.

`scripts/clip-studio/specs/portfolio-fall.json` is the 20-second fall: one shot,
one camera move, a track that goes swim → dance → swim, and a beat at 13.1s
where the camera swings round, holds him square to it, and lets go.

## Implementation and proof

- `scripts/clip-studio/public/rain.mjs`: the falling map as a pure function of
  time, so a render's seek gives what play mode's steps give.
- `scripts/clip-studio/public/swim.mjs`: the scripted Brain Food chase,
  integrated from zero at a fixed step so a scrub and an export agree.
- `scripts/clip-studio/public/game.mjs`: the played game — steering, the map's
  layout, and the rain.
- `scripts/clip-studio/public/live.mjs`: play mode — the loop, the input, and
  the recorder.
- `scripts/clip-studio/public/marks.mjs`: the map's node marks, ported from
  `lib/portfolio-node-mark.ts`. `marks-parity.test.ts` compares the two under
  vitest, so a change to the map's marks fails rather than drifting.
- `scripts/clip-studio/films.mjs`: film sources, the transcode, and the cache.
- `scripts/clip-studio/public/spec.mjs`: the spec model — defaults, validation,
  timeline resolution, framings, themes, and the fade and dip curves. Pure, and
  shared by the page and the renderer.
- `scripts/clip-studio/public/studio.mjs`: the frame renderer. Three.js draws
  the figure over a painted, animated background; type, scrim, contact pool,
  vignette, grain, and watermark are composited in 2D onto one canvas.
- `scripts/clip-studio/public/app.mjs`, `index.html`, `studio.css`: the editor —
  control definitions, the live draft, save, and render. It also exposes
  `window.clipStudio` for the headless renderer.
- `scripts/clip-studio/server.mjs`: loopback server for the page, the specs, the
  model, Three.js, and the cached brand fonts. It validates a spec before writing
  it and owns the one-at-a-time render job.
- `scripts/clip-studio/fonts.mjs`: one-time download of the two Neue Haas faces
  into `node_modules/.cache/clip-studio/fonts`. Without a network the renderer
  falls back to the system stack.
- `scripts/clip-studio/tools.mjs`: what the studio needs from the machine —
  ffmpeg, Playwright, a browser — and the message for each when it is absent.
- `scripts/clip-studio/render.mjs`: the checked-in managed runner. One headless
  browser per invocation, an ephemeral context, artifacts scoped to
  `.context/clips`, frames piped straight to ffmpeg.
- `scripts/clip-studio/spec.test.mjs`: timeline arithmetic, trimming, rejected
  specs, background defaults, fade and dip curves, the swim's determinism,
  bounds, and chasing, every checked-in spec, the save round trip and what it
  refuses, and the server's routes and path handling.
  `npm run test:clip-studio`.

The renderer steps time rather than following a clock: `renderFrame(t)` is a
function of `t` alone, and the grain tile is seeded, so the preview, a rerender,
and the export agree frame for frame. Software-rendered WebGL is deterministic
smoke evidence; final feel belongs in a walk.

ffmpeg and a Playwright install are prerequisites; see
[First run on a new machine](#first-run-on-a-new-machine).
`scripts/clip-studio/tools.mjs` holds those checks and what to say when one
fails.
