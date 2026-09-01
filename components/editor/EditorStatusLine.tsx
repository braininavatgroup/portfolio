"use client";

// The writing-mode status line rendered inside the dossier footer. Reports
// Editing / Saving / Saved / Committed <hash> / a specific failure. It does
// not animate and introduces no new color. Renders nothing outside an active
// writing session.

import { useSyncExternalStore } from "react";
import {
  editorStatus,
  editorStoreVersion,
  isEditorStoreActive,
  subscribeEditorStore,
  type EditorStatus,
} from "../../lib/editor/editor-store";

function statusText(status: EditorStatus): string {
  switch (status.state) {
    case "editing":
      return "Editing";
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "committed":
      return `Committed ${status.commitHash ?? ""}`.trim();
    case "conflict":
      return status.detail ?? "Edit conflict";
    case "error":
      return status.detail ?? "Save failed";
    default:
      return "Writing mode";
  }
}

export function EditorStatusLine() {
  useSyncExternalStore(subscribeEditorStore, editorStoreVersion, () => 0);
  if (!isEditorStoreActive()) return null;
  const status = editorStatus();
  return (
    <span data-editor-status={status.state} role="status">
      {statusText(status)}
    </span>
  );
}
