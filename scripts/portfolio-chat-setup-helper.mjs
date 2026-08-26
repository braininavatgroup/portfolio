import { execFile, spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  DEVELOPMENT_KEYCHAIN_ACCOUNT,
  DEVELOPMENT_KEYCHAIN_SERVICE,
  readDevelopmentKeyFromKeychain,
  validateOpenAIKey,
} from "./portfolio-chat-environment.mjs";

const KEYCHAIN_LABEL = "Brain in a Vat portfolio development OpenAI key";
const execFileAsync = promisify(execFile);
const KEYCHAIN_WRITER = fileURLToPath(
  new URL("./store-keychain-secret.swift", import.meta.url),
);

export function runWithInput(command, args, input) {
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
    child.stdin.end(input);
  });
}

export async function validateProvidedOpenAIKey(
  pastedValue,
  { validate = validateOpenAIKey } = {},
) {
  const apiKey = pastedValue.trim();
  if (!apiKey) throw new Error("No OpenAI key was provided.");
  await validate(apiKey);
  return apiKey;
}

export async function storeDevelopmentKeyInKeychain(
  apiKey,
  { runWithInput: run = runWithInput } = {},
) {
  await run(
    "/usr/bin/xcrun",
    [
      "swift",
      "-suppress-warnings",
      KEYCHAIN_WRITER,
      DEVELOPMENT_KEYCHAIN_SERVICE,
      DEVELOPMENT_KEYCHAIN_ACCOUNT,
      KEYCHAIN_LABEL,
    ],
    apiKey,
  );
}

export async function verifyDevelopmentKeyInKeychain(
  apiKey,
  { readKeychain = readDevelopmentKeyFromKeychain } = {},
) {
  const storedKey = (
    await readKeychain({
      service: DEVELOPMENT_KEYCHAIN_SERVICE,
      account: DEVELOPMENT_KEYCHAIN_ACCOUNT,
    })
  ).trim();
  const expected = Buffer.from(apiKey);
  const actual = Buffer.from(storedKey);
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    throw new Error("Keychain did not preserve the complete OpenAI key.");
  }
}

export async function deleteDevelopmentKeyFromKeychain({
  execute = execFileAsync,
} = {}) {
  await execute("/usr/bin/security", [
    "delete-generic-password",
    "-s",
    DEVELOPMENT_KEYCHAIN_SERVICE,
    "-a",
    DEVELOPMENT_KEYCHAIN_ACCOUNT,
  ]);
}

function isMissingKeychainItem(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 44
  );
}

async function readOptionalDevelopmentKey(readKeychain) {
  try {
    return (
      await readKeychain({
        service: DEVELOPMENT_KEYCHAIN_SERVICE,
        account: DEVELOPMENT_KEYCHAIN_ACCOUNT,
      })
    ).trim();
  } catch (error) {
    if (isMissingKeychainItem(error)) return undefined;
    throw error;
  }
}

export async function replaceDevelopmentKeyInKeychain(
  apiKey,
  {
    readKeychain = readDevelopmentKeyFromKeychain,
    remove = deleteDevelopmentKeyFromKeychain,
    store = storeDevelopmentKeyInKeychain,
    verify = verifyDevelopmentKeyInKeychain,
  } = {},
) {
  const previousKey = await readOptionalDevelopmentKey(readKeychain);
  if (previousKey) await remove();

  try {
    await store(apiKey);
    await verify(apiKey);
  } catch (error) {
    await remove().catch((removeError) => {
      if (!isMissingKeychainItem(removeError)) throw removeError;
    });
    if (previousKey) {
      await store(previousKey);
      await verify(previousKey);
    }
    throw error;
  }
}

export async function configureDevelopmentKey(
  pastedValue,
  {
    validate = validateOpenAIKey,
    replace = replaceDevelopmentKeyInKeychain,
  } = {},
) {
  const apiKey = await validateProvidedOpenAIKey(pastedValue, { validate });
  await replace(apiKey);
}

async function readStandardInput() {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function main() {
  const command = process.argv[2];
  const input = await readStandardInput();

  if (command === "validate-openai-key") {
    await validateProvidedOpenAIKey(input);
    return;
  }
  if (command === "configure-development-key") {
    if (process.platform !== "darwin") {
      throw new Error("Development Keychain setup requires macOS.");
    }
    await configureDevelopmentKey(input);
    return;
  }
  throw new Error(
    "Expected validate-openai-key or configure-development-key.",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
