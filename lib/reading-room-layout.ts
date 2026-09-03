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

function enforceSideSlotVisibility(state: ReadingRoomLayoutState): ReadingRoomLayoutState {
  const topView = state.slots.top;
  const bottomView = state.slots.bottom;

  if (!state.hidden.includes(topView) || state.hidden.includes(bottomView)) return state;

  return { ...state, hidden: state.hidden.filter((view) => view !== topView) };
}

/** Parses persisted slot state and resets only invalid fields to their defaults. */
export function parseReadingRoomLayout(value: string | null | undefined): ReadingRoomLayoutState {
  if (!value) return defaultLayout();

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return defaultLayout();

    return enforceSideSlotVisibility({
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
  return JSON.stringify(enforceSideSlotVisibility({
    ...state,
    slots: { ...state.slots },
    hidden: [...state.hidden],
  }));
}

/** Moves the view assignments between two visible layout slots. */
export function swapReadingRoomSlots(
  state: ReadingRoomLayoutState,
  first: ReadingRoomSlot,
  second: ReadingRoomSlot,
): ReadingRoomLayoutState {
  if (first === second) return state;

  return enforceSideSlotVisibility({
    ...state,
    slots: {
      ...state.slots,
      [first]: state.slots[second],
      [second]: state.slots[first],
    },
    hidden: [...state.hidden],
  });
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

  return enforceSideSlotVisibility({ ...state, hidden: nextHidden });
}

/** Returns the slots that retain a rendered body after collapse state is applied. */
export function visibleReadingRoomSlots(state: ReadingRoomLayoutState): ReadingRoomSlot[] {
  return READING_ROOM_SLOTS.filter((slot) => !state.hidden.includes(state.slots[slot]));
}
