// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateEditorStore,
  editorLiveText,
  markEditorValueSaved,
  setEditorOverride,
} from "../../lib/editor/editor-store";
import { initEditorSession } from "../../lib/editor/session-client";
import { EditableText } from "./EditableText";

const fetchMock = vi.fn();

async function activateWithSession() {
  activateEditorStore();
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      token: "test-token",
      revision: 1,
      branch: "writing-session",
      writable: true,
    }),
  });
  await initEditorSession();
}

// The interactive editable loads lazily behind Suspense; wait until the
// rendered element carries the editing attributes.
async function findEditable(path: string): Promise<HTMLElement> {
  return waitFor(() => {
    const element = document.querySelector<HTMLElement>(
      `[data-editable-path="${path}"]`,
    );
    if (!element) throw new Error(`no active editable for ${path}`);
    return element;
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetchMock.mockReset();
});

describe("EditableText", () => {
  it("becomes a contenteditable element with the stable path once writing mode activates", async () => {
    await activateWithSession();
    render(
      <EditableText as="h2" path="interface.reader.contactTitle" value="Contact" />,
    );
    const editable = await findEditable("interface.reader.contactTitle");
    expect(editable.tagName).toBe("H2");
    expect(editable.textContent).toBe("Contact");
    expect(editable.getAttribute("contenteditable")).toBe("plaintext-only");
  });

  it("debounces saves at 900ms and saves immediately on blur", async () => {
    await activateWithSession();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ revision: 2, save: "saved", commit: "pending" }),
    });
    render(<EditableText path="records.bradley.kind" value="About" />);
    const editable = await findEditable("records.bradley.kind");

    vi.useFakeTimers();
    editable.textContent = "About Bradley";
    fireEvent.input(editable);
    expect(editorLiveText("records.bradley.kind", "About")).toBe("About Bradley");
    expect(fetchMock).toHaveBeenCalledTimes(1); // session only

    await vi.advanceTimersByTimeAsync(899);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, saveInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(saveInit.body)).toMatchObject({
      path: "records.bradley.kind",
      value: "About Bradley",
      revision: 1,
    });

    editable.textContent = "About Bradley again";
    fireEvent.input(editable);
    fireEvent.blur(editable);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("sends no save when a field is entered and left unchanged", async () => {
    await activateWithSession();
    render(<EditableText path="records.pitching.kind" value="Music promotions systems" />);
    const editable = await findEditable("records.pitching.kind");
    vi.useFakeTimers();
    fireEvent.focus(editable);
    fireEvent.blur(editable);
    // Type a change and undo it before the debounce fires: still no save.
    editable.textContent = "Music promotions systemsX";
    fireEvent.input(editable);
    editable.textContent = "Music promotions systems";
    fireEvent.input(editable);
    await vi.advanceTimersByTimeAsync(2000);
    fireEvent.blur(editable);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the session fetch only
  });

  it("restores the last saved value on Escape", async () => {
    await activateWithSession();
    render(<EditableText path="records.bradley.summary" value="Base summary" />);
    const editable = await findEditable("records.bradley.summary");
    act(() => markEditorValueSaved("records.bradley.summary", "Saved summary"));
    editable.textContent = "Draft summary";
    fireEvent.input(editable);
    fireEvent.keyDown(editable, { key: "Escape" });
    expect(editable.textContent).toBe("Saved summary");
    expect(editorLiveText("records.bradley.summary", "Base summary")).toBe(
      "Saved summary",
    );
  });

  it("pastes plain text only, stripping markup and line breaks", async () => {
    await activateWithSession();
    render(<EditableText path="records.dubs.kind" value="In Production" />);
    const editable = await findEditable("records.dubs.kind");
    editable.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    selection?.addRange(range);
    fireEvent.paste(editable, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? " pasted\nline" : "<b>rich</b>",
      },
    });
    expect(editable.querySelector("b")).toBeNull();
    expect(editorLiveText("records.dubs.kind", "In Production")).toBe(
      "In Production pasted line",
    );
  });

  it("edits text inside a button without activating it", async () => {
    await activateWithSession();
    const onActivate = vi.fn();
    render(
      <button onClick={onActivate} type="button">
        <EditableText path="records.bradley.label" value="Bradley Berkman" />
      </button>,
    );
    const editable = await findEditable("records.bradley.label");
    fireEvent.click(editable);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("synchronizes every visible instance of the same path before the save completes", async () => {
    await activateWithSession();
    render(
      <>
        <EditableText as="h1" path="records.writ.label" value="Writ" />
        <EditableText as="small" path="records.writ.label" value="Writ" />
      </>,
    );
    await findEditable("records.writ.label");
    act(() => setEditorOverride("records.writ.label", "Writ Renamed"));
    await waitFor(() => {
      const instances = document.querySelectorAll(
        '[data-editable-path="records.writ.label"]',
      );
      expect(instances).toHaveLength(2);
      for (const instance of instances) {
        expect(instance.textContent).toBe("Writ Renamed");
      }
    });
  });

  it("renders the plain semantic element outside writing mode", async () => {
    // A fresh module registry gives an inactive store, matching normal
    // read-only browsing.
    vi.resetModules();
    const { EditableText: PassiveEditableText } = await import("./EditableText");
    render(
      <PassiveEditableText as="p" path="records.yoohoo.summary" value="Plain" />,
    );
    const element = screen.getByText("Plain");
    expect(element.tagName).toBe("P");
    expect(element.getAttribute("contenteditable")).toBeNull();
    expect(element.getAttribute("data-editable-path")).toBeNull();
  });
});
