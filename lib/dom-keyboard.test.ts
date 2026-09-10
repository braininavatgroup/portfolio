// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { isExactShiftShortcut, isInteractiveKeyboardTarget } from "./dom-keyboard";

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
      replacement.appendChild(document.createElement("span"));
      document.body.appendChild(replacement);
      expect(isInteractiveKeyboardTarget(replacement.firstElementChild)).toBe(true);
      replacement.remove();
      return;
    }
    wrapper.appendChild(document.createElement("span"));
    document.body.appendChild(wrapper);
    expect(isInteractiveKeyboardTarget(wrapper.firstElementChild)).toBe(true);
    wrapper.remove();
  });

  it("allows non-interactive document targets", () => {
    expect(isInteractiveKeyboardTarget(document)).toBe(false);
    expect(isInteractiveKeyboardTarget(document.createElement("div"))).toBe(false);
  });

  it("accepts only an exact unconsumed Shift shortcut outside controls", () => {
    expect(isExactShiftShortcut(new KeyboardEvent("keydown", { key: "G", shiftKey: true }), "g")).toBe(true);
    expect(isExactShiftShortcut(new KeyboardEvent("keydown", { key: "A", shiftKey: true }), "a")).toBe(true);
    expect(isExactShiftShortcut(new KeyboardEvent("keydown", { key: "g" }), "g")).toBe(false);
    expect(isExactShiftShortcut(new KeyboardEvent("keydown", { key: "g", shiftKey: true, metaKey: true }), "g")).toBe(false);
  });

});
