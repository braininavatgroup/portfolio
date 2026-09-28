/**
 * What a visitor does on the live site, one probe per interaction. The feature
 * map names each probe in a `probe <name>` row; scripts/live.mjs runs every
 * named probe once in a fresh page and reports it on each row that names it.
 *
 * Every probe takes `{ page, base, content }` (an open Playwright page, the
 * site origin, the parsed content file) and returns a short detail string, or
 * throws with what the visitor would have seen instead. Probes are read-only:
 * nothing here sends the Guide a question or writes to production; the
 * analytics beacons are answered locally by the caller's browser context.
 */
import { checkCarouselLinkFeedback, checkReadingRoomResize } from "./check-reading-room-interactions.mjs";
import { checkToolbarGeometry } from "./check-toolbar-geometry.mjs";

function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const readerHeading = (page) => page.locator("main aside h1").first();
async function expectRecord(page, base, id, heading) {
  await page.waitForURL((url) => url.pathname === (id ? `/index/${id}` : "/"), { timeout: 10_000 });
  await readerHeading(page).filter({ hasText: heading }).waitFor({ timeout: 10_000 });
  return new URL(page.url()).pathname;
}
async function changes(locator, before) {
  for (let waited = 0; waited < 5_000; waited += 100) {
    const now = await locator.textContent();
    if (now !== before) return now;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`still ${before} after the change`);
}

/**
 * Opens a reading-room page and waits for hydration: the Guide opens its chat
 * session from an effect, so that response means React owns the controls.
 * Clicking before then lands on server HTML and does nothing.
 */
async function openRoom(page, url) {
  const session = page.waitForResponse((response) => response.url().endsWith("/api/portfolio-chat/session"), { timeout: 30_000 });
  await page.goto(url, { waitUntil: "load" });
  return session;
}

