import {
  boxAt,
  upsertKeyframe,
  normalizedBox,
  validateProject,
} from "./model.mjs";
const $ = (id) => document.getElementById(id),
  canvas = $("canvas"),
  ctx = canvas.getContext("2d"),
  overlay = $("overlay");
let manifest = [],
  project,
  revision = 0,
  asset,
  selected = null,
  mode = "draw",
  time = 0,
  media = null,
  ready = false,
  drag = null,
  defaults = { style: "blur", strength: 6, color: "#242424" },
  history = [],
  dirty = false,
  saving = false,
  saveTimer,
  saveBlocked = false,
  loadToken = 0,
  playing = false;
const mediaName = (a) =>
  a.kind === "video" ? a.name.replace(/ raw$/, "") : a.name;
const clone = (v) => structuredClone(v),
  stamp = (t) =>
    `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`,
  keytime = () => (asset.kind === "video" ? Math.round(time * 1000) / 1000 : 0);
const entry = () =>
  project.assets[asset.id] ?? {
    sourceHash: asset.sha256,
    status: asset.deferred ? "deferred" : "unreviewed",
    notes: "",
    tracks: [],
    checkpoints: [...asset.checkpoints],
    reviewedCheckpoints: [],
  };
function editable() {
  return (project.assets[asset.id] ??= entry());
}
const target = () => entry().tracks.find((t) => t.id === selected);
function remember() {
  history.push(clone(project));
  if (history.length > 60) history.shift();
  $("undo").disabled = false;
}
function status(message, error = false) {
  $("save-status").textContent = message;
  $("save-status").dataset.error = String(error);
}
function changed() {
  dirty = true;
  status("Unsaved changes…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 500);
}
async function save() {
  if (!dirty || saving || saveBlocked) return;
  saving = true;
  dirty = false;
  try {
    const r = await fetch("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision, project }),
    });
    const d = await r.json();
    if (!r.ok) {
      saveBlocked = r.status === 409;
      throw Error(d.error);
    }
    revision = d.revision;
    status("Saved on this Mac");
  } catch (e) {
    dirty = true;
    status(`${e.message} Export a backup.`, true);
  } finally {
    saving = false;
    if (dirty && !saveBlocked) saveTimer = setTimeout(save, 3000);
  }
}
function mutate(fn) {
  remember();
  fn();
  changed();
  renderUI();
  render();
}
function renderLibrary() {
  const filter = $("filter").value,
    q = $("search").value.toLowerCase();
  $("library").replaceChildren();
  let group = "";
  const sorted = [...manifest].sort(
    (a, b) => Number(a.client) - Number(b.client),
  );
  for (const a of sorted) {
    const state = project.assets[a.id];
    if (filter === "focus" && (a.client || a.deferred)) continue;
    if (filter === "marked" && !state?.tracks.length) continue;
    if (filter === "deferred" && !a.deferred && state?.status !== "deferred")
      continue;
    if (q && !`${a.name} ${a.record}`.toLowerCase().includes(q)) continue;
    if (group !== a.record) {
      group = a.record;
      const label = document.createElement("div");
      label.className = "group-label";
      label.textContent = group.replaceAll("-", " ");
      $("library").append(label);
    }
    const b = document.createElement("button");
    b.dataset.active = String(asset?.id === a.id);
    b.dataset.asset = a.id;
    b.append(document.createTextNode(mediaName(a)));
    const sub = document.createElement("small");
    sub.textContent = `${a.kind === "video" ? `${stamp(a.duration)} recording` : a.kind === "interactive" ? "Interactive dashboard" : "Image"} · ${state?.tracks.length ? `${state.tracks.length} targets` : state?.status || (a.deferred ? "deferred" : "unreviewed")}`;
    b.append(sub);
    b.onclick = () => loadAsset(a);
    $("library").append(b);
  }
}
function checkpointTimes() {
  return [
    ...new Set([
      ...asset.checkpoints,
      ...entry().checkpoints,
      ...entry().tracks.flatMap((t) => t.keyframes.map((k) => k.time)),
    ]),
  ].sort((a, b) => a - b);
}
function renderCheckpoints() {
  const points = checkpointTimes();
  const reviewed = entry().reviewedCheckpoints || [];
  $("review-checkpoint").textContent = reviewed.some(
    (t) => Math.abs(t - time) < 0.12,
  )
    ? "Checkpoint reviewed ✓"
    : "Mark checkpoint reviewed";
  $("review-progress").textContent = `${reviewed.length} reviewed`;
  $("checkpoints").replaceChildren();
  for (const t of points) {
    const b = document.createElement("button");
    b.textContent = stamp(t);
    b.title = `${t.toFixed(3)} seconds`;
    b.dataset.time = t;
    b.dataset.reviewed = String(reviewed.some((r) => Math.abs(t - r) < 0.12));
    b.dataset.active = String(Math.abs(t - time) < 0.15);
    b.dataset.marked = String(
      entry().tracks.some((tr) =>
        tr.keyframes.some((k) => Math.abs(k.time - t) < 0.12),
      ),
    );
    b.onclick = () => seek(t);
    $("checkpoints").append(b);
  }
}
function renderUI() {
  if (!asset) return;
  $("asset-status").value = entry().status;
  $("asset-notes").value = entry().notes;
  $("target-count").textContent = entry().tracks.length;
  $("target-help").hidden =
    !!entry().tracks.length && entry().status === "marked";
  $("target-help").textContent = entry().tracks.length
    ? "Saved boxes are inactive while this asset is kept unchanged or deferred."
    : "Nothing hidden yet. Draw your first box on the media.";
  $("targets").replaceChildren();
  for (const t of entry().tracks) {
    const b = document.createElement("button");
    b.dataset.active = String(t.id === selected);
    b.append(document.createTextNode(t.label));
    const small = document.createElement("small");
    small.textContent = `${t.style} · ${t.keyframes.length} marked ${t.keyframes.length === 1 ? "checkpoint" : "checkpoints"}`;
    b.append(small);
    b.onclick = () => {
      selected = t.id;
      setMode("select");
      renderUI();
      render();
    };
    $("targets").append(b);
  }
  const t = target(),
    look = t || defaults;
  $("target-controls").hidden = !t;
  document
    .querySelectorAll("[data-style]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.style === look.style)),
    );
  $("strength").value = look.strength;
  $("strength-value").textContent = look.strength;
  $("strength-label").hidden = look.style === "solid";
  $("color-label").hidden = look.style !== "solid";
  $("color").value = look.color;
  if (t) {
    $("target-name").value = t.label;
    $("scope").value = t.scope;
    $("scope").closest("label").hidden = asset.kind !== "video";
    $("range-controls").hidden = t.scope !== "fixed" || asset.kind !== "video";
    $("start").value = t.start ?? 0;
    $("end").value = t.end ?? asset.duration ?? 0;
    $("anchor-count").textContent = t.keyframes
      .map((k) => stamp(k.time))
      .join(" · ");
    $("same-target").hidden = asset.kind !== "video";
    $("same-target").disabled = !!boxAt(t, time);
    $("remove-anchor").disabled = !t.keyframes.some(
      (k) => Math.abs(k.time - keytime()) < 0.12,
    );
  }
  renderLibrary();
  renderCheckpoints();
  $("undo").disabled = !history.length;
}
function fitStage() {
  if (!ready) return;
  const choice = $("zoom").value,
    scale = Number(choice),
    fit = Math.min(
      $("stage-scroll").clientWidth,
      (innerHeight * 0.63 * canvas.width) / canvas.height,
    ),
    width =
      choice === "native"
        ? canvas.width / (window.devicePixelRatio || 1)
        : scale === 1
          ? fit
          : $("stage-scroll").clientWidth * scale;
  $("stage").style.width = `${width}px`;
  $("stage").style.margin =
    width <= $("stage-scroll").clientWidth ? "0 auto" : "0";
}
function size() {
  return { w: canvas.width, h: canvas.height };
}
const temp = document.createElement("canvas"),
  tc = temp.getContext("2d");
