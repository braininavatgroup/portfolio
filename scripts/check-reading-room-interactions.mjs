/** Attach to the existing workspace server; the caller owns browser isolation. */
export async function checkReadingRoomResize(page, url) {
  const results = [];
  for (const width of [1020, 1280, 1440]) {
    await page.setViewportSize({width, height: 900});
    await page.goto(url, {waitUntil: 'networkidle'});
    const initial = width === 1440 ? [320, 1041] : [240, width - 321];
    for (const [index, label] of ['Resize Contents', 'Resize side panes'].entries()) {
      const box = await page.getByRole('separator', {name: label}).boundingBox();
      if (Math.abs(box.x - initial[index]) > 1) throw new Error(`${width}px ${label}: initial composition moved to ${box.x}`);
    }
    for (const name of ['Resize Contents', 'Resize side panes', 'Resize stacked side panes']) {
      const handle = page.getByRole('separator', {name});
      const vertical = await handle.getAttribute('aria-orientation') === 'vertical';
      for (const delta of [24, -24]) {
        const before = await handle.boundingBox();
        const x = before.x + before.width / 2;
        const y = before.y + before.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + (vertical ? delta : 0), y + (vertical ? 0 : delta), {steps: 12});
        await page.mouse.up();
        const after = await handle.boundingBox();
        const movement = vertical ? after.x - before.x : after.y - before.y;
        if (Math.abs(movement - delta) > 1) throw new Error(`${width}px ${name}: expected ${delta}px, got ${movement}px`);
        results.push({width, name, delta, movement});
      }
    }
  }
  return results;
}

export async function checkCarouselLinkFeedback(page, url) {
  await page.setViewportSize({width: 1440, height: 900});
  const results = [];
  for (const record of ['music-practice', 'infamous']) {
    await page.goto(`${url}#${record}`, {waitUntil: 'networkidle'});
    const links = page.locator('.reader-carousel-card a');
    for (const platform of ['Spotify', 'Beatport']) {
      const link = links.filter({has: page.locator(`[data-contact="${platform.toLowerCase()}"]`)}).first();
      // Focus reveals the card and pauses automatic scrolling, without navigation.
      await link.evaluate(el => el.closest('.reader-carousel-item').querySelector('button').focus());
      const mark = link.locator('.portfolio-node-mark');
      const resting = await mark.evaluate(el => getComputedStyle(el).opacity);
      await link.hover();
      const hovered = await mark.evaluate(el => getComputedStyle(el).opacity);
      if (resting !== '0.75' || hovered !== '1') throw new Error(`${record} ${platform}: missing hover feedback (${resting} -> ${hovered})`);
      await page.mouse.move(0, 0);
      await link.focus();
      const focused = await mark.evaluate(el => getComputedStyle(el).opacity);
      if (focused !== '1') throw new Error(`${record} ${platform}: missing focus feedback`);
      results.push({record, platform, resting, hovered, focused});
    }
  }
  return results;
}
