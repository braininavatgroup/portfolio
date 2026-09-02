// Inline links inside authored paragraphs. A paragraph string may carry
// `[label](record:<id>)`, `[label](thread:<id>)`, or `[label](https://…)`;
// everything else is plain text. The reader renders a record or thread
// segment as an in-dossier control and an external segment as an anchor
// that opens in a new tab; the assistant grounding and the flat text views
// strip the markup. Record and thread ids are validated against the
// structure when the content document loads.

export type PortfolioInlineLinkTarget =
  | { kind: "record"; id: string }
  | { kind: "thread"; id: string }
  | { kind: "external"; href: string };

export type PortfolioInlineSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; target: PortfolioInlineLinkTarget };

const INLINE_LINK_PATTERN =
  /\[([^\]\n]+)\]\((?:(record|thread):([a-z0-9-]+)|(https?:\/\/[^\s)]+))\)/g;

function targetOf(match: RegExpMatchArray): PortfolioInlineLinkTarget {
  const [, , kind, id, href] = match;
  if (href) return { kind: "external", href };
  return { kind: kind as "record" | "thread", id };
}

export function parseInlineLinks(text: string): PortfolioInlineSegment[] {
  const segments: PortfolioInlineSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: "text", text: text.slice(last, index) });
    segments.push({ type: "link", text: match[1], target: targetOf(match) });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
  return segments;
}

// Plain-text form for the assistant and flat views: an internal link keeps
// its label; an external one keeps the address too, so a reader of the text
// alone can still follow it.
export function stripInlineLinks(text: string): string {
  return parseInlineLinks(text)
    .map((segment) =>
      segment.type === "link" && segment.target.kind === "external"
        ? `${segment.text} (${segment.target.href})`
        : segment.text,
    )
    .join("");
}

export function inlineLinkTargets(text: string): PortfolioInlineLinkTarget[] {
  return parseInlineLinks(text).flatMap((segment) =>
    segment.type === "link" ? [segment.target] : [],
  );
}
