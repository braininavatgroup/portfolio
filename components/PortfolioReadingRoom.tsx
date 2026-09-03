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
  type PanelSize,
} from "react-resizable-panels";
import {
  cloneElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  DEFAULT_READING_ROOM_LAYOUT,
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

export type PortfolioReadingRoomProps = {
  activeThreadId: string | null;
  guide: ReactNode;
  guideHasThread: boolean;
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
  storage?: Pick<Storage, "getItem" | "setItem">;
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

function getBrowserStorage() {
  if (typeof window === "undefined") return fallbackStorage;
  try {
    const candidate = window.localStorage;
    return typeof candidate?.getItem === "function" && typeof candidate?.setItem === "function"
      ? candidate
      : fallbackStorage;
  } catch {
    return fallbackStorage;
  }
}

function viewLabel(view: ReadingRoomView) {
  if (view === "guide") return "Guide";
  return view[0]!.toUpperCase() + view.slice(1);
}

function viewMark(view: Exclude<ReadingRoomView, "reader">) {
  return view === "map" ? "map" : "chat";
}

function selectedLabel(node: PortfolioWorldNode) {
  return node.label
    .replace(/^Brain in a Vat /, "")
    .replace(/^Music promo campaign /, "Campaign ");
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
  children,
  collapsed,
  ...barProps
}: {
  activeDragView: ReadingRoomView | null;
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
      {(barProps.view === "guide" && barProps.guideHasThread) || barProps.slot === "bottom" ? (
        <span className="portfolio-reading-room-view-controls">
          {barProps.view === "guide" && barProps.guideHasThread ? (
            <PortfolioControlMark
              aria-label="Start a new Guide conversation"
              kind="newChat"
              onClick={barProps.onGuideReset}
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
      <div className="portfolio-reading-room-pane-body" hidden={collapsed}>
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
}: PortfolioReadingRoomProps) {
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );
  const layoutStorage = useMemo(
    () => storage ?? getBrowserStorage(),
    [storage],
  );
  const [layout, setLayout] = useState<ReadingRoomLayoutState>(DEFAULT_READING_ROOM_LAYOUT);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [mobileTab, setMobileTab] = useState<ReadingRoomMobileTab>("reader");
  const [contentsCollapsed, setContentsCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [activeDragView, setActiveDragView] = useState<ReadingRoomView | null>(null);
  const contentsPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();
  const bottomPanelRef = usePanelRef();

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
    persist(...args);
    notifyLayout();
  }, [notifyLayout]);

  const updateLayout = useCallback((update: (current: ReadingRoomLayoutState) => ReadingRoomLayoutState) => {
    setLayout((current) => {
      const next = update(current);
      layoutStorage.setItem(SLOT_STORAGE_KEY, serializeReadingRoomLayout(next));
      return next;
    });
  }, [layoutStorage]);

  const setViewHidden = useCallback((view: ReadingRoomView, hidden: boolean) => {
    updateLayout((current) => setReadingRoomViewHidden(current, view, hidden));
  }, [updateLayout]);

  const lowerCollapsed = layout.hidden.includes(layout.slots.bottom);
  const guideVisible = isDesktop
    ? !rightCollapsed && !layout.hidden.includes("guide")
    : mobileTab === "map";

  useEffect(() => {
    onGuideVisibilityChange?.(guideVisible);
  }, [guideVisible, onGuideVisibilityChange]);

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
  const toggleRight = useCallback(() => {
    if (rightCollapsed) {
      setRightCollapsed(false);
      updateLayout((current) => ({
        ...current,
        hidden: current.hidden.filter((view) => (
          view !== current.slots.top && view !== current.slots.bottom
        )),
      }));
      rightPanelRef.current?.expand();
      notifyLayout();
      return;
    }
    collapseRight();
  }, [collapseRight, notifyLayout, rightCollapsed, rightPanelRef, updateLayout]);
  const toggleLower = useCallback(() => {
    if (lowerCollapsed) {
      setViewHidden(layout.slots.bottom, false);
      bottomPanelRef.current?.expand();
    } else {
      setViewHidden(layout.slots.bottom, true);
      bottomPanelRef.current?.collapse();
    }
    notifyLayout();
  }, [bottomPanelRef, layout.slots.bottom, lowerCollapsed, notifyLayout, setViewHidden]);

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
  const viewNode = useCallback((view: ReadingRoomView, slot: ReadingRoomSlot) => {
    if (view === "reader") return reader;
    if (view === "guide") return guide;
    return renderMap(slot !== "main", slot === "main");
  }, [guide, reader, renderMap]);

  const barProps = useCallback((slot: ReadingRoomSlot) => ({
    contentsCollapsed,
    guideHasThread,
    lowerCollapsed,
    onGuideReset,
    onHome,
    onShowContents: showContents,
    onToggleLower: toggleLower,
    slot,
    view: layout.slots[slot],
  }), [contentsCollapsed, guideHasThread, layout.slots, lowerCollapsed, onGuideReset, onHome, showContents, toggleLower]);

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
      <section aria-label="Portfolio reading room" className="portfolio-reading-room portfolio-reading-room-mobile" data-breakpoint="below-1020">
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
                {renderMap(true, false)}
                <div aria-hidden="true" className="portfolio-reading-room-mobile-avatar" />
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
                    <span className="portfolio-reading-room-read-action">
                      <span>Read</span>
                      <PortfolioControlGlyph kind="readArrow" />
                    </span>
                  </button>
                ) : null}
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
          defaultLayout={outerPersistence.defaultLayout}
          id="reading-room-outer"
          onLayoutChanged={persistAndNotify(outerPersistence.onLayoutChanged)}
          orientation="horizontal"
        >
          <Panel
            collapsedSize={0}
            collapsible
            defaultSize={320}
            groupResizeBehavior="preserve-pixel-size"
            id="contents"
            minSize={300}
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
              300,
              closeContents,
            )}
          />
          <Panel id="workspace" minSize={1081}>
            <Group
              defaultLayout={primaryPersistence.defaultLayout}
              id="reading-room-primary"
              onLayoutChanged={persistAndNotify(primaryPersistence.onLayoutChanged)}
              orientation="horizontal"
            >
              <Panel defaultSize={`${DEFAULT_READING_ROOM_LAYOUT.split * 100}%`} id="main" minSize={720}>
                <DesktopSlot
                  activeDragView={activeDragView}
                  collapsed={layout.hidden.includes(layout.slots.main)}
                  {...barProps("main")}
                >
                  {viewNode(layout.slots.main, "main")}
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
                  360,
                  collapseRight,
                )}
              />
              <Panel
                collapsedSize={0}
                collapsible
                data-collapsed={rightCollapsed ? "true" : "false"}
                defaultSize={`${(1 - DEFAULT_READING_ROOM_LAYOUT.split) * 100}%`}
                id="right"
                minSize={360}
                onResize={(size: PanelSize) => setRightCollapsed(size.inPixels === 0)}
                panelRef={rightPanelRef}
              >
                <Group
                  defaultLayout={rightPersistence.defaultLayout}
                  id="reading-room-right"
                  onLayoutChanged={persistAndNotify(rightPersistence.onLayoutChanged)}
                  orientation="vertical"
                >
                  <Panel defaultSize="40%" id="top" minSize={SIDE_SLOT_MIN_HEIGHT}>
                    <DesktopSlot
                      activeDragView={activeDragView}
                      collapsed={layout.hidden.includes(layout.slots.top)}
                      {...barProps("top")}
                    >
                      {viewNode(layout.slots.top, "top")}
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
                      collapsed={lowerCollapsed}
                      {...barProps("bottom")}
                    >
                      {viewNode(layout.slots.bottom, "bottom")}
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
