import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const scriptUrl = new URL("./setup-portfolio-chat.sh", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

describe("portfolio chat setup wizard", () => {
  it("is the canonical npm setup entry point", async () => {
    const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));

    expect(packageJson.scripts["setup:chat"]).toBe(
      "bash scripts/setup-portfolio-chat.sh",
    );
  });

  it("captures both credentials through hidden wizard input", async () => {
    const script = await readFile(scriptUrl, "utf8");

    expect(script).toContain(
      'ask_secret OPENAI_DEVELOPMENT_KEY "Paste the development key:"',
    );
    expect(script).toContain(
      'ask_secret OPENAI_PRODUCTION_KEY "Paste the production service-account key:"',
    );
    expect(script).toContain("configure-development-key");
    expect(script).toContain("validate-openai-key");
  });

  it("never delegates secret capture to security's truncated password prompt", async () => {
    const script = await readFile(scriptUrl, "utf8");

    expect(script).not.toMatch(/security[^\n]+(?:-w|-p)/);
    expect(script).not.toContain("write_env OPENAI");
  });
});
