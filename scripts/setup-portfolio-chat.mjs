import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  DEVELOPMENT_KEYCHAIN_ACCOUNT,
  DEVELOPMENT_KEYCHAIN_SERVICE,
  readDevelopmentKeyFromKeychain,
  validateOpenAIKey,
} from "./portfolio-chat-environment.mjs";

const OPENAI_PROJECTS_URL =
  "https://platform.openai.com/settings/organization/projects";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          signal
            ? `${command} exited after ${signal}.`
            : `${command} exited with status ${code}.`,
        ),
      );
    });
  });
}

function runWithInput(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "inherit", "inherit"],
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          signal
            ? `${command} exited after ${signal}.`
            : `${command} exited with status ${code}.`,
        ),
      );
    });
    child.stdin.end(`${input}\n`);
  });
}

async function runWithTerminalInput(command, args, reader) {
  reader.pause();
  try {
    await run(command, args);
  } finally {
    reader.resume();
  }
}

async function open(url) {
  await run("/usr/bin/open", [url]);
}

async function pause(prompt, reader) {
  await reader.question(`${prompt}\nPress Return when you are ready. `);
}

async function confirm(prompt, reader) {
  const answer = await reader.question(`${prompt} [y/N] `);
  return /^(?:y|yes)$/i.test(answer.trim());
}

async function configureDevelopmentKey(reader) {
  console.log("\n1. Development key");
  console.log(
    'Create or select a dedicated OpenAI project such as "portfolio-dev", then create a project API key.',
  );
  await open(OPENAI_PROJECTS_URL);
  await pause(
    "Keep the newly created key visible. The next prompt stores it directly in macOS Keychain.",
    reader,
  );
  console.log(
    "Paste the development key at the password prompt. The paste will not be displayed.",
  );
  await runWithTerminalInput(
    "/usr/bin/security",
    [
      "add-generic-password",
      "-U",
      "-s",
      DEVELOPMENT_KEYCHAIN_SERVICE,
      "-a",
      DEVELOPMENT_KEYCHAIN_ACCOUNT,
      "-l",
      "Brain in a Vat portfolio development OpenAI key",
      "-w",
    ],
    reader,
  );
  const storedKey = (await readDevelopmentKeyFromKeychain()).trim();
  if (!storedKey) throw new Error("Keychain returned an empty development key.");
  console.log("Checking the development key with OpenAI…");
  await validateOpenAIKey(storedKey);
  console.log("Development key authenticated and verified in macOS Keychain.");
}

async function ensureWranglerLogin(reader) {
  console.log("\nChecking Cloudflare authentication…");
  try {
    await run("npx", ["wrangler", "whoami"]);
  } catch {
    console.log("Cloudflare needs authentication; opening its login flow.");
    await runWithTerminalInput("npx", ["wrangler", "login"], reader);
  }
}

async function configureProductionKey(reader) {
  console.log("\n2. Production key");
  console.log(
    'Create or select a separate OpenAI project such as "portfolio-production", then create a project service-account key.',
  );
  await open(OPENAI_PROJECTS_URL);
  await pause("Keep the production key visible.", reader);
  console.log(
    "Cloudflare stores this as the encrypted OPENAI_API_KEY Worker secret. It is never written to this repo or copied into the development environment.",
  );
  const stagingService = `biv-openai-portfolio-production-staging-${process.pid}`;
  console.log(
    "Paste the production key at the password prompt. It will be authenticated before upload and removed from Keychain when this step ends.",
  );
  await runWithTerminalInput(
    "/usr/bin/security",
    [
      "add-generic-password",
      "-s",
      stagingService,
      "-a",
      DEVELOPMENT_KEYCHAIN_ACCOUNT,
      "-l",
      "Temporary portfolio production OpenAI key",
      "-w",
    ],
    reader,
  );

  let productionKey;
  try {
    productionKey = (
      await readDevelopmentKeyFromKeychain({
        service: stagingService,
        account: DEVELOPMENT_KEYCHAIN_ACCOUNT,
      })
    ).trim();
    if (!productionKey) {
      throw new Error("Keychain returned an empty production key.");
    }
    console.log("Checking the production key with OpenAI…");
    await validateOpenAIKey(productionKey);
    console.log("Production key authenticated.");

    console.log(
      "Important: updating a Worker secret immediately creates and deploys a new Worker version.",
    );
    if (
      !(await confirm(
        "Upload the production key to the bradley-portfolio-preview Worker now?",
        reader,
      ))
    ) {
      console.log(
        "Production setup skipped. Run `npm run setup:chat` whenever you are ready to upload it.",
      );
      return false;
    }

    await ensureWranglerLogin(reader);
    console.log("Uploading the validated production key to Cloudflare…");
    await runWithInput(
      "npx",
      [
        "wrangler",
        "secret",
        "put",
        "OPENAI_API_KEY",
        "--config",
        "wrangler.preview.jsonc",
      ],
      productionKey,
    );
    console.log("Production key uploaded as an encrypted Worker secret.");
    return true;
  } finally {
    productionKey = undefined;
    await run(
      "/usr/bin/security",
      [
        "delete-generic-password",
        "-s",
        stagingService,
        "-a",
        DEVELOPMENT_KEYCHAIN_ACCOUNT,
      ],
      { stdio: "ignore" },
    ).catch(() => {
      console.warn(
        `Could not remove temporary Keychain item ${stagingService}; delete it manually.`,
      );
    });
  }
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error(
      "This setup wizard currently requires macOS because development keys are stored in Keychain.",
    );
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this setup wizard in an interactive terminal.");
  }

  console.log("Portfolio chat setup");
  console.log(
    "This creates two isolated credentials: one shared by local Conductor workspaces through macOS Keychain, and one encrypted in Cloudflare for the deployed site.",
  );
  console.log(
    "It does not use the BStack admin key, write a .env file, or print either secret.",
  );

  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await configureDevelopmentKey(reader);
    const productionConfigured = await configureProductionKey(reader);
    console.log("\nSetup complete.");
    console.log("Every checkout on this Mac can now start with `npm run dev`.");
    if (!productionConfigured) {
      console.log("The deployed Worker still needs its separate production key.");
    }
  } finally {
    reader.close();
  }
}

main().catch((error) => {
  console.error(`\nSetup stopped: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
