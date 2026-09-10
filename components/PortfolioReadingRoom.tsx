"use client";

import { Feedback, defaultPreset } from "@dnd-kit/dom";
import {
  DragDropProvider,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelRef,
  useGroupRef,
  type PanelSize,
} from "react-resizable-panels";
import {
  cloneElement,
  createRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  DEFAULT_READING_ROOM_LAYOUT,
  readingRoomMinimums,
  readingRoomInitialSizes,
  parseReadingRoomLayout,
  serializeReadingRoomLayout,
  setReadingRoomViewHidden,
  swapReadingRoomSlots,
  type ReadingRoomLayoutState,
  type ReadingRoomSlot,
  type ReadingRoomView,
} from "../lib/reading-room-layout";
import type { PortfolioWorldNode } from "../lib/portfolio-world";
import { PortfolioContents } from "./PortfolioContents";
import { PortfolioControlGlyph, PortfolioControlMark, PortfolioNodeMark } from "./PortfolioNodeMark";

const SLOT_STORAGE_KEY = "reading-room-slots";
const DESKTOP_QUERY = "(min-width: 1020px)";
// A side slot never shrinks below a usable Guide: 40px bar, the 80px minimum
// avatar area, the 78px composer, and its 12/24 margins (Bradley, 3 September;
// the README's 160 left only the avatar and the composer's top edge).
const SIDE_SLOT_MIN_HEIGHT = 240;
const READING_ROOM_SLOTS: readonly ReadingRoomSlot[] = ["main", "top", "bottom"];
// React renders each view once, in the slot it occupies on first run, and
// never moves it: React cannot carry a subtree between parents, so rendering a
// swapped view under its new slot would remount it and drop the Guide thread
// and the Map's state. A swap instead moves the view's DOM host between slot
// bodies (see the layout effect in PortfolioReadingRoom). The first-run
// composition is also what the server renders, so SSR puts each view inside
// its slot.
const HOME_SLOTS = DEFAULT_READING_ROOM_LAYOUT.slots;

// Nothing follows the pointer and no text appears: dnd-kit's Feedback plugin
// must keep running (it supplies the operation's shape for collisions), so it
// moves the bar while leaving a clone in place. The stylesheet hides the moving
// bar and darkens the clone; the target slot shows only its fill and border.
const READING_ROOM_DND_PLUGINS = [
  ...defaultPreset.plugins.filter((plugin) => plugin !== Feedback),
  Feedback.configure({ dropAnimation: null, feedback: "clone" }),
];

const fallbackStorage: Pick<Storage, "getItem" | "setItem"> = {
  getItem: () => null,
  setItem: () => {},
};

export type ReadingRoomMobileTab = "contents" | "reader" | "map";

export type ReadingRoomMobileTabRequest = {
  key: number;
  tab: ReadingRoomMobileTab;
};

/** Asks the shell to reveal a view: expand a collapsed column or lower slot on
 *  desktop, or switch to the tab that hosts it below 1020px. */
export type ReadingRoomViewRequest = {
  key: number;
  view: ReadingRoomView;
};

export type PortfolioReadingRoomProps = {
  activeThreadId: string | null;
  guide: ReactNode;
  guideHasThread: boolean;
  avatarHidden?: boolean;
  onToggleAvatar?: () => void;
  /** Temporarily expands the Map without changing saved panel preferences. */
  gameMode?: boolean;
  map: ReactElement<{ compact?: boolean; nodesInTabOrder?: boolean }>;
  mobileTabRequest?: ReadingRoomMobileTabRequest;
  onEscapeBeforeRoom?: () => boolean;
  onGuideReset: () => void;
  onGuideVisibilityChange?: (visible: boolean) => void;
  onHome: () => void;
  /** Fires after any panel resize, collapse, or reopen so viewport overlays
   *  (the avatar dock) can re-read slot geometry. */
  onLayoutChange?: () => void;
  onSelect: (node: PortfolioWorldNode) => void;
  onSelectThread: (threadId: string) => void;
  reader: ReactNode;
  selectedId: string | null;
  selectedSubject: PortfolioWorldNode | null;
  /** Optional in-memory storage injection for tests. Never pass browser storage. */
  storage?: Pick<Storage, "getItem" | "setItem">;
  viewRequest?: ReadingRoomViewRequest;
};

