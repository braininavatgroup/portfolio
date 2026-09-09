/**
 * Clip spec model. Pure module, shared by the browser renderer, the preview
 * server, and the headless MP4 renderer. No DOM and no Node APIs.
 */

/** Clips baked into public/avatars/bradley-quiet-portrait.glb. */
export const clipNames = [
  "Idle",
  "Full_Turn_Left",
  "Swim_Forward",
  "Swim_Idle",
  "Walking",
  "Running",
  "BackLeft_run",
  "swimming_to_edge",
  "All_Night_Dance",
  "Cardio_Dance",
  "Denim_Pop_Dance",
  "Funny_Dancing_02",
  "Funny_Dancing_03",
  "Not_Your_Mom",
  "Step_Hip_Hop_Dance",
  "Jazz_Dance",
  "Agree_Gesture",
  "Wave_One_Hand",
];

/**
 * Camera framings against a figure standing with its feet at y = 0 and about
 * 1.8 world units tall. `position` and `target` are metres in that space.
 */
export const framings = {
  full: { position: [0, 1.3, 4.5], target: [0, 0.75, 0], fov: 34 },
  wide: { position: [0, 1.45, 5.8], target: [0, 0.8, 0], fov: 34 },
  mid: { position: [0, 1.35, 2.9], target: [0, 1.05, 0], fov: 32 },
  closeup: { position: [0, 1.55, 1.7], target: [0, 1.42, 0], fov: 30 },
  hero: { position: [0, 0.55, 3.4], target: [0, 1.0, 0], fov: 38 },
  /** Holds the whole area a swimming figure moves through. */
  swim: { position: [0, 1.85, 6.2], target: [0, 1.85, 0], fov: 40 },
};

/**
 * Backgrounds are painted in 2D as a function of the frame's time, so they
 * animate without touching the figure's scene or the frame's determinism.
 */
export const backgroundKinds = ["paper", "aurora", "grid", "rings", "sweep", "video"];

/**
 * Films the studio can play behind the figure. `nmf-story` is the wave the
 * music-promo Instagram story workflow uses, read from its own repository.
 */
export const backgroundFilms = ["nmf-story"];

/** Overlays laid on the finished frame. `grain` is the still film speckle. */
export const textureKinds = ["none", "grain", "flicker", "scanlines", "dots"];

export const defaultBackground = {
  kind: "aurora",
  /** Multiplies the drift; 0 holds a still frame. */
  speed: 1,
  /** Multiplies the colour strength. */
  intensity: 1,
  /** The silverpoint rule grid over the background. */
  rules: false,
  /** The soft pool of accent light behind the figure. */
  glow: true,
  /** Which film the "video" kind plays. */
  film: "nmf-story",
  /**
   * How much of the last film frame is carried forward. A slow drift holds each
   * of the film's own frames for several of ours, which steps; this dissolves
   * between them instead.
   */
  smoothing: 0.4,
};

export const themes = {
  dark: {
    top: "#211c18",
    bottom: "#19140f",
    ink: "#f0e6dc",
    muted: "#a69c92",
    accent: "#b6df5b",
    grid: "rgba(240, 230, 220, 0.05)",
    shadow: 0.16,
    /** Register colours the moving backgrounds draw with. */
    /** The portfolio's registers, dark-mode values, keyed as the map keys them. */
    registers: {
      identity: "#f0e6dc",
      story: "#ff554a",
      arc: "#ff554a",
      warm: "#ff84d0",
      bridge: "#aaa0ff",
      cool: "#62c6df",
    },
    /** The contact pool lightens dark paper and darkens light paper. */
    pool: "255, 255, 255",
    /** Cuts a label out against any background, however bright. */
    labelOutline: "rgba(25, 20, 15, 0.92)",
  },
  light: {
    top: "#d2d7db",
    bottom: "#c5cbd0",
    ink: "#201711",
    muted: "#62676b",
    accent: "#4d1fc5",
    grid: "rgba(32, 23, 17, 0.05)",
    shadow: 0.3,
    registers: {
      identity: "#201711",
      story: "#d7191c",
      arc: "#d7191c",
      warm: "#d0007e",
      bridge: "#4d1fc5",
      cool: "#006e91",
    },
    pool: "0, 0, 0",
    labelOutline: "rgba(239, 241, 241, 0.92)",
  },
};

