/** A readable overview, independent of theme membership density.
 * The shell supplies the canvas size after reserving its toolbar row.
 * Records follow Contents order; selecting one restores its spatial relations.
 */
export function portfolioOverviewPositions(
  recordGroups: readonly (readonly string[])[],
  themeIds: readonly string[],
  { width, height }: { width: number; height: number },
) {
  const columns = Math.max(1, recordGroups.length);
  const inset = Math.max(16, (width - 840) / 2);
  const cell = (width - inset * 2) / columns;
  const labelWidth = Math.min(120, cell - 28);
  const contentHeight = Math.min(height, 440);
  const top = (height - contentHeight) / 2;
  const positions = new Map<string, { x: number; y: number }>();
  positions.set("bradley", { x: Math.max(inset, width / 2 - 56), y: top + 20 });
  themeIds.forEach((id, index) => positions.set(id, {
    x: inset + index * (width - inset * 2) / Math.max(1, themeIds.length),
    y: top + Math.min(76, contentHeight * 0.25),
  }));
  const rows = Math.max(1, ...recordGroups.map(group => group.length));
  const start = top + Math.min(132, contentHeight * 0.42);
  const gap = Math.min(88, (top + contentHeight - 26 - start) / Math.max(1, rows - 1));
  recordGroups.forEach((group, column) => group.forEach((id, row) => positions.set(id, {
    x: inset + column * cell,
    y: start + row * gap,
  })));
  return { positions, labelWidth };
}

/** At most two lines, each bounded by its column, with the full accessible
 * name retained on the node button. Long overview labels use an ellipsis. */
export function portfolioOverviewLabel(label: string, measure: (text: string) => number, width: number): string[] {
  if (measure(label) <= width) return [label];
  const words = label.split(" ");
  let first = words.shift() ?? "";
  while (words.length && measure(`${first} ${words[0]}`) <= width) first += ` ${words.shift()}`;
  const fit = (text: string) => {
    if (measure(text) <= width) return text;
    while (text.length > 1 && measure(`${text}…`) > width) text = text.slice(0, -1);
    return `${text.trimEnd()}…`;
  };
  return [fit(first), ...(words.length ? [fit(words.join(" "))] : [])];
}