function paintBox(box, look) {
  const { w, h } = size(),
    x = box.x * w,
    y = box.y * h,
    bw = box.w * w,
    bh = box.h * h;
  if (look.style === "solid") {
    ctx.fillStyle = look.color;
    ctx.fillRect(x, y, bw, bh);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, bw, bh);
  ctx.clip();
  if (look.style === "blur" && "filter" in ctx) {
    ctx.filter = `blur(${look.strength}px)`;
    ctx.drawImage(media, 0, 0, w, h);
  } else {
    const factor =
      look.style === "pixelate" ? look.strength * 2 : look.strength * 1.5;
    temp.width = Math.max(1, Math.ceil(bw / factor));
    temp.height = Math.max(1, Math.ceil(bh / factor));
    tc.imageSmoothingEnabled = true;
    tc.drawImage(media, x, y, bw, bh, 0, 0, temp.width, temp.height);
    ctx.imageSmoothingEnabled = look.style === "blur";
    ctx.drawImage(temp, 0, 0, temp.width, temp.height, x, y, bw, bh);
  }
  ctx.restore();
}
function visible() {
  return entry()
    .tracks.map((t) => ({ t, box: boxAt(t, time) }))
    .filter((x) => x.box);
}
function render() {
  if (!ready) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
  const boxes = visible();
  if ($("preview").checked && entry().status === "marked")
    for (const { t, box } of boxes) paintBox(box, t);
  overlay.replaceChildren();
  if ($("outlines").checked)
    for (const { t, box } of boxes) outline(box, t.id === selected);
  if (drag?.kind === "draw" && drag.box) outline(drag.box, true);
}
function outline(b, active) {
  const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  for (const [k, v] of Object.entries({
    x: b.x * 1000,
    y: b.y * 1000,
    width: b.w * 1000,
    height: b.h * 1000,
  }))
    r.setAttribute(k, v);
  r.dataset.selected = String(active);
  overlay.append(r);
  if (active && mode === "select") {
    const c = document.createElementNS(r.namespaceURI, "circle");
    c.setAttribute("cx", (b.x + b.w) * 1000);
    c.setAttribute("cy", (b.y + b.h) * 1000);
    c.setAttribute("r", 6);
    overlay.append(c);
  }
}
async function loadAsset(a) {
  pause();
  loadToken++;
  const token = loadToken;
  asset = a;
  selected = null;
  time = 0;
  ready = false;
  if (media?.tagName === "VIDEO") {
    media.removeAttribute("src");
    media.load();
  }
  media = null;
  $("stage").hidden = a.kind === "interactive";
  $("empty").hidden = a.kind !== "interactive";
  $("empty").textContent =
    a.record === "real-estate"
      ? "This dashboard is interactive, rather than an image. Record any naming or anonymization decisions in the notes below. The pending site edit removes the client name and labels demonstration data."
      : "This work sample is interactive. Record any text or identity decisions in the notes below. Its screenshot appears separately in the media list.";
  $("video-controls").hidden = a.kind !== "video";
  $("record").textContent = a.record.replaceAll("-", " ");
  $("asset-name").textContent = mediaName(a);
  $("source-info").textContent =
    a.kind === "interactive"
      ? "Interactive work sample"
      : a.kind === "video"
        ? "Loading the existing site video…"
        : "Loading the existing site image…";
  $("open-source").hidden = !a.src;
  $("open-source").href = `/media/${encodeURIComponent(a.id)}`;
  $("prior-note").textContent = a.priorNote
    ? `Your earlier note: ${a.priorNote}`
    : "";
  $("timeline").value = 0;
  $("time").value = 0;
  $("zoom").value = "1";
  $("stage").style.width = "100%";
  renderUI();
  if (a.kind === "interactive") return;
  const m = document.createElement(a.kind === "video" ? "video" : "img");
  media = m;
  const loaded = () => {
    if (token !== loadToken) return;
    canvas.width = a.kind === "video" ? m.videoWidth : m.naturalWidth;
    canvas.height = a.kind === "video" ? m.videoHeight : m.naturalHeight;
    ready = true;
    $("source-info").textContent =
      `${a.kind === "video" ? "Video frame" : "Site image"} · ${canvas.width} × ${canvas.height} source pixels · ${a.src.split("/").at(-1)}`;
    fitStage();
    render();
  };
  m.onerror = () => status("Could not load this original file.", true);
  if (a.kind === "video") {
    m.muted = true;
    m.playsInline = true;
    m.preload = "auto";
    m.onloadeddata = loaded;
    m.onseeked = () => {
      if (token !== loadToken) return;
      time = Math.min(a.duration, m.currentTime);
      updateTime();
      renderUI();
      render();
    };
    m.onended = pause;
    $("timeline").max = Math.max(0, a.duration - 1 / 30);
    $("time").max = a.duration;
    $("duration").textContent = `/ ${stamp(a.duration)}`;
  } else m.onload = loaded;
  m.src = `/media/${encodeURIComponent(a.id)}`;
}
function updateTime() {
  $("timeline").value = time;
  $("time").value = time.toFixed(2);
  renderCheckpoints();
}
function pause() {
  playing = false;
  if (media?.tagName === "VIDEO") media.pause();
  $("play").textContent = "Play";
}
function seek(t) {
  if (!ready || asset.kind !== "video") return;
  pause();
  media.currentTime = Math.max(0, Math.min(asset.duration - 1 / 30, t));
}
function setMode(m) {
  mode = m;
  $("draw").setAttribute("aria-pressed", String(m === "draw"));
  $("select").setAttribute("aria-pressed", String(m === "select"));
  canvas.style.cursor = m === "draw" ? "crosshair" : "default";
}
function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
  };
}
canvas.onpointerdown = (e) => {
  if (!ready || e.button !== 0) return;
  pause();
  canvas.focus();
  const p = point(e);
  canvas.setPointerCapture(e.pointerId);
  if (mode === "draw") {
    drag = { kind: "draw", from: p, box: null };
    return;
  }
  const hit = visible()
    .reverse()
    .find(
      ({ box: b }) =>
        p.x >= b.x - 0.005 &&
        p.x <= b.x + b.w + 0.012 &&
        p.y >= b.y - 0.005 &&
        p.y <= b.y + b.h + 0.012,
    );
  if (!hit) {
    selected = null;
    renderUI();
    render();
    return;
  }
  selected = hit.t.id;
  const rect = canvas.getBoundingClientRect(),
    resize =
      Math.abs(p.x - hit.box.x - hit.box.w) * rect.width < 12 &&
      Math.abs(p.y - hit.box.y - hit.box.h) * rect.height < 12;
  drag = {
    kind: resize ? "resize" : "move",
    from: p,
    original: clone(hit.box),
    before: clone(project),
    moved: false,
  };
  renderUI();
  render();
};
canvas.onpointermove = (e) => {
  if (!drag) return;
  const p = point(e);
  if (drag.kind === "draw") drag.box = normalizedBox(drag.from, p);
  else {
    const b = drag.original;
    const box =
      drag.kind === "resize"
        ? {
            ...b,
            w: Math.max(0.001, Math.min(1 - b.x, p.x - b.x)),
            h: Math.max(0.001, Math.min(1 - b.y, p.y - b.y)),
          }
        : {
            ...b,
            x: Math.max(0, Math.min(1 - b.w, b.x + p.x - drag.from.x)),
            y: Math.max(0, Math.min(1 - b.h, b.y + p.y - drag.from.y)),
          };
    upsertKeyframe(target(), keytime(), box);
    drag.moved = true;
  }
  render();
};
canvas.onpointerup = () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.kind === "draw" && d.box?.w > 0.001 && d.box?.h > 0.001) {
    remember();
    const a = editable(),
      id = crypto.randomUUID();
    a.tracks.push({
      id,
      label: `Target ${a.tracks.length + 1}`,
      ...defaults,
      scope: asset.kind === "video" ? "follow" : "fixed",
      start: 0,
      end: asset.duration || 0,
      keyframes: [{ time: keytime(), box: d.box }],
    });
    a.status = "marked";
    selected = id;
    changed();
  } else if (d.moved) {
    history.push(d.before);
    changed();
  }
  renderUI();
  render();
};
canvas.onpointercancel = () => {
  if (drag?.before) project = drag.before;
  drag = null;
  render();
};
canvas.onkeydown = (e) => {
  if (e.key === "Delete" || e.key === "Backspace") {
    if (target()) {
      e.preventDefault();
      deleteTarget();
    }
  } else if (e.key === "Escape") {
    selected = null;
    renderUI();
    render();
  } else if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) &&
    target()
  ) {
    const b = boxAt(target(), time);
    if (!b) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    mutate(() =>
      upsertKeyframe(target(), keytime(), {
        ...b,
        x: Math.max(
          0,
          Math.min(
            1 - b.w,
            b.x +
              (e.key === "ArrowRight"
                ? step
                : e.key === "ArrowLeft"
                  ? -step
                  : 0) /
                canvas.width,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            1 - b.h,
            b.y +
              (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0) /
                canvas.height,
          ),
        ),
      }),
    );
  }
};
function deleteTarget() {
  mutate(() => {
    editable().tracks = entry().tracks.filter((t) => t.id !== selected);
    selected = null;
  });
}
$("draw").onclick = () => setMode("draw");
$("select").onclick = () => setMode("select");
$("filter").onchange = renderLibrary;
$("search").oninput = renderLibrary;
$("preview").onchange = render;
$("outlines").onchange = render;
$("zoom").onchange = fitStage;
window.addEventListener("resize", fitStage);
$("undo").onclick = () => {
  if (!history.length) return;
  project = history.pop();
  selected = null;
  changed();
  renderUI();
  render();
};
$("asset-status").onchange = () => {
  const value = $("asset-status").value;
  mutate(() => (editable().status = value));
};
$("asset-notes").onchange = () => {
  const value = $("asset-notes").value;
  mutate(() => (editable().notes = value));
};
for (const b of document.querySelectorAll("[data-style]"))
  b.onclick = () => {
    defaults.style = b.dataset.style;
    if (target()) mutate(() => (target().style = defaults.style));
    else renderUI();
  };
