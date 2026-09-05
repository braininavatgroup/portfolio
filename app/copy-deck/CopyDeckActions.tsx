"use client";

import { useState } from "react";

const OBSIDIAN_NEW_NOTE = "obsidian://new";
const GOOGLE_DOCS_NEW = "https://docs.new";

export function CopyDeckActions({
  fileName,
  markdown,
}: {
  fileName: string;
  markdown: string;
}) {
  const [status, setStatus] = useState<string | null>(null);

  async function copyDeck(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(markdown);
      return true;
    } catch {
      setStatus("The browser refused the clipboard. Download the file instead.");
      return false;
    }
  }

  // Open the tab first: a window opened after an await is a popup to most
  // browsers. Google Docs turns pasted Markdown into headings and code spans
  // when Tools > Preferences > "Enable Markdown" is on.
  async function newGoogleDoc() {
    window.open(GOOGLE_DOCS_NEW, "_blank", "noopener");
    if (await copyDeck()) {
      setStatus("Deck copied. Paste it into the new document.");
    }
  }

  // Obsidian's URI reads the clipboard when asked, which keeps the whole deck
  // out of the URL. The note lands in the last-opened vault.
  async function newObsidianNote() {
    if (!(await copyDeck())) return;
    const name = fileName.replace(/\.md$/, "");
    window.location.href = `${OBSIDIAN_NEW_NOTE}?name=${encodeURIComponent(name)}&clipboard`;
    setStatus("Deck copied. Obsidian is opening it as a new note.");
  }

  async function copyOnly() {
    if (await copyDeck()) setStatus("Deck copied.");
  }

  return (
    <div className="copy-deck-actions">
      <button onClick={() => void newGoogleDoc()} type="button">
        New Google Doc
      </button>
      <button onClick={() => void newObsidianNote()} type="button">
        New Obsidian note
      </button>
      <a download={fileName} href="/copy-deck.md">
        Download {fileName}
      </a>
      <button onClick={() => void copyOnly()} type="button">
        Copy Markdown
      </button>
      <p aria-live="polite" className="copy-deck-status">
        {status}
      </p>
    </div>
  );
}
