"use client";

// Reviewer notes for Bradley. Mounts only when the worker has set the readable
// `portfolio_reviewer` cookie from a `?r=<code>` link (worker/portfolio-feedback.ts).
// A reviewer writes a note, optionally points at one element on the page, and
// sends it. The visit's own notes stay in component state so the reviewer can
// take one back; nothing is written into the page or into storage, so a later
// session starts clean and no reviewer ever sees another's notes.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import type {
  FeedbackNote,
  FeedbackNoteInput,
  FeedbackTarget,
} from "../worker/portfolio-feedback-store";
import { PortfolioControlMark } from "./PortfolioNodeMark";

export type FeedbackDraft = Omit<FeedbackNoteInput, "reviewer">;

export type PortfolioFeedbackTransport = {
  send(draft: FeedbackDraft): Promise<FeedbackNote>;
  remove(id: string): Promise<void>;
};

const NOTES_PATH = "/_portfolio-feedback/notes";
const REVIEWER_COOKIE = "portfolio_reviewer";
const REVIEWER_CODE = /^[a-z0-9][a-z0-9-]{1,31}$/u;
const REGION_CLASS = /^(portfolio|reader|avatar|cursor|scene)-[a-z0-9-]+$/u;
const SELECTOR_DEPTH = 6;
const TEXT_LIMIT = 120;

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
    const text = (element.textContent ?? "").replace(/\s+/gu, " ").trim();
    if (text) target.text = text.slice(0, TEXT_LIMIT);
  }

  const box = element.getBoundingClientRect();
  const round = (value: number) => Math.round(value * 10) / 10;
  target.rect = { x: round(box.left), y: round(box.top), width: round(box.width), height: round(box.height) };
  if (point && box.width > 0 && box.height > 0) {
    target.offset = {
      x: Math.round(((point.x - box.left) / box.width) * 1_000) / 1_000,
      y: Math.round(((point.y - box.top) / box.height) * 1_000) / 1_000,
    };
  }
  return target;
}

type Box = { top: number; left: number; width: number; height: number };

const subscribeToNothing = () => () => {};
const readCookieReviewer = () => readReviewerCookie(document.cookie);
const noReviewerOnServer = () => null;

function currentPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function PortfolioFeedback({
  reviewer: reviewerOverride,
  transport = portfolioFeedbackTransport,
}: {
  /** Test and gallery seam. In production the reviewer comes from the cookie. */
  reviewer?: string;
  transport?: PortfolioFeedbackTransport;
}) {
  // The server never knows the cookie, so the first client render agrees with
  // it (no reviewer) and the control appears after hydration.
  const cookieReviewer = useSyncExternalStore(
    subscribeToNothing,
    readCookieReviewer,
    noReviewerOnServer,
  );
  const reviewer = reviewerOverride ?? cookieReviewer;
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<Box | null>(null);
  const [target, setTarget] = useState<FeedbackTarget | null>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ kind: "sent" | "error"; message: string } | null>(null);
  const [sent, setSent] = useState<FeedbackNote[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaId = useId();

  useEffect(() => {
    if (open && !picking) textareaRef.current?.focus();
  }, [open, picking]);

  useEffect(() => {
    if (!picking) return;
    const inWidget = (node: EventTarget | null) =>
      node instanceof Node && Boolean(rootRef.current?.contains(node));
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
  }, [picking]);

  const close = useCallback(() => {
    setOpen(false);
    setPicking(false);
  }, []);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const note = text.trim();
      if (!note || pending) return;
      setPending(true);
      setStatus(null);
      try {
        const saved = await transport.send({
          note,
          path: currentPath(),
          pageTitle: document.title || undefined,
          target: target ?? undefined,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          userAgent: navigator.userAgent,
        });
        setSent((current) => [...current, saved]);
        setText("");
        setTarget(null);
        setStatus({ kind: "sent", message: "Sent. Only Bradley sees it." });
      } catch {
        setStatus({ kind: "error", message: "That did not send. Try again." });
      } finally {
        setPending(false);
      }
    },
    [pending, target, text, transport],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await transport.remove(id);
        setSent((current) => current.filter((note) => note.id !== id));
      } catch {
        setStatus({ kind: "error", message: "That note could not be taken back." });
      }
    },
    [transport],
  );

  if (!reviewer) return null;

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
              Note for Bradley · as {reviewer}
            </p>
            <PortfolioControlMark aria-label="Close notes" kind="close" onClick={close} />
          </div>

          {target ? (
            <p className="portfolio-feedback-target">
              Pointing at <span className="portfolio-feedback-target-name">{target.component ?? target.selector}</span>
              {target.text ? <> — “{target.text.length > 48 ? `${target.text.slice(0, 48)}…` : target.text}”</> : null}{" "}
              <button
                className="portfolio-feedback-text-button"
                onClick={() => setTarget(null)}
                type="button"
              >
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

          <textarea
            aria-label="Your note"
            id={textareaId}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !picking) {
                event.stopPropagation();
                close();
              }
            }}
            placeholder="What would you change, keep, or ask about?"
            ref={textareaRef}
            value={text}
          />

          <div className="portfolio-feedback-foot">
            <p aria-live="polite" className="portfolio-feedback-status" data-kind={status?.kind ?? "hint"}>
              {status?.message ?? "Only Bradley sees this."}
            </p>
            <button
              className="portfolio-feedback-send"
              disabled={!text.trim() || pending}
              type="submit"
            >
              {pending ? "Sending…" : "Send"}
            </button>
          </div>

          {sent.length > 0 ? (
            <>
              <p className="portfolio-feedback-eyebrow">Sent this visit</p>
              <ul className="portfolio-feedback-sent">
                {sent.map((note) => (
                  <li className="portfolio-feedback-sent-row" key={note.id}>
                    <span className="portfolio-feedback-sent-note">{note.note}</span>
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
      {picking && hover ? (
        <div
          aria-hidden="true"
          className="portfolio-feedback-highlight"
          style={{ height: hover.height, left: hover.left, top: hover.top, width: hover.width }}
        />
      ) : null}
    </div>
  );
}
