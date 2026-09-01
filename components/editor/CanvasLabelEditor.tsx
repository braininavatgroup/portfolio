"use client";

// Anchored single-line input for canvas-drawn map labels, which cannot host a
// browser caret. It reuses the map label's typography, updates the canvas
// draft live through the editor store, saves on Enter or blur, restores on
// Escape, and disappears afterwards. Development-only.

import { useEffect, useRef, useState } from "react";
import {
  editorSavedValue,
  setEditorOverride,
} from "../../lib/editor/editor-store";
import { cancelScheduledSave, saveNow } from "../../lib/editor/session-client";

export type CanvasLabelAnchor = {
  nodeId: string;
  path: string;
  initial: string;
  base: string;
  rect: { left: number; top: number; width: number; height: number };
  align: "center" | "left" | "right";
  compact: boolean;
};

export default function CanvasLabelEditor({
  anchor,
  onClose,
}: {
  anchor: CanvasLabelAnchor;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(anchor.initial);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const close = () => onClose();

  const save = () => {
    const value = draft.replace(/[\r\n]+/g, " ");
    setEditorOverride(anchor.path, value);
    // An untouched label is a no-op: close without saving or committing.
    if (value === (editorSavedValue(anchor.path) ?? anchor.base)) {
      cancelScheduledSave(anchor.path);
      close();
      return;
    }
    saveNow(anchor.path, value);
    close();
  };

  const restore = () => {
    cancelScheduledSave(anchor.path);
    const restored = editorSavedValue(anchor.path) ?? anchor.base;
    setEditorOverride(anchor.path, restored);
    close();
  };

  const font = anchor.compact
    ? '400 11px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif'
    : '400 12.5px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif';
  const width = Math.max(anchor.rect.width + 48, 180);
  const left =
    anchor.align === "center"
      ? anchor.rect.left + anchor.rect.width / 2 - width / 2
      : anchor.align === "right"
        ? anchor.rect.left + anchor.rect.width - width
        : anchor.rect.left;

  return (
    <input
      aria-label="Edit map label"
      data-editable-path={anchor.path}
      onBlur={save}
      onChange={(event) => {
        setDraft(event.target.value);
        setEditorOverride(anchor.path, event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          save();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          restore();
        }
      }}
      ref={inputRef}
      style={{
        background: "transparent",
        border: "none",
        color: "var(--ink)",
        font,
        left,
        outline: "1px solid var(--ink)",
        outlineOffset: 2,
        padding: 0,
        position: "absolute",
        textAlign: anchor.align,
        top: anchor.rect.top - 2,
        width,
        zIndex: 12,
      }}
      type="text"
      value={draft}
    />
  );
}
