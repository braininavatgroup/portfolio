import {
  PORTFOLIO_NODE_MARK_SIZE,
  portfolioNodeMarkPrimitives,
  type PortfolioNodeMarkPrimitive,
} from "../lib/portfolio-node-mark";
import {
  portfolioContactMarkPrimitives,
  type PortfolioContactMarkKind,
} from "../lib/portfolio-contact-mark";
import {
  portfolioControlMarkPrimitives,
  type PortfolioControlMarkKind,
} from "../lib/portfolio-control-mark";
import type {
  PortfolioWorldFamily,
  PortfolioWorldRegister,
} from "../lib/portfolio-world";
import type { ComponentPropsWithRef, CSSProperties } from "react";

function MarkGlyph({ primitives }: { primitives: readonly PortfolioNodeMarkPrimitive[] }) {
  const halfViewBox = PORTFOLIO_NODE_MARK_SIZE * 0.6;
  return (
    <svg
      focusable="false"
      viewBox={`${-halfViewBox} ${-halfViewBox} ${halfViewBox * 2} ${halfViewBox * 2}`}
    >
      {primitives.map((primitive, index) => {
        if (primitive.kind === "circle") {
          return (
            <circle
              cx={primitive.x}
              cy={primitive.y}
              fill={primitive.fill ? "currentColor" : "none"}
              key={index}
              r={primitive.radius}
            />
          );
        }
        if (primitive.kind === "polyline") {
          const Mark = primitive.close ? "polygon" : "polyline";
          return (
            <Mark
              fill={primitive.fill ? "currentColor" : "none"}
              key={index}
              points={primitive.points.map(({ x, y }) => `${x},${y}`).join(" ")}
            />
          );
        }
        if (primitive.kind === "path") {
          // A filled path is a silhouette: no stroke, or the envelope's 1.45
          // outline would fatten it.
          return (
            <path
              d={primitive.d}
              fill={primitive.fill ? "currentColor" : "none"}
              key={index}
              stroke={primitive.fill ? "none" : undefined}
            />
          );
        }
        return null;
      })}
    </svg>
  );
}

function shapeMask(d: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-9 -9 18 18'><path d='${d}' fill='#000'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// The brain pattern is a CSS mask (the outline shape intersected with the
// brain at 170%), exactly as the prototype draws it. It references no SVG ids,
// so a cloned bar — dnd-kit copies the bar while it drags — keeps its
// pattern instead of resolving a duplicate id to a hidden element.
function PatternedControlGlyph({ kind }: { kind: "map" | "chat" }) {
  const [outline] = portfolioControlMarkPrimitives(kind);
  if (outline.kind !== "path") return null;

  return (
    <>
      <span
        className="portfolio-control-pattern"
        data-pattern="brain"
        style={{ "--control-shape": shapeMask(outline.d) } as CSSProperties}
      />
      <svg focusable="false" viewBox="-9 -9 18 18">
        <path
          d={outline.d}
          fill="none"
          strokeWidth={kind === "chat" ? 1.15 : undefined}
        />
      </svg>
    </>
  );
}

export function PortfolioNodeMark({
  family,
  register,
}: {
  family: PortfolioWorldFamily;
  register: PortfolioWorldRegister;
}) {
  return (
    <span
      aria-hidden="true"
      className="portfolio-node-mark"
      data-family={family}
      data-register={register}
    >
      {family === "identity" ? (
        <span className="portfolio-node-brain" />
      ) : (
        <MarkGlyph primitives={portfolioNodeMarkPrimitives(family)} />
      )}
    </span>
  );
}

// A Contact row's mark: same envelope, stroke, and box as a node mark, drawn
// in the identity colour. `data-family="contact"` keeps it addressable.
export function PortfolioContactMark({ kind }: { kind: PortfolioContactMarkKind }) {
  return (
    <span
      aria-hidden="true"
      className="portfolio-node-mark"
      data-contact={kind}
      data-family="contact"
      data-register="identity"
    >
      <MarkGlyph primitives={portfolioContactMarkPrimitives(kind)} />
    </span>
  );
}

type PortfolioControlMarkProps = Omit<ComponentPropsWithRef<"button">, "children"> & {
  kind: PortfolioControlMarkKind;
  /** The 12px caption below the glyph. Omit for the bare chat-interior marks. */
  label?: string;
};

// A control drawn as a node mark: the glyph alone in the node envelope, an
// invisible 40px hit box around it, a caption below, and nothing else — no
// ring, fill, shadow, or pictogram. Map and Guide clip the SVG brain pattern
// inside their supplied outlines.
export function PortfolioControlMark({
  className,
  kind,
  label,
  type = "button",
  ...rest
}: PortfolioControlMarkProps) {
  return (
    <button
      className={`portfolio-control-mark${className ? ` ${className}` : ""}`}
      data-control={kind}
      type={type}
      {...rest}
    >
      <PortfolioControlGlyph kind={kind} />
      {label ? <span className="portfolio-control-label">{label}</span> : null}
    </button>
  );
}

export function PortfolioControlGlyph({ kind }: { kind: PortfolioControlMarkKind }) {
  return (
    <span aria-hidden="true" className="portfolio-control-glyph" data-control-glyph={kind}>
      {kind === "map" || kind === "chat" ? (
        <PatternedControlGlyph kind={kind} />
      ) : (
        <MarkGlyph primitives={portfolioControlMarkPrimitives(kind)} />
      )}
    </span>
  );
}
