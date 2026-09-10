const INTERACTIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a",
  '[role="button"]',
  '[role="link"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="searchbox"]',
  '[contenteditable]:not([contenteditable="false"])',
].join(",");

export function isInteractiveKeyboardTarget(target: EventTarget | null) {
  return (
    typeof Element !== "undefined" &&
    target instanceof Element &&
    target.closest(INTERACTIVE_SELECTOR) !== null
  );
}

export function isExactShiftShortcut(event: KeyboardEvent, key: string) {
  return (
    !event.defaultPrevented &&
    !event.repeat &&
    !event.isComposing &&
    event.key.toLowerCase() === key.toLowerCase() &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !isInteractiveKeyboardTarget(event.target)
  );
}