const defaultShot = {
  clip: "Idle",
  duration: 3,
  framing: "full",
  /** Degrees of orbit around the figure: [start, end]. 0 faces the camera. */
  orbit: [0, 0],
  /** Multiplies the framing's distance from the target: [start, end]. */
  dolly: [1, 1],
  /** Playback rate for the shot's clip. */
  rate: 1,
  /** Seconds into the clip at the shot's first frame. */
  offset: 0,
  loop: true,
  /**
   * "stand" keeps the figure on its feet at the frame's centre. "swim" hands it
   * to the Brain Food chase, which owns its position and heading.
   */
  motion: "stand",
  /** A floating shot's attitude and tumble; see `resolveFloat`. */
  float: null,
  /** Where the figure sits in the frame, from the shot's start to its end. */
  place: null,
  /** Multiplies the swim's speed. */
  swimSpeed: 1,
  /** Chooses which chase a swim shot runs; the same seed gives the same path. */
  seed: 7,
  /**
   * Animations played inside this one shot, in order: `[{ at, clip, fade,
   * rate, offset, loop }]`. Each hands off to the next the way clicking one in
   * the studio's animation panel does — a short fade, with nothing else in the
   * frame changing.
   */
  track: null,
  /**
   * Moments inside the shot where the camera and the figure come to attention —
   * `[{ at, in, hold, out, dolly, orbit, turn, roll, tilt, place, highlight }]`.
   * The shot's own camera and float carry on underneath; a beat eases over the
   * top of them and releases back.
   */
  beats: [],
  /** "cut" starts hard; "dip" fades through the background at the boundary. */
  transition: "cut",
  text: null,
};

const defaultText = {
  kicker: null,
  title: null,
  subtitle: null,
  /** "lower" keeps clear of Instagram's UI; "upper" sits above the figure. */
  place: "lower",
  align: "left",
  /** Seconds after the shot's start before the text appears. */
  delay: 0.2,
};

/** The falling map, and the treatment it is filmed with, across a whole clip. */
export const defaultRain = {
  enabled: false,
  count: 24,
  speed: 1,
  scale: 2,
  labels: false,
  fog: 0.09,
  seed: 5,
};

export const defaultSpec = {
  name: "clip",
  width: 1080,
  height: 1920,
  fps: 30,
  /** Total seconds. Trims or extends the last shot to match exactly. */
  duration: 15,
  theme: "dark",
  /** Overrides individual theme values. */
  palette: {},
  background: {},
  vignette: 0.28,
  /** How dark a "dip" transition goes. 1 is a full frame of paper. */
  dipDepth: 0.85,
  /** Which overlay the frame carries; `grain` is its strength. */
  texture: "grain",
  grain: 0.035,
  watermark: null,
  mark: false,
  rain: {},
  /** How much of the last frame trails under the new one, and which way. */
  echo: 0,
  echoStyle: "fall",
  /** A slow orbit, dolly, and roll under every shot's own framing. */
  cameraDrift: 0,
  /** Seconds a shot takes to cross into the one before it, rather than cut. */
  blend: 0.6,
  /** How far a fast near drop smears along its fall. */
  trails: 0.35,
  /** A slow handheld drift on the camera, in world units. */
  sway: 0,
  /** Record ids the rain leaves out. */
  hidden: [],
  shots: [],
};

class SpecError extends Error {}


function fail(message) {
  throw new SpecError(message);
}

