import { createBrowserCheck } from "./live-browser.mjs";
import { WrongAnswer } from "./live-result.mjs";
import { launchReadOnlyBrowser } from "./read-only-browser.mjs";
import { loadPlaywright } from "./clip-studio/tools.mjs";

export async function renderWalkthrough(directory, check) {
  // Playwright protocol/API traces include the full URL. This verifier does not retain them or screenshots.
  delete process.env.DEBUG;
  delete process.env.PWDEBUG;
  const playwright = loadPlaywright();
  const browser = await launchReadOnlyBrowser(playwright.chromium);
  let stage = "browser initialization";
  const privateCheck = (name, run, options) => check(name, async () => {
    try { return await run(); }
    catch (error) {
      // Console text, failed request messages and locator call logs can all contain the private URL.
      if (error instanceof WrongAnswer) throw new WrongAnswer(stage + " did not pass");
      throw new Error(stage + " unavailable");
    }
  }, options);
  const observe = createBrowserCheck({ browser, playwright, base: directory, check: privateCheck, retainScreenshots: false });
  const viewport = { width: 820, height: 620 };
  const wait = { timeout: 120_000 };
  try {
    await observe("walkthrough renders the real world and opens a plant photo", async page => {
      stage = "world load";
      await page.goto(directory + "?quality=low&webgl&spawn=1", { waitUntil: "commit", timeout: 60_000 });
      await page.locator("#startbtn").click(wait);
      await page.waitForFunction(() => {
        const yard = window.__yard;
        if (!yard?.pickCenter || !yard.card?.info) return false;
        const stats = yard.stats();
        return stats.plants.instances === 2933 && stats.plants.drawn > 0 && stats.triangles > 0 &&
          yard.plants.species.size === 42 && [...yard.plants.species.values()].every(s =>
            new URL(s.url, document.baseURI).href.startsWith(new URL("world/", document.baseURI).href)) &&
          !document.getElementById("about").textContent.includes("Stand-in data");
      }, null, wait);
      stage = "visible plant selection";
      const target = await page.evaluate(() => {
        const yard = window.__yard;
        for (const pitch of [-0.25, -0.05, -0.5]) {
          for (let heading = 0; heading < 360; heading += 10) {
            yard.player.yaw = -heading * Math.PI / 180;
            yard.player.pitch = pitch;
            yard.player.apply();
            const plant = yard.card.info[yard.pickCenter()]?.pm;
            if (plant?.gallery?.length) return { x: innerWidth / 2, y: innerHeight / 2, name: plant.heading.botanical };
          }
        }
        return null;
      });
      if (!target) throw new WrongAnswer("no selectable plant");
      await page.mouse.click(target.x, target.y);
      await page.waitForFunction(name => {
        const card = document.querySelector("#plantcard.open");
        return card?.querySelector(".pc-bot")?.textContent === name && card.querySelector("img")?.naturalWidth > 0;
      }, target.name, wait);
      await page.locator("#plantcard.open").getByRole("button", { name: "Close" }).click();
      await page.locator("#plantcard").waitFor({ state: "hidden" });
      return "2,933 instances, 42 real plant models, visible photo card";
    }, { viewport });
    await observe("walkthrough renders each of the 42 lookbook plants", async page => {
      stage = "lookbook load";
      await page.goto(directory + "lookbook.html?webgl&quality=low", { waitUntil: "commit", timeout: 60_000 });
      await page.waitForFunction(() => window.__lookbook?.ready, null, wait);
      const cells = page.locator("#grid .cell");
      if (await cells.count() !== 42) throw new WrongAnswer("unexpected lookbook count");
      stage = "lookbook model rendering";
      for (let index = 0; index < 42; index++) {
        await cells.nth(index).scrollIntoViewIfNeeded();
        await page.waitForFunction(i => document.querySelectorAll("#grid .cell")[i]?.dataset.rendered === "true", index, wait);
      }
      return "42 real species drawn into view";
    }, { viewport });
  } finally {
    await browser.close();
  }
}
