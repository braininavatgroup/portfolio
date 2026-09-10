/**
 * The Brain Food game, played by hand in the clip studio. The steering is the
 * portfolio's: the figure turns at a limited rate and loses speed while it
 * turns. The score, the timer, and the controls live outside the frame, so
 * nothing but the swim and the map is recorded.
 */
import { swimBox, swimMaxSpeed, swimTurnRadiansPerSecond } from "./swim.mjs";

const coastDampingPerSecond = 1.4;
const maximumStepSeconds = 0.05;
const biteRadius = 0.16;

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

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Scatters the map's records through the swim box, keeping them apart and off
 * the walls. The same seed always lays the map out the same way.
 */
export function layOutNodes(records, { seed = 3, box = swimBox, spacing = 0.42 } = {}) {
  const next = random(seed),
    placed = [];
  for (const record of records) {
    let best = null,
      bestClearance = -Infinity;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const candidate = {
        x: (next() * 2 - 1) * (box.halfWidth - 0.12),
        y: box.bottom + 0.12 + next() * (box.top - box.bottom - 0.24),
      };
      const clearance = placed.length
        ? Math.min(...placed.map((node) => Math.hypot(node.x - candidate.x, node.y - candidate.y)))
        : Infinity;
      if (clearance > bestClearance) {
        best = candidate;
        bestClearance = clearance;
      }
      if (clearance >= spacing) break;
    }
    placed.push({
      ...best,
      id: record.id,
      label: record.label,
      family: record.family,
      register: record.register,
      eaten: false,
    });
  }
  return placed;
}

/**
 * A playable session. `input` is a direction the player is asking for; the body
 * turns toward it. Releasing the input coasts rather than stopping dead.
 */
export function createGame({ nodes = [], box = swimBox, speed = 1 } = {}) {
  let pace = speed;
  const state = {
    position: { x: 0, y: (box.bottom + box.top) / 2 },
    velocity: { x: 0, y: 0 },
    heading: 0,
    nodes: nodes.map((node) => ({ ...node })),
    eaten: 0,
  };

  function step(elapsedSeconds, input) {
    const delta = clamp(elapsedSeconds, 0, maximumStepSeconds),
      maxSpeed = swimMaxSpeed * pace,
      length = Math.hypot(input.x, input.y);

    if (length > 0) {
      const wanted = Math.atan2(input.y, input.x),
        turn = swimTurnRadiansPerSecond * delta,
        difference = signedAngleDifference(state.heading, wanted);
      state.heading =
        Math.abs(difference) <= turn
          ? wanted
          : state.heading + Math.sign(difference) * turn;
      const remaining = Math.abs(signedAngleDifference(state.heading, wanted)),
        aligned = maxSpeed * Math.max(0, Math.cos(remaining));
      state.velocity = {
        x: Math.cos(state.heading) * aligned,
        y: Math.sin(state.heading) * aligned,
      };
    } else {
      const damping = Math.exp(-coastDampingPerSecond * delta);
      state.velocity = { x: state.velocity.x * damping, y: state.velocity.y * damping };
    }

    const candidate = {
      x: state.position.x + state.velocity.x * delta,
      y: state.position.y + state.velocity.y * delta,
    };
    state.position = {
      x: clamp(candidate.x, -box.halfWidth, box.halfWidth),
      y: clamp(candidate.y, box.bottom, box.top),
    };
    if (state.position.x !== candidate.x) state.velocity.x = 0;
    if (state.position.y !== candidate.y) state.velocity.y = 0;

    for (const node of state.nodes) {
      if (node.eaten) continue;
      if (Math.hypot(node.x - state.position.x, node.y - state.position.y) > biteRadius) continue;
      node.eaten = true;
      state.eaten += 1;
    }
    // A cleared map fills back up, so a take never runs out of food.
    if (state.nodes.length && state.nodes.every((node) => node.eaten))
      for (const node of state.nodes) node.eaten = false;

    return state;
  }

  return {
    state,
    step,
    setSpeed(next) {
      pace = next;
    },
    reset() {
      state.position = { x: 0, y: (box.bottom + box.top) / 2 };
      state.velocity = { x: 0, y: 0 };
      state.heading = 0;
      state.eaten = 0;
      for (const node of state.nodes) node.eaten = false;
    },
  };
}

/** Turns held keys into the direction the player is asking for. */
export function inputFromKeys(held) {
  const direction = { x: 0, y: 0 };
  if (held.has("ArrowLeft") || held.has("a")) direction.x -= 1;
  if (held.has("ArrowRight") || held.has("d")) direction.x += 1;
  if (held.has("ArrowUp") || held.has("w")) direction.y += 1;
  if (held.has("ArrowDown") || held.has("s")) direction.y -= 1;
  const length = Math.hypot(direction.x, direction.y);
  return length === 0 ? direction : { x: direction.x / length, y: direction.y / length };
}


/**
 * The rain: the map's nodes falling past a floating figure. Each drop carries a
 * depth — near ones are bigger, faster, and pass in front — so the fall reads
 * as a volume rather than a sheet. Drops that leave the bottom come back at the
 * top, so it never runs out.
 */
