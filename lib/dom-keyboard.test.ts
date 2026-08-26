// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { isExactToyboxShortcut, isInteractiveKeyboardTarget } from "./dom-keyboard";

describe("DOM keyboard ownership", () => {
  it.each([
    "input",
    "textarea",
    "select",
    "button",
    "a",
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="searchbox"]',
    '[role="button"]',
    '[role="link"]',
    "[contenteditable]",
  ])("recognizes %s and its descendants as interactive", (selector) => {
    const wrapper = document.createElement("div");
    if (selector.startsWith("[role")) {
      wrapper.setAttribute("role", selector.match(/"([^"]+)/)?.[1] ?? "textbox");
    } else if (selector === "[contenteditable]") {
      wrapper.setAttribute("contenteditable", "true");
    } else {
      const replacement = document.createElement(selector);
      wrapper.replaceWith(replacement);
      replacement.append(document.createElement("span"));
      document.body.append(replacement);
      expect(isInteractiveKeyboardTarget(replacement.firstElementChild)).toBe(true);
      replacement.remove();
      return;
    }
    wrapper.append(document.createElement("span"));
    document.body.append(wrapper);
    expect(isInteractiveKeyboardTarget(wrapper.firstElementChild)).toBe(true);
    wrapper.remove();
  });

  it("allows non-interactive document targets", () => {
    expect(isInteractiveKeyboardTarget(document)).toBe(false);
    expect(isInteractiveKeyboardTarget(document.createElement("div"))).toBe(false);
  });

  it("accepts only an unconsumed exact Shift+G event outside controls", () => {
    const allowed = new KeyboardEvent("keydown", { key: "G", shiftKey: true });
    expect(isExactToyboxShortcut(allowed)).toBe(true);

    for (const event of [
      new KeyboardEvent("keydown", { key: "g" }),
      new KeyboardEvent("keydown", { key: "g", shiftKey: true, metaKey: true }),
      new KeyboardEvent("keydown", { key: "g", shiftKey: true, ctrlKey: true }),
      new KeyboardEvent("keydown", { key: "g", shiftKey: true, altKey: true }),
      new KeyboardEvent("keydown", { key: "g", shiftKey: true, repeat: true }),
      new KeyboardEvent("keydown", { key: "x", shiftKey: true }),
    ]) {
      expect(isExactToyboxShortcut(event)).toBe(false);
    }

    const prevented = new KeyboardEvent("keydown", { key: "g", shiftKey: true, cancelable: true });
    prevented.preventDefault();
    expect(isExactToyboxShortcut(prevented)).toBe(false);

    const composing = new KeyboardEvent("keydown", { key: "g", shiftKey: true });
    Object.defineProperty(composing, "isComposing", { value: true });
    expect(isExactToyboxShortcut(composing)).toBe(false);
  });

  it("rejects an otherwise valid shortcut dispatched from a control descendant", () => {
    const button = document.createElement("button");
    const child = document.createElement("span");
    button.append(child);
    document.body.append(button);
    let accepted = true;
    child.addEventListener("keydown", (event) => {
      accepted = isExactToyboxShortcut(event);
    });
    child.dispatchEvent(new KeyboardEvent("keydown", { key: "g", shiftKey: true, bubbles: true }));
    expect(accepted).toBe(false);
    button.remove();
  });
});
