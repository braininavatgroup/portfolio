import { PORTFOLIO_GLYPH, PORTFOLIO_GLYPH_SIZES, type PortfolioGlyphSize } from "../lib/portfolio-glyph-metrics";
const CONTROL_STROKE = PORTFOLIO_GLYPH.control.stroke;
const CONTROL_SURFACE_SIZE = PORTFOLIO_GLYPH.control.surface;
import {
  portfolioNodeMarkPrimitives,
  type PortfolioNodeMarkPrimitive,
} from "../lib/portfolio-node-mark";
import {
  portfolioContactMarkPrimitives,
  type PortfolioContactMarkKind,
} from "../lib/portfolio-contact-mark";
import {
  portfolioControlMarkPrimitives,
  portfolioControlCrops,
  type PortfolioControlMarkKind,
} from "../lib/portfolio-control-mark";
import type {
  PortfolioWorldFamily,
  PortfolioWorldRegister,
} from "../lib/portfolio-world";
import type { ComponentPropsWithRef, CSSProperties } from "react";

function MarkGlyph({ primitives, control = false, size }: { primitives: readonly PortfolioNodeMarkPrimitive[]; control?: boolean; size?: number }) {
  const halfViewBox = control ? CONTROL_SURFACE_SIZE / 2 : PORTFOLIO_GLYPH.node.surface / 2;
  return (
    <svg
      style={size ? { width: size, height: size } : undefined}
      focusable="false"
      viewBox={`${-halfViewBox} ${-halfViewBox} ${halfViewBox * 2} ${halfViewBox * 2}`}
    >
      <g strokeWidth={control ? CONTROL_STROKE : PORTFOLIO_GLYPH.node.stroke} strokeLinecap={PORTFOLIO_GLYPH.lineCap} strokeLinejoin={PORTFOLIO_GLYPH.lineJoin}>
      {primitives.map((primitive, index) => {
        if (primitive.kind === "circle") {
          return (
            <circle
              cx={primitive.x}
              cy={primitive.y}
              fill={primitive.fill ? "currentColor" : "none"}
              vectorEffect={control ? "non-scaling-stroke" : undefined}
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
              vectorEffect={control ? "non-scaling-stroke" : undefined}
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
              vectorEffect={control ? "non-scaling-stroke" : undefined}
              key={index}
              stroke={primitive.fill ? "none" : undefined}
            />
          );
        }
        return null;
      })}
      </g>
    </svg>
  );
}

// Each SVG image contains vector cropping and clipping in one rasterization.
// Its internal IDs are isolated from the document and from drag clones.
function PatternedControlGlyph({ kind }: { kind: keyof typeof portfolioControlCrops }) {
  const [outline] = portfolioControlMarkPrimitives(kind);
  if (outline.kind !== "path") return null;
  if (kind === "avatarHidden") {
    return <svg focusable="false" viewBox="-10 -10 20 20"><path d={outline.d} fill="currentColor" stroke="currentColor" strokeWidth={CONTROL_STROKE} vectorEffect="non-scaling-stroke" /></svg>;
  }
  return (
    <>
      <span
        className="portfolio-control-pattern"
        data-pattern="brain"
        style={{ "--control-shape": `url("/glyph-textures/${kind}.svg")` } as CSSProperties}
      />
      <svg focusable="false" viewBox="-10 -10 20 20">
        <path d={outline.d} fill="none" strokeWidth={CONTROL_STROKE} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
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
      style={{ scale: PORTFOLIO_GLYPH.artworkScale }}
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
      style={{ scale: PORTFOLIO_GLYPH.artworkScale }}
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
      <PortfolioControlGlyph kind={kind} size={kind === "send" || kind === "minimize" ? "small" : "standard"} />
      {label ? <span className="portfolio-control-label">{label}</span> : null}
    </button>
  );
}

export function PortfolioControlGlyph({ kind, size = "standard" }: { kind: PortfolioControlMarkKind; size?: PortfolioGlyphSize }) {
  return (
    <span aria-hidden="true" className="portfolio-control-glyph" style={{ scale: PORTFOLIO_GLYPH.artworkScale }} data-control-glyph={kind} data-glyph-size={size}>
      {kind === "map" || kind === "chat" || kind === "avatarShown" || kind === "avatarHidden" ? (
        size === "standard" ? <PatternedControlGlyph kind={kind} /> : (
          <span className="portfolio-control-pattern-frame" style={{ transform: `scale(${PORTFOLIO_GLYPH_SIZES[size] / CONTROL_SURFACE_SIZE})` }}>
            <PatternedControlGlyph kind={kind} />
          </span>
        )
      ) : (
        <MarkGlyph control size={PORTFOLIO_GLYPH_SIZES[size]} primitives={portfolioControlMarkPrimitives(kind)} />
      )}
    </span>
  );
}
