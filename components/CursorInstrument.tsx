"use client";

import { useEffect, useState, type CSSProperties } from "react";

type CursorState = {
  x: number;
  y: number;
  visible: boolean;
  active: boolean;
  held: boolean;
  first: string;
  second: string;
};

const initialState: CursorState = {
  x: 0,
  y: 0,
  visible: false,
  active: false,
  held: false,
  first: "#201711",
  second: "#dfe8ee",
};

function inverseHexColor(color: string) {
  const normalized = color.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "#ffffff";
  return `#${(0xffffff ^ Number.parseInt(normalized, 16)).toString(16).padStart(6, "0")}`;
}

export function CursorInstrument() {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    const actionSelector = "button, a, input, textarea, select, [role='button'], [role='link'], [data-world-node]";
    const move = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const action = target?.closest(actionSelector);
      const node = target?.closest<HTMLElement>("[data-world-node]");
      const composition = target?.closest<HTMLElement>(".portfolio-composition") ??
        document.querySelector<HTMLElement>(".portfolio-composition");
      const nodeColorVariable = node?.dataset.cursorColor;
      const color = node && nodeColorVariable && composition
        ? getComputedStyle(composition).getPropertyValue(nodeColorVariable).trim()
        : composition
          ? getComputedStyle(composition).getPropertyValue("--ink").trim()
          : getComputedStyle(document.documentElement)
              .getPropertyValue("--foreground")
              .trim() || "#201711";
      setState((current) => ({
        ...current,
        x: event.clientX,
        y: event.clientY,
        visible: true,
        active: Boolean(action),
        first: color,
        second: inverseHexColor(color),
      }));
    };
    const press = () => setState((current) => ({ ...current, held: true, visible: true }));
    const release = () => setState((current) => ({ ...current, held: false }));
    const hide = () => setState((current) => ({ ...current, visible: false, held: false }));
    // Capture phase: a drag library that captures the pointer on `body` and
    // stops propagation of its own pointermove (dnd-kit does) must not freeze
    // the drawn cursor mid-drag. The window sees the event first this way.
    window.addEventListener("pointermove", move, { capture: true });
    window.addEventListener("pointerdown", press, { capture: true });
    window.addEventListener("pointerup", release, { capture: true });
    window.addEventListener("pointercancel", release, { capture: true });
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("pointermove", move, { capture: true });
      window.removeEventListener("pointerdown", press, { capture: true });
      window.removeEventListener("pointerup", release, { capture: true });
      window.removeEventListener("pointercancel", release, { capture: true });
      window.removeEventListener("blur", hide);
    };
  }, []);

  const style = {
    left: `${state.x}px`,
    top: `${state.y}px`,
    "--cursor-a": state.first,
    "--cursor-b": state.second,
  } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      className="cursor-instrument"
      data-action={state.active ? "true" : "false"}
      data-held={state.held ? "true" : "false"}
      data-visible={state.visible ? "true" : "false"}
      id="cursorInstrument"
      style={style}
    >
      <i className="cursor-arm cursor-arm-n" />
      <i className="cursor-arm cursor-arm-e" />
      <i className="cursor-arm cursor-arm-s" />
      <i className="cursor-arm cursor-arm-w" />
      <i className="cursor-pin" />
    </div>
  );
}
