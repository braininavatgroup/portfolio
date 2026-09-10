export const styles = ["blur", "pixelate", "solid"];
export function normalizedBox(a, b) {
  const x = Math.max(0, Math.min(1, a.x, b.x)),
    y = Math.max(0, Math.min(1, a.y, b.y));
  return {
    x,
    y,
    w: Math.min(1, Math.max(a.x, b.x)) - x,
    h: Math.min(1, Math.max(a.y, b.y)) - y,
  };
}
export function boxAt(track, time) {
  if (track.scope === "fixed") {
    if (time < track.start || time > track.end) return null;
    return (
      [...track.keyframes].reverse().find((k) => k.time <= time)?.box ??
      track.keyframes[0]?.box ??
      null
    );
  }
  return (
    track.keyframes.find((k) => Math.abs(k.time - time) < 0.12)?.box ?? null
  );
}
export function upsertKeyframe(track, time, box) {
  const key = track.keyframes.find((k) => Math.abs(k.time - time) < 0.12);
  if (key) key.box = box;
  else track.keyframes.push({ time, box });
  track.keyframes.sort((a, b) => a.time - b.time);
}
export function validateProject(project, manifest) {
  const fail = () => {
    throw new Error(
      "Invalid studio selections. No saved work was overwritten.",
    );
  };
  if (
    !project ||
    project.version !== 1 ||
    !project.assets ||
    typeof project.assets !== "object" ||
    Array.isArray(project.assets)
  )
    fail();
  const finite = (v, min, max) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  for (const [id, a] of Object.entries(project.assets)) {
    const source = manifest.find((m) => m.id === id);
    if (
      !source ||
      !a ||
      !["unreviewed", "marked", "keep", "deferred"].includes(a.status) ||
      typeof a.notes !== "string" ||
      a.notes.length > 20000 ||
      !Array.isArray(a.checkpoints) ||
      !Array.isArray(a.tracks) ||
      a.tracks.length > 200 ||
      a.checkpoints.length > 2000
    )
      fail();
    if (source.sha256 && a.sourceHash !== source.sha256)
      throw new Error(
        "A source image or video changed. Existing selections were preserved; reconcile the changed source before continuing.",
      );
    const end = source.kind === "video" ? source.duration : 0;
    for (const t of a.checkpoints) if (!finite(t, 0, end)) fail();
    if (a.reviewedCheckpoints !== undefined) {
      if (
        !Array.isArray(a.reviewedCheckpoints) ||
        a.reviewedCheckpoints.length > 2000
      )
        fail();
      for (const t of a.reviewedCheckpoints) if (!finite(t, 0, end)) fail();
    }
    const ids = new Set();
    for (const t of a.tracks) {
      if (
        typeof t.id !== "string" ||
        ids.has(t.id) ||
        typeof t.label !== "string" ||
        t.label.length > 1000 ||
        !styles.includes(t.style) ||
        !finite(t.strength, 1, 40) ||
        !/^#[a-f\d]{6}$/i.test(t.color) ||
        !["follow", "fixed"].includes(t.scope) ||
        !Array.isArray(t.keyframes) ||
        !t.keyframes.length ||
        t.keyframes.length > 2000
      )
        fail();
      ids.add(t.id);
      if (
        t.scope === "fixed" &&
        (!finite(t.start, 0, end) || !finite(t.end, t.start, end))
      )
        fail();
      let previous = -1;
      for (const k of t.keyframes) {
        const b = k.box;
        if (
          !finite(k.time, 0, end) ||
          k.time <= previous ||
          !b ||
          !finite(b.x, 0, 1) ||
          !finite(b.y, 0, 1) ||
          !finite(b.w, 0.00001, 1) ||
          !finite(b.h, 0.00001, 1) ||
          b.x + b.w > 1.000001 ||
          b.y + b.h > 1.000001
        )
          fail();
        previous = k.time;
      }
    }
  }
  return structuredClone(project);
}