function number(value, label, { min = -Infinity, max = Infinity } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value))
    fail(`${label} must be a finite number`);
  if (value < min || value > max) fail(`${label} must be between ${min} and ${max}`);
  return value;
}

function pair(value, label) {
  if (!Array.isArray(value) || value.length !== 2)
    fail(`${label} must be a two-number array`);
  return [number(value[0], `${label}[0]`), number(value[1], `${label}[1]`)];
}

function resolveBackground(raw) {
  if (raw === null || raw === undefined) return { ...defaultBackground };
  if (typeof raw !== "object" || Array.isArray(raw)) fail("background must be an object");
  const background = { ...defaultBackground, ...raw };
  if (!backgroundKinds.includes(background.kind))
    fail(`background.kind must be one of ${backgroundKinds.join(", ")}`);
  number(background.speed, "background.speed", { min: 0, max: 4 });
  number(background.intensity, "background.intensity", { min: 0, max: 2 });
  number(background.smoothing, "background.smoothing", { min: 0, max: 0.95 });
  if (!backgroundFilms.includes(background.film))
    fail(`background.film must be one of ${backgroundFilms.join(", ")}`);
  for (const key of ["rules", "glow"])
    if (typeof background[key] !== "boolean") fail(`background.${key} must be true or false`);
  return background;
}

function resolveRain(raw) {
  if (raw === null || raw === undefined) return { ...defaultRain };
  if (typeof raw !== "object" || Array.isArray(raw)) fail("rain must be an object");
  const rain = { ...defaultRain, ...raw };
  if (typeof rain.enabled !== "boolean") fail("rain.enabled must be true or false");
  if (typeof rain.labels !== "boolean") fail("rain.labels must be true or false");
  number(rain.count, "rain.count", { min: 0, max: 200 });
  number(rain.speed, "rain.speed", { min: 0, max: 6 });
  number(rain.scale, "rain.scale", { min: 0.2, max: 6 });
  number(rain.fog, "rain.fog", { min: 0, max: 1 });
  number(rain.seed, "rain.seed", { min: 0, max: 2 ** 31 });
  return rain;
}

/**
 * A floating shot's attitude: each angle runs from its first value to its
 * second across the shot, with `spin` scaling a constant tumble on top. A shot
 * that ends at spin 0 is one that catches itself.
 */
function resolveFloat(raw, label) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) fail(`${label} must be an object`);
  const float = {
    turn: [90, 90],
    roll: [0, 0],
    tilt: [0, 0],
    spin: [1, 1],
    /**
     * Degrees a second each axis tumbles at a spin of 1. Rolling is what turns
     * the figure's front away from the camera, so a scene that wants the face
     * readable turns that rate down and leaves the others.
     */
    rates: { turn: 34, roll: 62, tilt: 21 },
    /**
     * A sway on top of the tumble: roll and tilt swing by these degrees over
     * `period` seconds instead of winding on for ever. It gives a fall its
     * life without turning the figure's front away from the camera.
     */
    wobble: { roll: 0, tilt: 0, period: 6 },
    ...raw,
  };
  for (const key of ["turn", "roll", "tilt", "spin"])
    float[key] = pair(float[key], `${label}.${key}`);
  float.rates = { turn: 34, roll: 62, tilt: 21, ...float.rates };
  for (const axis of ["turn", "roll", "tilt"])
    number(float.rates[axis], `${label}.rates.${axis}`, { min: -360, max: 360 });
  float.wobble = { roll: 0, tilt: 0, period: 6, ...float.wobble };
  number(float.wobble.roll, `${label}.wobble.roll`, { min: -180, max: 180 });
  number(float.wobble.tilt, `${label}.wobble.tilt`, { min: -180, max: 180 });
  number(float.wobble.period, `${label}.wobble.period`, { min: 0.5, max: 60 });
  return float;
}

