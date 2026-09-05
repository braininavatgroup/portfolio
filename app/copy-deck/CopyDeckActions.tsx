"use client";

import { useState } from "react";
import type { CopyDeckPage } from "../../lib/portfolio-copy-deck";

// Chrome and Edge expose the File System Access API; TypeScript's DOM lib
// does not, so the two calls this component needs are declared here.
type WritableFile = { write(data: string): Promise<void>; close(): Promise<void> };
type FileHandle = { createWritable(): Promise<WritableFile> };
type DirectoryHandle = {
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
};
type DirectoryPicker = (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandle>;

function directoryPicker(): DirectoryPicker | null {
  const picker = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  return typeof picker === "function" ? picker : null;
}

async function writePages(root: DirectoryHandle, folderName: string, pages: readonly CopyDeckPage[]) {
  const folder = await root.getDirectoryHandle(folderName, { create: true });
  for (const page of pages) {
    const segments = page.path.split("/");
    const fileName = segments.pop() as string;
    let directory = folder;
    for (const segment of segments) {
      directory = await directory.getDirectoryHandle(segment, { create: true });
    }
    const file = await directory.getFileHandle(fileName, { create: true });
    const writable = await file.createWritable();
    await writable.write(page.content);
    await writable.close();
  }
}

export function CopyDeckActions({
  folderName,
  pages,
}: {
  folderName: string;
  pages: readonly CopyDeckPage[];
}) {
  const [status, setStatus] = useState<string | null>(null);
  const canWriteFolder = typeof window !== "undefined" && directoryPicker() !== null;

  // Pick the vault (or any folder inside it); the notes land in a
  // "Portfolio copy" folder there, overwriting the previous export so
  // Obsidian keeps the same notes between rounds.
  async function saveIntoVault() {
    const picker = directoryPicker();
    if (!picker) return;
    try {
      const root = await picker({ mode: "readwrite" });
      await writePages(root, folderName, pages);
      setStatus(`Saved ${pages.length} notes to ${root.name}/${folderName}.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Could not write there. Download the folder instead.");
    }
  }

  return (
    <div className="copy-deck-actions">
      {canWriteFolder ? (
        <button onClick={() => void saveIntoVault()} type="button">
          Save into Obsidian vault
        </button>
      ) : null}
      <a download={`${folderName}.zip`} href="/copy-deck.zip">
        Download folder (.zip)
      </a>
      <p aria-live="polite" className="copy-deck-status">
        {status}
      </p>
    </div>
  );
}
