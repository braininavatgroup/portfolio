import {
  PORTFOLIO_NODE_MARK_SIZE,
  portfolioNodeMarkPrimitives,
} from "../lib/portfolio-node-mark";
import type {
  PortfolioWorldFamily,
  PortfolioWorldRegister,
} from "../lib/portfolio-world";

export function PortfolioNodeMark({
  family,
  register,
}: {
  family: PortfolioWorldFamily;
  register: PortfolioWorldRegister;
}) {
  const halfViewBox = PORTFOLIO_NODE_MARK_SIZE * 0.6;
  const primitives = portfolioNodeMarkPrimitives(family);

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
            return null;
          })}
        </svg>
      )}
    </span>
  );
}
