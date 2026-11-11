import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {WrongAnswer, requireInput} from './live-result.mjs';
import {installReadOnlyBrowser, installNativeWriteGuard, probeTelemetry} from './read-only-browser.mjs';

// The production walk and its real-browser adverse tests use the same observation.
export function createBrowserCheck({browser, playwright, base, check}) {
  return async function browserCheck(name, run, options = {}) {
      await check(name, async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options, serviceWorkers: "block" });
        let page;
        const wrong = [], unavailable = [];
        let writeRefused = false, capabilityUnavailable = false;
        const onViolation = record => {
          if (record.unavailable) capabilityUnavailable = true;
          else writeRefused = true;
          (record.unavailable ? unavailable : wrong).push(`Refused ${record.api} ${record.path}`);
        };
        try {
          const telemetry = probeTelemetry(new URL(base).origin);
          await context.exposeBinding("bivReadOnlyViolation", (_source, record) => onViolation(record));
          await context.addInitScript(installReadOnlyBrowser, { reportName: "bivReadOnlyViolation", telemetry });
          page = await context.newPage();
          await installNativeWriteGuard(page, onViolation, telemetry);
          let loaded = false;
          page.on("console", message => { if (message.type() === "error") wrong.push(`console: ${message.text()}`); });
          page.on("pageerror", error => wrong.push(`page error: ${error.message}`));
          page.on("requestfailed", request => {
            const reason = request.failure()?.errorText ?? "";
            if (!reason.includes("ERR_ABORTED")) unavailable.push(`request failed: ${reason}`);
          });
          page.on("response", response => { if (response.status() >= 400) wrong.push(`HTTP ${response.status()}`); });
          const goto = page.goto.bind(page);
          page.goto = async (...args) => {
            const previouslyLoaded = loaded;
            const previousUrl = page.url();
            loaded = false;
            const response = await goto(...args);
            if (response === null && previouslyLoaded) {
              const previous = new URL(previousUrl), current = new URL(page.url());
              loaded = previous.origin === current.origin && previous.pathname === current.pathname
                && previous.search === current.search && previous.hash !== current.hash;
              requireInput(loaded, "navigation returned no response for an unverified document");
              return response;
            }
            requireInput(response, "navigation returned no response");
            if (response.status() !== 200) throw new WrongAnswer(`status ${response.status()}`);
            loaded = true;
            return response;
          };
          let result, error;
          try { result = await run(page, context); } catch (caught) { error = caught; }
          // Guard-induced errors do not prove a product defect. Genuine received
          // errors still outweigh unrelated request outages.
          if (writeRefused) throw new WrongAnswer(wrong.find(message => message.startsWith("Refused ")));
          if (capabilityUnavailable) throw new Error("Isolated browser capability unavailable");
          if (!error && !(await page.locator("body").evaluate(body => body.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })))) throw new WrongAnswer("Primary page view is not visible");
          if (wrong.length) throw new WrongAnswer(wrong.slice(0, 3).join("; "));
          if (error instanceof WrongAnswer) throw error;
          if (unavailable.length) throw new Error(unavailable.slice(0, 3).join("; "));
          if (error) {
            if (loaded && playwright.errors?.TimeoutError && error instanceof playwright.errors.TimeoutError) throw new WrongAnswer(error.message);
            throw error;
          }
          return result;
        } finally {
          if (page) {
            const directory = path.join(process.cwd(), ".context/verification");
            mkdirSync(directory, { recursive: true });
            try { await page.screenshot({ path: path.join(directory, `${name.replace(/[^a-z0-9-]/gi, "_")}.png`), fullPage: true }); }
            catch { await check("browser screenshot", async () => { throw new Error("Required browser screenshot unavailable"); }, { retry: false }); }
          }
          try { await context.close(); }
          catch (error) { await check("browser cleanup", async () => { throw error; }, { retry: false }); }
        }
      });
    }
}