export function createRain(records, { seed = 5, box = swimBox, density = 18, speed = 1 } = {}) {
  const next = random(seed),
    top = box.top + 1.4,
    bottom = box.bottom - 1.4,
    /** How far behind and in front of the figure the drops are spread. */
    farthest = -6,
    nearest = 2.4,
    // The swim camera sits at 6.2; a drop's spread widens with its distance so
    // that depth does not crowd everything toward the vanishing point.
    spreadAt = (z) => (6.2 - z) / 6.2,
    // A new drop enters at the top; the opening fill is scattered through the
    // frame instead, so the rain is already falling when a take starts.
    drop = (record, index, start = bottom + next() * (top - bottom)) => {
      const depth = next();
      return {
        id: `${record.id}-${index}`,
        label: record.label,
        family: record.family,
        register: record.register,
        // The spread is widened away from the figure's own plane, so the frame
        // holds a volume rather than a sheet of marks.
        across: next() * 2 - 1,
        x: 0,
        y: start,
        z: farthest + next() ** 1.4 * (nearest - farthest),
        // Depth now carries itself through perspective; what is left is how
        // fast a drop falls and how far it drifts toward the camera.
        fall: 0.25 + depth ** 2 * 1.7,
        approach: 0.04 + depth * 0.3,
        sway: next() * Math.PI * 2,
      };
    };

  let pace = speed;
  const drops = [];
  for (let index = 0; index < density; index += 1) {
    const made = drop(records[index % records.length], index);
    made.x = made.across * (box.halfWidth + 0.5) * spreadAt(made.z);
    drops.push(made);
  }

  return {
    drops,
    setSpeed(value) {
      pace = value;
    },
    step(elapsedSeconds) {
      const delta = clamp(elapsedSeconds, 0, maximumStepSeconds);
      drops.forEach((current, index) => {
        current.y -= current.fall * pace * delta;
        const spread = spreadAt(current.z);
        current.x = (current.across * (box.halfWidth + 0.5) + Math.sin(current.sway) * 0.06) * spread;
        // Drops also creep toward the camera, so a fall sweeps past rather than
        // sliding down a wall.
        current.z += current.approach * pace * delta;
        current.sway += delta * 0.6;
        if (current.y < bottom || current.z > nearest)
          drops[index] = drop(records[Math.floor(next() * records.length)], index, top);
      });
      return drops;
    },
  };
}


/**
 * Free drift for a floating figure. Unlike the chase, nothing steers a heading
 * here: the input accelerates the body and it coasts to a stop, so a take can
 * be nudged into place while it records without the motion snapping.
 */
export function createFloat({ box = swimBox, acceleration = 2.6, damping = 2.2, speed = 1 } = {}) {
  let pace = speed;
  const state = {
    position: { x: 0, y: (box.bottom + box.top) / 2 },
    velocity: { x: 0, y: 0 },
  };

  return {
    state,
    setSpeed(next) {
      pace = next;
    },
    reset() {
      state.position = { x: 0, y: (box.bottom + box.top) / 2 };
      state.velocity = { x: 0, y: 0 };
    },
    step(elapsedSeconds, input) {
      const delta = clamp(elapsedSeconds, 0, maximumStepSeconds),
        top = swimMaxSpeed * pace * 1.1,
        pull = Math.exp(-damping * delta);
      state.velocity = {
        x: (state.velocity.x + input.x * acceleration * pace * delta) * pull,
        y: (state.velocity.y + input.y * acceleration * pace * delta) * pull,
      };
      const speedNow = Math.hypot(state.velocity.x, state.velocity.y);
      if (speedNow > top) {
        state.velocity.x = (state.velocity.x / speedNow) * top;
        state.velocity.y = (state.velocity.y / speedNow) * top;
      }
      const candidate = {
        x: state.position.x + state.velocity.x * delta,
        y: state.position.y + state.velocity.y * delta,
      };
      state.position = {
        x: clamp(candidate.x, -box.halfWidth, box.halfWidth),
        y: clamp(candidate.y, box.bottom, box.top),
      };
      if (state.position.x !== candidate.x) state.velocity.x = 0;
      if (state.position.y !== candidate.y) state.velocity.y = 0;
      return state;
    },
  };
}

/**
 * An angle that is turned by holding a key. The rate eases in and out, so a
 * held key sweeps rather than steps and a released one settles instead of
 * stopping dead.
 */
export function createAttitude(initialDegrees = 0, { rate = 80, ease = 7 } = {}) {
  let value = initialDegrees,
    turning = 0;
  return {
    get degrees() {
      return value;
    },
    set degrees(next) {
      value = next;
      turning = 0;
    },
    /**
     * `direction` is -1, 0, or 1 and `boost` multiplies the held rate. `drift`
     * is a constant turn underneath both — the tumble a weightless body keeps
     * whether or not a key is down.
     */
    step(elapsedSeconds, direction, boost = 1, drift = 0) {
      const delta = clamp(elapsedSeconds, 0, maximumStepSeconds),
        wanted = direction * rate * boost;
      turning += (wanted - turning) * Math.min(1, delta * ease);
      value += (turning + drift) * delta;
      return value;
    },
  };
}
