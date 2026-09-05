import type { Point3 } from "./portfolio-world-projection";

/**
 * Zones: where a composition's members may land, not where they must.
 *
 * A zone is a sector (screen degrees around an anchor: 0 right, 90 down,
 * increasing clockwise) and a band (distance range in world units). Members
 * take equal slots across the sector in list order, alternate near and far
 * across the band, and then a seeded jitter chooses their exact pose. The
 * grouping and order are rules; the coordinates are weather.
 *
 * World axes: +x is screen-left, +y is screen-up, so a polar point is
 * subtracted from the anchor on both axes.
 */
export type Sector = readonly [number, number];
export type Band = readonly [number, number];

export type Zone = {
  sector: Sector;
  band: Band;
  members: readonly string[];
  z?: number;
};

export type ZoneMap = {
  /** Where the spotlit node hangs, around Bradley. */
  spotlight: { sector: Sector; band: Band; z?: number };
  zones: readonly Zone[];
};

export type Rng = () => number;

export const ZONE_DEPTH = 700;

/** Jitter as fractions of a slot's half-width and of the band's width. */
export const ZONE_JITTER = { angle: 0.3, radius: 0.15 } as const;

/** Near and far positions across a band, alternating slot by slot. */
export const BAND_STAGGER = [0.3, 0.7] as const;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, and good enough for layout jitter. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A rng that never jitters: every member lands on its slot centre. */
export const stillRng: Rng = () => 0.5;

/**
 * The session seed: chosen once per page load, so a record returns to the
 * pose you last saw within a visit and takes a new one on the next.
 */
let sessionSeed = 0x9e3779b9;

export function setWorldSeed(seed: number) {
  sessionSeed = seed >>> 0;
}

/** One rng per composition, stable for the session. */
export function compositionRng(key: string): Rng {
  return createRng((sessionSeed ^ hashString(key)) >>> 0);
}

const signed = (rng: Rng) => rng() * 2 - 1;

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export function polarPoint(
  anchor: Point3,
  degrees: number,
  radius: number,
  z = ZONE_DEPTH,
): Point3 {
  const theta = (degrees * Math.PI) / 180;
  return {
    x: anchor.x - Math.cos(theta) * radius,
    y: anchor.y - Math.sin(theta) * radius,
    z,
  };
}