/** Where a shot moves the figure to, in the frame's own units. */
function resolvePlace(raw, label) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) fail(`${label} must be an object`);
  const place = { from: [0, 1.85], to: [0, 1.85], ...raw };
  place.from = pair(place.from, `${label}.from`);
  place.to = pair(place.to, `${label}.to`);
  return place;
}

function resolveBeats(raw, label) {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) fail(`${label} must be an array`);
  return raw.map((entry, index) => {
    const beat = {
      at: 0,
      in: 1,
      hold: 1,
      out: 1,
      dolly: 1,
      orbit: 0,
      /** Degrees the camera swings out and back on its way to `orbit`. */
      sweep: 0,
      turn: 90,
      roll: 0,
      tilt: 90,
      place: [0, 1.85],
      /** Dims the background and lifts the light on the figure. */
      highlight: 0.5,
      ...entry,
    };
    for (const key of ["at", "in", "hold", "out"])
      number(beat[key], `${label}[${index}].${key}`, { min: 0, max: 60 });
    for (const key of ["dolly", "orbit", "sweep", "turn", "roll", "tilt", "highlight"])
      number(beat[key], `${label}[${index}].${key}`, { min: -720, max: 720 });
    number(beat.highlight, `${label}[${index}].highlight`, { min: 0, max: 1 });
    beat.place = pair(beat.place, `${label}[${index}].place`);
    return beat;
  });
}

function resolveTrack(raw, label, shot) {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw) || raw.length === 0) fail(`${label} must be a non-empty array`);
  const track = raw
    .map((entry, index) => {
      const item = { at: 0, fade: 0.3, rate: shot.rate, offset: 0, loop: true, ...entry };
      if (!clipNames.includes(item.clip))
        fail(`${label}[${index}].clip "${item.clip}" is not a clip in the avatar model`);
      number(item.at, `${label}[${index}].at`, { min: 0, max: 180 });
      number(item.fade, `${label}[${index}].fade`, { min: 0, max: 4 });
      number(item.rate, `${label}[${index}].rate`, { min: 0.05, max: 4 });
      number(item.offset, `${label}[${index}].offset`, { min: 0, max: 60 });
      if (typeof item.loop !== "boolean") fail(`${label}[${index}].loop must be true or false`);
      return item;
    })
    .sort((a, b) => a.at - b.at);
  if (track[0].at > 0) fail(`${label} must start at 0`);
  return track;
}

function resolveText(raw, label) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) fail(`${label} must be an object`);
  const text = { ...defaultText, ...raw };
  for (const key of ["kicker", "title", "subtitle"])
    if (text[key] !== null && typeof text[key] !== "string")
      fail(`${label}.${key} must be a string or null`);
  if (!["lower", "upper", "center"].includes(text.place))
    fail(`${label}.place must be lower, upper, or center`);
  if (!["left", "center"].includes(text.align))
    fail(`${label}.align must be left or center`);
  number(text.delay, `${label}.delay`, { min: 0 });
  if (!text.kicker && !text.title && !text.subtitle) return null;
  return text;
}

