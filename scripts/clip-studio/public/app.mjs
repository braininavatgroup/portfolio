/**
 * The clip studio's authoring page: a live preview on the left, controls for
 * every value in the spec on the right. Edits repaint the current frame, Save
 * writes the spec file, and Render runs the same headless renderer the command
 * line uses. The headless renderer drives this page through `window.clipStudio`.
 */
import { createClipStudio } from "./studio.mjs";
import { createLiveMode } from "./live.mjs";
import {
  backgroundFilms,
  backgroundKinds,
  clipNames,
  framings,
  shotAt,
  textureKinds,
  themes,
} from "./spec.mjs";

const canvas = document.getElementById("frame"),
  status = document.getElementById("status"),
  scrub = document.getElementById("scrub"),
  timeLabel = document.getElementById("time"),
  playButton = document.getElementById("play"),
  specSelect = document.getElementById("spec"),
  saveButton = document.getElementById("save"),
  renderButton = document.getElementById("render"),
  shotList = document.getElementById("shots"),
  shotCount = document.getElementById("shot-count"),
  shotFields = document.getElementById("shot-fields"),
  backgroundFields = document.getElementById("background-fields"),
  frameFields = document.getElementById("frame-fields"),
  sceneFields = document.getElementById("scene-fields"),
  jsonBox = document.getElementById("json"),
  applyJson = document.getElementById("apply-json"),
  fitButton = document.getElementById("fit-duration"),
  playPanel = document.getElementById("play-panel"),
  editPanel = document.getElementById("edit-panel"),
  modeButtons = [...document.querySelectorAll("[data-mode]")],
  transport = document.querySelector(".clip-studio-transport"),
  params = new URLSearchParams(location.search),
  headless = params.get("headless") === "1";