$("strength").oninput = () => {
  defaults.strength = Number($("strength").value);
  if (target()) mutate(() => (target().strength = defaults.strength));
  else renderUI();
};
$("color").oninput = () => {
  defaults.color = $("color").value;
  if (target()) mutate(() => (target().color = defaults.color));
  else renderUI();
};
$("target-name").onchange = () => {
  const value = $("target-name").value.trim() || "Untitled target";
  mutate(() => (target().label = value));
};
$("scope").onchange = () => {
  const value = $("scope").value;
  mutate(() => {
    target().scope = value;
    if (value === "fixed") {
      target().start = 0;
      target().end = asset.duration || 0;
    }
  });
};
for (const k of ["start", "end"])
  $(k).onchange = () => {
    const value = Number($(k).value),
      t = target();
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > asset.duration ||
      (k === "start" && value > t.end) ||
      (k === "end" && value < t.start)
    ) {
      renderUI();
      return;
    }
    mutate(() => (target()[k] = value));
  };
$("same-target").onclick = () => {
  const t = target();
  if (!t) return;
  mutate(() =>
    upsertKeyframe(
      t,
      keytime(),
      clone(
        t.keyframes.reduce((a, b) =>
          Math.abs(a.time - time) < Math.abs(b.time - time) ? a : b,
        ).box,
      ),
    ),
  );
  setMode("select");
};
$("remove-anchor").onclick = () =>
  mutate(() => {
    const t = target();
    t.keyframes = t.keyframes.filter(
      (k) => Math.abs(k.time - keytime()) >= 0.12,
    );
    if (!t.keyframes.length) {
      editable().tracks = entry().tracks.filter((x) => x.id !== t.id);
      selected = null;
    }
  });