function subscribeDesktop(listener: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getDesktopServerSnapshot() {
  return true;
}

function subscribeViewportWidth(listener: () => void) {
  window.addEventListener("resize", listener);
  return () => window.removeEventListener("resize", listener);
}

function getViewportWidth() {
  return window.innerWidth;
}

// The server guesses the narrowest desktop. Minimums may only grow after
// hydration: growing pushes panel sizes up, while shrinking from a too-wide
// guess would first collapse Contents and the right column on tablets.
function getViewportWidthServerSnapshot() {
  return 1020;
}

/** Layout preferences live only for this mounted visit, never in browser storage. */
function createVisitStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

function viewLabel(view: ReadingRoomView) {
  if (view === "guide") return "Guide";
  return view[0]!.toUpperCase() + view.slice(1);
}

function viewMark(view: Exclude<ReadingRoomView, "reader">) {
  return view === "map" ? "map" : "chat";
}

function selectedLabel(node: PortfolioWorldNode) {
  return node.label.replace(/^Brain in a Vat /, "");
}

function slotFromEntityId(value: unknown): ReadingRoomSlot | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const id = String(value).split("-").at(-1);
  return id === "main" || id === "top" || id === "bottom" ? id : null;
}

function watchCollapseThreshold(
  event: ReactPointerEvent,
  groupId: string,
  side: "left" | "right",
  minimum: number,
  onCollapse: () => void,
) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const bounds = group.getBoundingClientRect();
  const collapseAt = side === "left"
    ? bounds.left + minimum - 48
    : bounds.right - minimum + 48;
  const pointerId = event.pointerId;
  let crossedThreshold = false;

  const cleanup = () => {
    window.removeEventListener("pointermove", handleMove, true);
    window.removeEventListener("pointerup", handleEnd, true);
    window.removeEventListener("pointercancel", cleanup, true);
  };
  const handleMove = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    crossedThreshold ||= side === "left"
      ? moveEvent.clientX <= collapseAt
      : moveEvent.clientX >= collapseAt;
  };
  const handleEnd = (endEvent: PointerEvent) => {
    if (endEvent.pointerId !== pointerId) return;
    cleanup();
    if (crossedThreshold) queueMicrotask(onCollapse);
  };

  window.addEventListener("pointermove", handleMove, true);
  window.addEventListener("pointerup", handleEnd, true);
  window.addEventListener("pointercancel", cleanup, true);
}

function MainMast({
  onHome,
  onShowContents,
}: {
  onHome: () => void;
  onShowContents: () => void;
}) {
  return (
    <div className="portfolio-reading-room-main-mast">
      <PortfolioControlMark
        aria-label="Show Contents"
        kind="sidebarLeft"
        onClick={onShowContents}
      />
      <button
        aria-label="Return to About"
        className="portfolio-reading-room-home"
        onClick={onHome}
        type="button"
      >
        <span>Bradley Berkman</span>
        <PortfolioNodeMark family="identity" register="identity" />
      </button>
    </div>
  );
}

function DesktopViewBar({
  contentsCollapsed,
  slot,
  view,
}: {
  contentsCollapsed: boolean;
  slot: ReadingRoomSlot;
  view: ReadingRoomView;
}) {
  const { isDragging, ref } = useDraggable({
    data: { slot },
    id: `reading-room-drag-${slot}`,
  });

  return (
    <div
      className="portfolio-reading-room-view-bar"
      data-dragging={isDragging ? "true" : "false"}
      data-mast={slot === "main" && contentsCollapsed ? "true" : "false"}
      data-testid={`reading-room-bar-${slot}`}
      ref={ref}
    >
      <span className="portfolio-reading-room-view-mark">
        {view === "reader" ? (
          <PortfolioNodeMark family="identity" register="identity" />
        ) : (
          <PortfolioControlGlyph kind={viewMark(view)} />
        )}
      </span>
      <span className="portfolio-reading-room-view-label">{viewLabel(view)}</span>
    </div>
  );
}

