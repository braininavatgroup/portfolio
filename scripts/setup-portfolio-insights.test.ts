// Owns: the Airtable stage of `npm run setup:insights` captures the read-only
// token without echo, verifies it with one projected GET before storing it in
// the named Keychain entry, never places it in argv or on the terminal, and the
// launchd job never carries it. Retire when the report stops reading Airtable.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptUrl = new URL("./setup-portfolio-insights.sh", import.meta.url);
const scheduleUrl = new URL("./schedule-portfolio-insights.sh", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

async function airtableStage() {
  const script = await readFile(scriptUrl, "utf8");
  const start = script.indexOf("# ── Stage 3 · Airtable");
  const end = script.indexOf('rule "Done"');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return { script, stage: script.slice(start, end) };
}

describe("portfolio insights setup: Airtable stage", () => {
  it("is valid bash behind the canonical npm entry point", async () => {
    const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
    expect(packageJson.scripts["setup:insights"]).toBe("bash scripts/setup-portfolio-insights.sh");
    expect(() => execFileSync("bash", ["-n", fileURLToPath(scriptUrl)])).not.toThrow();
  });

  it("asks for a records-read token scoped to the Job Search base only", async () => {
    const { stage } = await airtableStage();
    expect(stage).toContain("data.records:read");
    expect(stage).toContain("Job Search");
    expect(stage).toContain("read -rs AIRTABLE_TOKEN");
  });

  it("verifies one projected Actions GET before storing in the named Keychain entry", async () => {
    const { script, stage } = await airtableStage();
    expect(script).toContain('KEYCHAIN_SERVICE="biv-portfolio-insights"');
    expect(script).toContain('AIRTABLE_BASE="app0LM9NfGL4ZHi3j"');
    expect(script).toContain('AIRTABLE_ACTIONS_TABLE="tblheGY3pSKmWvAS9"');

    const verify = stage.indexOf(
      "https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_ACTIONS_TABLE}?pageSize=1&fields%5B%5D=Action",
    );
    const store = stage.indexOf('store "airtable-read-token"');
    expect(verify).toBeGreaterThan(-1);
    expect(store).toBeGreaterThan(verify);
    // Only a 200 reaches the store call; every other status exits first.
    expect(stage.slice(verify, store)).toMatch(/200\)[^\n]*done_/u);
    expect(stage.slice(verify, store)).toMatch(/\*\)\s+fail /u);
    // GET only: no method override or request body anywhere in the stage.
    expect(stage).not.toMatch(/\s(?:-X|--request|-d|--data\S*)\s/u);
  });

  it("never echoes the token or passes it to curl as an argument", async () => {
    const { stage } = await airtableStage();
    const expansions = stage
      .split("\n")
      .filter((line) => /\$\{?AIRTABLE_TOKEN\b/u.test(line));
    expect(expansions.length).toBeGreaterThan(0);
    for (const line of expansions) {
      expect(line).not.toMatch(/\becho\b/u);
      expect(line).not.toMatch(/-H\s+["']Authorization/iu);
      if (/\bprintf\b/u.test(line)) expect(line).toMatch(/\|\s*curl\b.*-H @-/u);
    }
    expect(stage).toMatch(/\nunset AIRTABLE_TOKEN\n/u);
  });

  it("keeps the token out of the launchd job definition", async () => {
    const schedule = await readFile(scheduleUrl, "utf8");
    const start = schedule.indexOf('cat > "$PLIST" <<PLIST');
    const end = schedule.indexOf("\nPLIST\n", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const plist = schedule.slice(start, end);
    expect(plist).toContain("EnvironmentVariables");
    expect(plist).not.toMatch(/token|airtable|security\s+find/iu);
  });
});