$("delete-target").onclick = deleteTarget;
$("timeline").oninput = () => seek(Number($("timeline").value));
$("time").onchange = () => seek(Number($("time").value));
$("back").onclick = () => seek(time - 1 / 30);
$("forward").onclick = () => seek(time + 1 / 30);
$("checkpoint").onclick = () =>
  mutate(() => {
    const a = editable();
    if (!a.checkpoints.some((t) => Math.abs(t - time) < 0.12))
      a.checkpoints.push(keytime());
  });
$("previous-checkpoint").onclick = () =>
  seek([...checkpointTimes()].reverse().find((t) => t < time - 0.15) ?? 0);
$("next-checkpoint").onclick = () =>
  seek(
    checkpointTimes().find((t) => t > time + 0.15) ?? asset.duration - 1 / 30,
  );
$("review-checkpoint").onclick = () =>
  mutate(() => {
    const a = editable(),
      t = keytime();
    a.reviewedCheckpoints ??= [];
    if (a.reviewedCheckpoints.some((r) => Math.abs(r - t) < 0.12))
      a.reviewedCheckpoints = a.reviewedCheckpoints.filter(
        (r) => Math.abs(r - t) >= 0.12,
      );
    else a.reviewedCheckpoints.push(t);
    if (!a.checkpoints.some((r) => Math.abs(r - t) < 0.12))
      a.checkpoints.push(t);
  });
