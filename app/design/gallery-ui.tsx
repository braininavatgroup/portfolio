"use client";

// Presentation primitives for the /design gallery. These exist only to frame
// the real components; nothing here belongs in components/.

import {
  Suspense,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

export type GallerySectionId =
  | "tokens-color"
  | "tokens-type"
  | "tokens-spacing"
  | "marks"
  | "header"
  | "reader"
  | "world"
  | "chat"
  | "cursor"
  | "analytics"
  | "avatar"
  | "toybox"
  | "composition";

export type StageSize = "auto" | "short" | "medium" | "tall" | "viewport";

/**
 * A collapsible section. `<details>` rather than a button and a state hook:
 * the disclosure semantics, the keyboard handling and the expanded state
 * exposed to assistive technology all come for free, and a collapsed section
 * keeps its children mounted, so a Three.js fixture someone has already
 * mounted survives being folded away.
 *
 * The note stays inside the `<summary>` so a collapsed section still says what
 * it holds. It is a `<span>`, not a `<p>` — summary takes phrasing and heading
 * content only.
 */
export function Section({
  children,
  id,
  note,
  title,
}: {
  children: ReactNode;
  id: GallerySectionId;
  note?: string;
  title: string;
}) {
  return (
    <details className="design-section" id={id} open>
      <summary className="design-section-summary">
        <h2>{title}</h2>
        {note ? <span className="design-note">{note}</span> : null}
      </summary>
      <div className="design-section-body">{children}</div>
    </details>
  );
}

export function Specimen({
  children,
  flush = false,
  note,
  source,
  title,
}: {
  children: ReactNode;
  flush?: boolean;
  note?: string;
  source?: string;
  title: string;
}) {
  return (
    <article className="design-specimen">
      <div className="design-specimen-head">
        <h3>{title}</h3>
        {note ? <p>{note}</p> : null}
        {source ? (
          <p className="design-specimen-source">{source}</p>
        ) : null}
      </div>
      <div className="design-specimen-body" data-flush={flush ? "true" : "false"}>
        {children}
      </div>
    </article>
  );
}

/**
 * A stage is a transformed, painted box. Both properties make it the
 * containing block for `position: fixed` descendants, which is what lets the
 * full-viewport composition surfaces render inside a gallery card.
 */
export function Stage({
  children,
  narrow = false,
  size = "tall",
}: {
  children: ReactNode;
  narrow?: boolean;
  size?: StageSize;
}) {
  return (
    <div
      className={`design-stage${narrow ? " design-stage-narrow" : ""}`}
      data-size={size}
    >
      {children}
    </div>
  );
}

/**
 * Mounts a lazily imported fixture only after an explicit click. The import
 * itself is code-split, so the route never downloads Three.js on page load,
 * and each WebGL context is created only when a reviewer asks for it.
 */
export function LazyFixture({
  as: Fixture,
  label,
  size = "medium",
}: {
  as: ComponentType;
  label: string;
  size?: StageSize;
}) {
  const [mounted, setMounted] = useState(false);

  if (!mounted) {
    return (
      <div className="design-lazy">
        <span>{label} is not mounted. It loads Three.js and a WebGL context on demand.</span>
        <button
          className="design-gallery-control"
          onClick={() => setMounted(true)}
          type="button"
        >
          Mount
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="design-lazy">
        <button
          className="design-gallery-control"
          onClick={() => setMounted(false)}
          type="button"
        >
          Unmount {label}
        </button>
      </div>
      <Suspense
        fallback={
          <Stage size={size}>
            <p className="design-lazy">Loading {label}…</p>
          </Stage>
        }
      >
        <Fixture />
      </Suspense>
    </>
  );
}
