/**
 * Deterministic renderer for one clip spec. The same module drives the browser
 * preview and the headless MP4 render: every frame is a pure function of its
 * time, so a scrub, a replay, and an export all show the same image.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { swimAt, swimBox } from "./swim.mjs";
import { rainAt } from "./rain.mjs";
import { drawLabel, drawMark } from "./marks.mjs";
import {
  beatAt,
  dipAt,
  spinAt,
  trackAt,
  easeInOut,
  framings,
  resolveSpec,
  shotAt,
  textOpacityAt,
} from "./spec.mjs";

const figureHeight = 1.8;
const modelUrl = "/assets/avatar.glb";
const markUrl = "/assets/mark.png";
/**
 * The brand's own brain symbol. The map draws its identity node from
 * `/glyph-textures/circle.svg`, which is that brain masked into a small circle
 * — right at twenty pixels on a page, wrong blown up to fill a frame.
 */
const brainGlyphUrl = "/assets/mark.svg";

function loadModel() {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(modelUrl, resolve, undefined, reject);
  });
}

async function loadFonts() {
  const faces = [
    ["400", "/fonts/nhg-400.ttf"],
    ["500", "/fonts/nhg-500.ttf"],
  ];
  await Promise.all(
    faces.map(async ([weight, url]) => {
      try {
        const face = new FontFace("NHG portfolio", `url(${url})`, { weight });
        await face.load();
        document.fonts.add(face);
      } catch {
        // The system stack in `font()` below carries the frame without it.
      }
    }),
  );
}

/** A background film, seekable frame by frame. Resolves null when it is absent. */
function loadFilm(name) {
  return new Promise((resolve) => {
    const film = document.createElement("video");
    film.muted = true;
    film.playsInline = true;
    film.preload = "auto";
    film.src = `/films/${encodeURIComponent(name)}.webm`;
    film.addEventListener("loadeddata", () => resolve(film), { once: true });
    film.addEventListener("error", () => resolve(null), { once: true });
  });
}

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function font(weight, size) {
  return `${weight} ${size}px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif`;
}