function DesktopSlot({
  activeDragView,
  bodyRef,
  children,
  collapsed,
  ...barProps
}: {
  avatarHidden: boolean;
  onToggleAvatar?: () => void;
  activeDragView: ReadingRoomView | null;
  /** The body only ever holds one view host, and the shell reparents hosts
   *  between bodies; a React sibling inside the body would break that. */
  bodyRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  collapsed: boolean;
  guideHasThread: boolean;
  lowerCollapsed: boolean;
  onGuideReset: () => void;
  onHome: () => void;
  onShowContents: () => void;
  onToggleLower: () => void;
} & Parameters<typeof DesktopViewBar>[0]) {
  const { isDropTarget, ref } = useDroppable({
    data: { slot: barProps.slot },
    id: `reading-room-slot-${barProps.slot}`,
  });

  return (
    <section
      className="portfolio-reading-room-pane"
      data-collapsed={collapsed ? "true" : "false"}
      data-reading-room-slot={barProps.slot}
      data-view={barProps.view}
      ref={ref}
      style={collapsed && barProps.slot === "bottom" ? { height: "40px" } : undefined}
    >
      <DesktopViewBar {...barProps} />
      {barProps.slot === "main" && barProps.contentsCollapsed ? (
        <MainMast
          onHome={barProps.onHome}
          onShowContents={barProps.onShowContents}
        />
      ) : null}
      {(barProps.view === "guide" && (barProps.guideHasThread || barProps.onToggleAvatar)) || barProps.slot === "bottom" ? (
        <span className="portfolio-reading-room-view-controls">
          {barProps.view === "guide" && barProps.guideHasThread ? (
            <PortfolioControlMark
              aria-label="Start a new Guide conversation"
              kind="newChat"
              onClick={barProps.onGuideReset}
            />
          ) : null}
          {barProps.view === "guide" && !collapsed && barProps.onToggleAvatar ? (
            <PortfolioControlMark
              aria-label={barProps.avatarHidden ? "Show avatar" : "Hide avatar"}
              aria-pressed={!barProps.avatarHidden}
              kind={barProps.avatarHidden ? "avatarHidden" : "avatarShown"}
              onClick={barProps.onToggleAvatar}
            />
          ) : null}
          {barProps.slot === "bottom" ? (
            <PortfolioControlMark
              aria-label={barProps.lowerCollapsed ? "Show lower view" : "Hide lower view"}
              kind="panelBottom"
              onClick={barProps.onToggleLower}
            />
          ) : null}
        </span>
      ) : null}
      {isDropTarget && activeDragView ? (
        <span aria-hidden="true" className="portfolio-reading-room-drop-target" />
      ) : null}
      <div className="portfolio-reading-room-pane-body" hidden={collapsed} ref={bodyRef}>
        {children}
      </div>
    </section>
  );
}

function MobileMast({ onHome }: { onHome: () => void }) {
  return (
    <div className="portfolio-reading-room-mobile-top" data-height="44">
      <button
        aria-label="Return to About"
        className="portfolio-reading-room-mobile-home"
        onClick={onHome}
        type="button"
      >
        <span>Bradley Berkman</span>
        <PortfolioNodeMark family="identity" register="identity" />
      </button>
    </div>
  );
}

function MobileTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReadingRoomMobileTab;
  onClick: () => void;
}) {
  const label = children[0]!.toUpperCase() + children.slice(1);
  return (
    <button
      aria-label={`${label} tab`}
      aria-pressed={active}
      className="portfolio-control-mark portfolio-reading-room-mobile-tab"
      data-control={children === "contents" ? "mobileSidebar" : children}
      onClick={onClick}
      type="button"
    >
      {children === "reader" ? (
        <PortfolioNodeMark family="identity" register="identity" />
      ) : (
        <PortfolioControlGlyph kind={children === "contents" ? "mobileSidebar" : "map"} />
      )}
      <span className="portfolio-control-label">{label}</span>
    </button>
  );
}

