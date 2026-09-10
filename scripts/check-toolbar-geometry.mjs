/** Browser regression assertion. Pass an already-open Playwright page; browser
 * launch, concurrency limits, and cleanup belong to the verification harness.
 * Checks painted surfaces, not only the wrappers that can hide grid overflow.
 */
export async function checkToolbarGeometry(page) {
  const rows = await page.locator('.portfolio-reading-room-view-bar').evaluateAll(bars => bars
    .filter(bar => bar.getBoundingClientRect().width > 0)
    .map(bar => {
      const row = bar.getBoundingClientRect();
      const mark = bar.querySelector('.portfolio-reading-room-view-mark');
      const art = mark.querySelector('svg, .portfolio-node-brain');
      const artwork = art.getBoundingClientRect();
      const pane = bar.closest('.portfolio-reading-room-pane');
      const actions = [...pane.querySelectorAll(':scope > .portfolio-reading-room-view-controls svg')]
        .map(svg => {
          const rect = svg.getBoundingClientRect();
          return { centerY: rect.y + rect.height / 2, size: [rect.width, rect.height] };
        });
      return {
        view: pane.dataset.view,
        height: row.height,
        centerY: row.y + row.height / 2,
        artCenterY: artwork.y + artwork.height / 2,
        artInset: artwork.x + artwork.width / 2 - row.x,
        actions,
      };
    }));
  const near = (a, b) => Math.abs(a - b) < 0.02;
  for (const row of rows) {
    if (!near(row.height, 40) || !near(row.centerY, row.artCenterY) || !near(row.artInset, 33)) {
      throw new Error(`Toolbar artwork drift: ${JSON.stringify(row)}`);
    }
    for (const action of row.actions) {
      if (!near(action.centerY, row.centerY) || action.size.some(size => !near(size, 18))) {
        throw new Error(`Toolbar action drift: ${JSON.stringify(row)}`);
      }
    }
  }
  return rows;
}
