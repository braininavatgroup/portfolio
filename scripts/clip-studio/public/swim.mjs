/**
 * The Brain Food swim, without the game around it. The figure chases food the
 * way it does in the portfolio — turning at a limited rate and losing speed
 * while it turns — but the food, the score, and the controls are gone. Only the
 * motion is left.
 *
 * The path is a pure function of time: it is integrated from zero on every
 * frame at a fixed step, so scrubbing, replaying, and exporting agree.
 */

/** Matches the portfolio's feel, in stage units per second rather than pixels. */
export const swimMaxSpeed = 1.15;
export const swimTurnRadiansPerSecond = 2.2;
const stepSeconds = 1 / 120;
const biteRadius = 0.2;

/** The box the figure swims inside, in world units around the frame's centre. */
export const swimBox = { halfWidth: 1.02, bottom: 0.45, top: 3.25 };

function random(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function signedAngleDifference(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function turnToward(from, to, maximumTurn) {
  const difference = signedAngleDifference(from, to);
  return Math.abs(difference) <= maximumTurn ? to : from + Math.sign(difference) * maximumTurn;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Where the figure is, and which way it points, `seconds` into a swim shot.
 * `box` defaults to the framing the `swim` camera is set up for.
 */
export function swimAt(seconds, { seed = 7, speed = 1, box = swimBox } = {}) {
  const next = random(seed),
    food = () => ({
      x: (next() * 2 - 1) * box.halfWidth * 0.92,
      y: box.bottom + next() * (box.top - box.bottom),
    });

  let position = { x: 0, y: (box.bottom + box.top) / 2 },
    heading = 0,
    target = food(),
    eaten = 0;

  const maxSpeed = swimMaxSpeed * speed,
    steps = Math.max(0, Math.round(Math.min(seconds, 600) / stepSeconds));
  for (let step = 0; step < steps; step += 1) {
    const wanted = Math.atan2(target.y - position.y, target.x - position.x);
    heading = turnToward(heading, wanted, swimTurnRadiansPerSecond * stepSeconds);
    // Speed falls away with the angle still to turn, so hard turns read as banks.
    const aligned = maxSpeed * Math.max(0, Math.cos(signedAngleDifference(heading, wanted)));
    position = {
      x: clamp(
        position.x + Math.cos(heading) * aligned * stepSeconds,
        -box.halfWidth,
        box.halfWidth,
      ),
      y: clamp(
        position.y + Math.sin(heading) * aligned * stepSeconds,
        box.bottom,
        box.top,
      ),
    };
    if (Math.hypot(target.x - position.x, target.y - position.y) < biteRadius) {
      target = food();
      eaten += 1;
    }
  }
  return { position, heading, eaten };
}
