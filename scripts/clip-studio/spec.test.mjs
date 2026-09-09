import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readFile as read } from "node:fs/promises";
import {
  backgroundKinds,
  dipAt,
  spinAt,
  frameCount,
  resolveSpec,
  shotAt,
  textOpacityAt,
} from "./public/spec.mjs";
import { specNames, startServer } from "./server.mjs";
import { swimAt, swimBox } from "./public/swim.mjs";
import { rainAt } from "./public/rain.mjs";
import {
  createAttitude,
  createFloat,
  createGame,
  createRain,
  inputFromKeys,
  layOutNodes,
} from "./public/game.mjs";

const specDir = fileURLToPath(new URL("./specs", import.meta.url));

function spec(overrides = {}) {
  return resolveSpec({
    name: "test",
    duration: 6,
    shots: [
      { clip: "Idle", duration: 3 },
      { clip: "Jazz_Dance", duration: 3 },
    ],
    ...overrides,
  });
}

test("shot starts follow their durations", () => {
  assert.deepEqual(
    spec().shots.map((shot) => [shot.start, shot.duration]),
    [
      [0, 3],
      [3, 3],
    ],
  );
});

test("the last shot is trimmed to the requested duration", () => {
  const trimmed = spec({ duration: 5 });
  assert.equal(trimmed.shots[1].duration, 2);
  assert.equal(trimmed.totalDuration, 5);
  assert.equal(frameCount(trimmed), 150);
});

test("a duration the shots cannot reach is rejected", () => {
  assert.throws(() => spec({ duration: 3.1 }), /cannot be trimmed/);
});

test("an unknown clip is rejected before rendering", () => {
  assert.throws(
    () => resolveSpec({ name: "test", duration: 2, shots: [{ clip: "Moonwalk", duration: 2 }] }),
    /is not a clip/,
  );
});

test("an unknown framing names the available ones", () => {
  assert.throws(
    () =>
      resolveSpec({
        name: "test",
        duration: 2,
        shots: [{ clip: "Idle", duration: 2, framing: "macro" }],
      }),
    /full/,
  );
});

test("shotAt picks the covering shot and its local time", () => {
  const resolved = spec();
  assert.equal(shotAt(resolved, 0).shot.clip, "Idle");
  assert.equal(shotAt(resolved, 2.999).shot.clip, "Idle");
  assert.equal(shotAt(resolved, 3).shot.clip, "Jazz_Dance");
  assert.equal(shotAt(resolved, 4.5).local, 1.5);
  assert.equal(shotAt(resolved, 99).shot.clip, "Jazz_Dance");
  assert.equal(shotAt(resolved, -5).shot.clip, "Idle");
});

test("a dip peaks at its own boundary and clears between shots", () => {
  const resolved = spec({
    shots: [
      { clip: "Idle", duration: 3 },
      { clip: "Jazz_Dance", duration: 3, transition: "dip" },
    ],
  });
  assert.equal(dipAt(resolved, 3), 1);
  assert.ok(dipAt(resolved, 2.9) > 0 && dipAt(resolved, 2.9) < 1);
  assert.equal(dipAt(resolved, 1), 0);
  assert.equal(dipAt(resolved, 5), 0);
});

test("a first shot marked dip does not fade in from nothing", () => {
  const resolved = spec({
    shots: [
      { clip: "Idle", duration: 3, transition: "dip" },
      { clip: "Jazz_Dance", duration: 3 },
    ],
  });
  assert.equal(dipAt(resolved, 0), 0);
});

test("text fades in after its delay and out before the shot ends", () => {
  const [shot] = resolveSpec({
    name: "test",
    duration: 4,
    shots: [{ clip: "Idle", duration: 4, text: { title: "Hello" } }],
  }).shots;
  assert.equal(textOpacityAt(shot, 0), 0);
  assert.equal(textOpacityAt(shot, 1), 1);
  assert.ok(textOpacityAt(shot, 3.9) < 0.5);
  assert.equal(textOpacityAt(shot, 4), 0);
});

test("a shot without any text has no overlay", () => {
  const [shot] = spec().shots;
  assert.equal(shot.text, null);
  assert.equal(textOpacityAt(shot, 1), 0);
});

test("every checked-in spec resolves", async () => {
  const files = (await readdir(specDir)).filter((name) => name.endsWith(".json"));
  assert.ok(files.length > 0);
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(specDir, file), "utf8"));
    const resolved = resolveSpec(raw);
    assert.equal(resolved.name, file.slice(0, -5));
    assert.ok(resolved.totalDuration > 0);
  }
});

