"use client";

// Reviewer notes for Bradley. Mounts only when the worker has set the readable
// `portfolio_reviewer` cookie and the current URL carries the matching named
// marker from a `?r=<code>` link (worker/portfolio-feedback.ts).
// A reviewer writes a note, optionally points at one element on the page or
// selects a run of text, and sends it. A selected quote can carry a suggested
// replacement instead of a comment. The visit's own notes stay in component
// state, shown as numbered pins, so the reviewer can find and take one back;
// nothing is written into the page or into storage, so a later session starts
// clean and no reviewer ever sees another's notes.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  isPlaceholderReviewerCode,
  type FeedbackNote,
  type FeedbackNoteInput,
  type FeedbackQuote,
  type FeedbackTarget,
} from "../worker/portfolio-feedback-store";
import { PortfolioControlMark } from "./PortfolioNodeMark";

export type FeedbackDraft = Omit<FeedbackNoteInput, "reviewer">;

export type PortfolioFeedbackTransport = {
  send(draft: FeedbackDraft): Promise<FeedbackNote>;
  remove(id: string): Promise<void>;
};

const NOTES_PATH = "/_portfolio-feedback/notes";
const REVIEWER_COOKIE = "portfolio_reviewer";
const REVIEWER_PARAM = "reviewer";
const REVIEWER_CODE = /^[a-z0-9][a-z0-9-]{1,31}$/u;
const REGION_CLASS = /^(portfolio|reader|avatar|cursor|scene)-[a-z0-9-]+$/u;
const SELECTOR_DEPTH = 6;
const TEXT_LIMIT = 120;
const QUOTE_LIMIT = 600;
const CONTEXT_LIMIT = 40;