function grainTile(alpha, seedStart = 20260909) {
  const size = 256,
    canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d"),
    image = context.createImageData(size, size);
  // A fixed seed keeps the tile identical between the preview and the export.
  let seed = seedStart;
  for (let index = 0; index < image.data.length; index += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = seed % 256;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = Math.round(alpha * 255);
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/** Even rows of ink, the width of a scan line at this frame size. */
function scanlineTile(alpha) {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 6;
  const context = canvas.getContext("2d");
  context.fillStyle = `rgba(0, 0, 0, ${alpha * 8})`;
  context.fillRect(0, 0, 4, 2);
  return canvas;
}

/** A loose dot screen, for a printed rather than a filmed surface. */
function dotTile(alpha) {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const context = canvas.getContext("2d");
  context.fillStyle = `rgba(0, 0, 0, ${alpha * 10})`;
  context.beginPath();
  context.arc(4, 4, 1.4, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

/** Recolours an opaque-on-white glyph so it reads on the frame's paper. */
function tint(image, color) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function wrapLines(context, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

export async function createClipStudio({ canvas, spec: rawSpec, records = [] }) {
  let spec = resolveSpec(rawSpec);
  canvas.width = spec.width;
  canvas.height = spec.height;
  const context = canvas.getContext("2d");

  const gl = document.createElement("canvas");
  gl.width = spec.width;
  gl.height = spec.height;
  const renderer = new THREE.WebGLRenderer({
    canvas: gl,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(spec.width, spec.height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(spec.palette.accent), 0.6);
  rim.position.set(-3, 2, -2);
  scene.add(rim);

  const [gltf, mark, brain, film] = await Promise.all([
    loadModel(),
    loadImage(markUrl),
    loadImage(brainGlyphUrl),
    spec.background.kind === "video" ? loadFilm(spec.background.film) : null,
    loadFonts(),
  ]);
  let currentFilm = film,
    currentFilmName = spec.background.kind === "video" ? spec.background.film : null;

  const figure = gltf.scene;
  const bounds = new THREE.Box3().setFromObject(figure);
  const scale = figureHeight / Math.max(1e-6, bounds.max.y - bounds.min.y);
  figure.scale.setScalar(scale);
  bounds.setFromObject(figure);
  figure.position.y -= bounds.min.y;
  figure.position.x -= (bounds.min.x + bounds.max.x) / 2;
  figure.position.z -= (bounds.min.z + bounds.max.z) / 2;

  // The figure hangs inside a body group so a swim shot can pivot it about its
  // middle; standing shots leave it on its feet.
  const body = new THREE.Group();
  body.add(figure);
  const pivot = new THREE.Group();
  pivot.add(body);
  scene.add(pivot);

  const mixer = new THREE.AnimationMixer(figure);
  const clips = new Map(gltf.animations.map((clip) => [clip.name, clip]));
  const missing = spec.shots.map((shot) => shot.clip).filter((name) => !clips.has(name));
  if (missing.length) throw new Error(`Model has no clip named ${missing.join(", ")}`);

  const hips = figure.getObjectByName("Hips");
  const feetBones = ["LeftToeBase", "RightToeBase", "LeftFoot", "RightFoot"]
    .map((name) => figure.getObjectByName(name))
    .filter(Boolean);

  const camera = new THREE.PerspectiveCamera(34, spec.width / spec.height, 0.1, 100);
  /**
   * The map is projected through a camera that holds still on the shot's own
   * framing. The drift, the sway, and a beat's swing move the figure's camera
   * only — otherwise the whole fall lurches whenever the camera does, and the
   * rain reads as something stuck to the lens rather than weather being fallen
   * through.
   */
  const railCamera = new THREE.PerspectiveCamera(34, spec.width / spec.height, 0.1, 100);
  let texture = buildTexture();
  let tintedMark = mark ? tint(mark, spec.palette.ink) : null;
  let currentShot = null;

  /**
   * The overlay tiles for the current texture. `flicker` holds several grain
   * tiles and steps through them, which reads as film rather than as dirt on
   * the lens; the others are a single tile.
   */
  function buildTexture() {
    if (spec.texture === "none" || spec.grain <= 0) return null;
    if (spec.texture === "scanlines") return { tiles: [scanlineTile(spec.grain)] };
    if (spec.texture === "dots") return { tiles: [dotTile(spec.grain)] };
    if (spec.texture === "flicker")
      return {
        tiles: [0, 1, 2, 3].map((step) => grainTile(spec.grain, 20260909 + step * 7919)),
        rate: 12,
      };
    return { tiles: [grainTile(spec.grain)] };
  }

  /**
   * Swaps in an edited spec without reloading the model, so the editor can
   * repaint on every keystroke. Anything derived from the palette or the frame
   * size is rebuilt here.
   */
  function update(nextRaw) {
    const next = resolveSpec(nextRaw);
    const missingClip = next.shots.map((shot) => shot.clip).find((name) => !clips.has(name));
    if (missingClip) throw new Error(`Model has no clip named ${missingClip}`);
    const resized = next.width !== spec.width || next.height !== spec.height;
    spec = next;
    if (resized) {
      canvas.width = spec.width;
      canvas.height = spec.height;
      gl.width = spec.width;
      gl.height = spec.height;
      renderer.setSize(spec.width, spec.height, false);
      camera.aspect = spec.width / spec.height;
    }
    texture = buildTexture();
    tintedMark = mark ? tint(mark, spec.palette.ink) : null;
    rim.color = new THREE.Color(spec.palette.accent);
    currentShot = null;
    // A playing film follows the background's drift as its playback rate.
    if (currentFilm && !currentFilm.paused) filmPace();
    return spec;
  }

  /**
   * Live playback: crossfades to a clip and advances the mixer by real time,
   * rather than the scripted path's exact seek. `once` plays a gesture through
   * and holds its last frame, which is what a triggered animation should do.
   */
  let liveAction = null,
    liveClip = null,
    liveEndsAt = 0,
    liveElapsed = 0;

  function playClip(name, { fade = 0.25, once = false } = {}) {
    const clip = clips.get(name);
    if (!clip) return null;
    const next = mixer.clipAction(clip);
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    if (liveAction && liveAction !== next && fade > 0) next.crossFadeFrom(liveAction, fade, false);
    next.play();
    liveAction = next;
    liveClip = name;
    liveElapsed = 0;
    liveEndsAt = once ? clip.duration : Infinity;
    currentShot = null;
    return { name, duration: clip.duration };
  }

  /**
   * Applies a blend of clips at exact times — the scripted path's answer to a
   * crossfade. Seeking cannot use three's own crossfade, which runs on elapsed
   * time, so both clips are posed by hand and the mixer is asked to evaluate
   * without advancing.
   */
  function applyPose(entries) {
    for (const action of mixer._actions ?? []) action.setEffectiveWeight(0);
    for (const { clip, time, weight, loop = true } of entries) {
      const source = clips.get(clip);
      if (!source || weight <= 0) continue;
      const action = mixer.clipAction(source);
      action.enabled = true;
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = !loop;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(weight);
      action.play();
      action.time = loop
        ? ((time % source.duration) + source.duration) % source.duration
        : Math.min(time, source.duration);
    }
    mixer.update(0);
    currentShot = null;
    liveClip = null;
  }

  function playShot(shot) {
    if (currentShot === shot) return;
    mixer.stopAllAction();
    const action = mixer.clipAction(clips.get(shot.clip));
    action.setLoop(shot.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !shot.loop;
    action.play();
    currentShot = shot;
  }

  /**
   * A swimming shot owns the figure's place in the frame: the Brain Food chase
   * moves it, and the prone clip is turned to face the way it is going. Every
   * other shot stands the figure in the middle.
   */
  /** Faces the prone figure along a heading, about its hips, in the frame's plane. */
  function faceAlong(position, heading, roll = 0) {
    if (hips) {
      pivot.updateMatrixWorld(true);
      const anchor = hips.getWorldPosition(new THREE.Vector3());
      body.position.set(-anchor.x, -anchor.y, -anchor.z);
    }
    pivot.position.set(position.x, position.y, 0);
    const screenHeading = -heading;
    const yaw = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2 + screenHeading,
    );
    const pitch = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      Math.asin(Math.sin(screenHeading)),
    );
    pivot.quaternion.copy(yaw.multiply(pitch));
    // Roll turns the figure about its own long axis: face down, or face up to
    // the falling map.
    if (roll)
      pivot.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll),
      );
  }

  /** Clips whose rest pose lies face down along the camera's axis. */
  const proneClips = new Set(["Swim_Forward", "Swim_Idle", "swimming_to_edge"]);

  /**
   * The rotation for an explicit attitude, in degrees.
   *
   * A swim clip rests prone, head toward the camera; a standing clip rests on
   * its feet, facing it. The same attitude therefore needs a different base for
   * each, or a dance played inside a float lands face down where a swim lands
   * face up. `standing` is how much of what is playing is a standing clip, so a
   * crossfade between the two turns the figure over as the animation changes.
   */
  function attitudeQuaternion({ turn, roll, tilt }, standing = 0) {
    const radians = (degrees) => (degrees * Math.PI) / 180,
      axis = (x, y, z, angle) =>
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(x, y, z), angle);

    const frame = axis(1, 0, 0, radians(tilt)).multiply(
      axis(0, 0, 1, radians(turn) - Math.PI / 2),
    );
    // Prone rests along the camera's axis and rolls about its length, which is
    // z; standing rests upright and rolls about its length, which is y.
    const prone = frame
      .clone()
      .multiply(axis(1, 0, 0, -Math.PI / 2))
      .multiply(axis(0, 0, 1, radians(roll)));
    if (standing <= 0) return prone;
    const upright = frame.clone().multiply(axis(0, 1, 0, radians(roll)));
    return standing >= 1 ? upright : prone.slerp(upright, standing);
  }

  /** The rotation a swimming figure takes to face along a heading. */
  function swimQuaternion(heading) {
    const screenHeading = -heading;
    return new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + screenHeading)
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          Math.asin(Math.sin(screenHeading)),
        ),
      );
  }

  /**
   * Where a shot puts the figure and how it turns it, as data. Returning it
   * rather than applying it is what lets two shots be blended across their
   * boundary instead of cutting.
   */
  function figurePose(shot, local, standing = 0) {
    const eased = easeInOut(local / shot.duration);
    if (shot.motion === "float") {
      const between = ([from, to]) => from + (to - from) * eased,
        place = shot.place ?? { from: [0, 1.85], to: [0, 1.85] };
      const rates = shot.float.rates ?? tumbleRates,
        wobble = shot.float.wobble ?? { roll: 0, tilt: 0, period: 6 },
        swing = Math.sin((local / wobble.period) * Math.PI * 2),
        swingLate = Math.sin((local / wobble.period) * Math.PI * 2 + 1.1);
      return {
        position: {
          x: place.from[0] + (place.to[0] - place.from[0]) * eased,
          y: place.from[1] + (place.to[1] - place.from[1]) * eased,
        },
        quaternion: attitudeQuaternion(
          {
            turn: between(shot.float.turn) + spinAt(local, shot.float.spin, shot.duration, rates.turn),
            roll:
              between(shot.float.roll) +
              spinAt(local, shot.float.spin, shot.duration, rates.roll) +
              wobble.roll * swing,
            tilt:
              between(shot.float.tilt) +
              spinAt(local, shot.float.spin, shot.duration, rates.tilt) +
              wobble.tilt * swingLate,
          },
          standing,
        ),
        anchor: "full",
      };
    }
    if (shot.motion === "swim") {
      const { position, heading } = swimAt(local + shot.offset, {
        seed: shot.seed,
        speed: shot.swimSpeed,
        box: swimBox,
      });
      return { position, quaternion: swimQuaternion(heading), anchor: "full" };
    }
    const place = shot.place ?? { from: [0, 0], to: [0, 0] };
    return {
      position: {
        x: place.from[0] + (place.to[0] - place.from[0]) * eased,
        y: place.from[1] + (place.to[1] - place.from[1]) * eased,
      },
      quaternion: new THREE.Quaternion(),
      anchor: "xz",
    };
  }

  /** Puts a blended pose on the figure, cancelling the clip's own drift. */
  function applyFigurePose({ position, quaternion, anchorFull }) {
    pivot.position.set(0, 0, 0);
    pivot.quaternion.identity();
    body.position.set(0, 0, 0);
    if (hips) {
      pivot.updateMatrixWorld(true);
      const held = hips.getWorldPosition(new THREE.Vector3());
      // A floating figure hangs from its hips; a standing one keeps its bounce
      // and only loses the ground it would cover.
      body.position.set(-held.x, -held.y * anchorFull, -held.z);
    }
    pivot.position.set(position.x, position.y, 0);
    pivot.quaternion.copy(quaternion);
  }

  /** The tumble rates a spin of 1 turns at, in degrees a second. */
  const tumbleRates = { turn: 34, roll: 62, tilt: 21 };


  /** A slow handheld drift, in world units, applied to the camera. */
  let sway = { x: 0, y: 0 };
  /** A camera move under the shot's own framing: orbit, dolly, and roll. */
  let drift = { orbit: 0, dolly: 1, roll: 0 };

  /** A shot's camera, as data, so two shots can be crossed between. */
  function cameraParams(shot, progress, beat = null, beatWeight = 0, phase = null) {
    const framing = framings[shot.framing],
      eased = easeInOut(progress),
      baseOrbit = shot.orbit[0] + (shot.orbit[1] - shot.orbit[0]) * eased,
      baseDolly = shot.dolly[0] + (shot.dolly[1] - shot.dolly[0]) * eased,
      // A beat pulls the camera toward it and lets the drift keep breathing.
      // The swing carries the camera out and brings it back, so it arrives at
      // `orbit` — square on. It only swings on the way in: swinging again on
      // the way out took the camera off the figure just as it should have been
      // holding him.
      beatOrbit = beat
        ? baseOrbit +
          (beat.orbit - baseOrbit) * beatWeight +
          (phase === "in" ? beat.sweep * Math.sin(Math.PI * beatWeight) : 0)
        : baseOrbit,
      orbit = ((beatOrbit * Math.PI) / 180) + drift.orbit * (1 - beatWeight * 0.7),
      dolly =
        (beat ? baseDolly + (beat.dolly - baseDolly) * beatWeight : baseDolly) *
        (1 + (drift.dolly - 1) * (1 - beatWeight * 0.7)),
      target = new THREE.Vector3(...framing.target),
      offset = new THREE.Vector3(...framing.position).sub(target).multiplyScalar(dolly);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit);
    return { position: target.clone().add(offset), target, fov: framing.fov };
  }

  function applyCamera({ position, target, fov }) {
    camera.fov = fov;
    camera.position.copy(position).add(new THREE.Vector3(sway.x, sway.y, 0));
    camera.lookAt(new THREE.Vector3(target.x + sway.x, target.y + sway.y, target.z));
    if (drift.roll) camera.rotateZ(drift.roll);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  /** Parks the map's camera on a framing, with none of the shot's movement. */
  function railOn(framingName) {
    const framing = framings[framingName] ?? framings.swim;
    railCamera.fov = framing.fov;
    railCamera.position.set(...framing.position);
    railCamera.lookAt(new THREE.Vector3(...framing.target));
    railCamera.updateProjectionMatrix();
    railCamera.updateMatrixWorld(true);
  }

  function placeCamera(shot, progress) {
    const framing = framings[shot.framing],
      eased = easeInOut(progress),
      orbit =
        ((shot.orbit[0] + (shot.orbit[1] - shot.orbit[0]) * eased) * Math.PI) / 180 +
        drift.orbit,
      dolly = (shot.dolly[0] + (shot.dolly[1] - shot.dolly[0]) * eased) * drift.dolly,
      target = new THREE.Vector3(...framing.target),
      offset = new THREE.Vector3(...framing.position).sub(target).multiplyScalar(dolly);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit);
    camera.fov = framing.fov;
    camera.position.copy(target).add(offset).add(new THREE.Vector3(sway.x, sway.y, 0));
    camera.lookAt(new THREE.Vector3(target.x + sway.x, target.y + sway.y, target.z));
    // Rolling after the look keeps the horizon turning without moving the
    // subject, which is what reads as tumbling through space rather than panning.
    if (drift.roll) camera.rotateZ(drift.roll);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  /**
   * The camera looks along the floor, so a ground plane collapses to a sliver.
   * The contact shadow is painted instead, under the figure's projected feet.
   */
  function paintContactShadow(shot) {
    if (spec.palette.shadow <= 0 || shot.motion === "swim") return;
    // Nothing is standing on anything in a falling scene; a pool of light under
    // the feet only reads as a halo.
    if (spec.rain.enabled || shot.motion === "float") return;
    // The pool follows the lowest foot: several clips lift the hips off the floor.
    const floor = new THREE.Vector3();
    let groundY = 0;
    if (feetBones.length) {
      groundY = Infinity;
      for (const bone of feetBones) {
        bone.getWorldPosition(floor);
        groundY = Math.min(groundY, floor.y);
      }
    }
    const feet = new THREE.Vector3(0, groundY, 0).project(camera),
      side = new THREE.Vector3(0.5, groundY, 0).project(camera),
      x = ((feet.x + 1) / 2) * spec.width,
      y = ((1 - feet.y) / 2) * spec.height,
      radius = Math.abs(side.x - feet.x) * spec.width;
    if (!Number.isFinite(radius) || radius <= 0 || y < -200 || y > spec.height + 200) return;
    context.save();
    context.translate(x, y);
    context.scale(1, 0.22);
    const pool = context.createRadialGradient(0, 0, 0, 0, 0, radius);

    const tint = spec.palette.pool;
    pool.addColorStop(0, `rgba(${tint}, ${spec.palette.shadow})`);
    pool.addColorStop(0.6, `rgba(${tint}, ${spec.palette.shadow * 0.4})`);
    pool.addColorStop(1, `rgba(${tint}, 0)`);
    context.fillStyle = pool;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  /** Hex plus an alpha byte, so a gradient stop can fade a token colour. */
  function fade(color, alpha) {
    const byte = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
      .toString(16)
      .padStart(2, "0");
    return `${color}${byte}`;
  }

  function paintPaper() {
    const gradient = context.createLinearGradient(0, 0, 0, spec.height);
    gradient.addColorStop(0, spec.palette.top);
    gradient.addColorStop(1, spec.palette.bottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, spec.width, spec.height);
  }

  /** Slow drifting pools of register colour. The default; reads as depth. */
  function paintAurora(time) {
    paintPaper();
    const { intensity } = spec.background,
      registers = Object.values(spec.palette.registers);
    context.save();
    context.globalCompositeOperation = "lighter";
    registers.forEach((color, index) => {
      const phase = time + index * 1.7,
        x = spec.width * (0.5 + 0.34 * Math.sin(phase * 0.21 + index)),
        y = spec.height * (0.42 + 0.3 * Math.cos(phase * 0.16 + index * 1.3)),
        radius = spec.width * (0.55 + 0.12 * Math.sin(phase * 0.13 + index)),
        pool = context.createRadialGradient(x, y, 0, x, y, radius);
      pool.addColorStop(0, fade(color, 0.42 * intensity));
      pool.addColorStop(0.45, fade(color, 0.17 * intensity));
      pool.addColorStop(1, fade(color, 0));
      context.fillStyle = pool;
      context.fillRect(0, 0, spec.width, spec.height);
    });
    context.restore();
  }

  /** A floor grid running to a horizon, scrolling toward the viewer. */
  function paintGrid(time) {
    paintPaper();
    const { intensity } = spec.background,
      horizon = spec.height * 0.42,
      vanishX = spec.width / 2,
      depth = 26,
      accent = spec.palette.accent;
    context.save();
    context.strokeStyle = fade(accent, 0.16 * intensity);
    context.lineWidth = 2;
    context.beginPath();
    for (let index = -14; index <= 14; index += 1) {
      const x = vanishX + index * spec.width * 0.16;
      context.moveTo(vanishX, horizon);
      context.lineTo(x, spec.height);
    }
    context.stroke();
    // Rows are spaced by a power series, so they crowd toward the horizon.
    for (let row = 0; row < depth; row += 1) {
      const progress = ((row + (time * 0.35) % 1) / depth) ** 2.6,
        y = horizon + progress * (spec.height - horizon);
      context.strokeStyle = fade(accent, 0.03 * intensity + progress * 0.2 * intensity);
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(spec.width, y);
      context.stroke();
    }
    const haze = context.createLinearGradient(0, 0, 0, horizon * 1.4);
    haze.addColorStop(0, spec.palette.top);
    haze.addColorStop(1, `${spec.palette.top}00`);
    context.fillStyle = haze;
    context.fillRect(0, 0, spec.width, horizon * 1.4);
    context.restore();
  }

  /** Contour rings breathing out from behind the figure. */
  function paintRings(time) {
    paintPaper();
    const { intensity } = spec.background,
      centreX = spec.width / 2,
      centreY = spec.height * 0.46,
      count = 22,
      span = spec.height * 0.85;
    context.save();
    context.lineWidth = 3;
    for (let index = 0; index < count; index += 1) {
      const phase = (index + (time * 0.25) % 1) / count,
        radius = phase * span,
        colour = Object.values(spec.palette.registers)[index % 6];
      context.strokeStyle = fade(colour, (0.03 + 0.16 * (1 - phase)) * intensity);
      context.beginPath();
      context.ellipse(centreX, centreY, radius, radius * 0.94, 0, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  /** Wide diagonal bands of light crossing the frame. */
  function paintSweep(time) {
    paintPaper();
    const { intensity } = spec.background,
      diagonal = Math.hypot(spec.width, spec.height);
    context.save();
    context.globalCompositeOperation = "lighter";
    context.translate(spec.width / 2, spec.height / 2);
    context.rotate(-0.5);
    Object.values(spec.palette.registers).forEach((color, index, all) => {
      const offset =
          ((time * 0.16 + index / all.length) % 1) * diagonal * 1.6 -
          diagonal * 0.8,
        band = context.createLinearGradient(offset - 260, 0, offset + 260, 0);
      band.addColorStop(0, fade(color, 0));
      band.addColorStop(0.5, fade(color, 0.18 * intensity));
      band.addColorStop(1, fade(color, 0));
      context.fillStyle = band;
      context.fillRect(-diagonal, -diagonal, diagonal * 2, diagonal * 2);
    });
    context.restore();
  }

  /**
   * A buffer the film is blended into. At a low drift the film holds each of
   * its own frames for several of ours, which steps; carrying a fraction of the
   * last frame forward dissolves between them instead.
   */
  let filmBuffer = null;

  function filmBufferContext() {
    if (!filmBuffer) {
      filmBuffer = document.createElement("canvas");
      filmBuffer.width = spec.width;
      filmBuffer.height = spec.height;
    } else if (filmBuffer.width !== spec.width || filmBuffer.height !== spec.height) {
      filmBuffer.width = spec.width;
      filmBuffer.height = spec.height;
    }
    return filmBuffer.getContext("2d");
  }

  /** The film, drawn to cover the frame, mixed toward the paper by intensity. */
  function paintFilm() {
    paintPaper();
    if (!currentFilm) return;
    const scale = Math.max(
      spec.width / (currentFilm.videoWidth || spec.width),
      spec.height / (currentFilm.videoHeight || spec.height),
    );
    const drawWidth = (currentFilm.videoWidth || spec.width) * scale,
      drawHeight = (currentFilm.videoHeight || spec.height) * scale,
      left = (spec.width - drawWidth) / 2,
      top = (spec.height - drawHeight) / 2,
      smoothing = Math.min(0.95, Math.max(0, spec.background.smoothing ?? 0));

    context.save();
    context.globalAlpha = Math.min(1, spec.background.intensity * (1 - highlight * 0.55));
    if (smoothing > 0) {
      const buffer = filmBufferContext();
      buffer.globalAlpha = 1 - smoothing;
      buffer.drawImage(currentFilm, left, top, drawWidth, drawHeight);
      buffer.globalAlpha = 1;
      context.drawImage(filmBuffer, 0, 0);
    } else {
      filmBuffer = null;
      context.drawImage(currentFilm, left, top, drawWidth, drawHeight);
    }
    context.restore();
  }

  const backgroundPainters = {
    paper: paintPaper,
    aurora: paintAurora,
    grid: paintGrid,
    rings: paintRings,
    sweep: paintSweep,
    video: paintFilm,
  };

  function paintBackground(time) {
    backgroundPainters[spec.background.kind](time * spec.background.speed);

    if (spec.background.rules) {
      context.strokeStyle = spec.palette.grid;
      context.lineWidth = 2;
      context.beginPath();
      for (let x = 0; x <= spec.width; x += 90) {
        context.moveTo(x + 0.5, 0);
        context.lineTo(x + 0.5, spec.height);
      }
      for (let y = 0; y <= spec.height; y += 90) {
        context.moveTo(0, y + 0.5);
        context.lineTo(spec.width, y + 0.5);
      }
      context.stroke();
    }

    if (spec.background.glow) {
      const glow = context.createRadialGradient(
        spec.width / 2,
        spec.height * 0.52,
        0,
        spec.width / 2,
        spec.height * 0.52,
        spec.width * 0.75,
      );
      glow.addColorStop(0, `${spec.palette.accent}22`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, spec.width, spec.height);
    }
  }

  function paintText(shot, local) {
    const opacity = textOpacityAt(shot, local);
    if (opacity <= 0.001) return;
    const text = shot.text,
      margin = Math.round(spec.width * 0.082),
      maxWidth = spec.width - margin * 2,
      rise = (1 - opacity) * 26;

    const blocks = [];
    if (text.kicker)
      blocks.push({ value: text.kicker, size: 34, leading: 44, weight: 500, kind: "kicker" });
    if (text.title)
      blocks.push({ value: text.title, size: 92, leading: 98, weight: 500, kind: "title" });
    if (text.subtitle)
      blocks.push({ value: text.subtitle, size: 40, leading: 52, weight: 400, kind: "subtitle" });

    const measured = blocks.map((block) => {
      context.font = font(block.weight, block.size);
      context.letterSpacing =
        block.kind === "kicker" ? "4px" : block.kind === "title" ? "-3px" : "-0.4px";
      const value = block.kind === "kicker" ? block.value.toUpperCase() : block.value;
      return { ...block, lines: wrapLines(context, value, maxWidth) };
    });
    const gap = 22,
      height =
        measured.reduce((total, block) => total + block.lines.length * block.leading, 0) +
        gap * (measured.length - 1);

    let y =
      text.place === "upper"
        ? Math.round(spec.height * 0.14)
        : text.place === "center"
          ? Math.round((spec.height - height) / 2)
          : Math.round(spec.height - 430 - height);
    y += rise;

    // A scrim keeps the type legible where the figure stands behind it.
    if (text.place !== "center") {
      const fade = 260,
        lower = text.place === "lower",
        edge = lower ? spec.height : 0,
        inner = lower ? y - fade : y + height + fade,
        scrim = context.createLinearGradient(0, inner, 0, edge);
      scrim.addColorStop(0, `${spec.palette.bottom}00`);
      scrim.addColorStop(1, `${spec.palette.bottom}f2`);
      context.save();
      context.globalAlpha = opacity;
      context.fillStyle = scrim;
      context.fillRect(0, Math.min(inner, edge), spec.width, Math.abs(edge - inner));
      context.restore();
    }

    context.save();
    context.globalAlpha = opacity;
    context.textBaseline = "top";
    for (const block of measured) {
      context.font = font(block.weight, block.size);
      context.letterSpacing =
        block.kind === "kicker" ? "4px" : block.kind === "title" ? "-3px" : "-0.4px";
      context.fillStyle =
        block.kind === "kicker"
          ? spec.palette.accent
          : block.kind === "subtitle"
            ? spec.palette.muted
            : spec.palette.ink;
      context.textAlign = text.align === "center" ? "center" : "left";
      const x = text.align === "center" ? spec.width / 2 : margin;
      for (const line of block.lines) {
        context.fillText(line, x, y);
        y += block.leading;
      }
      y += gap;
    }
    context.restore();
    context.letterSpacing = "0px";
  }

  /** Drives a moving texture; the frame's own time, so an export matches. */
  let textureTime = 0;
  /** How much a beat is holding the frame, 0 to 1. */
  let highlight = 0;

  function paintChrome() {
    if (spec.vignette > 0) {
      const vignette = context.createRadialGradient(
        spec.width / 2,
        spec.height / 2,
        spec.width * 0.35,
        spec.width / 2,
        spec.height / 2,
        spec.height * 0.72,
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, `rgba(0,0,0,${spec.vignette})`);
      context.fillStyle = vignette;
      context.fillRect(0, 0, spec.width, spec.height);
    }
    if (texture) {
      const tile =
        texture.tiles[
          texture.rate ? Math.floor(textureTime * texture.rate) % texture.tiles.length : 0
        ];
      context.fillStyle = context.createPattern(tile, "repeat");
      context.fillRect(0, 0, spec.width, spec.height);
    }
    if (spec.mark && tintedMark) {
      const size = 108,
        x = spec.width - size - Math.round(spec.width * 0.082);
      context.save();
      context.globalAlpha = 0.9;
      context.drawImage(tintedMark, x, Math.round(spec.height * 0.075), size, size);
      context.restore();
    }
    if (spec.watermark) {
      context.save();
      context.font = font(500, 30);
      context.letterSpacing = "3px";
      context.fillStyle = spec.palette.muted;
      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      context.fillText(
        spec.watermark.toUpperCase(),
        spec.width / 2,
        spec.height - 250,
      );
      context.restore();
      context.letterSpacing = "0px";
    }
  }

  /** Projects a world point to frame pixels, through the map's still camera. */
  function project(x, y, z = 0) {
    const point = new THREE.Vector3(x, y, z).project(railCamera);
    return {
      x: ((point.x + 1) / 2) * spec.width,
      y: ((1 - point.y) / 2) * spec.height,
      /** Behind the camera, where a projection folds over on itself. */
      behind: point.z > 1,
    };
  }

  /** How many pixels one world unit covers at depth `z`. */
  function pixelsPerUnit(z) {
    return Math.abs(project(0.5, 0, z).x - project(0, 0, z).x) * 2;
  }

  const hex = (colour) => {
    const value = colour.replace("#", "");
    return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16));
  };

  /** Mixes toward the paper, which is how distance reads as haze. */
  function fogged(colour, amount) {
    if (amount <= 0 || !colour.startsWith("#")) return colour;
    const from = hex(colour),
      to = hex(spec.palette.bottom),
      mixed = from.map((channel, index) =>
        Math.round(channel + (to[index] - channel) * Math.min(1, amount)),
      );
    return `rgb(${mixed.join(", ")})`;
  }

  /**
   * The map's records, as the food. Eaten nodes fade to a ring, so the frame
   * shows what has been taken without any score.
   */
  const brainCache = new Map();

  /**
   * The map's records, as the portfolio draws them: the register's colour, the
   * family's mark, the label below it. `scale` sizes a node for the frame, and
   * `depth` fades the ones further away in the rain.
   */
  const nodePlanePixels = () => pixelsPerUnit(0);

  function paintNodes(ctx, nodes, { labels = true, scale = 1, trails = 0, fog = 0 } = {}) {
    if (!nodes?.length) return;
    const reference = nodePlanePixels();
    for (const node of nodes) {
      const z = node.z ?? 0,
        at = project(node.x, node.y, z);
      if (at.behind) continue;
      // Perspective sets the size: a mark at the figure's own depth draws at
      // the size the map draws it, and everything else follows the lens.
      const perspective = node.z === undefined ? 1 : pixelsPerUnit(z) / reference,
        colourAt = spec.palette.registers[node.register] ?? spec.palette.accent,
        haze = node.z === undefined ? 0 : Math.max(0, -z) * fog,
        colour = fogged(colourAt, haze),
        nodeScale = scale * (node.scale ?? 1) * perspective,
        depth = Math.min(1, (node.alpha ?? 1) * (1 - haze * 0.55));
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.globalAlpha = depth * (node.eaten ? 0.3 : 1);

      // The smear sits behind the drop — above it, where it fell from — so the
      // streak reads as downward travel.
      if (trails > 0 && node.fall) {
        const smear = node.fall * trails * nodeScale * 26;
        for (let step = 3; step >= 1; step -= 1) {
          ctx.save();
          ctx.globalAlpha = (depth * 0.16) / step;
          ctx.translate(0, (-smear * step) / 3);
          drawMark(ctx, { family: node.family, colour, scale: nodeScale, brain, brainCache });
          ctx.restore();
        }
        ctx.globalAlpha = depth * (node.eaten ? 0.3 : 1);
      }

      drawMark(ctx, { family: node.family, colour, scale: nodeScale, brain, brainCache });
      // The furthest drops keep their marks but drop their labels; at that size
      // the type is mush rather than information.
      if (labels && !node.eaten && depth > 0.5 && nodeScale > 0.7)
        drawLabel(ctx, {
          label: node.label,
          family: node.family,
          scale: nodeScale,
          colour: fogged(spec.palette.ink, haze),
          outline: spec.palette.labelOutline,
        });
      ctx.restore();
    }
  }

  /**
   * Draws one frame from an explicit state rather than the spec's timeline:
   * the live game's clip time, position, heading, and map. `backgroundTime`
   * only drives the painted backgrounds; a film plays on its own clock.
   */
  function renderState({
    clip = "Swim_Forward",
    clipTime = 0,
    /** Seconds since the last frame. Live playback; null seeks `clipTime`. */
    advance = null,
    /** True while a triggered clip owns the figure. */
    liveOwned = false,
    framing = "swim",
    position = { x: 0, y: 1.85 },
    heading = 0,
    prone = true,
    /**
     * An explicit attitude for a floating figure: `turn` points its length in
     * the frame (90° is head up), `roll` turns it about that length (0 lies it
     * on its back, facing the camera), and `tilt` tips the whole figure toward
     * or away from the camera. The swim's heading decomposition folds at
     * exactly these angles, so this path sets the rotation outright.
     */
    attitude = null,
    nodes = [],
    nodeScale = 1,
    labels = true,
    trails = 0,
    fog = 0,
    swayAmount = 0,
    /** Camera move under the framing: {orbit, dolly, roll}, in radians. */
    camera: cameraDrift = null,
    /** How much of the last frame is kept, and which way it is pushed. */
    echo = 0,
    /** "fall" lifts the last frame, so ghosts trail above a falling mark;
     *  "tunnel" pushes it outward from the centre. */
    echoStyle = "fall",
    echoZoom = 0.015,
    echoLift = 7,
    backgroundTime = 0,
  }) {
    drift = cameraDrift ?? { orbit: 0, dolly: 1, roll: 0 };
    sway = swayAmount
      ? {
          x: Math.sin(backgroundTime * 0.37) * swayAmount,
          y: Math.cos(backgroundTime * 0.29) * swayAmount * 0.7,
        }
      : { x: 0, y: 0 };
    const shot = { clip, framing, orbit: [0, 0], dolly: [1, 1], loop: true };
    if (advance === null) {
      playShot(shot);
      mixer.setTime(clipTime);
    } else {
      // Live: the mixer runs forward, so crossfades and one-shots behave.
      if (liveClip !== clip && !liveOwned) playClip(clip, { fade: 0.3 });
      mixer.update(advance);
      liveElapsed += advance;
    }
    pivot.position.set(0, 0, 0);
    pivot.quaternion.identity();
    body.position.set(0, 0, 0);
    if (prone && attitude) {
      const degrees = (radians) => (radians * 180) / Math.PI;
      applyFigurePose({
        position,
        quaternion: attitudeQuaternion(
          {
            turn: degrees(attitude.turn),
            roll: degrees(attitude.roll),
            tilt: degrees(attitude.tilt ?? 0),
          },
          proneClips.has(liveClip ?? clip) ? 0 : 1,
        ),
        anchorFull: 1,
      });
    } else if (prone) faceAlong(position, heading);
    else {
      // A floating figure keeps its feet under it and only drifts.
      if (hips) {
        pivot.updateMatrixWorld(true);
        const anchor = hips.getWorldPosition(new THREE.Vector3());
        body.position.set(-anchor.x, -anchor.y, -anchor.z);
      }
      pivot.position.set(position.x, position.y, 0);
    }
    placeCamera(shot, 0);
    renderer.render(scene, camera);

    textureTime = backgroundTime;

    // The subject — map and figure — is composed on its own transparent layer
    // so the echo can trail it without smearing the background behind it.
    const subject = subjectContext();
    paintEcho(subject, echo, { style: echoStyle, zoom: echoZoom, lift: echoLift });
    // Nodes behind the figure are painted first; the rain's near ones land on
    // top of it, which is what gives the fall its depth.
    const behind = nodes.filter((node) => (node.z === undefined ? !node.front : node.z <= 0)),
      infront = nodes.filter((node) => (node.z === undefined ? node.front : node.z > 0));
    // Far to near, so a nearer mark covers the one behind it.
    const byDepth = (a, b) => (a.z ?? 0) - (b.z ?? 0);
    paintNodes(subject, behind.sort(byDepth), { labels, scale: nodeScale, trails, fog });
    subject.drawImage(gl, 0, 0);
    paintNodes(subject, infront.sort(byDepth), { labels, scale: nodeScale, trails, fog });
    keepEcho(echo, subjectCanvas);

    paintBackground(backgroundTime);
    context.drawImage(subjectCanvas, 0, 0);
    paintChrome();
  }

  /**
   * The last frame's *subject* — the figure and the map, on transparent — held
   * so it can be laid back down under the new one. Only the subject echoes:
   * ghosting the background as well left a grey haze along every edge of the
   * film, which is not a trail, it is dirt.
   */
  let echoCanvas = null;
  let subjectCanvas = null;

  function subjectContext() {
    if (!subjectCanvas) {
      subjectCanvas = document.createElement("canvas");
    }
    if (subjectCanvas.width !== spec.width || subjectCanvas.height !== spec.height) {
      subjectCanvas.width = spec.width;
      subjectCanvas.height = spec.height;
    }
    const held = subjectCanvas.getContext("2d");
    held.setTransform(1, 0, 0, 1, 0, 0);
    held.clearRect(0, 0, spec.width, spec.height);
    return held;
  }

  function paintEcho(target, strength, { style = "fall", zoom = 0.015, lift = 7 } = {}) {
    if (strength <= 0 || !echoCanvas) return;
    target.save();
    target.globalAlpha = Math.min(0.95, strength);
    if (style === "tunnel") {
      const grow = 1 + zoom,
        width = spec.width * grow,
        height = spec.height * grow;
      target.drawImage(
        echoCanvas,
        (spec.width - width) / 2,
        (spec.height - height) / 2,
        width,
        height,
      );
    } else {
      // Lifting the last frame leaves every ghost above where its mark is now,
      // which is the streak a falling thing makes.
      target.drawImage(echoCanvas, 0, -lift);
    }
    target.restore();
  }

  function keepEcho(strength, source) {
    if (strength <= 0) {
      echoCanvas = null;
      return;
    }
    if (!echoCanvas) echoCanvas = document.createElement("canvas");
    if (echoCanvas.width !== spec.width || echoCanvas.height !== spec.height) {
      echoCanvas.width = spec.width;
      echoCanvas.height = spec.height;
    }
    const held = echoCanvas.getContext("2d");
    held.clearRect(0, 0, spec.width, spec.height);
    held.drawImage(source, 0, 0);
  }

  function renderFrame(time) {
    textureTime = time;
    sway = spec.sway
      ? {
          x: Math.sin(time * 0.37) * spec.sway,
          y: Math.cos(time * 0.29) * spec.sway * 0.7,
        }
      : { x: 0, y: 0 };
    drift = spec.cameraDrift
      ? {
          orbit: Math.sin(time * 0.07) * 0.11 * spec.cameraDrift,
          dolly: 1 + Math.sin(time * 0.051) * 0.07 * spec.cameraDrift,
          roll: Math.sin(time * 0.043) * 0.05 * spec.cameraDrift,
        }
      : { orbit: 0, dolly: 1, roll: 0 };
    const { shot, index, local, progress } = shotAt(spec, time);

    // One scene, not a compilation: near a boundary the outgoing shot keeps
    // running and is crossed into the incoming one — clip, place, attitude, and
    // camera together — so nothing in the frame jumps.
    const previous = index > 0 ? spec.shots[index - 1] : null,
      window = Math.min(spec.blend, previous ? previous.duration : 0, shot.duration),
      crossing = previous && local < window,
      weight = crossing ? easeInOut(local / window) : 1;

    const { beat, weight: beatWeight, phase: beatPhase } = beatAt(shot.beats, local);
    highlight = beat ? beat.highlight * beatWeight : 0;
    // The figure catches the light as the background steps back.
    rim.intensity = 0.6 + highlight * 1.5;
    key.intensity = 1.7 + highlight * 0.5;

    // A shot's track plays its animations one into the next inside the shot,
    // with the camera, the motion, and the scene carrying straight on.
    const entries = shot.track
      ? trackAt(shot.track, local).map((entry) => ({ ...entry, weight: entry.weight * weight }))
      : [{ clip: shot.clip, time: (shot.offset + local) * shot.rate, weight, loop: shot.loop }];
    const standing = entries.reduce(
      (total, entry) => total + (proneClips.has(entry.clip) ? 0 : entry.weight),
      0,
    );

    const basePose = figurePose(shot, local, standing),
      pose = beat
        ? {
            position: {
              x: basePose.position.x + (beat.place[0] - basePose.position.x) * beatWeight,
              y: basePose.position.y + (beat.place[1] - basePose.position.y) * beatWeight,
            },
            quaternion: basePose.quaternion
              .clone()
              .slerp(
                attitudeQuaternion(
                  { turn: beat.turn, roll: beat.roll, tilt: beat.tilt },
                  standing,
                ),
                beatWeight,
              ),
            anchor: basePose.anchor,
          }
        : basePose;
    let blended = pose;
    if (crossing) {
      const outgoingLocal = previous.duration + local,
        outgoing = figurePose(previous, outgoingLocal, standing);
      entries.push({
        clip: previous.clip,
        time: (previous.offset + outgoingLocal) * previous.rate,
        weight: 1 - weight,
        loop: previous.loop,
      });
      blended = {
        position: {
          x: outgoing.position.x + (pose.position.x - outgoing.position.x) * weight,
          y: outgoing.position.y + (pose.position.y - outgoing.position.y) * weight,
        },
        quaternion: outgoing.quaternion.clone().slerp(pose.quaternion, weight),
        anchor: pose.anchor,
        anchorFull:
          (outgoing.anchor === "full" ? 1 : 0) +
          ((pose.anchor === "full" ? 1 : 0) - (outgoing.anchor === "full" ? 1 : 0)) * weight,
      };
    }
    applyPose(entries);
    applyFigurePose({
      ...blended,
      anchorFull: blended.anchorFull ?? (blended.anchor === "full" ? 1 : 0),
    });

    railOn(shot.framing);
    const shotCamera = cameraParams(shot, progress, beat, beatWeight, beatPhase);
    if (crossing) {
      const outgoingCamera = cameraParams(previous, 1);
      applyCamera({
        position: outgoingCamera.position.lerp(shotCamera.position, weight),
        target: outgoingCamera.target.lerp(shotCamera.target, weight),
        fov: outgoingCamera.fov + (shotCamera.fov - outgoingCamera.fov) * weight,
      });
    } else applyCamera(shotCamera);
    renderer.render(scene, camera);

    const drops = spec.rain.enabled
      ? rainAt(time, {
          records: records.filter((record) => !spec.hidden.includes(record.id)),
          count: spec.rain.count,
          seed: spec.rain.seed,
          speed: spec.rain.speed,
        })
      : [];
    const subject = subjectContext();
    paintEcho(subject, spec.echo, { style: spec.echoStyle });
    const byDepth = (a, b) => (a.z ?? 0) - (b.z ?? 0);
    const nodeOptions = {
      labels: spec.rain.labels,
      scale: spec.rain.scale,
      fog: spec.rain.fog,
      trails: spec.trails,
    };
    paintNodes(subject, drops.filter((drop) => drop.z <= 0).sort(byDepth), nodeOptions);
    subject.drawImage(gl, 0, 0);
    paintNodes(subject, drops.filter((drop) => drop.z > 0).sort(byDepth), nodeOptions);
    keepEcho(spec.echo, subjectCanvas);

    paintBackground(time);
    paintContactShadow(shotAt(spec, time).shot);
    context.drawImage(subjectCanvas, 0, 0);
    paintText(shot, local);
    paintChrome();

    const dip = dipAt(spec, time) * spec.dipDepth;
    if (dip > 0) {
      context.save();
      context.globalAlpha = dip;
      context.fillStyle = spec.palette.bottom;
      context.fillRect(0, 0, spec.width, spec.height);
      context.restore();
    }
  }

  /**
   * Work a frame needs before it can be drawn: the film has to be loaded and
   * seeked. Standing frames resolve immediately.
   */
  async function prepare(time) {
    if (spec.background.kind !== "video") return;
    if (currentFilmName !== spec.background.film) {
      currentFilmName = spec.background.film;
      currentFilm = await loadFilm(currentFilmName);
    }
    if (!currentFilm?.duration) return;
    const at = (time * spec.background.speed) % currentFilm.duration;
    if (Math.abs(currentFilm.currentTime - at) < 1 / 120) return;
    await new Promise((resolve) => {
      currentFilm.addEventListener("seeked", resolve, { once: true });
      currentFilm.currentTime = at;
    });
  }

  /**
   * Live mode lets the film run on its own clock, which is how it moves in the
   * story workflow. Scripted rendering seeks it frame by frame instead.
   */
  async function setLive(live) {
    if (spec.background.kind !== "video") return;
    if (!currentFilm && spec.background.film) {
      currentFilmName = spec.background.film;
      currentFilm = await loadFilm(currentFilmName);
    }
    if (!currentFilm) return;
    currentFilm.loop = true;
    if (live) await currentFilm.play().catch(() => {});
    else currentFilm.pause();
    filmPace();
  }

  /**
   * The background's drift is the film's own playback rate while it plays; at
   * zero the film holds on a frame instead of running.
   */
  function filmPace() {
    if (!currentFilm) return;
    const wanted = spec.background.speed;
    if (wanted <= 0.05) {
      currentFilm.pause();
      return;
    }
    currentFilm.playbackRate = Math.min(8, Math.max(0.0625, wanted));
    if (currentFilm.paused) currentFilm.play().catch(() => {});
  }

  return {
    get spec() {
      return spec;
    },
    update,
    prepare,
    setLive,
    filmPace,
    playClip,
    /** Every clip in the model, with its length, for the animation panel. */
    get clipLibrary() {
      return [...clips.entries()]
        .map(([name, clip]) => ({ name, duration: clip.duration }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    /** How far the current live clip has run, and whether it has finished. */
    get liveClipState() {
      return { clip: liveClip, elapsed: liveElapsed, finished: liveElapsed >= liveEndsAt };
    },
    renderState,
    renderFrame,
    dispose() {
      renderer.dispose();
    },
  };
}