export function PortfolioReadingRoom({
  avatarHidden = false,
  onToggleAvatar,
  gameMode = false,
  activeThreadId,
  guide,
  guideHasThread,
  map,
  mobileTabRequest,
  onEscapeBeforeRoom,
  onGuideReset,
  onGuideVisibilityChange,
  onHome,
  onLayoutChange,
  onSelect,
  onSelectThread,
  reader,
  selectedId,
  selectedSubject,
  storage,
  viewRequest,
}: PortfolioReadingRoomProps) {
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );
  const viewportWidth = useSyncExternalStore(
    subscribeViewportWidth,
    getViewportWidth,
    getViewportWidthServerSnapshot,
  );
  // Opening proportions and drag limits are separate so compact desktops remain resizable.
  const minimums = readingRoomMinimums();
  const initialSizes = readingRoomInitialSizes(viewportWidth);
  const layoutStorage = useMemo(
    () => storage ?? createVisitStorage(),
    [storage],
  );
  const [storedLayout, setLayout] = useState<ReadingRoomLayoutState>(DEFAULT_READING_ROOM_LAYOUT);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [storedMobileTab, setMobileTab] = useState<ReadingRoomMobileTab>("reader");
  const mobileTab = gameMode ? "map" : storedMobileTab;
  const layout: ReadingRoomLayoutState = gameMode
    ? { ...storedLayout, slots: {main: "map", top: "reader", bottom: "guide"}, hidden: [] }
    : storedLayout;
  const [contentsCollapsed, setContentsCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [activeDragView, setActiveDragView] = useState<ReadingRoomView | null>(null);
  const contentsPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();
  const bottomPanelRef = usePanelRef();
  const outerGroupRef = useGroupRef();
  const primaryGroupRef = useGroupRef();
  const rightGroupRef = useGroupRef();
  const [viewHosts] = useState(() => ({
    guide: createRef<HTMLDivElement>(),
    map: createRef<HTMLDivElement>(),
    reader: createRef<HTMLDivElement>(),
  }));
  const [slotBodies] = useState(() => ({
    bottom: createRef<HTMLDivElement>(),
    main: createRef<HTMLDivElement>(),
    top: createRef<HTMLDivElement>(),
  }));

  // The server guesses a desktop width. Resolve that guess once after hydration;
  // subsequent user resizing owns the layout for the rest of this visit.
  const initialCompositionApplied = useRef(false);
  useLayoutEffect(() => {
    if (!isDesktop || storage || initialCompositionApplied.current) return;
    let innerFrame = 0;
    const frame = requestAnimationFrame(() => {
      const sizes = readingRoomInitialSizes(window.innerWidth);
      const width = window.innerWidth - 1;
      outerGroupRef.current?.setLayout({
        contents: sizes.contents / width * 100,
        workspace: (1 - sizes.contents / width) * 100,
      });
      // The nested group needs its final width before converting its constraints.
      innerFrame = requestAnimationFrame(() => {
        const total = sizes.main + sizes.right;
        primaryGroupRef.current?.setLayout({main: sizes.main / total * 100, right: sizes.right / total * 100});
        initialCompositionApplied.current = true;
      });
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(innerFrame); };
  }, [isDesktop, outerGroupRef, primaryGroupRef, storage]);

  const outerPersistence = useDefaultLayout({
    id: "reading-room-outer",
    panelIds: ["contents", "workspace"],
    storage: persistenceReady ? layoutStorage : fallbackStorage,
  });
  const primaryPersistence = useDefaultLayout({
    id: "reading-room-primary",
    panelIds: ["main", "right"],
    storage: persistenceReady ? layoutStorage : fallbackStorage,
  });
  const rightPersistence = useDefaultLayout({
    id: "reading-room-right",
    panelIds: ["top", "bottom"],
    storage: persistenceReady ? layoutStorage : fallbackStorage,
  });

  /* eslint-disable react-hooks/set-state-in-effect -- persisted browser layout
     must reconcile only after the server-safe first client render. */
  useEffect(() => {
    setLayout(parseReadingRoomLayout(layoutStorage.getItem(SLOT_STORAGE_KEY)));
    setPersistenceReady(true);
  }, [layoutStorage]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const notifyLayout = useCallback(() => {
    onLayoutChange?.();
  }, [onLayoutChange]);
  const persistAndNotify = useCallback(<A extends unknown[]>(persist: (...args: A) => void) => (...args: A) => {
    if (!gameMode) persist(...args);
    notifyLayout();
  }, [gameMode, notifyLayout]);

  const updateLayout = useCallback((update: (current: ReadingRoomLayoutState) => ReadingRoomLayoutState) => {
    if (gameMode) return;
    setLayout((current) => {
      const next = update(current);
      layoutStorage.setItem(SLOT_STORAGE_KEY, serializeReadingRoomLayout(next));
      return next;
    });
  }, [gameMode, layoutStorage]);

  const setViewHidden = useCallback((view: ReadingRoomView, hidden: boolean) => {
    updateLayout((current) => setReadingRoomViewHidden(current, view, hidden));
  }, [updateLayout]);

  const lowerCollapsed = layout.hidden.includes(layout.slots.bottom);
  const guideVisible = isDesktop
    ? (storedLayout.slots.main === "guide" || (!rightCollapsed && !storedLayout.hidden.includes("guide")))
    : storedMobileTab === "map";

  // The avatar must enter/leave with its pane before resize delivery begins.
  useLayoutEffect(() => {
    onGuideVisibilityChange?.(guideVisible);
  }, [guideVisible, onGuideVisibilityChange]);

  // Put each view's DOM host in the slot the layout assigns it. Hosts are the
  // sole child of every slot body, so React never inserts beside or removes a
  // moved host; it only ever updates the view inside it. Focus is restored
  // because moving an element blurs it.
  useLayoutEffect(() => {
    if (!isDesktop) return;
    const focused = document.activeElement;
    let moved = false;
    for (const slot of READING_ROOM_SLOTS) {
      const body = slotBodies[slot].current;
      const host = viewHosts[layout.slots[slot]].current;
      if (!body || !host || host.parentNode === body) continue;
      body.appendChild(host);
      moved = true;
    }
    if (!moved) return;
    if (focused instanceof HTMLElement && focused !== document.activeElement) focused.focus();
    notifyLayout();
  }, [isDesktop, layout.slots, notifyLayout, slotBodies, viewHosts]);

  /* eslint-disable react-hooks/set-state-in-effect -- mobileTabRequest is an
     imperative navigation request from the controlled Experience owner. */
  useEffect(() => {
    if (!mobileTabRequest || isDesktop) return;
    setMobileTab(mobileTabRequest.tab);
  }, [isDesktop, mobileTabRequest]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.fullscreenElement) return;
      if (onEscapeBeforeRoom?.()) return;
      if (guideHasThread) {
        onGuideReset();
        return;
      }
      onHome();
      if (!isDesktop) setMobileTab("reader");
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [guideHasThread, isDesktop, onEscapeBeforeRoom, onGuideReset, onHome]);

  const closeContents = useCallback(() => {
    setContentsCollapsed(true);
    contentsPanelRef.current?.collapse();
    notifyLayout();
  }, [contentsPanelRef, notifyLayout]);
  const showContents = useCallback(() => {
    setContentsCollapsed(false);
    contentsPanelRef.current?.expand();
    notifyLayout();
  }, [contentsPanelRef, notifyLayout]);
  const collapseRight = useCallback(() => {
    setRightCollapsed(true);
    updateLayout((current) => ({
      ...current,
      hidden: [...new Set([
        ...current.hidden,
        current.slots.top,
        current.slots.bottom,
      ])],
    }));
    rightPanelRef.current?.collapse();
    notifyLayout();
  }, [notifyLayout, rightPanelRef, updateLayout]);
  const expandRight = useCallback(() => {
    setRightCollapsed(false);
    updateLayout((current) => ({
      ...current,
      hidden: current.hidden.filter((view) => (
        view !== current.slots.top && view !== current.slots.bottom
      )),
    }));
    rightPanelRef.current?.expand();
    notifyLayout();
  }, [notifyLayout, rightPanelRef, updateLayout]);
  const toggleRight = rightCollapsed ? expandRight : collapseRight;
  const expandLower = useCallback(() => {
    setViewHidden(layout.slots.bottom, false);
    bottomPanelRef.current?.expand();
    notifyLayout();
  }, [bottomPanelRef, layout.slots.bottom, notifyLayout, setViewHidden]);
  const collapseLower = useCallback(() => {
    setViewHidden(layout.slots.bottom, true);
    bottomPanelRef.current?.collapse();
    notifyLayout();
  }, [bottomPanelRef, layout.slots.bottom, notifyLayout, setViewHidden]);
  const toggleLower = lowerCollapsed ? expandLower : collapseLower;

  const revealView = useCallback((view: ReadingRoomView) => {
    if (!isDesktop) {
      setMobileTab(view === "reader" ? "reader" : "map");
      return;
    }
    const slot = READING_ROOM_SLOTS.find((candidate) => layout.slots[candidate] === view);
    if (!slot || slot === "main") return;
    if (rightCollapsed) expandRight();
    if (slot === "bottom" && (lowerCollapsed || rightCollapsed)) expandLower();
  }, [expandLower, expandRight, isDesktop, layout.slots, lowerCollapsed, rightCollapsed]);
  const revealViewRef = useRef(revealView);
  useEffect(() => {
    revealViewRef.current = revealView;
  });
  // Keyed on the request alone: re-running on layout changes would reopen a
  // view the visitor just closed.
  useEffect(() => {
    if (!viewRequest) return;
    revealViewRef.current(viewRequest.view);
  }, [viewRequest]);

  const selectFromContents = useCallback((node: PortfolioWorldNode) => {
    onSelect(node);
    if (!isDesktop) setMobileTab("reader");
  }, [isDesktop, onSelect]);
  const selectThreadFromContents = useCallback((threadId: string) => {
    onSelectThread(threadId);
    if (!isDesktop) setMobileTab("reader");
  }, [isDesktop, onSelectThread]);
  const homeFromContents = useCallback(() => {
    onHome();
    if (!isDesktop) setMobileTab("reader");
  }, [isDesktop, onHome]);

  const renderMap = useCallback((compact: boolean, nodesInTabOrder: boolean) =>
    cloneElement(map, { compact, nodesInTabOrder }), [map]);
  const mapInMain = layout.slots.main === "map";
  const viewHost = useCallback((view: ReadingRoomView) => (
    <div
      className="portfolio-reading-room-view-host"
      data-reading-room-view={view}
      ref={viewHosts[view]}
    >
      {view === "reader" ? reader : null}
      {view === "guide" ? guide : null}
      {view === "map" ? renderMap(!mapInMain, mapInMain) : null}
    </div>
  ), [guide, mapInMain, reader, renderMap, viewHosts]);

  const barProps = useCallback((slot: ReadingRoomSlot) => ({
    avatarHidden,
    onToggleAvatar,
    contentsCollapsed,
    guideHasThread,
    lowerCollapsed,
    onGuideReset,
    onHome,
    onShowContents: showContents,
    onToggleLower: toggleLower,
    slot,
    view: layout.slots[slot],
  }), [avatarHidden, onToggleAvatar, contentsCollapsed, guideHasThread, layout.slots, lowerCollapsed, onGuideReset, onHome, showContents, toggleLower]);

  const onDragStart = useCallback((event: DragStartEvent) => {
    const sourceSlot = slotFromEntityId(event.operation.source?.id);
    setActiveDragView(sourceSlot ? layout.slots[sourceSlot] : null);
  }, [layout.slots]);
  const onDragEnd = useCallback((event: DragEndEvent) => {
    const sourceSlot = slotFromEntityId(event.operation.source?.id);
    const targetSlot = slotFromEntityId(event.operation.target?.id);
    setActiveDragView(null);
    if (!sourceSlot || !targetSlot || sourceSlot === targetSlot) return;
    updateLayout((current) => swapReadingRoomSlots(current, sourceSlot, targetSlot));
  }, [updateLayout]);

  if (!isDesktop) {
    return (
      <section aria-label="Portfolio reading room" className="portfolio-reading-room portfolio-reading-room-mobile" data-breakpoint="below-1020" data-game-mode={gameMode}>
        <MobileMast onHome={homeFromContents} />
        <div className="portfolio-reading-room-mobile-page">
          <div
            className="portfolio-reading-room-mobile-view"
            data-mobile-view="contents"
            hidden={mobileTab !== "contents"}
          >
            <PortfolioContents
              activeThreadId={activeThreadId}
              onHome={homeFromContents}
              onNavigate={() => setMobileTab("reader")}
              onSelect={selectFromContents}
              onSelectThread={selectThreadFromContents}
              selectedId={selectedId}
            />
          </div>
          <div
            className="portfolio-reading-room-mobile-view"
            data-mobile-view="reader"
            hidden={mobileTab !== "reader"}
          >
            {reader}
          </div>
          <div
            className="portfolio-reading-room-mobile-view"
            data-mobile-view="map"
            hidden={mobileTab !== "map"}
          >
            <div className="portfolio-reading-room-mobile-map-page">
              <section className="portfolio-reading-room-mobile-map" data-size="52">
                <div className="portfolio-reading-room-map-canvas">
                  {renderMap(!gameMode, gameMode)}
                </div>
                <div aria-hidden="true" className="portfolio-reading-room-mobile-avatar" />
                <div className="portfolio-reading-room-map-controls">
                {selectedSubject && selectedSubject.id !== "bradley" ? (
                  <button
                    aria-label={`Read ${selectedSubject.label}`}
                    className="portfolio-reading-room-read-chip"
                    onClick={() => setMobileTab("reader")}
                    type="button"
                  >
                    <PortfolioNodeMark
                      family={selectedSubject.family}
                      register={selectedSubject.register}
                    />
                    <span className="portfolio-reading-room-read-label">
                      {selectedLabel(selectedSubject)}
                    </span>
                  </button>
                ) : null}
                {onToggleAvatar ? (
                  <PortfolioControlMark
                    aria-label={avatarHidden ? "Show avatar" : "Hide avatar"}
                    aria-pressed={!avatarHidden}
                    className="portfolio-reading-room-avatar-toggle"
                    kind={avatarHidden ? "avatarHidden" : "avatarShown"}
                    onClick={onToggleAvatar}
                  />
                ) : null}
                </div>
              </section>
              <section
                className="portfolio-reading-room-mobile-guide"
                data-has-thread={guideHasThread ? "true" : "false"}
                data-size="48"
              >
                {guide}
                {guideHasThread ? (
                  <PortfolioControlMark
                    aria-label="Start a new Guide conversation"
                    className="portfolio-reading-room-mobile-new-chat"
                    kind="newChat"
                    onClick={onGuideReset}
                  />
                ) : null}
              </section>
            </div>
          </div>
        </div>
        <nav aria-label="Reading room views" className="portfolio-reading-room-mobile-tabs" data-height="56">
          {(["contents", "reader", "map"] as const).map((tab) => (
            <MobileTab active={mobileTab === tab} key={tab} onClick={() => setMobileTab(tab)}>
              {tab}
            </MobileTab>
          ))}
        </nav>
      </section>
    );
  }

  return (
    <DragDropProvider
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      plugins={READING_ROOM_DND_PLUGINS}
    >
      <section
        aria-label="Portfolio reading room"
        className="portfolio-reading-room portfolio-reading-room-desktop"
        data-breakpoint="1020-and-up"
        data-game-mode={gameMode}
        data-right-collapsed={rightCollapsed ? "true" : "false"}
      >
        <span className="portfolio-reading-room-global-controls">
          <PortfolioControlMark
            aria-label={rightCollapsed ? "Show side panes" : "Hide side panes"}
            kind="sidebarRight"
            onClick={toggleRight}
          />
        </span>
        <Group
          defaultLayout={outerPersistence.defaultLayout ?? {
            contents: initialSizes.contents / (viewportWidth - 1) * 100,
            workspace: (1 - initialSizes.contents / (viewportWidth - 1)) * 100,
          }}
          id="reading-room-outer"
          groupRef={outerGroupRef}
          onLayoutChanged={persistAndNotify(outerPersistence.onLayoutChanged)}
          orientation="horizontal"
        >
          <Panel
            collapsedSize={0}
            collapsible
            defaultSize={initialSizes.contents}
            groupResizeBehavior="preserve-pixel-size"
            id="contents"
            minSize={minimums.contents}
            onResize={(size: PanelSize) => setContentsCollapsed(size.inPixels === 0)}
            panelRef={contentsPanelRef}
          >
            <PortfolioContents
              activeThreadId={activeThreadId}
              onClose={closeContents}
              onHome={homeFromContents}
              onSelect={selectFromContents}
              onSelectThread={selectThreadFromContents}
              selectedId={selectedId}
            />
          </Panel>
          <Separator
            aria-label="Resize Contents"
            className="portfolio-reading-room-separator"
            data-collapse-threshold="48"
            onPointerDown={(event) => watchCollapseThreshold(
              event,
              "reading-room-outer",
              "left",
              minimums.contents,
              closeContents,
            )}
          />
          <Panel id="workspace" minSize={minimums.workspace}>
            <Group
              defaultLayout={primaryPersistence.defaultLayout ?? {
                main: initialSizes.main / (initialSizes.main + initialSizes.right) * 100,
                right: initialSizes.right / (initialSizes.main + initialSizes.right) * 100,
              }}
              id="reading-room-primary"
              groupRef={primaryGroupRef}
              onLayoutChanged={persistAndNotify(primaryPersistence.onLayoutChanged)}
              orientation="horizontal"
            >
              <Panel defaultSize={initialSizes.main} id="main" minSize={minimums.main}>
                <DesktopSlot
                  activeDragView={activeDragView}
                  bodyRef={slotBodies.main}
                  collapsed={false}
                  {...barProps("main")}
                >
                  {viewHost(HOME_SLOTS.main)}
                </DesktopSlot>
              </Panel>
              <Separator
                aria-label="Resize side panes"
                className="portfolio-reading-room-separator"
                data-collapse-threshold="48"
                onPointerDown={(event) => watchCollapseThreshold(
                  event,
                  "reading-room-primary",
                  "right",
                  minimums.right,
                  collapseRight,
                )}
              />
              <Panel
                collapsedSize={0}
                collapsible
                data-collapsed={rightCollapsed ? "true" : "false"}
                defaultSize={initialSizes.right}
                id="right"
                minSize={minimums.right}
                onResize={(size: PanelSize) => setRightCollapsed(size.inPixels === 0)}
                panelRef={rightPanelRef}
              >
                <Group
                  defaultLayout={rightPersistence.defaultLayout}
                  id="reading-room-right"
                  groupRef={rightGroupRef}
                  onLayoutChanged={persistAndNotify(rightPersistence.onLayoutChanged)}
                  orientation="vertical"
                >
                  <Panel defaultSize="40%" id="top" minSize={SIDE_SLOT_MIN_HEIGHT}>
                    <DesktopSlot
                      activeDragView={activeDragView}
                      bodyRef={slotBodies.top}
                      collapsed={layout.hidden.includes(layout.slots.top)}
                      {...barProps("top")}
                    >
                      {viewHost(HOME_SLOTS.top)}
                    </DesktopSlot>
                  </Panel>
                  <Separator aria-label="Resize stacked side panes" className="portfolio-reading-room-separator" />
                  <Panel
                    collapsedSize={40}
                    collapsible
                    defaultSize="60%"
                    id="bottom"
                    minSize={SIDE_SLOT_MIN_HEIGHT}
                    onResize={(size: PanelSize) => {
                      const collapsed = size.inPixels <= 40;
                      if (collapsed !== layout.hidden.includes(layout.slots.bottom)) {
                        setViewHidden(layout.slots.bottom, collapsed);
                      }
                    }}
                    panelRef={bottomPanelRef}
                  >
                    <DesktopSlot
                      activeDragView={activeDragView}
                      bodyRef={slotBodies.bottom}
                      collapsed={lowerCollapsed}
                      {...barProps("bottom")}
                    >
                      {viewHost(HOME_SLOTS.bottom)}
                    </DesktopSlot>
                  </Panel>
                </Group>
              </Panel>
            </Group>
          </Panel>
        </Group>
      </section>
    </DragDropProvider>
  );
}