$("play").onclick = async () => {
  if (!ready) return;
  if (playing) {
    pause();
    return;
  }
  try {
    await media.play();
    playing = true;
    $("play").textContent = "Pause";
    let last = 0;
    const frame = (now) => {
      if (!playing) return;
      if (now - last > 100) {
        last = now;
        time = media.currentTime;
        $("timeline").value = time;
        $("time").value = time.toFixed(2);
        render();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  } catch (e) {
    status(e.message, true);
  }
};
$("export").onclick = async () => {
  await save();
  const exported = {
    ...clone(project),
    exportedAt: new Date().toISOString(),
    purpose:
      "User-selected redaction targets. Follow-content tracks require propagation and rendered review before site replacement.",
    sources: manifest.map(
      ({ id, src, sha256, duration, width, height, kind }) => ({
        id,
        src,
        sha256,
        duration,
        width,
        height,
        kind,
      }),
    ),
    applicationPolicy:
      "Only assets with status marked authorize applying targets. Keep and deferred assets remain unchanged.",
    baseCommit: document.body.dataset.baseCommit,
    coordinateSpace: "normalized-source",
    treatmentUnits: "source pixels",
    preview: "follow-content targets show only at annotated checkpoints",
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "portfolio-redaction-selections.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("import").onclick = () => $("import-file").click();
$("import-file").onchange = async () => {
  const file = $("import-file").files[0];
  if (!file) return;
  try {
    const p = JSON.parse(await file.text());
    for (const s of p.sources || []) {
      const a = manifest.find((a) => a.id === s.id);
      if (!a || a.sha256 !== s.sha256)
        throw Error(
          "This export belongs to different source media. Saved work was not changed.",
        );
    }
    const valid = validateProject(p, manifest);
    remember();
    project = valid;
    selected = null;
    changed();
    renderUI();
    render();
  } catch (e) {
    status(e.message, true);
  }
  $("import-file").value = "";
};
window.addEventListener("beforeunload", (e) => {
  if (dirty || saving) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
try {
  const r = await fetch("/api/project");
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Could not load studio");
  manifest = data.manifest;
  project = data.project;
  revision = data.revision;
  document.body.dataset.baseCommit = data.baseCommit || "";
  $("base-commit").textContent = data.baseCommit
    ? `· ${data.baseCommit.slice(0, 7)}`
    : "";
  status(revision ? "Saved on this Mac" : "No selections yet");
  await loadAsset(manifest.find((a) => a.id === "66") || manifest[0]);
} catch (e) {
  status(e.message, true);
}
