"use client";

// Development-only activation for the writing mode. Renders nothing; when the
// URL carries ?edit=1 it activates the editor store, opens a session with the
// local writing endpoint, and injects the hover/focus outline styles for
// editable elements using the existing semantic ink token.

import { useEffect } from "react";
import { activateEditorStore } from "../../lib/editor/editor-store";
import { initEditorSession } from "../../lib/editor/session-client";

const EDITOR_STYLES = `
[data-editable-path] { cursor: text; }
[data-editable-path]:hover {
  outline: 1px solid color-mix(in srgb, var(--ink) 40%, transparent);
  outline-offset: 2px;
}
[data-editable-path]:focus,
[data-editable-path]:focus-visible {
  outline: 1px solid var(--ink);
  outline-offset: 2px;
}
`;

export default function DevEditorGate() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") !== "1") return;
    activateEditorStore();
    void initEditorSession();
    const style = document.createElement("style");
    style.dataset.portfolioEditor = "true";
    style.textContent = EDITOR_STYLES;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return null;
}
