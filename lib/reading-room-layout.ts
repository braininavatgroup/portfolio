export type ReadingRoomView = "reader" | "map" | "guide";
export type ReadingRoomSlot = "main" | "top" | "bottom";

type ReadingRoomSlots = Record<ReadingRoomSlot, ReadingRoomView>;

export type ReadingRoomLayoutState = {
  slots: ReadingRoomSlots;
  hidden: ReadingRoomView[];
  split: number;
  vsplit: number;
  side: number;
};

const READING_ROOM_VIEWS = new Set<ReadingRoomView>(["reader", "map", "guide"]);
const READING_ROOM_SLOTS: readonly ReadingRoomSlot[] = ["main", "top", "bottom"];
const SIDE_SLOTS: readonly ReadingRoomSlot[] = ["top", "bottom"];

export const DEFAULT_READING_ROOM_LAYOUT: ReadingRoomLayoutState = {
  slots: { main: "reader", top: "map", bottom: "guide" },
  hidden: [],
  split: 680 / 1120,
  vsplit: 0.4,
  side: 320 / 1440,
};

function defaultLayout(): ReadingRoomLayoutState {
  return {
    ...DEFAULT_READING_ROOM_LAYOUT,
    slots: { ...DEFAULT_READING_ROOM_LAYOUT.slots },
    hidden: [...DEFAULT_READING_ROOM_LAYOUT.hidden],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReadingRoomView(value: unknown): value is ReadingRoomView {
  return typeof value === "string" && READING_ROOM_VIEWS.has(value as ReadingRoomView);
}

function parseSlots(value: unknown): ReadingRoomSlots {
  if (!isRecord(value)) return { ...DEFAULT_READING_ROOM_LAYOUT.slots };

  const slots = READING_ROOM_SLOTS.map((slot) => value[slot]);
  if (!slots.every(isReadingRoomView) || new Set(slots).size !== READING_ROOM_SLOTS.length) {
    return { ...DEFAULT_READING_ROOM_LAYOUT.slots };
  }

  return {
    main: slots[0],
    top: slots[1],
    bottom: slots[2],
  };
}

function parseHidden(value: unknown): ReadingRoomView[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.filter(isReadingRoomView))];
}

function parseSize(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Hidden-ness belongs to a slot, not a view: `hidden` lists the views that
 * currently occupy collapsed slots. Main is never collapsed (nothing could
 * reopen it), and the upper side slot cannot collapse alone while the lower
 * one stays open.
 */
function normalizeHidden(state: ReadingRoomLayoutState): ReadingRoomLayoutState {
  const { main: mainView, top: topView, bottom: bottomView } = state.slots;
  const topAlone = state.hidden.includes(topView) && !state.hidden.includes(bottomView);
  const hidden = state.hidden.filter((view) => (
    view !== mainView && (!topAlone || view !== topView)
  ));

  return hidden.length === state.hidden.length ? state : { ...state, hidden };
}

/** Parses persisted slot state and resets only invalid fields to their defaults. */
export function parseReadingRoomLayout(value: string | null | undefined): ReadingRoomLayoutState {
  if (!value) return defaultLayout();

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return defaultLayout();

    return normalizeHidden({
      slots: parseSlots(parsed.slots),
      hidden: parseHidden(parsed.hidden),
      split: parseSize(parsed.split, DEFAULT_READING_ROOM_LAYOUT.split),
      vsplit: parseSize(parsed.vsplit, DEFAULT_READING_ROOM_LAYOUT.vsplit),
      side: parseSize(parsed.side, DEFAULT_READING_ROOM_LAYOUT.side),
    });
  } catch {
    return defaultLayout();
  }
}

/** Serializes the persistent state owned by the Reading Room shell. */
export function serializeReadingRoomLayout(state: ReadingRoomLayoutState): string {
  return JSON.stringify(normalizeHidden({
    ...state,
    slots: { ...state.slots },
    hidden: [...state.hidden],
  }));
}

/**
 * Moves the view assignments between two layout slots. A collapsed slot stays
 * collapsed with its new view; a view arriving in main is always shown, so a
 * bar dragged out of a collapsed slot reopens its view rather than hiding main.
 */
export function swapReadingRoomSlots(
  state: ReadingRoomLayoutState,
  first: ReadingRoomSlot,
  second: ReadingRoomSlot,
): ReadingRoomLayoutState {
  if (first === second) return state;

  const slots = {
    ...state.slots,
    [first]: state.slots[second],
    [second]: state.slots[first],
  };
  const hidden = SIDE_SLOTS
    .filter((slot) => state.hidden.includes(state.slots[slot]))
    .map((slot) => slots[slot]);

  return normalizeHidden({ ...state, slots, hidden });
}

/** Hides or reopens a view while keeping a visible lower side slot above water. */
export function setReadingRoomViewHidden(
  state: ReadingRoomLayoutState,
  view: ReadingRoomView,
  hidden: boolean,
): ReadingRoomLayoutState {
  const nextHidden = hidden
    ? [...new Set([...state.hidden, view])]
    : state.hidden.filter((hiddenView) => hiddenView !== view);

  return normalizeHidden({ ...state, hidden: nextHidden });
}

/** Returns the slots that retain a rendered body after collapse state is applied. */
export function visibleReadingRoomSlots(state: ReadingRoomLayoutState): ReadingRoomSlot[] {
  return READING_ROOM_SLOTS.filter((slot) => !state.hidden.includes(state.slots[slot]));
}

/** Breakpoint for the accepted full-width opening composition. */
export const FULL_DESKTOP_WIDTH = 1382;

export type ReadingRoomMinimums = {
  contents: number;
  main: number;
  right: number;
  /** main + separator + right: the workspace panel's own minimum. */
  workspace: number;
};

/** Initial composition is separate from resize limits: defaults must not lock the handles. */
export function readingRoomInitialSizes(viewportWidth: number) {
  const contents = viewportWidth >= FULL_DESKTOP_WIDTH ? Math.min(320, viewportWidth - 1082) : 240;
  const workspace = viewportWidth - contents - 1;
  const initialMainFloor = viewportWidth >= FULL_DESKTOP_WIDTH ? 720 : Math.max(420, viewportWidth - 562);
  const initialRightFloor = viewportWidth >= FULL_DESKTOP_WIDTH ? 360 : 320;
  const main = Math.min(workspace - 1 - initialRightFloor, Math.max(initialMainFloor, (workspace - 1) * DEFAULT_READING_ROOM_LAYOUT.split));
  return { contents, main, right: workspace - 1 - main };
}

/** Readable lower limits leave at least 178px of drag room at the desktop breakpoint. */
export function readingRoomMinimums(): ReadingRoomMinimums {
  const contents = 180;
  const main = 420;
  const right = 240;
  return { contents, main, right, workspace: main + 1 + right };
}