test("a background fills its defaults and rejects an unknown kind", () => {
  const resolved = spec({ background: { kind: "grid", intensity: 1.4 } });
  assert.deepEqual(resolved.background, {
    kind: "grid",
    speed: 1,
    intensity: 1.4,
    rules: false,
    glow: true,
    film: "nmf-story",
    smoothing: 0.4,
  });
  assert.ok(backgroundKinds.includes("aurora"));
  assert.throws(() => spec({ background: { kind: "lava" } }), /background.kind must be one of/);
  assert.throws(() => spec({ background: { speed: 9 } }), /background.speed/);
  assert.throws(() => spec({ background: { glow: "yes" } }), /background.glow/);
});

test("saving a spec validates it and refuses a mismatched name", async () => {
  const { server, origin } = await startServer(0);
  const file = path.join(specDir, "test-round-trip.json");
  try {
    const body = {
      name: "test-round-trip",
      duration: 2,
      shots: [{ clip: "Idle", duration: 2 }],
    };
    const save = async (name, spec) =>
      fetch(`${origin}/api/specs/${name}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(spec),
      });

    const written = await save("test-round-trip", body);
    assert.equal(written.status, 200);
    assert.deepEqual(JSON.parse(await read(file, "utf8")), body);

    const mismatched = await save("test-round-trip", { ...body, name: "other" });
    assert.equal(mismatched.status, 400);

    const invalid = await save("test-round-trip", {
      ...body,
      shots: [{ clip: "Moonwalk", duration: 2 }],
    });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /is not a clip/);

    // A rejected save leaves the file it would have replaced untouched.
    assert.deepEqual(JSON.parse(await read(file, "utf8")), body);
  } finally {
    server.close();
    await rm(file, { force: true });
  }
});

test("a render for an unknown spec is refused", async () => {
  const { server, origin } = await startServer(0);
  try {
    const response = await fetch(`${origin}/api/render/not-a-spec`, { method: "POST" });
    assert.equal(response.status, 404);
    const state = await (await fetch(`${origin}/api/render`)).json();
    assert.equal(state.running, false);
  } finally {
    server.close();
  }
});

test("a swim shot carries its own motion settings", () => {
  const [shot] = resolveSpec({
    name: "test",
    duration: 4,
    shots: [{ clip: "Swim_Forward", duration: 4, framing: "swim", motion: "swim", seed: 12 }],
  }).shots;
  assert.equal(shot.motion, "swim");
  assert.equal(shot.seed, 12);
  assert.equal(shot.swimSpeed, 1);
  assert.throws(
    () => resolveSpec({
      name: "test",
      duration: 2,
      shots: [{ clip: "Idle", duration: 2, motion: "fly" }],
    }),
    /motion must be stand, swim, or float/,
  );
});

test("a float shot fills its attitude and spins exactly as it is seeked", () => {
  const [shot] = resolveSpec({
    name: "test",
    duration: 4,
    shots: [
      {
        clip: "Swim_Idle",
        duration: 4,
        framing: "swim",
        motion: "float",
        float: { roll: [180, 0], spin: [2, 0] },
      },
    ],
  }).shots;
  assert.deepEqual(shot.float, {
    turn: [90, 90],
    roll: [180, 0],
    tilt: [0, 0],
    spin: [2, 0],
    rates: { turn: 34, roll: 62, tilt: 21 },
    wobble: { roll: 0, tilt: 0, period: 6 },
  });

  // A tumble that eases to nothing is integrated, not sampled: seeking to the
  // end gives the same angle as running there.
  const rate = 60;
  assert.equal(spinAt(0, [2, 0], 4, rate), 0);
  assert.ok(Math.abs(spinAt(4, [2, 0], 4, rate) - 240) < 1e-9);
  assert.ok(spinAt(2, [2, 0], 4, rate) < spinAt(4, [2, 0], 4, rate));
  assert.equal(spinAt(3, [0, 0], 5, rate), 0, "no spin turns nothing");
});

test("the rain is the same at a time however it is reached", () => {
  const records = mapRecords,
    options = { records, count: 9, seed: 4 };
  assert.deepEqual(rainAt(3.25, options), rainAt(3.25, options));
  assert.notDeepEqual(rainAt(3.25, options), rainAt(3.5, options));
  assert.equal(rainAt(0, options).length, 9);

  // A drop's spread widens with its distance, so its place is checked against
  // the part of the frame it covers rather than against world units.
  const span = swimBox.top - swimBox.bottom + 2.8;
  for (const time of [0, 2.5, 9, 40]) {
    for (const drop of rainAt(time, options)) {
      assert.ok(drop.z > -6.001 && drop.z < 2.401, `z at ${time}`);
      const spread = (6.2 - drop.z) / 6.2,
        onScreen = (drop.y - 1.85) / spread;
      assert.ok(Math.abs(onScreen) <= span / 2 + 1e-6, `y at ${time}: ${onScreen}`);
    }
  }
  assert.deepEqual(rainAt(1, { ...options, records: [] }), []);
});

test("the swim is deterministic, seeded, and stays inside its box", () => {
  const first = swimAt(4.25),
    again = swimAt(4.25);
  assert.deepEqual(first, again);
  assert.notDeepEqual(swimAt(4.25, { seed: 99 }).position, first.position);

  for (const seconds of [0, 0.5, 3, 7.5, 15]) {
    const { position } = swimAt(seconds);
    assert.ok(Math.abs(position.x) <= swimBox.halfWidth + 1e-9, `x at ${seconds}`);
    assert.ok(position.y >= swimBox.bottom - 1e-9, `y floor at ${seconds}`);
    assert.ok(position.y <= swimBox.top + 1e-9, `y ceiling at ${seconds}`);
  }
});

test("the swim chases food rather than drifting", () => {
  // The count is the game's own signal: a figure that never reaches food is stuck.
  assert.ok(swimAt(15).eaten >= 4);
  assert.equal(swimAt(0).eaten, 0);
  assert.ok(swimAt(15, { speed: 2 }).eaten > swimAt(15, { speed: 0.5 }).eaten);
});

const mapRecords = [
  { id: "bradley", label: "Bradley Berkman", family: "identity", register: "identity" },
  { id: "dubs", label: "Dubs", family: "product", register: "cool" },
  { id: "kickoff", label: "Kickoff", family: "component", register: "bridge" },
];

test("the map lays out inside the box, keeping each node's family and register", () => {
  const nodes = layOutNodes(mapRecords);
  assert.equal(nodes.length, 3);
  assert.deepEqual(
    nodes.map((node) => [node.family, node.register]),
    [["identity", "identity"], ["product", "cool"], ["component", "bridge"]],
  );
  for (const node of nodes) {
    assert.ok(Math.abs(node.x) <= swimBox.halfWidth);
    assert.ok(node.y >= swimBox.bottom && node.y <= swimBox.top);
  }
  assert.deepEqual(layOutNodes(mapRecords), nodes);
});

test("held keys become a unit direction", () => {
  assert.deepEqual(inputFromKeys(new Set(["ArrowRight"])), { x: 1, y: 0 });
  assert.deepEqual(inputFromKeys(new Set(["w"])), { x: 0, y: 1 });
  assert.deepEqual(inputFromKeys(new Set()), { x: 0, y: 0 });
  const diagonal = inputFromKeys(new Set(["ArrowRight", "ArrowUp"]));
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
});

test("a played game moves on input, coasts without it, and eats what it reaches", () => {
  const game = createGame({ nodes: layOutNodes(mapRecords) });
  for (let step = 0; step < 30; step += 1) game.step(1 / 60, { x: 1, y: 0 });
  assert.ok(game.state.position.x > 0);

  const moving = Math.hypot(game.state.velocity.x, game.state.velocity.y);
  for (let step = 0; step < 30; step += 1) game.step(1 / 60, { x: 0, y: 0 });
  const coasting = Math.hypot(game.state.velocity.x, game.state.velocity.y);
  assert.ok(coasting > 0 && coasting < moving, "coasting slows without stopping dead");

  const [target] = game.state.nodes;
  game.state.position = { x: target.x, y: target.y };
  game.step(1 / 60, { x: 0, y: 0 });
  assert.equal(target.eaten, true);
  assert.equal(game.state.eaten, 1);
});

test("the game stays inside its box however hard it is driven", () => {
  const game = createGame({ nodes: [] });
  for (let step = 0; step < 600; step += 1) game.step(1 / 60, { x: 1, y: 1 });
  assert.ok(game.state.position.x <= swimBox.halfWidth + 1e-9);
  assert.ok(game.state.position.y <= swimBox.top + 1e-9);
});

test("the rain falls, keeps its count, and returns drops to the top", () => {
  const rain = createRain(mapRecords, { density: 12 });
  const first = rain.drops[0],
    startedAt = first.y;
  rain.step(1 / 60);
  assert.ok(rain.drops[0].y < startedAt, "a drop falls");
  assert.ok(rain.drops.some((drop) => drop.z > 0), "some drops pass in front of the figure");
  assert.ok(rain.drops.some((drop) => drop.z < 0), "some pass behind it");
  assert.ok(
    rain.drops.every((drop) => drop.z > -6.001 && drop.z < 2.401),
    "all sit inside the volume the camera holds",
  );

  const nearest = rain.drops.map((drop) => drop.z);
  for (let step = 0; step < 60; step += 1) rain.step(1 / 60);
  assert.ok(
    rain.drops.some((drop, index) => drop.z > nearest[index]),
    "drops creep toward the camera as they fall",
  );

  for (let step = 0; step < 2000; step += 1) rain.step(1 / 60);
  assert.equal(rain.drops.length, 12, "the count holds");
  for (const drop of rain.drops) {
    assert.ok(drop.y > swimBox.bottom - 1.5, "no drop is left below the frame");
    assert.ok(drop.z <= 2.4001, "and none is left behind the camera");
    assert.ok(mapRecords.some((record) => record.label === drop.label));
  }
});

test("a held attitude key sweeps and a released one settles", () => {
  const turn = createAttitude(90);
  for (let step = 0; step < 30; step += 1) turn.step(1 / 60, 1);
  const swept = turn.degrees;
  assert.ok(swept > 100 && swept < 150, `half a second of holding turns smoothly: ${swept}`);

  let previous = swept;
  for (let step = 0; step < 30; step += 1) {
    turn.step(1 / 60, 0);
    assert.ok(turn.degrees >= previous, "it eases out rather than snapping back");
    previous = turn.degrees;
  }
  assert.ok(turn.degrees - swept < 15, "and settles rather than drifting on");

  turn.degrees = 12;
  assert.equal(turn.degrees, 12);
  turn.step(1 / 60, 0);
  assert.equal(turn.degrees, 12, "setting an angle stops the sweep");
});

test("shift turns faster", () => {
  const plain = createAttitude(0),
    boosted = createAttitude(0);
  for (let step = 0; step < 30; step += 1) {
    plain.step(1 / 60, 1);
    boosted.step(1 / 60, 1, 2.2);
  }
  assert.ok(boosted.degrees > plain.degrees * 1.5);
});

test("the float accelerates, caps, and coasts to a stop inside its box", () => {
  const float = createFloat();
  for (let step = 0; step < 45; step += 1) float.step(1 / 60, { x: 1, y: 0 });
  assert.ok(float.state.position.x > 0);

  const moving = Math.abs(float.state.velocity.x);
  assert.ok(moving > 0, "it is still moving before it reaches the wall");

  // Driven into the wall it stops there rather than leaving the box.
  for (let step = 0; step < 300; step += 1) float.step(1 / 60, { x: 1, y: 0 });
  assert.ok(Math.abs(float.state.position.x) <= swimBox.halfWidth + 1e-9);
  float.reset();
  for (let step = 0; step < 45; step += 1) float.step(1 / 60, { x: 1, y: 0 });
  for (let step = 0; step < 180; step += 1) float.step(1 / 60, { x: 0, y: 0 });
  assert.ok(Math.abs(float.state.velocity.x) < moving * 0.05, "it coasts down");
});

test("the server lists specs, serves them, and refuses paths that escape", async () => {
  const { server, origin } = await startServer(0);
  try {
    const names = await (await fetch(`${origin}/api/specs`)).json();
    assert.deepEqual(names, await specNames());

    const first = await (await fetch(`${origin}/api/specs/${names[0]}`)).json();
    assert.equal(first.name, names[0]);

    assert.equal((await fetch(`${origin}/api/specs/..%2F..%2Fpackage`)).status, 400);
    assert.equal((await fetch(`${origin}/nope.mjs`)).status, 404);

    const page = await fetch(`${origin}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /clip-studio/);

    const escape = await fetch(`${origin}/vendor/three/../../../package.json`);
    assert.notEqual(escape.status, 200);

    const model = await fetch(`${origin}/assets/avatar.glb`, { method: "GET" });
    assert.equal(model.status, 200);
    assert.equal(model.headers.get("content-type"), "model/gltf-binary");
  } finally {
    server.close();
  }
});

