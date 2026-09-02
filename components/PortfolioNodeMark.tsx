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
import type { ComponentPropsWithRef } from "react";

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
// ring, fill, shadow, or pictogram. `map` renders the brain symbol mask.
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
      <span aria-hidden="true" className="portfolio-control-glyph">
        {kind === "map" ? (
          <span className="portfolio-node-brain" />
        ) : (
          <MarkGlyph primitives={portfolioControlMarkPrimitives(kind)} />
        )}
      </span>
      {label ? <span className="portfolio-control-label">{label}</span> : null}
    </button>
  );
}
