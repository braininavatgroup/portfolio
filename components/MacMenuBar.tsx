"use client";

import { useLayoutEffect, useRef, useState } from "react";

import {
  layoutMacMenuBar,
  WRIT_MENU_BAR,
  type MacMenuBarItem,
  type MacMenuBarSpec,
} from "../lib/mac-menu-bar";

// Width assumed before the column has been measured, so server output and
// the first client paint agree on a plausible bar instead of an empty one.
const UNMEASURED_WIDTH = 560;

function MenuBarIcon({ item }: { item: MacMenuBarItem }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      data-color={item.color ? "true" : undefined}
      height={item.height}
      src={item.src}
      width={item.width}
    />
  );
}

/**
 * A live macOS menu bar that fills its container, keeps the centre icon on
 * the container's midline, and re-spaces or sheds items as the width changes.
 */
export function MacMenuBar({ spec = WRIT_MENU_BAR }: { spec?: MacMenuBarSpec }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(UNMEASURED_WIDTH);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (typeof next === "number") setWidth(next);
    });
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const layout = layoutMacMenuBar(spec, width);
  const style = {
    "--mac-menu-bar-gap-left": `${layout.leftGap}px`,
    "--mac-menu-bar-gap-right": `${layout.rightGap}px`,
  } as React.CSSProperties;

  return (
    <div className="mac-menu-bar" data-testid="mac-menu-bar" ref={ref} style={style}>
      <div className="mac-menu-bar-side" data-side="left">
        {[...layout.left].reverse().map((item) => (
          <MenuBarIcon item={item} key={item.id} />
        ))}
      </div>
      <div className="mac-menu-bar-center" data-active="true">
        <MenuBarIcon item={spec.center} />
      </div>
      <div className="mac-menu-bar-side" data-side="right">
        {layout.right.map((item) => (
          <MenuBarIcon item={item} key={item.id} />
        ))}
      </div>
    </div>
  );
}

/**
 * A captured macOS panel hanging from a live menu bar. The panel image is
 * expected on a canvas whose horizontal centre is the panel's own centre, so
 * centring the image centres the panel under the active menu bar icon.
 */
export function MacPanelFrame({
  alt,
  src,
  loading,
  width,
  height,
}: {
  alt: string;
  src: string;
  loading?: "lazy" | "eager";
  width?: number;
  height?: number;
}) {
  return (
    <div className="mac-panel-frame">
      <MacMenuBar />
      <img alt={alt} height={height} loading={loading} src={src} width={width} />
    </div>
  );
}
