// Development-only client for the local writing endpoint. Loaded dynamically
// by the editor provider after `?edit=1` is detected, so none of these
// endpoint literals reach a production bundle.

import { normalizeContentValue } from "../portfolio-content-schema";
import {
  editorStatus,
  markEditorValueSaved,
  setEditorStatus,
} from "./editor-store";

const ENDPOINT_BASE = "/__portfolio-editor";
export const SAVE_DEBOUNCE_MS = 900;
const COMMIT_POLL_DELAY_MS = 2600;

type SessionState = {
  token: string;
  revision: number;
  branch: string;
  writable: boolean;
};

let session: SessionState | null = null;
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const queue: Array<{ path: string; value: string }> = [];
let inFlight = false;
let commitPoll: ReturnType<typeof setTimeout> | null = null;

export async function initEditorSession(): Promise<SessionState | null> {
  try {
    const response = await fetch(`${ENDPOINT_BASE}/session`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      setEditorStatus({
        state: "error",
        detail: `Writing endpoint unavailable (${response.status})`,
      });
      return null;
    }
    session = (await response.json()) as SessionState;
    if (session && !session.writable) {
      setEditorStatus({
        state: "error",
        detail: `Writes disabled on branch ${session.branch || "(detached)"}`,
      });
    }
    return session;
  } catch {
    setEditorStatus({
      state: "error",
      detail: "Writing endpoint unreachable",
    });
    return null;
  }
}

export function markEditing() {
  setEditorStatus({ state: "editing" });
}

// Leaving a field without a real change returns the status line to idle
// without disturbing a Saved/Committed report from an earlier edit.
export function clearEditingStatus() {
  if (editorStatus().state === "editing") {
    setEditorStatus({ state: "idle" });
  }
}

export function scheduleSave(path: string, value: string) {
  const existing = pendingTimers.get(path);
  if (existing) clearTimeout(existing);
  pendingTimers.set(
    path,
    setTimeout(() => {
      pendingTimers.delete(path);
      enqueueSave(path, value);
    }, SAVE_DEBOUNCE_MS),
  );
  setEditorStatus({ state: "editing" });
}

export function cancelScheduledSave(path: string) {
  const existing = pendingTimers.get(path);
  if (existing) {
    clearTimeout(existing);
    pendingTimers.delete(path);
  }
}

export function saveNow(path: string, value: string) {
  cancelScheduledSave(path);
  enqueueSave(path, value);
}

function enqueueSave(path: string, value: string) {
  const existing = queue.find((entry) => entry.path === path);
  if (existing) existing.value = value;
  else queue.push({ path, value });
  void flushQueue();
}

async function flushQueue() {
  if (inFlight || !session) return;
  const next = queue.shift();
  if (!next) return;
  inFlight = true;
  setEditorStatus({ state: "saving" });
  try {
    const value = normalizeContentValue(next.path, next.value);
    const response = await fetch(`${ENDPOINT_BASE}/save`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-portfolio-editor-token": session.token,
      },
      body: JSON.stringify({
        path: next.path,
        value,
        revision: session.revision,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      revision?: number;
      code?: string;
      message?: string;
    } | null;
    if (response.ok && body && typeof body.revision === "number") {
      session.revision = body.revision;
      markEditorValueSaved(next.path, value);
      setEditorStatus({ state: "saved" });
      scheduleCommitPoll();
    } else if (response.status === 409 && body?.code === "stale-revision") {
      // Never resolve competing prose automatically: the draft stays visible
      // and conflicted until Bradley reloads and retries.
      setEditorStatus({
        state: "conflict",
        detail: "This text changed elsewhere. Reload the page, then retry.",
      });
    } else if (response.status === 409) {
      setEditorStatus({
        state: "error",
        detail: body?.message ?? "The development branch changed.",
      });
    } else {
      setEditorStatus({
        state: "error",
        detail: body?.message ?? `Save failed (${response.status})`,
      });
    }
  } catch {
    // Network failure: leave the draft in place. A retry happens on the next
    // input, blur, or explicit retry — never automatically.
    setEditorStatus({
      state: "error",
      detail: "Save failed: writing endpoint unreachable. Edit again to retry.",
    });
  } finally {
    inFlight = false;
    if (queue.length > 0) void flushQueue();
  }
}

function scheduleCommitPoll() {
  if (commitPoll) clearTimeout(commitPoll);
  commitPoll = setTimeout(async () => {
    commitPoll = null;
    if (!session) return;
    try {
      const response = await fetch(`${ENDPOINT_BASE}/status`, {
        headers: { "x-portfolio-editor-token": session.token },
      });
      if (!response.ok) return;
      const body = (await response.json()) as {
        pending?: boolean;
        lastCommit?: { hash?: string; error?: string } | null;
      } | null;
      if (body?.lastCommit?.hash) {
        setEditorStatus({ state: "committed", commitHash: body.lastCommit.hash });
      } else if (body?.lastCommit?.error) {
        // The file save is durable; only the Git commit failed.
        setEditorStatus({
          state: "error",
          detail: `Saved, but Git commit failed: ${body.lastCommit.error}`,
        });
      } else if (body?.pending) {
        scheduleCommitPoll();
      }
    } catch {
      // Status polling is cosmetic; the save already succeeded.
    }
  }, COMMIT_POLL_DELAY_MS);
}