/** Screen angle from one world point to another, 0 right, 90 down, in [0, 360). */
export function screenAngle(from: Point3, to: Point3): number {
  const degrees = (Math.atan2(-(to.y - from.y), -(to.x - from.x)) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export function screenDistance(from: Point3, to: Point3): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/** Whether an angle lies inside a sector that may wrap past 360. */
export function inSector(degrees: number, [from, to]: Sector): boolean {
  const span = to - from;
  const offset = (((degrees - from) % 360) + 360) % 360;
  return offset >= -1e-9 && offset <= span + 1e-9;
}

/**
 * Place a zone's members: equal slots across the sector in list order, near
 * and far alternating across the band, each nudged by the rng but kept
 * inside its own slot and the band, so order and grouping always hold.
 */
export function placeInZone(anchor: Point3, zone: Zone, rng: Rng): Map<string, Point3> {
  const { sector, band, members } = zone;
  const count = members.length;
  const slot = (sector[1] - sector[0]) / Math.max(1, count);
  const half = slot / 2;
  const width = band[1] - band[0];
  return new Map(
    members.map((id, index) => {
      const centre = sector[0] + (index + 0.5) * slot;
      const degrees = centre + signed(rng) * ZONE_JITTER.angle * half;
      const stagger = count === 1 ? 0.5 : BAND_STAGGER[index % 2];
      const radius = clamp(
        lerp(band[0], band[1], stagger) + signed(rng) * ZONE_JITTER.radius * width,
        band[0],
        band[1],
      );
      return [id, polarPoint(anchor, degrees, radius, zone.z)];
    }),
  );
}

/** Place one node in a single-slot zone. */
export function placeOne(
  anchor: Point3,
  zone: { sector: Sector; band: Band; z?: number },
  rng: Rng,
): Point3 {
  return placeInZone(anchor, { ...zone, members: ["one"] }, rng).get("one")!;
}

/**
 * Up to four relations land loosely, as in the accepted arc frame: up-left,
 * right, far right and up, then left and below. A single relation takes the
 * right seat.
 */
export const LOOSE_SLOTS: readonly { sector: Sector; band: Band }[] = [
  { sector: [230, 250], band: [380, 470] },
  { sector: [4, 24], band: [480, 570] },
  { sector: [332, 350], band: [960, 1100] },
  { sector: [136, 156], band: [420, 500] },
];

export const LOOSE_LIMIT = LOOSE_SLOTS.length;

/**
 * `rotation` is the record's signature: it turns the seating so siblings
 * with the same relations do not land as copies of each other.
 */
export function looseZones(members: readonly string[], rotation = 0, tilt = 0): Zone[] {
  const count = members.length;
  const slots = count === 1 ? [LOOSE_SLOTS[1]] : LOOSE_SLOTS.slice(0, count);
  return slots.map((slot, index) => ({
    ...slot,
    sector: [slot.sector[0] + tilt, slot.sector[1] + tilt],
    members: [members[(index + rotation) % Math.max(1, count)]],
  }));
}

/** How far the trunk tilts from straight up, signed, in screen degrees. */
export function trunkTilt(anchor: Point3, trunkTo: Point3): number {
  return ((screenAngle(anchor, trunkTo) - 270 + 540) % 360) - 180;
}

/** Families in the order a star seats them, so groupings stay together. */
const FAMILY_ORDER = [
  "story",
  "operation",
  "component",
  "engagement",
  "product",
  "identity",
] as const;

export function groupByFamily(
  members: readonly string[],
  familyOf: (id: string) => string | undefined,
): string[] {
  const rank = (id: string) => {
    const index = FAMILY_ORDER.indexOf(familyOf(id) as (typeof FAMILY_ORDER)[number]);
    return index === -1 ? FAMILY_ORDER.length : index;
  };
  return members
    .map((id, index) => ({ id, index, rank: rank(id) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ id }) => id);
}

/**
 * The star: relations on two arcs either side of the spotlit node, skipping
 * the cone the trunk comes down through and the cone straight below. The
 * first half take the right arc, the rest the left, so groupings stay
 * together.
 */
export const STAR_ARCS = { right: [300, 405] as Sector, left: [135, 240] as Sector };
export const STAR_BAND: Band = [470, 720];

export function starZones(
  members: readonly string[],
  familyOf?: (id: string) => string | undefined,
): Zone[] {
  const half = Math.ceil(members.length / 2);
  let rightCount = half;
  if (familyOf) {
    // Split where a family ends, at the boundary nearest the middle.
    let best = Infinity;
    for (let index = 1; index < members.length; index += 1) {
      if (familyOf(members[index - 1]) === familyOf(members[index])) continue;
      const distance = Math.abs(index - half);
      if (distance < best) {
        best = distance;
        rightCount = index;
      }
    }
  }
  return [
    { sector: STAR_ARCS.right, band: STAR_BAND, members: members.slice(0, rightCount) },
    { sector: STAR_ARCS.left, band: STAR_BAND, members: members.slice(rightCount) },
  ].filter((zone) => zone.members.length > 0);
}

/**
 * The two large Stories are authored as zone maps: the groupings and their
 * order come from the accepted frames; the exact pose is the session's.
 */
export const AUTHORED_ZONES: Record<string, ZoneMap> = {
  "thread-making-work-playable": {
    spotlight: { sector: [94, 101], band: [710, 760], z: 660 },
    zones: [
      // Products, up and left.
      { sector: [220, 256], band: [500, 800], members: ["dubs", "writ"] },
      // Components, left.
      { sector: [174, 208], band: [660, 900], members: ["reporting", "kickoff", "pitching"] },
      // Engagements, right.
      { sector: [334, 382], band: [500, 790], members: ["real-estate", "touring"] },
    ],
  },
};

/**
 * The trunk cone: no relation lands within this many degrees of the line
 * from the spotlit node up to Bradley, whichever way it tilts. A member
 * whose slot falls inside is moved to the cone's nearer edge at its radius.
 */
export const TRUNK_CONE = 16;

export function clearTrunkCone(
  anchor: Point3,
  trunkTo: Point3,
  point: Point3,
  /** Half the node's label width in world units; widens the cone for it. */
  labelHalfWidth = 0,
): Point3 {
  const trunk = screenAngle(anchor, trunkTo);
  const angle = screenAngle(anchor, point);
  const radius = screenDistance(anchor, point);
  const cone = TRUNK_CONE + (Math.atan2(labelHalfWidth, Math.max(1, radius)) * 180) / Math.PI;
  let delta = ((angle - trunk + 540) % 360) - 180;
  if (Math.abs(delta) >= cone) return point;
  if (delta === 0) delta = 1;
  return polarPoint(anchor, trunk + Math.sign(delta) * cone, radius, point.z);
}

/**
 * The minimum a node moves between compositions, in world units (about 25px
 * at the reference viewport). Smaller shifts read as a mistake, not a move.
 */
export const MIN_SHIFT = 60;

/**
 * Push `next` away from `previous` until it is at least `min` away, along
 * the line between them, or along `fallback` when they coincide.
 */
export function ensureShift(
  previous: Point3 | undefined,
  next: Point3,
  min = MIN_SHIFT,
  fallback: { x: number; y: number } = { x: 1, y: 0 },
): Point3 {
  if (!previous) return next;
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= min) return next;
  const direction =
    distance > 1e-6
      ? { x: dx / distance, y: dy / distance }
      : { x: fallback.x, y: fallback.y };
  return { x: previous.x + direction.x * min, y: previous.y + direction.y * min, z: next.z };
}

/** Every member of a zone map, in zone order. */
export function zoneMembers(zones: readonly Zone[]): string[] {
  return zones.flatMap((zone) => zone.members);
}