/** Reads and writes a nested spec value from a `shots.2.orbit.0` style path. */
function at(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function put(object, path, value) {
  const keys = path.split("."),
    last = keys.pop();
  let target = object;
  for (const key of keys) {
    if (target[key] === null || target[key] === undefined) target[key] = {};
    target = target[key];
  }
  target[last] = value;
}

function field(definition) {
  const label = document.createElement("label"),
    caption = document.createElement("span");
  label.className = "clip-studio-field";
  caption.textContent = definition.label;
  label.append(caption);

  let input;
  if (definition.kind === "select") {
    input = document.createElement("select");
    for (const option of definition.options) {
      const element = document.createElement("option");
      element.value = String(option);
      element.textContent = String(option);
      input.append(element);
    }
  } else if (definition.kind === "textarea") {
    input = document.createElement("textarea");
    input.rows = 2;
  } else {
    input = document.createElement("input");
    input.type = definition.kind === "list" ? "text" : definition.kind;
    if (definition.kind === "number" || definition.kind === "range") {
      input.min = definition.min;
      input.max = definition.max;
      input.step = definition.step ?? 0.01;
    }
  }
  input.dataset.path = definition.path;
  input.dataset.kind = definition.kind;
  if (definition.nullable) input.dataset.nullable = "true";
  label.append(input);
  return { label, input, caption };
}

const shotDefinitions = (index) => [
  { label: "Clip", kind: "select", options: clipNames, path: `shots.${index}.clip` },
  { label: "Seconds", kind: "number", min: 0.2, max: 60, step: 0.1, path: `shots.${index}.duration` },
  { label: "Framing", kind: "select", options: Object.keys(framings), path: `shots.${index}.framing` },
  { label: "Transition", kind: "select", options: ["cut", "dip"], path: `shots.${index}.transition` },
  { label: "Orbit from °", kind: "number", min: -180, max: 180, step: 1, path: `shots.${index}.orbit.0` },
  { label: "Orbit to °", kind: "number", min: -180, max: 180, step: 1, path: `shots.${index}.orbit.1` },
  { label: "Dolly from", kind: "number", min: 0.3, max: 3, step: 0.02, path: `shots.${index}.dolly.0` },
  { label: "Dolly to", kind: "number", min: 0.3, max: 3, step: 0.02, path: `shots.${index}.dolly.1` },
  { label: "Speed", kind: "number", min: 0.05, max: 4, step: 0.05, path: `shots.${index}.rate` },
  { label: "Start in clip", kind: "number", min: 0, max: 30, step: 0.1, path: `shots.${index}.offset` },
  { label: "Loop", kind: "checkbox", path: `shots.${index}.loop` },
  { label: "Motion", kind: "select", options: ["stand", "swim"], path: `shots.${index}.motion` },
  { label: "Swim speed", kind: "number", min: 0.1, max: 4, step: 0.05, path: `shots.${index}.swimSpeed` },
  { label: "Swim seed", kind: "number", min: 0, max: 9999, step: 1, path: `shots.${index}.seed` },
  { label: "Kicker", kind: "text", nullable: true, path: `shots.${index}.text.kicker` },
  { label: "Title", kind: "textarea", nullable: true, path: `shots.${index}.text.title` },
  { label: "Subtitle", kind: "textarea", nullable: true, path: `shots.${index}.text.subtitle` },
  { label: "Text place", kind: "select", options: ["lower", "upper", "center"], path: `shots.${index}.text.place` },
  { label: "Text align", kind: "select", options: ["left", "center"], path: `shots.${index}.text.align` },
];

const backgroundDefinitions = [
  { label: "Kind", kind: "select", options: backgroundKinds, path: "background.kind" },
  { label: "Film", kind: "select", options: backgroundFilms, path: "background.film" },
  { label: "Drift", kind: "range", min: 0, max: 4, step: 0.05, path: "background.speed" },
  { label: "Colour", kind: "range", min: 0, max: 2, step: 0.05, path: "background.intensity" },
  { label: "Smoothing", kind: "range", min: 0, max: 0.95, step: 0.05, path: "background.smoothing" },
  { label: "Rules", kind: "checkbox", path: "background.rules" },
  { label: "Glow", kind: "checkbox", path: "background.glow" },
  { label: "Texture", kind: "select", options: textureKinds, path: "texture" },
  { label: "Texture amount", kind: "range", min: 0, max: 0.2, step: 0.005, path: "grain" },
  { label: "Vignette", kind: "range", min: 0, max: 1, step: 0.01, path: "vignette" },
];

/** The falling map and its treatment — play mode's dials, for a scripted clip. */
const sceneDefinitions = [
  { label: "Falling nodes", kind: "checkbox", path: "rain.enabled" },
  { label: "Falling count", kind: "range", min: 0, max: 120, step: 1, path: "rain.count" },
  { label: "Fall speed", kind: "range", min: 0, max: 4, step: 0.05, path: "rain.speed" },
  { label: "Node size", kind: "range", min: 0.2, max: 6, step: 0.1, path: "rain.scale" },
  { label: "Haze", kind: "range", min: 0, max: 0.4, step: 0.005, path: "rain.fog" },
  { label: "Labels", kind: "checkbox", path: "rain.labels" },
  { label: "Fall seed", kind: "number", min: 0, max: 9999, step: 1, path: "rain.seed" },
  { label: "Camera drift", kind: "range", min: 0, max: 3, step: 0.05, path: "cameraDrift" },
  { label: "Echo", kind: "range", min: 0, max: 0.9, step: 0.01, path: "echo" },
  { label: "Echo style", kind: "select", options: ["fall", "tunnel"], path: "echoStyle" },
  { label: "Trails", kind: "range", min: 0, max: 2, step: 0.05, path: "trails" },
  { label: "Camera sway", kind: "range", min: 0, max: 0.4, step: 0.005, path: "sway" },
  { label: "Blend seconds", kind: "range", min: 0, max: 2, step: 0.05, path: "blend" },
  { label: "Hide nodes", kind: "list", path: "hidden" },
  { label: "Logo colour", kind: "text", path: "palette.registers.identity" },
];

const frameDefinitions = [
  { label: "Name", kind: "text", path: "name" },
  { label: "Seconds", kind: "number", min: 1, max: 180, step: 0.5, path: "duration" },
  { label: "Theme", kind: "select", options: Object.keys(themes), path: "theme" },
  { label: "Width", kind: "number", min: 64, max: 4096, step: 1, path: "width" },
  { label: "Height", kind: "number", min: 64, max: 4096, step: 1, path: "height" },
  { label: "Frames per second", kind: "number", min: 1, max: 60, step: 1, path: "fps" },
  { label: "Dip depth", kind: "range", min: 0, max: 1, step: 0.01, path: "dipDepth" },
  { label: "Watermark", kind: "text", nullable: true, path: "watermark" },
  { label: "Brand mark", kind: "checkbox", path: "mark" },
];

async function loadSpec(name) {
  const response = await fetch(`/api/specs/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(`Spec "${name}" is not available`);
  return response.json();
}

/**
 * Edits are kept in the browser as a working copy, so a reload never loses a
 * session's tuning. Save writes the file and clears it.
 */
const draftKey = (name) => `clip-studio-draft-${name}`;

function readDraft(name) {
  try {
    const held = localStorage.getItem(draftKey(name));
    return held ? JSON.parse(held) : null;
  } catch {
    return null;
  }
}

function keepDraft(spec) {
  try {
    localStorage.setItem(draftKey(spec.name), JSON.stringify(spec));
  } catch {
    // Storage can be unavailable; Save still writes the file.
  }
}

async function main() {
  const names = await (await fetch("/api/specs")).json(),
    wanted = params.get("spec") ?? names[0];
  if (!wanted) throw new Error("No specs found under scripts/clip-studio/specs");
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === wanted;
    specSelect.append(option);
  }
  specSelect.addEventListener("change", () => {
    params.set("spec", specSelect.value);
    location.search = params.toString();
  });

  let draft = await loadSpec(wanted);
  const working = readDraft(wanted);
  let restoredWorkingCopy = false;
  if (working && JSON.stringify(working) !== JSON.stringify(draft)) {
    draft = working;
    restoredWorkingCopy = true;
  }
  const records = await (await fetch("/api/records")).json().catch(() => []);
  const studio = await createClipStudio({ canvas, spec: draft, records });

  let time = 0,
    playing = false,
    last = null,
    selected = 0,
    dirty = false;

  function note(message, tone = "") {
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function show(next) {
    const total = studio.spec.totalDuration;
    time = Math.min(Math.max(next, 0), total);
    // While the timeline plays the film runs on its own clock; parked, the
    // frame is seeked exactly. The seek is asynchronous, so the frame below
    // draws what it has and repaints when the seek lands.
    if (!playing) studio.prepare(time).then(() => studio.renderFrame(time));
    studio.renderFrame(time);
    scrub.max = String(total);
    scrub.value = String(time);
    timeLabel.textContent = `${time.toFixed(2)} / ${total.toFixed(2)}s`;
    const active = shotAt(studio.spec, time).index;
    [...shotList.children].forEach((item, index) => {
      item.dataset.playing = String(index === active);
    });
  }

  /** Applies the working draft. A rejected draft leaves the last good frame up. */
  function apply({ keepTime = true } = {}) {
    try {
      studio.update(draft);
      dirty = true;
      keepDraft(draft);
      note(
        `${studio.spec.shots.length} shots · ${studio.spec.totalDuration.toFixed(1)}s · ` +
          `${studio.spec.width}×${studio.spec.height} · unsaved`,
      );
      drawShotList();
      jsonBox.value = JSON.stringify(draft, null, 2);
      show(keepTime ? Math.min(time, studio.spec.totalDuration) : 0);
      return true;
    } catch (error) {
      note(error.message, "bad");
      const written = draft.shots.reduce((total, shot) => total + (shot.duration ?? 0), 0);
      shotCount.textContent =
        `${draft.shots.length} · ${written.toFixed(1)}s of ${Number(draft.duration).toFixed(1)}s`;
      fitButton.hidden = false;
      return false;
    }
  }

  function drawShotList() {
    shotList.replaceChildren();
    studio.spec.shots.forEach((shot, index) => {
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${shot.clip} · ${shot.duration.toFixed(1)}s · ${shot.framing}`;
      item.dataset.selected = String(index === selected);
      item.addEventListener("click", () => {
        selected = index;
        drawShotList();
        drawShotFields();
        show(shot.start + 0.001);
      });
      shotList.append(item);
    });
    const written = draft.shots.reduce((total, shot) => total + (shot.duration ?? 0), 0);
    shotCount.textContent =
      `${draft.shots.length} · ${written.toFixed(1)}s of ${Number(draft.duration).toFixed(1)}s`;
    fitButton.hidden = Math.abs(written - draft.duration) < 0.05;
  }

  function bind(container, definitions) {
    container.replaceChildren();
    for (const definition of definitions) {
      const { label, input } = field(definition),
        // A spec file may omit a key; the control still shows what renders.
        raw = at(draft, definition.path),
        value = raw === undefined ? at(studio.spec, definition.path) : raw;
      if (definition.kind === "checkbox") input.checked = Boolean(value ?? true);
      else if (definition.kind === "list") input.value = (value ?? []).join(", ");
      else input.value = value === null || value === undefined ? "" : String(value);
      input.addEventListener(definition.kind === "select" || definition.kind === "checkbox" ? "change" : "input", () => {
        let next;
        if (definition.kind === "checkbox") next = input.checked;
        else if (definition.kind === "list")
          next = input.value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean);
        else if (definition.kind === "number" || definition.kind === "range") next = Number(input.value);
        else next = input.value === "" && definition.nullable ? null : input.value;
        put(draft, definition.path, next);
        apply();
        // A playing film takes its drift as a playback rate, not a seek.
        studio.filmPace?.();
      });
      container.append(label);
    }
  }

  function drawShotFields() {
    const shot = draft.shots[selected];
    if (!shot) {
      shotFields.replaceChildren();
      return;
    }
    // Editing text needs the object to exist; an all-empty block resolves to none.
    shot.orbit ??= [0, 0];
    shot.dolly ??= [1, 1];
    shot.text ??= { kicker: null, title: null, subtitle: null, place: "lower", align: "left" };
    bind(shotFields, shotDefinitions(selected));
  }

  for (const button of document.querySelectorAll("[data-shot-action]")) {
    button.addEventListener("click", () => {
      const action = button.dataset.shotAction,
        shots = draft.shots;
      if (action === "add") {
        shots.splice(selected + 1, 0, { clip: "Idle", duration: 3, framing: "full" });
        selected += 1;
      } else if (action === "duplicate" && shots[selected]) {
        shots.splice(selected + 1, 0, structuredClone(shots[selected]));
        selected += 1;
      } else if (action === "delete" && shots.length > 1) {
        shots.splice(selected, 1);
        selected = Math.max(0, selected - 1);
      } else if (action === "up" && selected > 0) {
        shots.splice(selected - 1, 0, shots.splice(selected, 1)[0]);
        selected -= 1;
      } else if (action === "down" && selected < shots.length - 1) {
        shots.splice(selected + 1, 0, shots.splice(selected, 1)[0]);
        selected += 1;
      } else return;
      if (apply()) drawShotFields();
    });
  }

  /**
   * The clip's length is what it is; shots that do not add up to it are the
   * commonest way to wedge a spec, so this sets the length to the shots.
   */
  fitButton.addEventListener("click", () => {
    draft.duration = Number(
      draft.shots.reduce((total, shot) => total + (shot.duration ?? 0), 0).toFixed(2),
    );
    if (apply()) {
      bind(frameFields, frameDefinitions);
      note(`Clip is now ${draft.duration}s, the length of its shots.`, "good");
    }
  });

  applyJson.addEventListener("click", () => {
    let parsed;
    try {
      parsed = JSON.parse(jsonBox.value);
    } catch (error) {
      note(`That JSON does not parse: ${error.message}`, "bad");
      return;
    }
    const previous = draft;
    draft = parsed;
    if (!apply({ keepTime: false })) {
      draft = previous;
      return;
    }
    selected = 0;
    drawShotFields();
    bind(backgroundFields, backgroundDefinitions);
    bind(sceneFields, sceneDefinitions);
    bind(frameFields, frameDefinitions);
  });

  saveButton.addEventListener("click", async () => {
    const response = await fetch(`/api/specs/${encodeURIComponent(draft.name)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft, null, 2),
    });
    const body = await response.json();
    if (!response.ok) return note(body.error ?? "The spec could not be saved", "bad");
    dirty = false;
    try {
      localStorage.removeItem(draftKey(body.name));
    } catch {
      // Nothing to clear.
    }
    note(`Saved ${body.name}.json`, "good");
    if (![...specSelect.options].some((option) => option.value === body.name)) {
      const option = document.createElement("option");
      option.value = body.name;
      option.textContent = body.name;
      option.selected = true;
      specSelect.append(option);
    }
  });

  renderButton.addEventListener("click", async () => {
    if (dirty) saveButton.click();
    renderButton.disabled = true;
    const started = await fetch(`/api/render/${encodeURIComponent(draft.name)}`, {
      method: "POST",
    });
    if (!started.ok) {
      renderButton.disabled = false;
      return note((await started.json()).error ?? "The render could not start", "bad");
    }
    const poll = setInterval(async () => {
      const state = await (await fetch("/api/render")).json();
      if (state.running) return note(`Rendering ${state.progress ?? ""}`.trim());
      clearInterval(poll);
      renderButton.disabled = false;
      if (state.error) return note(state.error, "bad");
      note(`Rendered ${state.file}`, "good");
    }, 1000);
  });

  playButton.addEventListener("click", () => {
    playing = !playing;
    last = null;
    playButton.textContent = playing ? "Pause" : "Play";
    // Seeking a film every frame cannot keep up in real time, which is what
    // made the background stall. Playing it back is smooth; a parked frame is
    // seeked exactly, and so is every frame of a render.
    studio.setLive(playing);
    if (playing) requestAnimationFrame(tick);
  });

  function tick(now) {
    if (!playing) return;
    if (last !== null) {
      const next = time + (now - last) / 1000;
      show(next >= studio.spec.totalDuration ? 0 : next);
    }
    last = now;
    requestAnimationFrame(tick);
  }

  scrub.addEventListener("input", () => {
    playing = false;
    playButton.textContent = "Play";
    studio.setLive(false);
    show(Number(scrub.value));
  });

  window.clipStudio = {
    get spec() {
      return studio.spec;
    },
    renderFrame: (seconds) => studio.renderFrame(seconds),
    /** Frames leave the page as data URLs; the Node renderer pipes them to ffmpeg. */
    frame: async (seconds, type = "image/png") => {
      await studio.prepare(seconds);
      studio.renderFrame(seconds);
      return canvas.toDataURL(type);
    },
    ready: true,
  };

  const live = createLiveMode({
    studio,
    canvas,
    records,
    elements: {
      playButton: document.getElementById("live-restart"),
      recordButton: document.getElementById("live-record"),
      faceButton: document.getElementById("live-face"),
      clipLibrary: document.getElementById("live-library"),
      queueReadout: document.getElementById("live-queue"),
      baseSelect: document.getElementById("live-base"),
      clipSelect: document.getElementById("live-clip"),
      speedInput: document.getElementById("live-speed"),
      modeSelect: document.getElementById("live-mode"),
      poseSelect: document.getElementById("live-pose"),
      angleInput: document.getElementById("live-angle"),
      rollInput: document.getElementById("live-roll"),
      tiltInput: document.getElementById("live-tilt"),
      tumbleInput: document.getElementById("live-tumble"),
      readout: document.getElementById("live-readout"),
    },
    onStatus: note,
  });

  /**
   * Play mode drives the frame itself, so scripted playback stops while it
   * runs and the timeline transport goes away with it.
   */
  async function setMode(next) {
    playing = false;
    playButton.textContent = "Play";
    for (const button of modeButtons)
      button.ariaSelected = String(button.dataset.mode === next);
    playPanel.hidden = next !== "play";
    editPanel.hidden = next === "play";
    transport.hidden = next === "play";
    if (next === "play") await live.start();
    else {
      await live.stop();
      show(time);
      note(
        `${studio.spec.shots.length} shots · ${studio.spec.totalDuration.toFixed(1)}s · ` +
          `${studio.spec.width}×${studio.spec.height}`,
      );
    }
  }
  for (const button of modeButtons)
    button.addEventListener("click", () => setMode(button.dataset.mode));

  bind(backgroundFields, backgroundDefinitions);
  bind(sceneFields, sceneDefinitions);
  bind(frameFields, frameDefinitions);
  drawShotList();
  drawShotFields();
  jsonBox.value = JSON.stringify(draft, null, 2);
  dirty = false;
  show(0);
  if (headless) {
    // The headless renderer drives the scripted timeline; play mode would fight it.
    playPanel.hidden = true;
    editPanel.hidden = false;
    note("Ready for the headless renderer.");
  } else {
    await setMode(params.get("mode") === "edit" ? "edit" : "play");
    if (restoredWorkingCopy) note("Restored your unsaved edits. Save writes them to the file.", "good");
  }
}

main().catch((error) => {
  status.textContent = error.message;
  window.clipStudioError = error.message;
  console.error(error);
});
