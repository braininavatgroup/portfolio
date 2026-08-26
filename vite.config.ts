import { sites } from "@openai/sites-vite-plugin";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json" with { type: "json" };
import { getLocalWorkerConfig } from "./lib/server/local-chat-config.js";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async ({ command }) => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const localBindingConfig = {
    ...getLocalWorkerConfig(command),
    d1_databases: d1
      ? [
          {
            binding: d1,
            database_name: "site-creator-d1",
            database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
          },
        ]
      : [],
    r2_buckets: r2
      ? [
          {
            binding: r2,
            bucket_name: "site-creator-r2",
          },
        ]
      : [],
  };

  return {
    build: {
      // Three.js is isolated in one lazy chunk. Its gzip size is tracked during verification.
      chunkSizeWarningLimit: 1000,
    },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    resolve: {
      alias: {
        // The Agents SDK's unused MCP OAuth client imports this package at its
        // top level. Its browser build uses Web Crypto and is Worker-compatible,
        // but the package does not declare a `workerd` export condition.
        "pkce-challenge": fileURLToPath(
          new URL(
            "./node_modules/pkce-challenge/dist/index.browser.js",
            import.meta.url,
          ),
        ),
      },
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
