// Inline links inside authored paragraphs. A paragraph string may carry
// `[label](record:<id>)` or `[label](thread:<id>)`; everything else is plain
// text. The reader renders a link segment as an in-dossier control, the
// assistant grounding and the flat text views strip the markup. Ids are
// validated against the structure when the content document loads.

export type PortfolioInlineLinkTarget =
  | { kind: "record"; id: string }
  | { kind: "thread"; id: string };

export type PortfolioInlineSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; target: PortfolioInlineLinkTarget };

const INLINE_LINK_PATTERN = /\[([^\]\n]+)\]\((record|thread):([a-z0-9-]+)\)/g;

export function parseInlineLinks(text: string): PortfolioInlineSegment[] {
  const segments: PortfolioInlineSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: "text", text: text.slice(last, index) });
    const [, label, kind, id] = match;
    segments.push({
      type: "link",
      text: label,
      target: { kind: kind as "record" | "thread", id },
    });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
  return segments;
}

export function stripInlineLinks(text: string): string {
  return text.replace(INLINE_LINK_PATTERN, "$1");
}

export function inlineLinkTargets(text: string): PortfolioInlineLinkTarget[] {
  return parseInlineLinks(text).flatMap((segment) =>
    segment.type === "link" ? [segment.target] : [],
  );
}