export const portfolioFeedbackTransport: PortfolioFeedbackTransport = {
  async send(draft) {
    const response = await fetch(NOTES_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!response.ok) throw new Error(`Note not sent (${response.status})`);
    const { note } = (await response.json()) as { note: FeedbackNote };
    return note;
  },
  async remove(id) {
    const response = await fetch(`${NOTES_PATH}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`Note not removed (${response.status})`);
  },
};

/** The reviewer code from the worker's cookie, or null. Signature is checked server-side. */
export function readReviewerCookie(cookie: string): string | null {
  for (const pair of cookie.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== REVIEWER_COOKIE) continue;
    const [version, code] = pair.slice(separator + 1).trim().split(".");
    return version === "v1" && REVIEWER_CODE.test(code ?? "") ? code : null;
  }
  return null;
}

function escapeIdentifier(value: string) {
  return value.replace(/[^\w-]/gu, (character) => `\\${character}`);
}

function segmentFor(element: Element) {
  if (element.id) return `#${escapeIdentifier(element.id)}`;
  let segment = element.tagName.toLowerCase();
  for (const name of [...element.classList].filter((name) => REGION_CLASS.test(name)).slice(0, 2)) {
    segment += `.${name}`;
  }
  for (const attribute of ["data-world-node", "data-register", "data-control"]) {
    const value = element.getAttribute(attribute);
    if (value !== null && value.length <= 40) {
      segment += `[${attribute}="${value.replace(/"/gu, '\\"')}"]`;
    }
  }
  const parent = element.parentElement;
  if (parent) {
    const sameTag = [...parent.children].filter((child) => child.tagName === element.tagName);
    if (sameTag.length > 1) segment += `:nth-of-type(${sameTag.indexOf(element) + 1})`;
  }
  return segment;
}

function normalizeText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function roundBox(box: DOMRect) {
  const round = (value: number) => Math.round(value * 10) / 10;
  return { x: round(box.left), y: round(box.top), width: round(box.width), height: round(box.height) };
}

/**
 * Describes one element well enough for an agent to find it: a short
 * selector path, the nearest named region, its visible text, and where it
 * sits. `point` is the click position, kept as a fraction of the box so a
 * note on the canvas still says where on it.
 */
export function describeElement(
  element: Element,
  point?: { x: number; y: number },
): FeedbackTarget {
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body && segments.length < SELECTOR_DEPTH) {
    const segment = segmentFor(current);
    segments.unshift(segment);
    if (segment.startsWith("#")) break;
    current = current.parentElement;
  }
  const target: FeedbackTarget = { selector: segments.join(" > ") };

  let region: Element | null = element;
  while (region && !target.component) {
    const name = [...region.classList].find((name) => REGION_CLASS.test(name));
    if (name) target.component = name;
    region = region.parentElement;
  }

  if (element.tagName !== "CANVAS") {
    const text = normalizeText(element.textContent ?? "");
    if (text) target.text = text.slice(0, TEXT_LIMIT);
  }

  const box = element.getBoundingClientRect();
  target.rect = roundBox(box);
  if (point && box.width > 0 && box.height > 0) {
    target.offset = {
      x: Math.round(((point.x - box.left) / box.width) * 1_000) / 1_000,
      y: Math.round(((point.y - box.top) / box.height) * 1_000) / 1_000,
    };
  }
  return target;
}

function rangeElement(range: Range): Element | null {
  const node = range.commonAncestorContainer;
  return node instanceof Element ? node : node.parentElement;
}

function rangeBox(range: Range, element: Element) {
  const box = typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : null;
  return box && (box.width > 0 || box.height > 0) ? box : element.getBoundingClientRect();
}

/**
 * Describes a text selection as a quote with a little context on each side,
 * anchored to the element that contains it. The prefix and suffix let an
 * agent find the exact run even if the same words appear twice on the page.
 */
export function describeSelection(range: Range): FeedbackTarget | null {
  const element = rangeElement(range);
  const text = normalizeText(range.toString()).slice(0, QUOTE_LIMIT);
  if (!element || !text) return null;

  const target = describeElement(element);
  const before = document.createRange();
  before.setStart(element, 0);
  before.setEnd(range.startContainer, range.startOffset);
  const after = document.createRange();
  after.selectNodeContents(element);
  after.setStart(range.endContainer, range.endOffset);

  const quote: FeedbackQuote = { text };
  const prefix = normalizeText(before.toString()).slice(-CONTEXT_LIMIT);
  const suffix = normalizeText(after.toString()).slice(0, CONTEXT_LIMIT);
  if (prefix) quote.prefix = prefix;
  if (suffix) quote.suffix = suffix;
  target.quote = quote;
  target.text = text.slice(0, TEXT_LIMIT);
  target.rect = roundBox(rangeBox(range, element));
  return target;
}

type Box = { top: number; left: number; width: number; height: number };
type Pin = { id: string; index: number; top: number; left: number };
type Mode = "comment" | "suggest";

const subscribeToNothing = () => () => {};
const readCookieReviewer = () => readReviewerCookie(document.cookie);
const readUrlReviewer = () => {
  const reviewer = new URLSearchParams(window.location.search).get(REVIEWER_PARAM);
  return reviewer && REVIEWER_CODE.test(reviewer) ? reviewer : null;
};
const noReviewerOnServer = () => null;

function currentPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function shorten(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function elementFor(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

/** Where this visit's notes point right now: one pin per note whose element is still on the page. */
function locatePins(notes: FeedbackNote[]): Pin[] {
  const pins: Pin[] = [];
  notes.forEach((note, index) => {
    if (!note.target) return;
    const element = elementFor(note.target.selector);
    if (!element) return;
    const box = element.getBoundingClientRect();
    // A hidden element reports an all-zero box; leave it unpinned.
    if (box.width === 0 && box.height === 0 && box.top === 0 && box.left === 0) return;
    pins.push({ id: note.id, index: index + 1, top: box.top - 9, left: box.right - 9 });
  });
  return pins;
}

function sentSummary(note: FeedbackNote) {
  if (note.suggestion) return `Edit: ${shorten(note.suggestion, 60)}`;
  if (note.note) return note.note;
  return note.target?.quote ? `“${shorten(note.target.quote.text, 60)}”` : "";
}

export function PortfolioFeedback({
  reviewer: reviewerOverride,
  transport = portfolioFeedbackTransport,
}: {
  /** Test and gallery seam. In production the reviewer comes from the cookie. */
  reviewer?: string;
  transport?: PortfolioFeedbackTransport;
}) {
  // The server never knows the cookie or browser URL, so the first client
  // render agrees with it (no reviewer) and the control appears after hydration.
  const cookieReviewer = useSyncExternalStore(
    subscribeToNothing,
    readCookieReviewer,
    noReviewerOnServer,
  );
  const urlReviewer = useSyncExternalStore(
    subscribeToNothing,
    readUrlReviewer,
    noReviewerOnServer,
  );
  const reviewer = reviewerOverride ??
    (cookieReviewer && cookieReviewer === urlReviewer ? cookieReviewer : null);
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<Box | null>(null);
  const [selection, setSelection] = useState<Box | null>(null);
  const [target, setTarget] = useState<FeedbackTarget | null>(null);
  const [mode, setMode] = useState<Mode>("comment");
  const [text, setText] = useState("");
  const [replacement, setReplacement] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ kind: "sent" | "error"; message: string } | null>(null);
  const [sent, setSent] = useState<FeedbackNote[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const rangeRef = useRef<Range | null>(null);
  const textareaId = useId();
  const suggesting = mode === "suggest" && Boolean(target?.quote);
  // A link sent with its placeholder still in it (`?r=[name]`) lands here as
  // "name"; the panel then asks who is writing instead of guessing.
  const needsName = Boolean(reviewer) && isPlaceholderReviewerCode(reviewer!);

  useEffect(() => {
    if (open && !picking) textareaRef.current?.focus();
  }, [open, picking, suggesting]);

  const inWidget = useCallback(
    (node: EventTarget | null) => node instanceof Node && Boolean(rootRef.current?.contains(node)),
    [],
  );

  // Element picking: capture the next click anywhere on the page.
  useEffect(() => {
    if (!picking) return;
    const stop = (event: Event) => {
      if (!inWidget(event.target)) event.stopPropagation();
    };
    const move = (event: PointerEvent) => {
      const element = event.target;
      if (!(element instanceof Element) || inWidget(element)) {
        setHover(null);
        return;
      }
      const box = element.getBoundingClientRect();
      setHover({ top: box.top, left: box.left, width: box.width, height: box.height });
    };
    const pick = (event: MouseEvent) => {
      const element = event.target;
      if (!(element instanceof Element) || inWidget(element)) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(describeElement(element, { x: event.clientX, y: event.clientY }));
      setMode("comment");
      setPicking(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setPicking(false);
      }
    };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerdown", stop, true);
    document.addEventListener("pointerup", stop, true);
    document.addEventListener("click", pick, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerdown", stop, true);
      document.removeEventListener("pointerup", stop, true);
      document.removeEventListener("click", pick, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [inWidget, picking]);

  // Text selection: offer a comment control under any selection inside the
  // composition. The range is kept until the control is used.
  useEffect(() => {
    if (!reviewer || picking) return;
    const read = () => {
      const live = document.getSelection();
      const range = live && live.rangeCount > 0 && !live.isCollapsed ? live.getRangeAt(0) : null;
      const element = range ? rangeElement(range) : null;
      if (!range || !element || inWidget(element) || !element.closest(".portfolio-composition")) {
        rangeRef.current = null;
        setSelection(null);
        return;
      }
      rangeRef.current = range.cloneRange();
      const box = rangeBox(range, element);
      setSelection({ top: box.top, left: box.left, width: box.width, height: box.height });
    };
    document.addEventListener("selectionchange", read);
    document.addEventListener("pointerup", read);
    document.addEventListener("keyup", read);
    return () => {
      document.removeEventListener("selectionchange", read);
      document.removeEventListener("pointerup", read);
      document.removeEventListener("keyup", read);
    };
  }, [inWidget, picking, reviewer]);

  // Pins follow their elements through pane scrolls and resizes.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPins(locatePins(sent)));
    };
    update();
    document.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [sent]);

  const close = useCallback(() => {
    setOpen(false);
    setPicking(false);
    setFocusedId(null);
  }, []);

  const commentOnSelection = useCallback(() => {
    const range = rangeRef.current;
    const described = range ? describeSelection(range) : null;
    if (!described) return;
    document.getSelection()?.removeAllRanges();
    rangeRef.current = null;
    setSelection(null);
    setTarget(described);
    setMode("comment");
    setReplacement("");
    setPicking(false);
    setOpen(true);
  }, []);

  const chooseMode = useCallback(
    (next: Mode) => {
      setMode(next);
      if (next === "suggest" && target?.quote && !replacement) setReplacement(target.quote.text);
    },
    [replacement, target],
  );

  const clearTarget = useCallback(() => {
    setTarget(null);
    setMode("comment");
    setReplacement("");
  }, []);

  const named = !needsName || reviewerName.trim().length > 0;
  const canSend =
    named &&
    (suggesting
      ? replacement.trim().length > 0 && replacement.trim() !== target?.quote?.text
      : text.trim().length > 0);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!canSend || pending) return;
      setPending(true);
      setStatus(null);
      try {
        const saved = await transport.send({
          note: text.trim(),
          ...(needsName ? { reviewerName: reviewerName.trim() } : {}),
          ...(suggesting ? { suggestion: replacement.trim() } : {}),
          path: currentPath(),
          pageTitle: document.title || undefined,
          target: target ?? undefined,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          userAgent: navigator.userAgent,
        });
        setSent((current) => [...current, saved]);
        setText("");
        setReplacement("");
        setTarget(null);
        setMode("comment");
        setStatus({ kind: "sent", message: "Sent. Only Bradley sees it." });
      } catch {
        setStatus({ kind: "error", message: "That did not send. Try again." });
      } finally {
        setPending(false);
      }
    },
    [canSend, needsName, pending, replacement, reviewerName, suggesting, target, text, transport],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await transport.remove(id);
        setSent((current) => current.filter((note) => note.id !== id));
        setFocusedId((current) => (current === id ? null : current));
      } catch {
        setStatus({ kind: "error", message: "That note could not be taken back." });
      }
    },
    [transport],
  );

  if (!reviewer) return null;

  const escapeCloses = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape" && !picking) {
      event.stopPropagation();
      close();
    }
  };

  return (
    <div className="portfolio-feedback" data-open={open} data-picking={picking} ref={rootRef}>
      {open ? (
        <form
          aria-label="Note for Bradley"
          className="portfolio-feedback-panel"
          onSubmit={(event) => void submit(event)}
          role="dialog"
        >
          <div className="portfolio-feedback-head">
            <p className="portfolio-feedback-eyebrow">
              {needsName
                ? reviewerName.trim()
                  ? `Note for Bradley · from ${reviewerName.trim()}`
                  : "Note for Bradley"
                : `Note for Bradley · as ${reviewer}`}
            </p>
            <PortfolioControlMark aria-label="Close notes" kind="close" onClick={close} />
          </div>

          {needsName ? (
            <input
              aria-label="Your name"
              className="portfolio-feedback-why"
              onChange={(event) => setReviewerName(event.target.value)}
              onKeyDown={escapeCloses}
              placeholder="Your name, so Bradley knows who this is from"
              type="text"
              value={reviewerName}
            />
          ) : null}

          {target?.quote ? (
            <>
              <blockquote className="portfolio-feedback-quote">“{shorten(target.quote.text, 160)}”</blockquote>
              <p className="portfolio-feedback-target">
                Quoting <span className="portfolio-feedback-target-name">{target.component ?? target.selector}</span>{" "}
                <button className="portfolio-feedback-text-button" onClick={clearTarget} type="button">
                  Clear
                </button>
              </p>
              <div aria-label="What kind of note" className="portfolio-feedback-modes" role="group">
                <button
                  aria-pressed={mode === "comment"}
                  className="portfolio-feedback-mode"
                  onClick={() => chooseMode("comment")}
                  type="button"
                >
                  Comment
                </button>
                <button
                  aria-pressed={mode === "suggest"}
                  className="portfolio-feedback-mode"
                  onClick={() => chooseMode("suggest")}
                  type="button"
                >
                  Suggest an edit
                </button>
              </div>
            </>
          ) : target ? (
            <p className="portfolio-feedback-target">
              Pointing at <span className="portfolio-feedback-target-name">{target.component ?? target.selector}</span>
              {target.text ? <> — “{shorten(target.text, 48)}”</> : null}{" "}
              <button className="portfolio-feedback-text-button" onClick={clearTarget} type="button">
                Clear
              </button>
            </p>
          ) : (
            <button
              aria-pressed={picking}
              className="portfolio-feedback-point"
              data-picking={picking}
              onClick={() => setPicking((current) => !current)}
              type="button"
            >
              {picking ? "Click anything on the page · Esc to cancel" : "Point at something on the page"}
            </button>
          )}

          {suggesting ? (
            <>
              <textarea
                aria-label="Suggested replacement"
                id={textareaId}
                onChange={(event) => setReplacement(event.target.value)}
                onKeyDown={escapeCloses}
                ref={textareaRef}
                value={replacement}
              />
              <input
                aria-label="Why, optionally"
                className="portfolio-feedback-why"
                onChange={(event) => setText(event.target.value)}
                onKeyDown={escapeCloses}
                placeholder="Why? (optional)"
                type="text"
                value={text}
              />
            </>
          ) : (
            <textarea
              aria-label="Your note"
              id={textareaId}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={escapeCloses}
              placeholder={target?.quote ? "What about this passage?" : "What would you change, keep, or ask about?"}
              ref={textareaRef}
              value={text}
            />
          )}

          <div className="portfolio-feedback-foot">
            <p aria-live="polite" className="portfolio-feedback-status" data-kind={status?.kind ?? "hint"}>
              {status?.message ?? (target ? "Only Bradley sees this." : "Select text on the page to quote it.")}
            </p>
            <button className="portfolio-feedback-send" disabled={!canSend || pending} type="submit">
              {pending ? "Sending…" : suggesting ? "Send edit" : "Send"}
            </button>
          </div>

          {sent.length > 0 ? (
            <>
              <p className="portfolio-feedback-eyebrow">Sent this visit</p>
              <ul className="portfolio-feedback-sent">
                {sent.map((note, index) => (
                  <li className="portfolio-feedback-sent-row" data-focused={focusedId === note.id} key={note.id}>
                    <span aria-hidden="true" className="portfolio-feedback-sent-index">{index + 1}</span>
                    <span className="portfolio-feedback-sent-note">{sentSummary(note)}</span>
                    <button
                      className="portfolio-feedback-text-button"
                      onClick={() => void remove(note.id)}
                      type="button"
                    >
                      Take back
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </form>
      ) : (
        <button
          aria-expanded={false}
          className="portfolio-feedback-trigger"
          onClick={() => setOpen(true)}
          type="button"
        >
          Leave a note
        </button>
      )}
      {selection && !picking ? (
        <button
          className="portfolio-feedback-select"
          onClick={commentOnSelection}
          onPointerDown={(event) => event.preventDefault()}
          style={{ left: selection.left + selection.width / 2, top: selection.top + selection.height + 8 }}
          type="button"
        >
          Comment on selection
        </button>
      ) : null}
      {picking && hover ? (
        <div
          aria-hidden="true"
          className="portfolio-feedback-highlight"
          style={{ height: hover.height, left: hover.left, top: hover.top, width: hover.width }}
        />
      ) : null}
      {pins.map((pin) => (
        <button
          aria-label={`Your note ${pin.index}`}
          className="portfolio-feedback-pin"
          data-focused={focusedId === pin.id}
          key={pin.id}
          onClick={() => {
            setFocusedId(pin.id);
            setOpen(true);
          }}
          style={{ left: pin.left, top: pin.top }}
          type="button"
        >
          {pin.index}
        </button>
      ))}
    </div>
  );
}