function resolveShot(raw, index) {
  const label = `shots[${index}]`;
  if (typeof raw !== "object" || raw === null) fail(`${label} must be an object`);
  const shot = { ...defaultShot, ...raw };
  if (!clipNames.includes(shot.clip))
    fail(`${label}.clip "${shot.clip}" is not a clip in the avatar model`);
  if (typeof shot.framing !== "string" || !framings[shot.framing])
    fail(
      `${label}.framing must be one of ${Object.keys(framings).join(", ")}; ` +
        `received ${JSON.stringify(shot.framing)}`,
    );
  number(shot.duration, `${label}.duration`, { min: 0.2, max: 60 });
  number(shot.rate, `${label}.rate`, { min: 0.05, max: 4 });
  number(shot.offset, `${label}.offset`, { min: 0 });
  shot.orbit = pair(shot.orbit, `${label}.orbit`);
  shot.dolly = pair(shot.dolly, `${label}.dolly`);
  if (typeof shot.loop !== "boolean") fail(`${label}.loop must be true or false`);
  if (!["cut", "dip"].includes(shot.transition))
    fail(`${label}.transition must be cut or dip`);
  if (!["stand", "swim", "float"].includes(shot.motion))
    fail(`${label}.motion must be stand, swim, or float`);
  shot.track = resolveTrack(shot.track, `${label}.track`, shot);
  shot.beats = resolveBeats(shot.beats, `${label}.beats`);
  shot.float = resolveFloat(shot.float, `${label}.float`);
  shot.place = resolvePlace(shot.place, `${label}.place`);
  if (shot.motion === "float" && !shot.float) shot.float = resolveFloat({}, `${label}.float`);
  number(shot.swimSpeed, `${label}.swimSpeed`, { min: 0.1, max: 4 });
  number(shot.seed, `${label}.seed`, { min: 0, max: 2 ** 31 });
  shot.text = resolveText(shot.text, `${label}.text`);
  return shot;
}

/**
 * Normalizes a spec: fills defaults, validates, computes shot start times, and
 * fits the timeline to `duration` by trimming or extending the last shot. The
 * result is what both renderers read; it never mutates the input.
 */
export function resolveSpec(raw) {
  if (typeof raw !== "object" || raw === null) fail("spec must be an object");
  const spec = { ...defaultSpec, ...raw };
  if (typeof spec.name !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(spec.name))
    fail("name must be lowercase letters, digits, and hyphens");
  number(spec.width, "width", { min: 64, max: 4096 });
  number(spec.height, "height", { min: 64, max: 4096 });
  number(spec.fps, "fps", { min: 1, max: 60 });
  number(spec.duration, "duration", { min: 1, max: 180 });
  number(spec.vignette, "vignette", { min: 0, max: 1 });
  spec.background = resolveBackground(spec.background);
  spec.rain = resolveRain(spec.rain);
  number(spec.echo, "echo", { min: 0, max: 0.95 });
  number(spec.cameraDrift, "cameraDrift", { min: 0, max: 4 });
  number(spec.blend, "blend", { min: 0, max: 4 });
  number(spec.trails, "trails", { min: 0, max: 2 });
  number(spec.sway, "sway", { min: 0, max: 0.4 });
  if (!Array.isArray(spec.hidden) || spec.hidden.some((id) => typeof id !== "string"))
    fail("hidden must be a list of record ids");
  if (!["fall", "tunnel"].includes(spec.echoStyle))
    fail("echoStyle must be fall or tunnel");
  number(spec.dipDepth, "dipDepth", { min: 0, max: 1 });
  if (!textureKinds.includes(spec.texture))
    fail(`texture must be one of ${textureKinds.join(", ")}`);
  number(spec.grain, "grain", { min: 0, max: 0.2 });
  if (!themes[spec.theme]) fail(`theme must be ${Object.keys(themes).join(" or ")}`);
  if (!Array.isArray(spec.shots) || spec.shots.length === 0)
    fail("shots must be a non-empty array");
  if (spec.watermark !== null && typeof spec.watermark !== "string")
    fail("watermark must be a string or null");

  const shots = spec.shots.map(resolveShot);
  let start = 0;
  for (const shot of shots) {
    shot.start = start;
    start += shot.duration;
  }
  const last = shots[shots.length - 1];
  const overflow = start - spec.duration;
  if (overflow > 0 && last.duration - overflow < 0.2)
    fail(
      `shots run ${start.toFixed(2)}s, which cannot be trimmed to ${spec.duration}s ` +
        "without dropping the last shot below 0.2s",
    );
  last.duration -= overflow;
  const theme = themes[spec.theme],
    palette = {
      ...theme,
      ...spec.palette,
      registers: { ...theme.registers, ...(spec.palette.registers ?? {}) },
    };
  return { ...spec, palette, shots, totalDuration: spec.duration };
}

