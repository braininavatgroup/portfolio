// In-memory state for the local writing mode. This module is intentionally
// tiny and free of endpoint or DOM references so shipping components can
// import it: outside an activated development editor session every read falls
// through to the caller's base value.

export type EditorSaveState =
  | "idle"
  | "editing"
  | "saving"
  | "saved"
  | "committed"
  | "conflict"
  | "error";

export type EditorStatus = {
  state: EditorSaveState;
  detail?: string;
  commitHash?: string;
};

type Listener = () => void;

const overrides = new Map<string, string>();
const savedValues = new Map<string, string>();
const listeners = new Set<Listener>();

let active = false;
let status: EditorStatus = { state: "idle" };
let version = 0;

function notify() {
  version += 1;
  for (const listener of listeners) listener();
}

export function activateEditorStore() {
  active = true;
  notify();
}

export function isEditorStoreActive(): boolean {
  return active;
}

export function subscribeEditorStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function editorStoreVersion(): number {
  return version;
}

// Live text for a stable content path: the in-session override when one
// exists, the caller's base value otherwise. Safe to call from render loops.
export function editorLiveText(path: string, base: string): string {
  if (!active) return base;
  return overrides.get(path) ?? base;
}

export function setEditorOverride(path: string, value: string) {
  overrides.set(path, value);
  notify();
}

// The last value the local server confirmed for a path; Escape restores it.
export function editorSavedValue(path: string): string | undefined {
  return savedValues.get(path);
}

export function markEditorValueSaved(path: string, value: string) {
  savedValues.set(path, value);
  notify();
}

export function editorStatus(): EditorStatus {
  return status;
}

export function setEditorStatus(next: EditorStatus) {
  status = next;
  notify();
}