export const probes = {
  async "contents-select"({ page, base, content }) {
    await openRoom(page, `${base}/`);
    const contents = page.getByRole("navigation", { name: "Portfolio contents" });
    await contents.getByRole("button", { name: content.records.touring.label, exact: true }).click();
    const record = await expectRecord(page, base, "touring", content.records.touring.label);
    await contents.getByRole("button", { name: content.threads.philosophy.title, exact: true }).click();
    const theme = await expectRecord(page, base, "thread-philosophy", content.threads.philosophy.title);
    return `${record}, ${theme}`;
  },

  async "contents-home"({ page, base, content }) {
    await openRoom(page, `${base}/index/writ`);
    await page.getByRole("button", { name: "Portfolio home" }).click();
    return expectRecord(page, base, null, content.records.bradley.label);
  },

  async "map-select"({ page, base, content }) {
    await openRoom(page, `${base}/`);
    const { label, kind } = content.records.dubs;
    await page.getByRole("region", { name: "Spatial portfolio world" }).getByRole("button", { name: new RegExp(`${label}$`) }).click();
    return `${kind} node -> ${await expectRecord(page, base, "dubs", label)}`;
  },

  async "reader-inline-link"({ page, base, content }) {
    await openRoom(page, `${base}/`);
    await page.evaluate(() => { window.liveCheckMarker = true; });
    await page.getByRole("complementary").getByRole("link", { name: "INFAMOUS PR" }).click();
    await expectRecord(page, base, "infamous", content.records.infamous.label);
    expect(await page.evaluate(() => window.liveCheckMarker === true), "the inline link reloaded the page instead of selecting in place");
    return "/ -> /index/infamous in place";
  },

  async "reader-contact"({ page, base, content }) {
    await openRoom(page, `${base}/`);
    const reader = page.getByRole("complementary");
    const hrefs = await reader.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs.includes(`mailto:${content.contact.email}`), `no mailto:${content.contact.email} link`);
    const cv = reader.getByRole("link", { name: content.contact.cvLabel });
    expect((await cv.getAttribute("href")) === "/cv/bradley-berkman-cv.pdf", "the CV link does not point at the CV");
    for (const label of Object.values(content.contact.socialLabels)) {
      const href = await reader.getByRole("link", { name: label, exact: true }).getAttribute("href");
      expect(href?.startsWith("https://"), `${label} link is ${href}`);
    }
    return `${hrefs.length} links`;
  },

  async "reader-gallery-viewer"({ page, base }) {
    await openRoom(page, `${base}/index/writ`);
    const opener = page.getByRole("button", { name: /^Open gallery visual in reader/ }).first();
    await opener.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ timeout: 10_000 });
    const position = (await dialog.textContent())?.match(/(\d+) of (\d+)/)?.[0];
    expect(/^1 of \d+$/.test(position ?? ""), `viewer shows "${position}", not "1 of n"`);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached", timeout: 5_000 });
    await page
      .waitForFunction(() => document.activeElement?.getAttribute("aria-label")?.startsWith("Open gallery visual in reader"), null, { timeout: 2_000 })
      .catch(async () => {
        const focused = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80) ?? "nothing");
        throw new Error(`focus went to ${focused}, not back to the opener`);
      });
    return `${position}, Escape closes, focus restored`;
  },

  async "reader-video"({ page, base }) {
    await openRoom(page, `${base}/index/kickoff`);
    const video = page.locator("main aside video").first();
    await video.scrollIntoViewIfNeeded();
    await page.waitForFunction((el) => el.currentTime > 1, await video.elementHandle(), { timeout: 20_000 });
    return `plays ${new URL(await video.evaluate((el) => el.currentSrc)).pathname}`;
  },

  async "reader-report-embed"({ page, base }) {
    await openRoom(page, `${base}/index/reporting`);
    const frame = page.locator("main aside iframe").first();
    const src = await frame.getAttribute("src");
    expect(src?.startsWith("https://campaignreports.braininavat.dance/"), `report frame src is ${src}`);
    await frame.scrollIntoViewIfNeeded();
    const body = page.frameLocator("main aside iframe").first().locator("body");
    await body.waitFor({ timeout: 20_000 });
    expect(((await body.textContent()) ?? "").trim().length > 0, "the embedded report is blank");
    return new URL(src).host;
  },

  async "mac-menu-bar"({ page, base }) {
    await openRoom(page, `${base}/index/writ`);
    const bar = page.getByTestId("mac-menu-bar").first();
    await bar.scrollIntoViewIfNeeded();
    const glyphs = await bar.locator("img").evaluateAll((images) => images.filter((image) => image.complete && image.naturalWidth > 0 && image.getBoundingClientRect().width > 0).length);
    expect(glyphs > 0, "the menu bar painted no glyphs");
    return `${await page.getByTestId("mac-menu-bar").count()} bars, ${glyphs} glyphs in the first`;
  },

  async "carousel-links"({ page, base }) {
    return `${(await checkCarouselLinkFeedback(page, `${base}/`)).length} links`;
  },

  async history({ page, base, content }) {
    await openRoom(page, `${base}/`);
    await page.getByRole("navigation", { name: "Portfolio contents" }).getByRole("button", { name: content.records.writ.label, exact: true }).click();
    await expectRecord(page, base, "writ", content.records.writ.label);
    await page.goBack();
    await expectRecord(page, base, null, content.records.bradley.label);
    await page.goForward();
    await expectRecord(page, base, "writ", content.records.writ.label);
    return "select, back, forward";
  },

  async "legacy-hash"({ page, base, content }) {
    // The demos' return links still use this form: /?view=graph#touring.
    await openRoom(page, `${base}/?view=graph#touring`);
    await readerHeading(page).filter({ hasText: content.records.touring.label }).waitFor({ timeout: 10_000 });
    return "/#touring opens Tour Advancing System";
  },

  async "reading-room-resize"({ page, base }) {
    return `${(await checkReadingRoomResize(page, `${base}/`)).length} drags`;
  },

  async "reading-room-collapse"({ page, base }) {
    await openRoom(page, `${base}/`);
    const contents = page.getByRole("navigation", { name: "Portfolio contents" });
    await contents.getByRole("button", { name: "Hide Contents" }).click();
    await contents.waitFor({ state: "hidden", timeout: 5_000 });
    const reopen = page.getByRole("button", { name: /^Show Contents$/ });
    await reopen.click();
    await contents.waitFor({ state: "visible", timeout: 5_000 });
    return "Hide Contents, Show Contents";
  },

  async "mobile-tabs"({ page, base }) {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoom(page, `${base}/`);
    const views = [
      ["Map tab", page.getByRole("region", { name: "Spatial portfolio world" })],
      ["Contents tab", page.getByRole("navigation", { name: "Portfolio contents" })],
      ["Reader tab", page.getByRole("complementary")],
    ];
    for (const [tab, view] of views) {
      await page.getByRole("button", { name: tab }).click();
      await view.waitFor({ state: "visible", timeout: 5_000 });
    }
    return views.map(([tab]) => tab).join(", ");
  },

  async "toolbar-geometry"({ page, base }) {
    await openRoom(page, `${base}/`);
    await page.waitForLoadState("networkidle");
    const rows = await checkToolbarGeometry(page);
    expect(rows.length > 0, "no toolbar rows painted");
    return `${rows.length} rows`;
  },

  async "guide-composer"({ page, base }) {
    const session = await openRoom(page, `${base}/`);
    expect(session.status() === 200, `the Guide's session request answered ${session.status()}`);
    const guide = page.getByRole("region", { name: "Portfolio Guide" });
    const starters = await guide.getByRole("button").filter({ hasText: "?" }).count();
    expect(starters > 0, "the Guide shows no starter questions");
    const ask = guide.getByRole("button", { name: "Ask" });
    expect(await ask.isDisabled(), "Ask is enabled with an empty composer");
    await guide.getByRole("textbox").fill("live check: typed, never sent");
    expect(await ask.isEnabled(), "Ask stays disabled with a question typed");
    await guide.getByRole("textbox").fill("");
    return `session 200, ${starters} starters, Ask follows the composer`;
  },

  async avatar({ page, base }) {
    const model = page.waitForResponse((response) => /\.glb(\?|$)/.test(response.url()), { timeout: 30_000 });
    await openRoom(page, `${base}/`);
    expect((await model).status() === 200, `the avatar model answered ${(await model).status()}`);
    const overlay = page.locator(".avatar-overlay");
    await overlay.locator("canvas").first().waitFor({ timeout: 20_000 });
    const state = await overlay.getAttribute("data-avatar-state");
    expect(state !== "error", "the avatar boundary caught a renderer failure");
    await page.getByRole("button", { name: "Hide avatar" }).click();
    await page.getByRole("button", { name: "Show avatar" }).click();
    await overlay.locator("canvas").first().waitFor({ timeout: 10_000 });
    return `model 200, canvas painted (${state}), Hide and Show`;
  },

  async "brain-food"({ page, base }) {
    await openRoom(page, `${base}/`);
    const room = page.locator("[data-game-mode]").first();
    await page.locator(".avatar-overlay canvas").first().waitFor({ timeout: 20_000 });
    // The shortcut is the page's, not a text field's: click empty map first,
    // the way a visitor who has just read the map would.
    const map = page.getByRole("region", { name: "Spatial portfolio world" });
    const box = await map.boundingBox();
    await page.mouse.click(box.x + box.width - 12, box.y + box.height - 12);
    // The shortcut is ignored until the avatar model is ready; the canvas
    // appears before that, so try again the way an impatient visitor would.
    const started = () => room.getAttribute("data-game-mode").then((mode) => mode === "true");
    for (let tries = 0; tries < 20 && !(await started()); tries += 1) {
      await page.keyboard.press("Shift+G");
      await page.waitForTimeout(1_000);
    }
    expect(await started(), "Shift+G never started Brain Food");
    const playing = await page.locator("[data-brain-food]").first().getAttribute("data-brain-food");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("[data-game-mode]")?.getAttribute("data-game-mode") === "false", null, { timeout: 10_000 });
    expect(playing === "true", "the map did not enter Brain Food");
    return `Shift+G starts, Escape ends (${await room.getAttribute("data-game-mode")})`;
  },

  async cursor({ page, base }) {
    await openRoom(page, `${base}/`);
    const cursor = page.locator(".cursor-instrument");
    const read = () => cursor.evaluate((el) => ({ left: el.style.left, top: el.style.top, visible: el.dataset.visible, action: el.dataset.action }));
    const home = page.getByRole("button", { name: "Portfolio home" });
    await home.hover();
    const over = await read();
    await page.mouse.move(720, 450);
    await page.mouse.move(724, 452);
    const off = await read();
    expect(over.visible === "true" && off.left === "724px" && off.top === "452px", `cursor did not follow the pointer: ${JSON.stringify(off)}`);
    expect(over.action === "true", "the cursor did not invert over a button");
    return "follows the pointer, inverts over a button";
  },

  async "analytics-context"({ page, base }) {
    const clarity = page.waitForRequest((request) => request.url().includes("clarity.ms/tag/"), { timeout: 20_000 });
    await openRoom(page, `${base}/`);
    const context = await page.locator("html").getAttribute("data-portfolio-analytics-context");
    expect(context === "external", `root carries analytics context "${context}"`);
    await clarity;
    return "external context, Clarity requested (answered locally)";
  },

  async "privacy-preference"({ page, base, content }) {
    await page.goto(`${base}/privacy`, { waitUntil: "networkidle" });
    const region = page.getByRole("region", { name: "Analytics preferences" });
    await region.getByRole("button", { name: content.interface["privacy.optOutAnalytics"] }).click();
    await region.getByRole("button", { name: content.interface["privacy.enableAnalytics"] }).click();
    await region.getByRole("button", { name: content.interface["privacy.optOutAnalytics"] }).waitFor({ timeout: 5_000 });
    return "opt out, opt back in";
  },

  async "touring-demo"({ page, base }) {
    await page.goto(`${base}/demos/touring`, { waitUntil: "networkidle" });
    const demo = page.getByRole("main", { name: "Tour advancing demo" });
    await demo.getByRole("heading", { name: "2 details still needed" }).waitFor({ timeout: 10_000 });
    await demo.getByRole("button", { name: /Open the promoter form/ }).click();
    await demo.getByRole("textbox", { name: /^Driver Name/ }).fill("Live Check Driver");
    await demo.getByRole("button", { name: "Save advance" }).click();
    await demo.getByRole("heading", { name: "1 detail still needed" }).waitFor({ timeout: 5_000 });
    await demo.getByRole("button", { name: "Artist", exact: true }).click();
    await demo.getByRole("region", { name: "Day sheet" }).waitFor({ timeout: 5_000 });
    await demo.getByRole("button", { name: "Reset" }).click();
    await demo.getByRole("heading", { name: "2 details still needed" }).waitFor({ timeout: 5_000 });
    return "promoter saves a driver, 2 -> 1 still needed, artist day sheet, reset";
  },

  async "touring-embed"({ page, base }) {
    await openRoom(page, `${base}/index/touring`);
    const demo = page.getByRole("complementary").getByRole("region", { name: "Tour advancing demo" });
    await demo.scrollIntoViewIfNeeded();
    await demo.getByRole("button", { name: "Promoter", exact: true }).click();
    await demo.getByRole("button", { name: "Save advance" }).waitFor({ timeout: 5_000 });
    return "embedded demo switches to the promoter form";
  },

  async "quarterly-dashboard"({ page, base }) {
    await page.goto(`${base}/demos/quarterly-dashboard`, { waitUntil: "networkidle" });
    const pitches = page.getByRole("button", { name: /^Pitches this quarter/ }).locator("strong");
    const q2 = await pitches.textContent();
    await page.getByRole("combobox", { name: /^Quarter/ }).selectOption("Q1");
    const q1 = await changes(pitches, q2);
    await page.getByRole("button", { name: "Pitch Detail", exact: true }).click();
    const rows = await page.getByRole("table", { name: "Pitch detail rows" }).getByRole("row").count();
    const download = page.waitForEvent("download", { timeout: 10_000 });
    await page.getByRole("button", { name: "Download CSV" }).click();
    const file = (await download).suggestedFilename();
    expect(file.endsWith(".csv"), `download is ${file}`);
    return `Q2 ${q2} -> Q1 ${q1} pitches, ${rows - 1} detail rows, ${file}`;
  },

  async "quarterly-embed"({ page, base }) {
    await openRoom(page, `${base}/index/real-estate`);
    const dashboard = page.getByRole("region", { name: "Quarterly pitch conversion dashboard" });
    await dashboard.scrollIntoViewIfNeeded();
    const pitches = dashboard.getByRole("button", { name: /^Pitches this quarter/ }).locator("strong");
    const before = await pitches.textContent();
    await dashboard.getByRole("combobox", { name: /^Quarter/ }).selectOption("Q1");
    return `embedded filters live: ${before} -> ${await changes(pitches, before)} pitches`;
  },
};