/** The shot covering `time`, with its local time and progress. */
export function shotAt(spec, time) {
  const clamped = Math.min(Math.max(time, 0), spec.totalDuration - 1e-6);
  let index = 0;
  for (let i = 0; i < spec.shots.length; i += 1)
    if (clamped >= spec.shots[i].start) index = i;
  const shot = spec.shots[index];
  const local = clamped - shot.start;
  return { shot, index, local, progress: Math.min(1, local / shot.duration) };
}

/**
 * How far into a beat the shot is at `local`: 0 outside it, 1 at its hold. The
 * ease in and out are the same curve the rest of the clip moves on.
 */
export function beatAt(beats, local) {
  for (const beat of beats) {
    const rising = local - beat.at;
    if (rising < 0) continue;
    if (rising < beat.in)
      return { beat, weight: easeInOut(rising / beat.in), phase: "in" };
    const holding = rising - beat.in;
    if (holding <= beat.hold) return { beat, weight: 1, phase: "hold" };
    const falling = holding - beat.hold;
    if (falling < beat.out)
      return { beat, weight: 1 - easeInOut(falling / beat.out), phase: "out" };
  }
  return { beat: null, weight: 0, phase: null };
}

/**
 * The animations playing at `local` inside a shot's track: the current one, and
 * the one before it while their fade is still running. Weights sum to one.
 */
export function trackAt(track, local) {
  let index = 0;
  for (let at = 0; at < track.length; at += 1) if (local >= track[at].at) index = at;
  const current = track[index],
    previous = index > 0 ? track[index - 1] : null,
    into = local - current.at,
    fading = previous && current.fade > 0 && into < current.fade,
    weight = fading ? into / current.fade : 1;

  const entries = [
    {
      clip: current.clip,
      time: (current.offset + into) * current.rate,
      weight,
      loop: current.loop,
    },
  ];
  if (fading)
    entries.push({
      clip: previous.clip,
      time: (previous.offset + local - previous.at) * previous.rate,
      weight: 1 - weight,
      loop: previous.loop,
    });
  return entries;
}

/**
 * The angle a tumbling axis has reached at `local`, given a rate that eases
 * from `spin[0]` to `spin[1]` across a shot of `duration`. Integrated exactly,
 * so seeking to a frame gives the same angle as playing up to it.
 */
export function spinAt(local, spin, duration, ratePerSecond) {
  const [from, to] = spin;
  return ratePerSecond * (from * local + ((to - from) * local * local) / (2 * duration));
}

export function easeInOut(t) {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped < 0.5
    ? 4 * clamped ** 3
    : 1 - (-2 * clamped + 2) ** 3 / 2;
}

/**
 * Opacity of the background dip at `time`. A shot marked "dip" fades the frame
 * out and back across its own start, so the boundary reads as one gesture.
 */
export function dipAt(spec, time, window = 0.28) {
  let strength = 0;
  for (const shot of spec.shots) {
    if (shot.transition !== "dip" || shot.start === 0) continue;
    const distance = Math.abs(time - shot.start);
    if (distance < window) strength = Math.max(strength, 1 - distance / window);
  }
  return strength;
}

/** Text opacity for a shot's overlay at local time `local`. */
export function textOpacityAt(shot, local) {
  if (!shot.text) return 0;
  const inStart = shot.text.delay;
  const inEnd = inStart + 0.45;
  const outStart = Math.max(inEnd, shot.duration - 0.4);
  if (local < inStart) return 0;
  if (local < inEnd) return easeInOut((local - inStart) / (inEnd - inStart));
  if (local < outStart) return 1;
  return 1 - easeInOut((local - outStart) / Math.max(0.001, shot.duration - outStart));
}

export function frameCount(spec) {
  return Math.round(spec.totalDuration * spec.fps);
}
