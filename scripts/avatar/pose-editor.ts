import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { avatarAsset } from "../../lib/avatar/config";
import { applyPoseOffsets, createPoseSampler, getWristAngles, makePoseDraft, parsePoseDraft, postureAngles, postureOffset, posturePoints, setWristAngles, solveLimb, straightenWrist, type Limb, type PoseOffsets, type WristAngles } from "../../lib/avatar/pose-editor";

const storageKey = "portfolio-avatar-pose-draft-v1";
const parts = {
  "left-hand": { label: "Left hand", bend: "Left elbow", nodes: ["LeftArm", "LeftForeArm", "LeftHand"] },
  "right-hand": { label: "Right hand", bend: "Right elbow", nodes: ["RightArm", "RightForeArm", "RightHand"] },
  "left-foot": { label: "Left foot", bend: "Left knee", nodes: ["LeftUpLeg", "LeftLeg", "LeftFoot"] },
  "right-foot": { label: "Right foot", bend: "Right knee", nodes: ["RightUpLeg", "RightLeg", "RightFoot"] },
} as const;
type Part = keyof typeof parts;
type Handle = { part: Part; bend: boolean; element: HTMLButtonElement };
const element = <T = HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string) => element<HTMLButtonElement>(id);
const status = (text: string, error = false) => {
  element("status").textContent = text;
  element("status").dataset.error = String(error);
};
const world = (object: THREE.Object3D) => object.getWorldPosition(new THREE.Vector3());

