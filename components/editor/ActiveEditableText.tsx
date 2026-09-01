"use client";

/* eslint-disable react-hooks/refs -- createElement receives the element ref as a prop; nothing reads ref.current during render. */

// The interactive half of EditableText: contentEditable behavior, plain-text
// normalization, keyboard handling, and draft state. Development-only; the
// production bundle never includes this module.

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ClipboardEvent,
  type MouseEvent,
} from "react";
import {
  editorLiveText,
  editorSavedValue,
  setEditorOverride,
} from "../../lib/editor/editor-store";
import {
  cancelScheduledSave,
  markEditing,
  saveNow,
  scheduleSave,
} from "../../lib/editor/session-client";
import type { ActiveEditableTextProps } from "./EditableText";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readPlainText(element: HTMLElement, multiline: boolean): string {
  const text =
    (multiline ? element.innerText : element.textContent) ??
    element.textContent ??
    "";
  const normalized = text.replace(/\u00A0/g, " ").replace(/\r\n?/g, "\n");
  return multiline
    ? normalized.replace(/\n+$/, "")
    : normalized.replace(/\n+/g, " ");
}

function insertPlainText(text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export default function ActiveEditableText({
  as,
  multiline = false,
  path,
  value,
  ...rest
}: ActiveEditableTextProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  // React never re-renders the children of this element: the initial markup
  // is set once, and every later change flows through the DOM (typing) or the
  // sync effect below (edits made to the same path elsewhere on the page).
  const [initialHtml] = useState(() => ({
    __html: escapeHtml(editorLiveText(path, value)),
  }));

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const sync = () => {
      if (document.activeElement === element) return;
      const live = editorLiveText(path, value);
      if ((element.textContent ?? "") !== live) {
        element.textContent = live;
      }
    };
    sync();
    // Subscribe lazily through a MutationObserver-free interval-less path:
    // the parent EditableText re-renders on store changes, re-running this
    // effect with a fresh closure.
  });

  const commitDraft = (element: HTMLElement) => {
    const draft = readPlainText(element, multiline);
    setEditorOverride(path, draft);
    return draft;
  };

  const handleInput = (event: { currentTarget: EventTarget & HTMLElement }) => {
    markEditing();
    const draft = commitDraft(event.currentTarget);
    scheduleSave(path, draft);
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const draft = commitDraft(event.currentTarget);
    saveNow(path, draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelScheduledSave(path);
      const restored = editorSavedValue(path) ?? value;
      event.currentTarget.textContent = restored;
      setEditorOverride(path, restored);
      return;
    }
    if (event.key === "Enter" && !multiline) {
      event.preventDefault();
      const draft = commitDraft(event.currentTarget);
      saveNow(path, draft);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    // Rich-text markup and pasted HTML are stripped; only plain text lands.
    event.preventDefault();
    let text = event.clipboardData.getData("text/plain");
    if (!multiline) text = text.replace(/[\r\n]+/g, " ");
    insertPlainText(text);
    handleInput({ currentTarget: event.currentTarget });
  };

  // In writing mode the text inside a link or button edits instead of
  // activating the control, so swallow activation at the capture phase.
  const handleClickCapture = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return createElement(as, {
    ...rest,
    contentEditable: "plaintext-only",
    "data-editable-path": path,
    dangerouslySetInnerHTML: initialHtml,
    onBlur: handleBlur,
    onClickCapture: handleClickCapture,
    onInput: handleInput,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    ref: elementRef,
    role: "textbox",
    spellCheck: true,
    suppressContentEditableWarning: true,
    tabIndex: 0,
  });
}