test("a missing tool is named rather than failing part-way", async () => {
  const { assertRenderTools, cachedBrowser, ffmpegAdvice, hasFfmpeg, loadPlaywright, playwrightAdvice } =
    await import("./tools.mjs");

  // What a machine happens to have is not the assertion; what it is told is.
  assert.equal(typeof (await hasFfmpeg()), "boolean");
  assert.match(ffmpegAdvice, /brew install ffmpeg/);
  assert.match(playwrightAdvice, /npm run clip:setup/);

  const present = async () => true,
    absent = async () => false,
    playwright = () => ({ chromium: {} });

  await assertRenderTools({ ffmpeg: present, playwright });
  await assert.rejects(
    assertRenderTools({ ffmpeg: absent, playwright }),
    /brew install ffmpeg/,
  );
  await assert.rejects(
    assertRenderTools({
      ffmpeg: present,
      playwright: () => {
        throw new Error(playwrightAdvice);
      },
    }),
    /clip:setup/,
  );

  // A machine with no Playwright at all is told what to run, not shown a
  // resolution error from deep inside the renderer.
  assert.throws(
    () =>
      loadPlaywright(() => {
        throw new Error("Cannot find module");
      }),
    /clip:setup/,
  );

  // The cached-browser fallback answers with a path or nothing, never a throw.
  assert.equal(cachedBrowser("/nowhere-on-this-machine"), null);
});