async function startEditor() {
  const stage = element("stage");
  const styles = getComputedStyle(document.body);
  const color = (token: string) => new THREE.Color(styles.getPropertyValue(token).trim());
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute("aria-label", "3D avatar preview");
  stage.insertBefore(renderer.domElement, stage.firstChild);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 30);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.85, 0);
  controls.minDistance = 0.65;
  controls.maxDistance = 6;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.enablePan = true;
  const fit = () => { camera.position.set(0, 0.95, 3.7); controls.target.set(0, 0.85, 0); controls.update(); };
  fit();
  scene.add(new THREE.AmbientLight(color("--prototype-white"), 1.6));
  const light = new THREE.DirectionalLight(color("--prototype-white"), 1.7);
  light.position.set(2, 4, 3); scene.add(light);
  const grid = new THREE.GridHelper(3, 12, color("--ink"), color("--ink"));
  grid.material.transparent = true; grid.material.opacity = 0.1;
  grid.position.y = -0.015; scene.add(grid);

  const response = await fetch(avatarAsset.modelUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Avatar could not load (${response.status}).`);
  const bytes = await response.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const digest = [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, "0")).join("");
  const gltf = await new GLTFLoader().parseAsync(bytes, "/avatars/");
  const model = gltf.scene;
  const group = new THREE.Group();
  group.rotation.x = avatarAsset.standingPitchRadians;
  group.add(model); scene.add(group);
  const clip = gltf.animations.find(clip => clip.name === "Idle");
  if (!clip) throw new Error("The avatar has no Idle animation.");
  const nodes = new Map<string, THREE.Object3D>();
  model.traverse(node => { if (node.type === "Bone") nodes.set(node.name, node); });
  const chains = Object.fromEntries(Object.entries(parts).map(([id, part]) => {
    const [upper, lower, end] = part.nodes.map(name => nodes.get(name));
    if (!upper || !lower || !end) throw new Error(`Missing joints for ${part.label}.`);
    return [id, { upper, lower, end }];
  })) as Record<Part, Limb>;
  const sample = createPoseSampler(model, clip);
  let baseRotations = new Map<string, THREE.Quaternion>();
  let offsets: PoseOffsets = {};
  let selected: Part = "left-hand";
  let editingMode: "limbs" | "posture" = "limbs";
  let posturePoint = "Head";
  let playing = false;
  let playTime = 0;
  let saved = JSON.stringify(offsets);
  const undo: PoseOffsets[] = [];
  const redo: PoseOffsets[] = [];

  function evaluatePose(time = 0) {
    baseRotations = sample(time);
    applyPoseOffsets(model, offsets);
  }
  evaluatePose();

  // Reference axes come from the unedited idle, excluding the stage's pitch.
  const postureBases = new Map<string, THREE.Quaternion>();
  const modelInverse = model.getWorldQuaternion(new THREE.Quaternion()).invert();
  const postureSelect = element<HTMLSelectElement>("posture-point");
  for (const [name, point] of Object.entries(posturePoints)) {
    const node = nodes.get(name);
    if (!node?.parent) throw new Error(`Missing posture joint: ${name}.`);
    postureBases.set(name, modelInverse.clone().multiply(node.parent.getWorldQuaternion(new THREE.Quaternion())));
    const option = document.createElement("option"); option.value = name; option.textContent = point.label;
    postureSelect.appendChild(option);
  }

  const handles: Handle[] = [];
  for (const [id, part] of Object.entries(parts)) {
    for (const bend of [false, true]) {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "portfolio-pose-editor-handle";
      marker.dataset.bend = String(bend);
      marker.dataset.part = id;
      marker.setAttribute("aria-label", `Move ${bend ? part.bend.toLowerCase() : part.label.toLowerCase()}`);
      marker.title = bend ? part.bend : part.label;
      const label = document.createElement("span");
      label.textContent = bend ? part.bend : part.label;
      marker.appendChild(label);
      element("handles").appendChild(marker);
      handles.push({ part: id as Part, bend, element: marker });
    }
  }

  function refreshControls() {
    element("limb-controls").hidden = editingMode !== "limbs";
    element("posture-controls").hidden = editingMode !== "posture";
    button("mode-limbs").setAttribute("aria-pressed", String(editingMode === "limbs"));
    button("mode-posture").setAttribute("aria-pressed", String(editingMode === "posture"));
    postureSelect.disabled = playing;
    const point = posturePoints[posturePoint]!;
    const pointAngles = postureAngles(new THREE.Quaternion(...(offsets[posturePoint] ?? [0, 0, 0, 1])), postureBases.get(posturePoint)!, point.signs);
    for (const input of document.querySelectorAll<HTMLInputElement>("[data-posture]")) {
      const axis = Number(input.dataset.posture);
      const value = Math.round(pointAngles[axis]!);
      input.disabled = playing;
      input.min = String(Math.min(-point.limit, value)); input.max = String(Math.max(point.limit, value));
      input.value = String(value);
      element(`posture-label-${axis}`).textContent = point.labels[axis]!;
      element(`posture-value-${axis}`).textContent = `${value}°`;
    }
    button("reset-posture-point").disabled = playing;
    button("reset-posture").disabled = playing;
    button("undo").disabled = playing || undo.length === 0;
    button("redo").disabled = playing || redo.length === 0;
    for (const control of document.querySelectorAll<HTMLButtonElement>("[data-axis], [data-part]:not(.portfolio-pose-editor-handle), #reset, #import")) {
      control.disabled = playing;
    }
    document.querySelectorAll<HTMLButtonElement>(".portfolio-pose-editor-parts [data-part]").forEach(control => {
      control.setAttribute("aria-pressed", String(control.dataset.part === selected));
    });
    element("selection").textContent = `${parts[selected].label} · fine adjustment`;
    const isHand = selected.endsWith("hand");
    element("wrist-controls").hidden = !isHand;
    element("wrist-title").textContent = selected === "left-hand" ? "Left wrist" : "Right wrist";
    const angles = getWristAngles(chains[selected].end);
    for (const input of document.querySelectorAll<HTMLInputElement>("[data-wrist]")) {
      input.disabled = playing || !isHand;
      const angle = Math.round(angles[input.dataset.wrist as keyof WristAngles]);
      input.value = String(angle);
      element(`${input.id}-value`).textContent = `${angle}°`;
    }
    button("straighten-wrist").disabled = playing || !isHand;
    button("reset-wrist").disabled = playing || !isHand;
    stage.dataset.poseJoints = String(Object.keys(offsets).length);
    stage.dataset.playing = String(playing);
    stage.dataset.dirty = String(JSON.stringify(offsets) !== saved);
    button("preview").textContent = playing ? "Pause to edit" : "Preview idle";
    button("preview").setAttribute("aria-pressed", String(playing));
    element("mode").textContent = playing ? "Playing your edited idle" : "Edit pose · frame 0";
  }

  function captureOffsets(part: Part, wristOnly = false) {
    for (const name of wristOnly ? [parts[part].nodes[2]] : parts[part].nodes) {
      const delta = nodes.get(name)!.quaternion.clone().multiply(baseRotations.get(name)!.clone().invert()).normalize();
      if (delta.angleTo(new THREE.Quaternion()) < 1e-6) delete offsets[name];
      else offsets[name] = delta.toArray();
    }
    refreshControls();
  }
  function record(before: PoseOffsets) {
    if (JSON.stringify(before) === JSON.stringify(offsets)) return;
    undo.push(before); if (undo.length > 50) undo.shift(); redo.length = 0;
    status("Unsaved changes. Preview the idle or save your draft.");
    refreshControls();
  }
  function select(part: Part) { selected = part; refreshControls(); }
  function move(part: Part, target: THREE.Vector3, pole: THREE.Vector3) {
    solveLimb(chains[part], target, pole, part.endsWith("hand") ? "local" : "world");
    captureOffsets(part);
  }
  function nudge(handle: Pick<Handle, "part" | "bend">, delta: THREE.Vector3) {
    if (playing) return;
    const before = structuredClone(offsets);
    const chain = chains[handle.part];
    const target = world(chain.end);
    const pole = world(chain.lower);
    (handle.bend ? pole : target).add(delta);
    move(handle.part, target, pole);
    record(before);
  }

  const raycaster = new THREE.Raycaster();
  function hitPlane(event: PointerEvent, plane: THREE.Plane) {
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(
      (event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1,
    ), camera);
    return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  }
  for (const handle of handles) {
    let drag: {
      id: number; before: PoseOffsets; plane: THREE.Plane;
      grabOffset: THREE.Vector3; target: THREE.Vector3; pole: THREE.Vector3;
    } | undefined;
    handle.element.addEventListener("pointerdown", event => {
      if (playing || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation(); select(handle.part);
      handle.element.focus();
      const chain = chains[handle.part];
      const point = world(handle.bend ? chain.lower : chain.end);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), point);
      const hit = hitPlane(event, plane); if (!hit) return;
      drag = { id: event.pointerId, before: structuredClone(offsets), plane, grabOffset: point.sub(hit), target: world(chain.end), pole: world(chain.lower) };
      handle.element.setPointerCapture(event.pointerId);
      controls.enabled = false;
      handle.element.dataset.dragging = "true";
    });
    handle.element.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId) return;
      const hit = hitPlane(event, drag.plane); if (!hit) return;
      offsets = structuredClone(drag.before); evaluatePose();
      const point = hit.add(drag.grabOffset);
      move(handle.part, handle.bend ? drag.target : point, handle.bend ? point : drag.pole);
    });
    const finish = (event: PointerEvent, cancelled: boolean) => {
      if (!drag || drag.id !== event.pointerId) return;
      if (cancelled) { offsets = drag.before; evaluatePose(); refreshControls(); }
      else record(drag.before);
      drag = undefined; controls.enabled = true; handle.element.dataset.dragging = "false";
      if (handle.element.hasPointerCapture(event.pointerId)) handle.element.releasePointerCapture(event.pointerId);
    };
    handle.element.addEventListener("pointerup", event => finish(event, false));
    handle.element.addEventListener("pointercancel", event => finish(event, true));
    handle.element.addEventListener("lostpointercapture", event => finish(event, true));
    handle.element.addEventListener("focus", () => select(handle.part));
    handle.element.addEventListener("keydown", event => {
      const directions: Record<string, THREE.Vector3> = {
        ArrowLeft: new THREE.Vector3(-1, 0, 0), ArrowRight: new THREE.Vector3(1, 0, 0),
        ArrowUp: new THREE.Vector3(0, 1, 0), ArrowDown: new THREE.Vector3(0, -1, 0),
        PageUp: new THREE.Vector3(0, 0, 1), PageDown: new THREE.Vector3(0, 0, -1),
      };
      const direction = directions[event.key]; if (!direction) return;
      event.preventDefault();
      nudge(handle, direction.applyQuaternion(camera.quaternion).multiplyScalar(event.shiftKey ? 0.05 : 0.01));
    });
  }

  document.querySelectorAll<HTMLButtonElement>(".portfolio-pose-editor-parts [data-part]").forEach(control => {
    control.addEventListener("click", () => select(control.dataset.part as Part));
  });
  button("mode-limbs").addEventListener("click", () => { editingMode = "limbs"; refreshControls(); });
  button("mode-posture").addEventListener("click", () => { editingMode = "posture"; refreshControls(); });
  postureSelect.addEventListener("change", () => { posturePoint = postureSelect.value; refreshControls(); });
  for (const input of document.querySelectorAll<HTMLInputElement>("[data-posture]")) {
    let before: PoseOffsets | undefined;
    input.addEventListener("input", () => {
      if (playing) return;
      before ??= structuredClone(offsets);
      const point = posturePoints[posturePoint]!;
      const basis = postureBases.get(posturePoint)!;
      const angles = postureAngles(new THREE.Quaternion(...(offsets[posturePoint] ?? [0, 0, 0, 1])), basis, point.signs);
      angles[Number(input.dataset.posture)] = Number(input.value);
      const rotation = postureOffset(angles, basis, point.signs);
      if (rotation.angleTo(new THREE.Quaternion()) < 1e-6) delete offsets[posturePoint];
      else offsets[posturePoint] = rotation.toArray();
      evaluatePose(); refreshControls();
    });
    input.addEventListener("change", () => { if (before) record(before); before = undefined; });
  }
  button("reset-posture-point").addEventListener("click", () => {
    const before = structuredClone(offsets); delete offsets[posturePoint];
    evaluatePose(); refreshControls(); record(before);
  });
  button("reset-posture").addEventListener("click", () => {
    const before = structuredClone(offsets);
    for (const name of Object.keys(posturePoints)) delete offsets[name];
    evaluatePose(); refreshControls(); record(before);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-axis]").forEach(control => {
    control.addEventListener("click", () => {
      const delta = new THREE.Vector3();
      delta[control.dataset.axis as "x" | "y" | "z"] = Number(control.dataset.step) * 0.01;
      nudge({ part: selected, bend: false }, delta);
    });
  });
  for (const input of document.querySelectorAll<HTMLInputElement>("[data-wrist]")) {
    let before: PoseOffsets | undefined;
    input.addEventListener("input", () => {
      if (playing || !selected.endsWith("hand")) return;
      before ??= structuredClone(offsets);
      const hand = chains[selected].end;
      const angles = getWristAngles(hand);
      angles[input.dataset.wrist as keyof WristAngles] = Number(input.value);
      setWristAngles(hand, angles);
      captureOffsets(selected, true);
    });
    input.addEventListener("change", () => {
      if (before) record(before);
      before = undefined;
    });
  }
  button("straighten-wrist").addEventListener("click", () => {
    const before = structuredClone(offsets);
    straightenWrist(chains[selected].end);
    captureOffsets(selected, true); record(before);
  });
  button("reset-wrist").addEventListener("click", () => {
    const before = structuredClone(offsets);
    delete offsets[parts[selected].nodes[2]];
    evaluatePose(); refreshControls(); record(before);
  });
  button("preview").addEventListener("click", () => {
    playing = !playing; playTime = 0; evaluatePose(); refreshControls();
  });
  button("reset").addEventListener("click", () => {
    const before = structuredClone(offsets); offsets = {}; evaluatePose(); record(before);
  });
  function travelHistory(from: PoseOffsets[], to: PoseOffsets[]) {
    if (playing) return;
    const previous = from.pop(); if (!previous) return;
    to.push(structuredClone(offsets)); offsets = previous; evaluatePose(); refreshControls();
    status(JSON.stringify(offsets) === saved ? "Pose restored." : "Unsaved changes.");
  }
  button("undo").addEventListener("click", () => travelHistory(undo, redo));
  button("redo").addEventListener("click", () => travelHistory(redo, undo));
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault(); if (event.shiftKey) travelHistory(redo, undo); else travelHistory(undo, redo);
    }
  });
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(control => {
    control.addEventListener("click", () => {
      const distance = camera.position.distanceTo(controls.target);
      const direction = control.dataset.view === "side" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, control.dataset.view === "back" ? -1 : 1);
      camera.position.copy(controls.target).addScaledVector(direction, distance); controls.update();
    });
  });
  button("frame").addEventListener("click", fit);
  button("portrait").addEventListener("click", () => {
    const direction = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(world(nodes.get("Head")!)).add(new THREE.Vector3(0, -0.12, 0));
    camera.position.copy(controls.target).addScaledVector(direction, 1.5); controls.update();
  });
  button("save").addEventListener("click", () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(makePoseDraft(digest, offsets)));
      saved = JSON.stringify(offsets); refreshControls(); status("Draft saved in this browser. The portfolio is unchanged.");
    } catch { status("Browser storage is unavailable. Download the pose to keep it.", true); }
  });
  button("download").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(makePoseDraft(digest, offsets), null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "bradley-idle-pose.json";
    link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("Pose downloaded. Send that file back to apply it to the portfolio.");
  });
  const input = element<HTMLInputElement>("pose-file");
  button("import").addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const file = input.files?.[0]; input.value = ""; if (!file) return;
    if (file.size > 50_000) { status("That file is too large for a pose draft.", true); return; }
    void file.text().then(text => {
      const draft = parsePoseDraft(text, digest);
      const before = structuredClone(offsets); offsets = draft.offsets; evaluatePose(); record(before);
      status("Pose imported. Save a draft to keep it in this browser.");
    }).catch((error: unknown) => status(error instanceof Error ? error.message : "Could not import pose.", true));
  });

  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) {
      offsets = parsePoseDraft(existing, digest).offsets; saved = JSON.stringify(offsets);
      evaluatePose(); status("Your saved draft is restored.");
    } else status("Ready. Grab a hand to begin.");
  } catch (error) { status(error instanceof Error ? error.message : "Saved draft could not be restored.", true); }
  document.querySelectorAll<HTMLButtonElement>("[data-requires-model]").forEach(control => { control.disabled = false; });
  refreshControls(); element("loading").hidden = true; stage.dataset.ready = "true";

  let width = 1; let height = 1;
  const resize = new ResizeObserver(() => {
    width = stage.clientWidth; height = stage.clientHeight;
    renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
  });
  resize.observe(stage);
  let lastTime = performance.now();
  const showBends = element<HTMLInputElement>("show-bends");
  renderer.setAnimationLoop(time => {
    const delta = Math.min((time - lastTime) / 1000, 0.05); lastTime = time;
    if (document.hidden) return;
    if (playing) { playTime = (playTime + delta) % clip.duration; evaluatePose(playTime); }
    for (const handle of handles) {
      const chain = chains[handle.part];
      const point = world(handle.bend ? chain.lower : chain.end).project(camera);
      handle.element.hidden = playing || editingMode !== "limbs" || (handle.bend && !showBends.checked) || point.z > 1 || point.z < -1;
      handle.element.style.left = `${(point.x + 1) / 2 * width}px`;
      handle.element.style.top = `${(-point.y + 1) / 2 * height}px`;
      handle.element.dataset.selected = String(handle.part === selected);
    }
    renderer.render(scene, camera);
  });
  window.addEventListener("pagehide", () => {
    renderer.setAnimationLoop(null); resize.disconnect(); controls.dispose(); renderer.dispose();
  }, { once: true });
}

void startEditor().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Could not start the pose editor.";
  element("loading").textContent = message;
  status(message, true);
});
