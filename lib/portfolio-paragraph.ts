// Flow inside one authored paragraph. A paragraph string is normally one run
// of prose, but it may carry a bulleted list: lines beginning with `- `. The
// reader renders each prose run as a `<p>` and each list run as a `<ul>`;
// the writing mode edits the raw string, and the assistant grounding reads
// it as text. A paragraph without list lines is a single prose run.

export type PortfolioParagraphFlow =
  | { type: "prose"; text: string }
  | { type: "list"; items: string[] };

const LIST_LINE_PATTERN = /^\s*-\s+(.*)$/;

export function parseParagraphFlow(text: string): PortfolioParagraphFlow[] {
  const flow: PortfolioParagraphFlow[] = [];
  let prose: string[] = [];
  let items: string[] = [];
  const flushProse = () => {
    const run = prose.join("\n").trim();
    if (run) flow.push({ type: "prose", text: run });
    prose = [];
  };
  const flushList = () => {
    if (items.length) flow.push({ type: "list", items });
    items = [];
  };
  for (const line of text.split("\n")) {
    const item = LIST_LINE_PATTERN.exec(line);
    if (item) {
      flushProse();
      items.push(item[1].trim());
    } else {
      flushList();
      prose.push(line);
    }
  }
  flushProse();
  flushList();
  return flow;
}

export function paragraphHasList(text: string): boolean {
  return parseParagraphFlow(text).some((run) => run.type === "list");
}
