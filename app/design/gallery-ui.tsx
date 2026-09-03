"use client";

// Presentation primitives for the /design gallery. These exist only to frame
// the real components; nothing here belongs in components/.

import {
  Suspense,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";

export type GallerySectionId =
  | "tokens-color"
  | "tokens-type"
  | "tokens-spacing"
  | "marks"
  | "header"
  | "reading-room"
  | "reader"
  | "world"
  | "chat"
  | "cursor"
  | "analytics"
  | "avatar"
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
 * content only. `source` sits there too, which is why sections that cover one
 * file no longer need a `Specimen` wrapper just to carry a path.
 */
export function Section({
  children,
  id,
  note,
  source,
  title,
}: {
  children: ReactNode;
  id: GallerySectionId;
  note?: string;
  source?: string;
  title: string;
}) {
  return (
    <details className="design-section" id={id} open>
      <summary className="design-section-summary">
        <h2>{title}</h2>
        {note ? <span className="design-note">{note}</span> : null}
        {source ? <code className="design-section-source">{source}</code> : null}
      </summary>
      <div className="design-section-body">{children}</div>
    </details>
  );
}

export function Specimen({
  children,
  flush = false,
  note,
  title,
}: {
  children: ReactNode;
  flush?: boolean;
  note?: string;
  title: string;
}) {
  return (
    <article className="design-specimen">
      <div className="design-specimen-head">
        <h3>{title}</h3>
        {note ? <p>{note}</p> : null}
      </div>
      <div className="design-specimen-body" data-flush={flush ? "true" : "false"}>
        {children}
      </div>
    </article>
  );
}

/**
 * The control strip above a state-matrix specimen. One live component instance
 * is driven through its states from here, rather than the gallery mounting one
 * tree per state — which is what used to put five `PortfolioReader`s and four
 * animating world canvases on the page at once.
 */
export function StateStrip<Value extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: Value) => void;
  options: readonly { readonly value: Value; readonly label: string }[];
  value: Value;
}) {
  return (
    <div aria-label={label} className="design-state-strip" role="group">
      <span className="design-state-strip-label">{label}</span>
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className="design-gallery-control"
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A stage is a transformed, painted box. Both properties make it the
 * containing block for `position: fixed` descendants, which is what lets the
 * full-viewport composition surfaces render inside a gallery card.
 *
 * `bleed` widens it to the full window. The Reading Room's persisted panel
 * proportions and minimum widths are viewport-derived, so an inset stage would
 * render the right values at the wrong proportion. Bleeding to 100vw keeps the
 * gallery fixture faithful to the shipped canvas.
 */
export function Stage({
  bleed = false,
  children,
  narrow = false,
  size = "tall",
  style,
}: {
  bleed?: boolean;
  children: ReactNode;
  narrow?: boolean;
  size?: StageSize;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`design-stage${narrow ? " design-stage-narrow" : ""}`}
      data-bleed={bleed ? "true" : "false"}
      data-size={size}
      style={style}
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
}: {
  as: ComponentType;
  label: string;
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
          <Stage size="short">
            <p className="design-lazy">Loading {label}…</p>
          </Stage>
        }
      >
        <Fixture />
      </Suspense>
    </>
  );
}
