import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const DEVELOPMENT_KEYCHAIN_SERVICE = "biv-openai-portfolio-dev";
export const DEVELOPMENT_KEYCHAIN_ACCOUNT = "api-key";

export async function readDevelopmentKeyFromKeychain({
  service = DEVELOPMENT_KEYCHAIN_SERVICE,
  account = DEVELOPMENT_KEYCHAIN_ACCOUNT,
} = {}) {
  const { stdout } = await execFileAsync(
    "/usr/bin/security",
    ["find-generic-password", "-s", service, "-a", account, "-w"],
    { encoding: "utf8" },
  );
  return stdout;
}

/**
 * @param {string} apiKey
 * @param {(input: string | URL, init?: RequestInit) => Promise<{
 *   ok: boolean;
 *   status: number;
 *   body?: { cancel(): Promise<void> } | null;
 * }>} [fetchImplementation]
 */
export async function validateOpenAIKey(
  apiKey,
  fetchImplementation = fetch,
) {
  const response = await fetchImplementation("https://api.openai.com/v1/models", {
    method: "GET",
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  try {
    if (!response.ok) {
      throw new Error(`OpenAI rejected the key (HTTP ${response.status}).`);
    }
  } finally {
    await response.body?.cancel().catch(() => {});
  }
}

/**
 * @param {{
 *   environment?: Record<string, string | undefined>;
 *   platform?: string;
 *   readKeychain?: (input: { service: string; account: string }) => Promise<string>;
 * }} [options]
 */
export async function resolveDevelopmentOpenAIKey({
  environment = process.env,
  platform = process.platform,
  readKeychain = readDevelopmentKeyFromKeychain,
} = {}) {
  const explicitKey = environment.OPENAI_API_KEY?.trim();
  if (explicitKey) return explicitKey;

  if (platform !== "darwin") {
    throw new Error(
      "OPENAI_API_KEY is required to run the portfolio chat outside macOS.",
    );
  }

  try {
    const key = (await readKeychain({
      service: DEVELOPMENT_KEYCHAIN_SERVICE,
      account: DEVELOPMENT_KEYCHAIN_ACCOUNT,
    })).trim();
    if (key) return key;
  } catch {
    // The setup message below is the useful error for every Keychain failure.
  }

  throw new Error(
    "The portfolio development key is not configured. Run `npm run setup:chat` once, then retry.",
  );
}
