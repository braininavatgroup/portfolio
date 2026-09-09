/**
 * The map's node marks, drawn the way the portfolio draws them.
 *
 * The geometry is a port of `lib/portfolio-node-mark.ts` — the portfolio's own
 * primitives, at the same proportions and stroke — because that module is
 * TypeScript inside the application build and this page is plain modules on a
 * local server. `scripts/clip-studio/marks-parity.test.ts` compares the two, so
 * a change to the map's marks fails here rather than drifting quietly.
 */

/** `PORTFOLIO_NODE_MARK_SIZE`. */
export const markSize = 15;
/** `PORTFOLIO_GLYPH.node.stroke` and `PORTFOLIO_GLYPH.artworkScale`. */
export const markStroke = 1.45;
export const artworkScale = 0.9;
/** `BRADLEY_MARK_SIZE`. */
export const identityMarkSize = 21;

export const labelFont = '400 12.5px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const identityLabelFont = '500 14px "NHG portfolio", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const labelTop = 18;
export const labelLineHeight = 15;
export const labelMaxWidth = 132;

export function markPrimitives(family, size = markSize) {
  if (family === "story") {
    return [
      { kind: "polyline", points: [{ x: 0, y: -size * 0.5 }, { x: 0, y: size * 0.5 }], close: false, fill: false },
      {
        kind: "polyline",
        points: [{ x: -size * 0.433, y: -size * 0.25 }, { x: size * 0.433, y: size * 0.25 }],
        close: false,
        fill: false,
      },
      {
        kind: "polyline",
        points: [{ x: -size * 0.433, y: size * 0.25 }, { x: size * 0.433, y: -size * 0.25 }],
        close: false,
        fill: false,
      },
    ];
  }
  if (family === "identity") return [{ kind: "brain" }];
  if (family === "operation") {
    return [
      { kind: "circle", x: 0, y: 0, radius: size * 0.5, fill: false },
      { kind: "circle", x: 0, y: 0, radius: size * 0.25, fill: false },
    ];
  }
  if (family === "component") {
    const radius = size * 0.56;
    return [
      {
        kind: "polyline",
        points: [
          { x: 0, y: -radius },
          { x: Math.sin(Math.PI / 3) * radius, y: radius / 2 },
          { x: -Math.sin(Math.PI / 3) * radius, y: radius / 2 },
        ],
        close: true,
        fill: false,
      },
    ];
  }
  if (family === "engagement") {
    return [
      {
        kind: "polyline",
        points: [
          { x: 0, y: -size * 0.54 },
          { x: size * 0.54, y: 0 },
          { x: 0, y: size * 0.54 },
          { x: -size * 0.54, y: 0 },
        ],
        close: true,
        fill: false,
      },
    ];
  }
  return [
    { kind: "circle", x: 0, y: 0, radius: size * 0.5, fill: false },
    { kind: "circle", x: 0, y: 0, radius: size * (1.9 / 15), fill: true },
  ];
}

/**
 * Recolours the shared brain SVG, as `tintedBrain` does on the map.
 *
 * The map draws this glyph at about twenty pixels. A clip draws it many times
 * larger, so it is rasterised at the size it will be drawn — rounded up to the
 * next power of two and cached — rather than blown up from twenty and going to
 * mush.
 */
export function tintedBrain(image, colour, cache = new Map(), size = 64) {
  if (!image) return null;
  const raster = Math.min(1024, 2 ** Math.ceil(Math.log2(Math.max(32, size)))),
    key = `${colour}@${raster}`,
    held = cache.get(key);
  if (held) return held;
  const canvas = document.createElement("canvas");
  canvas.width = raster;
  canvas.height = raster;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, raster, raster);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = colour;
  context.fillRect(0, 0, raster, raster);
  cache.set(key, canvas);
  return canvas;
}

/**
 * Paints one mark at the current origin. `scale` sizes the whole mark for the
 * frame; the map draws at 1 in CSS pixels.
 */
export function drawMark(context, { family, colour, scale = 1, brain = null, brainCache }) {
  const size = (family === "identity" ? identityMarkSize : markSize) * artworkScale;
  context.save();
  // Scaling the context rather than the geometry keeps the map's proportions,
  // stroke weight, and label offsets exactly as they are drawn on the site.
  context.scale(scale, scale);
  context.fillStyle = colour;
  context.strokeStyle = colour;
  context.lineWidth = markStroke * artworkScale;
  context.lineJoin = "round";
  context.lineCap = "round";
  for (const primitive of markPrimitives(family, size)) {
    if (primitive.kind === "brain") {
      // The glyph is rasterised for the pixels it will actually cover.
      const glyph = tintedBrain(brain, colour, brainCache, Math.ceil(size * scale * 1.5));
      if (!glyph) continue;
      // The shared SVG has 18px of ink in a 20px surface; keep the map's ink size.
      const surface = size * 0.98 * (20 / 18);
      context.drawImage(glyph, -surface / 2, -surface / 2, surface, surface);
      continue;
    }
    context.beginPath();
    if (primitive.kind === "circle") {
      context.arc(primitive.x, primitive.y, primitive.radius, 0, Math.PI * 2);
    } else {
      primitive.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      if (primitive.close) context.closePath();
    }
    if (primitive.fill) context.fill();
    else context.stroke();
  }
  context.restore();
}

/** Wraps a label the way the map does: the most even split that fits. */
export function wrapLabel(label, measure, maxWidth = labelMaxWidth) {
  if (measure(label) <= maxWidth || !label.includes(" ")) return [label];
  const words = label.split(" ");
  let best = [label],
    bestScore = Infinity;
  for (let split = 1; split < words.length; split += 1) {
    const lines = [words.slice(0, split).join(" "), words.slice(split).join(" ")],
      widest = Math.max(...lines.map(measure));
    if (widest < bestScore) {
      bestScore = widest;
      best = lines;
    }
  }
  return best;
}

/**
 * Paints a node's label below its mark, at the map's offsets.
 *
 * On the site a label sits on a known paper. Here it can be over any part of a
 * black-and-white film, so it is cut out against `outline` — a hard contrasting
 * edge rather than a soft shadow, which is what kept blurring away over white.
 */
export function drawLabel(context, { label, family, scale = 1, colour, outline }) {
  context.save();
  context.scale(scale, scale);
  context.font = family === "identity" ? identityLabelFont : labelFont;
  context.textAlign = "center";
  context.textBaseline = "top";
  const measure = (line) => context.measureText(line).width;
  const lines = wrapLabel(label, measure, labelMaxWidth);
  if (outline) {
    context.strokeStyle = outline;
    context.lineWidth = 3.5;
    context.lineJoin = "round";
    context.miterLimit = 2;
    lines.forEach((line, index) => {
      context.strokeText(line, 0, labelTop + index * labelLineHeight);
    });
  }
  context.fillStyle = colour;
  lines.forEach((line, index) => {
    context.fillText(line, 0, labelTop + index * labelLineHeight);
  });
  context.restore();
}
