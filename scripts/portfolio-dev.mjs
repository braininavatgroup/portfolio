import { spawn } from "node:child_process";
import { resolveDevelopmentOpenAIKey } from "./portfolio-chat-environment.mjs";

async function main() {
  const apiKey = await resolveDevelopmentOpenAIKey();
  const child = spawn("vinext", ["dev", ...process.argv.slice(2)], {
    env: {
      ...process.env,
      OPENAI_API_KEY: apiKey,
      WRANGLER_LOG_PATH:
        process.env.WRANGLER_LOG_PATH ?? ".wrangler/wrangler.log",
    },
    stdio: "inherit",
  });

  child.once("error", (error) => {
    console.error(`Could not start the development server: ${error.message}`);
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
