/**
 * The falling map, as a pure function of time.
 *
 * Play mode steps the rain frame by frame, which is right for something being
 * driven by hand. A scripted render cannot do that — it seeks — so this module
 * gives the same look analytically: every drop's place at `time` is computed
 * from its seed, with no state carried between frames.
 */
import { swimBox } from "./swim.mjs";

const farthest = -6;
const nearest = 2.4;
/** The swim framing's camera, which the spread is widened against. */
const cameraDepth = 6.2;
const centreY = 1.85;

/**
 * How much wider a drop's spread has to be at depth `z` to cover the same part
 * of the frame. Without it the far drops crowd the vanishing point and the top
 * and bottom of the frame run thin.
 */
function spreadAt(z) {
  return (cameraDepth - z) / cameraDepth;
}

function random(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Wraps `value` into [0, span), for a drop that falls forever. */
function wrap(value, span) {
  return ((value % span) + span) % span;
}

/**
 * The drops for `records` at `time`. `count` is how many fall at once; the same
 * seed always gives the same fall.
 */
export function rainAt(
  time,
  { records = [], count = 18, seed = 5, speed = 1, box = swimBox } = {},
) {
  if (!records.length) return [];
  const next = random(seed),
    top = box.top + 1.4,
    bottom = box.bottom - 1.4,
    span = top - bottom,
    depth = nearest - farthest,
    drops = [];

  for (let index = 0; index < count; index += 1) {
    const record = records[index % records.length],
      shape = next(),
      startY = next(),
      startZ = next(),
      across = next() * 2 - 1,
      swayPhase = next() * Math.PI * 2,
      fall = 0.25 + shape ** 2 * 1.7,
      approach = 0.04 + shape * 0.3,
      // Each drop keeps falling and creeping toward the camera, wrapping round
      // rather than being respawned, so its place is a function of time alone.
      // The place is held as a fraction of the frame and widened for depth, so
      // near and far drops cover it evenly.
      down = wrap(startY + (fall * speed * time) / span, 1),
      z = farthest + wrap(startZ ** 1.4 * depth + approach * speed * time, depth),
      spread = spreadAt(z);

    drops.push({
      id: `${record.id}-${index}`,
      label: record.label,
      family: record.family,
      register: record.register,
      x: (across * (box.halfWidth + 0.5) + Math.sin(swayPhase + time * 0.6) * 0.06) * spread,
      y: centreY + (0.5 - down) * span * spread,
      z,
      fall,
    });
  }
  return drops;
}
