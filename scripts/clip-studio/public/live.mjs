/**
 * Play mode: you swim the figure yourself and record the take. The canvas holds
 * nothing but the frame — the keys, the timer, and the food counter live in the
 * page around it, so none of them reach the recording.
 */
import {
  createAttitude,
  createFloat,
  createGame,
  createRain,
  inputFromKeys,
  layOutNodes,
} from "./game.mjs";

const settingsKey = "clip-studio-play-v1";
const swimClips = ["Swim_Forward", "Swim_Idle", "swimming_to_edge"];
/** Swim_Idle first: it is the one that reads as floating rather than standing. */
const floatClips = ["Swim_Idle", "Swim_Forward", "Idle", "Agree_Gesture", "Wave_One_Hand"];

function recorderType() {
  const wanted = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return wanted.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

/**
 * Wires play mode onto an existing studio. Returns handles the page uses to
 * enter and leave the mode; nothing runs until `start` is called.
 */
/** Everything in the play panel, so a reload keeps the take you had set up. */
function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(settingsKey) ?? "{}");
  } catch {
    return {};
  }
}

export function createLiveMode({ studio, canvas, elements, records, onStatus }) {
  const {
    playButton,
    recordButton,
    clipSelect,
    speedInput,
    modeSelect,
    poseSelect,
    angleInput,
    rollInput,
    tiltInput,
    faceButton,
    clipLibrary,
    queueReadout,
    baseSelect,
    tumbleInput,
    readout,
  } = elements;

  /** The scene — the map, the treatment, the camera — is the spec's, so the
   *  same controls drive a take and a scripted clip. */
  const scene = () => studio.spec;

  let game = null,
    float = null,
    rain = null,
    turn = createAttitude(90),
    rollAngle = createAttitude(0),
    tiltAngle = createAttitude(0),
    syncedAt = 0,
    mode = "chase",

    pose = "float",
    tumble = 1,
    running = false,
    held = new Set(),
    pointer = null,
    looking = null,
    lastFrame = null,
    clipTime = 0,
    startedAt = 0,
    recorder = null,
    chunks = [],
    speed = 1,
    clip = "Swim_Forward";

  function status(message, tone = "") {
    onStatus?.(message, tone);
  }

  /**
   * Standing upright has no attitude to set, so its controls go dead rather
   * than silently doing nothing — which is exactly how they read before.
   */
  function applyPoseState() {
    const inert = pose !== "float";
    for (const control of [angleInput, rollInput, tiltInput, faceButton])
      control.disabled = inert;
  }

  /** The panel's current state, as it is written to and read from storage. */
  function settings() {
    return {
      mode,
      clip,
      pose,
      speed,
      tumble,
      turn: turn.degrees,
      roll: rollAngle.degrees,
      tilt: tiltAngle.degrees,
    };
  }

  let savingAt = 0;

  function saveSettings(now = performance.now()) {
    if (now - savingAt < 400) return;
    savingAt = now;
    try {
      localStorage.setItem(settingsKey, JSON.stringify(settings()));
    } catch {
      // Storage can be unavailable; the take just will not be remembered.
    }
  }

  /** Puts a saved panel back, both in this module and in the controls. */
  function restore(saved) {
    if (!saved || typeof saved !== "object") return;
    const number = (value, fallback) =>
      typeof value === "number" && Number.isFinite(value) ? value : fallback;
    mode = saved.mode === "rain" || saved.mode === "chase" ? saved.mode : mode;
    pose = saved.pose === "upright" ? "upright" : "float";
    speed = number(saved.speed, speed);
    tumble = number(saved.tumble, tumble);
    turn.degrees = number(saved.turn, turn.degrees);
    rollAngle.degrees = number(saved.roll, rollAngle.degrees);
    tiltAngle.degrees = number(saved.tilt, tiltAngle.degrees);

    modeSelect.value = mode;
    fillClips();
    if (typeof saved.clip === "string" && [...clipSelect.options].some((o) => o.value === saved.clip)) {
      clipSelect.value = saved.clip;
      clip = saved.clip;
    }
    poseSelect.value = pose;
    speedInput.value = String(speed);
    tumbleInput.value = String(tumble);
    angleInput.value = String(Math.round(turn.degrees));
    rollInput.value = String(Math.round(rollAngle.degrees));
    tiltInput.value = String(Math.round(tiltAngle.degrees));
    applyPoseState();
  }

  function input() {
    if (pointer) {
      const rect = canvas.getBoundingClientRect(),
        // The canvas is letterboxed by CSS; map the pointer through its box.
        x = ((pointer.x - rect.left) / rect.width) * 2 - 1,
        y = 1 - ((pointer.y - rect.top) / rect.height) * 2,
        target = { x: x * 1.05, y: 1.85 + y * 2.25 },
        toward = {
          x: target.x - game.state.position.x,
          y: target.y - game.state.position.y,
        },
        length = Math.hypot(toward.x, toward.y);
      if (length > 0.06) return { x: toward.x / length, y: toward.y / length };
      return { x: 0, y: 0 };
    }
    return inputFromKeys(held);
  }

  function frame(now) {
    if (!running) return;
    const delta = lastFrame === null ? 0 : (now - lastFrame) / 1000;
    lastFrame = now;
    const seconds = (now - startedAt) / 1000;

    if (mode === "rain") {
      // Floating: the input pushes the figure and it coasts, rather than being
      // steered, and a slow bob keeps it alive when nothing is held.
      steerAttitude(delta, now);
      const state = float.step(delta, input());
      clipTime += delta;
      const drops = rain.step(delta);
      // A slow, unsynchronised camera move: the frame drifts around the figure,
      // breathes in and out, and rolls, none of them in step with each other.
      const drift = scene().cameraDrift,
        camera = drift
          ? {
              orbit: Math.sin(seconds * 0.07) * 0.11 * drift,
              dolly: 1 + Math.sin(seconds * 0.051) * 0.07 * drift,
              roll: Math.sin(seconds * 0.043) * 0.05 * drift,
            }
          : null;
      if (triggered && studio.liveClipState.finished) releaseTrigger();
      studio.renderState({
        clip,
        advance: delta,
        liveOwned: Boolean(triggered),
        framing: "swim",
        // Floating uses the swim orientation, which is the one that reads;
        // angle turns the figure in the frame and roll turns it about its own
        // length, so any attitude is reachable by hand.
        prone: pose === "float",
        attitude: {
          turn: (turn.degrees * Math.PI) / 180,
          roll: (rollAngle.degrees * Math.PI) / 180,
          tilt: (tiltAngle.degrees * Math.PI) / 180,
        },
        position: {
          x: state.position.x,
          y: state.position.y + Math.sin(seconds * 0.9) * 0.06,
        },
        nodes: scene().rain.enabled ? drops : [],
        nodeScale: scene().rain.scale,
        labels: scene().rain.labels,
        trails: scene().trails,
        fog: scene().rain.fog,
        camera,
        echo: scene().echo,
        echoStyle: scene().echoStyle,
        swayAmount: scene().sway,
        backgroundTime: seconds,
      });
      readout.textContent = `${recorder ? "● " : ""}${seconds.toFixed(1)}s · ${drops.length} falling`;
      requestAnimationFrame(frame);
      return;
    }

    const state = game.step(delta, input());
    // The swim clip runs with the figure: fast strokes when it is moving,
    // almost still when it is coasting.
    const pace = Math.hypot(state.velocity.x, state.velocity.y);
    clipTime += delta * (0.35 + pace * 0.75);

    studio.renderState({
      clip,
      clipTime,
      framing: "swim",
      position: state.position,
      heading: state.heading,
      nodes: scene().rain.enabled ? state.nodes : [],
      nodeScale: scene().rain.scale,
      labels: scene().rain.labels,
      trails: scene().trails,
      fog: scene().rain.fog,
      backgroundTime: seconds,
    });

    readout.textContent = `${recorder ? "● " : ""}${seconds.toFixed(1)}s · ${state.eaten} eaten`;
    requestAnimationFrame(frame);
  }

  /** -1, 0, or 1 from a pair of held keys. */
  function axis(negative, positive) {
    return (held.has(positive) ? 1 : 0) - (held.has(negative) ? 1 : 0);
  }

  const wrap = (value) => ((value % 360) + 360) % 360;

  /**
   * Turns the attitude while its keys are held, and writes the sliders back a
   * few times a second — often enough to read, rarely enough to stay out of
   * the frame's way.
   */
  function steerAttitude(delta, now) {
    const boost = held.has("Shift") ? 2.2 : 1;
    // The three tumble rates are deliberately unrelated, so the figure never
    // settles into a repeating spin.
    turn.step(delta, axis("z", "x"), boost, tumble * 0.9);
    rollAngle.step(delta, axis("q", "e"), boost, tumble * 1.6);
    tiltAngle.step(delta, axis("r", "f"), boost, tumble * 0.5);
    if (now - syncedAt < 120) return;
    syncedAt = now;
    saveSettings(now);
    angleInput.value = String(Math.round(wrap(turn.degrees)));
    rollInput.value = String(Math.round(wrap(rollAngle.degrees)));
    tiltInput.value = String(Math.round(wrap(tiltAngle.degrees)));
  }

  function keyDown(event) {
    if (!running) return;
    if (event.key === " ") {
      event.preventDefault();
      toggleRecording();
      return;
    }
    if (event.key.toLowerCase() === "c") {
      faceCamera();
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      const button = clipLibrary.querySelectorAll("[data-clip]")[Number(event.key) - 1];
      if (button) trigger(button.dataset.clip, { queued: event.shiftKey });
      return;
    }
    if (event.key === "Escape" && triggered) {
      queue = [];
      releaseTrigger();
      return;
    }
    held.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    if (event.key.startsWith("Arrow")) event.preventDefault();
  }

  function keyUp(event) {
    held.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  }

  /**
   * Left drag moves the figure toward the pointer. Right drag — or Shift with
   * the left — turns it: across for turn, up and down for tilt, the way a look
   * control works anywhere else. The wheel rolls.
   */
  function pointerDown(event) {
    canvas.setPointerCapture?.(event.pointerId);
    if (event.button === 2 || event.shiftKey) {
      looking = { x: event.clientX, y: event.clientY };
      event.preventDefault();
      return;
    }
    pointer = { x: event.clientX, y: event.clientY };
  }

  function pointerMove(event) {
    if (looking) {
      const degreesPerPixel = 0.35;
      turn.degrees -= (event.clientX - looking.x) * degreesPerPixel;
      tiltAngle.degrees += (event.clientY - looking.y) * degreesPerPixel;
      looking = { x: event.clientX, y: event.clientY };
      return;
    }
    if (pointer) pointer = { x: event.clientX, y: event.clientY };
  }

  function pointerUp() {
    pointer = null;
    looking = null;
  }

  function wheel(event) {
    if (mode !== "rain" || pose !== "float") return;
    event.preventDefault();
    rollAngle.degrees += event.deltaY * 0.12;
  }

  function blockMenu(event) {
    event.preventDefault();
  }

  async function upload(blob) {
    status(`Saving ${(blob.size / 1_000_000).toFixed(1)} MB…`);
    const response = await fetch("/api/record", {
      method: "POST",
      headers: { "content-type": "video/webm" },
      body: blob,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return status(body.error ?? "The take could not be saved", "bad");
    status(`Saved ${body.file}`, "good");
  }

  function toggleRecording() {
    if (recorder) {
      recorder.stop();
      return;
    }
    const type = recorderType();
    if (!type) return status("This browser cannot record the canvas", "bad");
    chunks = [];
    recorder = new MediaRecorder(canvas.captureStream(30), {
      mimeType: type,
      videoBitsPerSecond: 12_000_000,
    });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type });
      recorder = null;
      recordButton.textContent = "Record";
      recordButton.dataset.recording = "false";
      await upload(blob);
    };
    recorder.start(250);
    recordButton.textContent = "Stop";
    recordButton.dataset.recording = "true";
    status("Recording. Space or Stop ends the take.");
  }

  function fillClips() {
    clipSelect.replaceChildren();
    for (const name of mode === "rain" ? floatClips : swimClips) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      clipSelect.append(option);
    }
    clip = clipSelect.value;
  }

  /**
   * A triggered clip owns the figure until it finishes, then the base clip —
   * the one the float idles on — comes back. Shift-clicking a clip queues it
   * behind whatever is playing instead of cutting to it.
   */
  let triggered = null,
    queue = [];

  function drawQueue() {
    const parts = [];
    if (triggered) parts.push(triggered);
    parts.push(...queue);
    queueReadout.textContent = parts.length ? parts.join(" → ") : clip;
    for (const button of clipLibrary.querySelectorAll("[data-clip]"))
      button.dataset.playing = String(button.dataset.clip === triggered);
  }

  function trigger(name, { queued = false } = {}) {
    if (queued && triggered) {
      queue.push(name);
      drawQueue();
      return;
    }
    queue = queued ? queue : [];
    triggered = name;
    studio.playClip(name, { fade: 0.3, once: true });
    drawQueue();
  }

  function releaseTrigger() {
    const next = queue.shift();
    if (next) {
      triggered = next;
      studio.playClip(next, { fade: 0.3, once: true });
    } else {
      triggered = null;
      studio.playClip(clip, { fade: 0.4 });
    }
    drawQueue();
  }

  /** The map, minus anything the take is not meant to show. */
  function visibleRecords() {
    return records.filter((record) => !scene().hidden.includes(record.id));
  }

  function build() {
    const shown = visibleRecords();
    game = createGame({ nodes: layOutNodes(shown), speed });
    float = createFloat({ speed });
    rain = createRain(shown, { density: scene().rain.count, speed: scene().rain.speed });
  }

  function fillLibrary() {
    if (clipLibrary.childElementCount) return;
    studio.clipLibrary.forEach((entry, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.clip = entry.name;
      button.dataset.playing = "false";
      button.title = `${entry.duration.toFixed(1)}s${index < 9 ? ` · key ${index + 1}` : ""}`;
      button.textContent = entry.name.replace(/_/g, " ");
      button.addEventListener("click", (event) =>
        trigger(entry.name, { queued: event.shiftKey }),
      );
      clipLibrary.append(button);
    });
    for (const entry of studio.clipLibrary) {
      const option = document.createElement("option");
      option.value = entry.name;
      option.textContent = entry.name.replace(/_/g, " ");
      baseSelect.append(option);
    }
    baseSelect.value = clip;
  }

  async function start() {
    restore(readSettings());
    applyPoseState();
    fillLibrary();
    drawQueue();
    build();
    running = true;
    lastFrame = null;
    clipTime = 0;
    startedAt = performance.now();
    await studio.setLive(true);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("contextmenu", blockMenu);
    canvas.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);
    requestAnimationFrame(frame);
    status(
      mode === "rain"
        ? "Arrows or WASD drift. Hold Z/X turn, Q/E roll, R/F tilt, C faces the camera. Space records."
        : "Arrow keys or WASD to swim, or drag on the frame. Space records.",
    );
  }

  async function stop() {
    running = false;
    if (recorder) recorder.stop();
    await studio.setLive(false);
    window.removeEventListener("keydown", keyDown);
    window.removeEventListener("keyup", keyUp);
    canvas.removeEventListener("pointerdown", pointerDown);
    canvas.removeEventListener("contextmenu", blockMenu);
    canvas.removeEventListener("wheel", wheel);
    window.removeEventListener("pointermove", pointerMove);
    window.removeEventListener("pointerup", pointerUp);
    held = new Set();
    pointer = null;
  }

  fillClips();
  for (const control of [
    clipSelect,
    poseSelect,
    modeSelect,
    baseSelect,
    speedInput,
    tumbleInput,
    angleInput,
    rollInput,
    tiltInput,
  ])
    control.addEventListener("change", () => saveSettings(performance.now() + 1000));

  clipSelect.addEventListener("change", () => {
    clip = clipSelect.value;
    baseSelect.value = clip;
    if (!triggered) studio.playClip(clip, { fade: 0.4 });
    drawQueue();
  });
  baseSelect.addEventListener("change", () => {
    clip = baseSelect.value;
    if ([...clipSelect.options].some((option) => option.value === clip)) clipSelect.value = clip;
    if (!triggered) studio.playClip(clip, { fade: 0.4 });
    saveSettings(performance.now() + 1000);
    drawQueue();
  });
  poseSelect.addEventListener("change", () => {
    pose = poseSelect.value;
    applyPoseState();
    saveSettings(performance.now() + 1000);
  });
  angleInput.addEventListener("input", () => {
    turn.degrees = Number(angleInput.value);
  });
  rollInput.addEventListener("input", () => {
    rollAngle.degrees = Number(rollInput.value);
  });
  tiltInput.addEventListener("input", () => {
    tiltAngle.degrees = Number(tiltInput.value);
  });
  tumbleInput.addEventListener("input", () => {
    tumble = Number(tumbleInput.value);
  });
  modeSelect.addEventListener("change", () => {
    mode = modeSelect.value;
    fillClips();
    // The rain is a floating shot; landing in it standing upright is never what
    // was wanted, so the attitude resets with the mode.
    if (mode === "rain") {
      pose = "float";
      turn.degrees = 90;
      rollAngle.degrees = 0;
      tiltAngle.degrees = 0;
      poseSelect.value = pose;
      applyPoseState();
      angleInput.value = "90";
      rollInput.value = "0";
      tiltInput.value = "0";
    }
    build();
    startedAt = performance.now();
    status(
      mode === "rain"
        ? "Arrows or WASD drift. Hold Z/X turn, Q/E roll, R/F tilt, C faces the camera. Space records."
        : "Arrow keys or WASD to swim, or drag on the frame. Space records.",
    );
  });
  speedInput.addEventListener("input", () => {
    speed = Number(speedInput.value);
    game?.setSpeed(speed);
    float?.setSpeed(speed);
  });
  /**
   * Turns the figure to face the camera without touching how it is pointed in
   * the frame: roll and tilt are what decide which way it looks, and hunting
   * them by hand is fiddly once a tumble has moved them.
   */
  function faceCamera() {
    if (pose !== "float") {
      pose = "float";
      poseSelect.value = pose;
      applyPoseState();
    }
    rollAngle.degrees = 0;
    tiltAngle.degrees = 0;
    rollInput.value = "0";
    tiltInput.value = "0";
    saveSettings(performance.now() + 1000);
    status("Facing the camera. Tumble will drift again from here.");
  }

  faceButton.addEventListener("click", faceCamera);
  recordButton.addEventListener("click", toggleRecording);
  playButton.addEventListener("click", () => {
    build();
    startedAt = performance.now();
  });

  return { start, stop };
}
