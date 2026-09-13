import { sites } from "@openai/sites-vite-plugin";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json" with { type: "json" };

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const TAILSCALE_DEV_HOST = "bradleys-macbook-air.tail847e36.ts.net";

// Reviewer feedback runs locally so the `?r=<code>` flow can be previewed.
// These two values sign and read local cookies and the local digest only;
// the password gate is off in development and the real Worker holds its own
// secrets. Override either through the environment when needed.
const LOCAL_FEEDBACK_SESSION_SECRET =
  process.env.PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET ??
  "local-development-only-reviewer-cookie-signing-secret";
const LOCAL_FEEDBACK_ADMIN_TOKEN =
  process.env.PORTFOLIO_FEEDBACK_ADMIN_TOKEN ??
  "local-development-only-feedback-admin-token-0000";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  vars: {
    PORTFOLIO_CHAT_SESSION_REQUIRED: "false",
    PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "1000",
    OPENAI_PORTFOLIO_MODEL: "gpt-5.6-sol",
    OPENAI_PORTFOLIO_REASONING_EFFORT: "low",
    OPENAI_PORTFOLIO_VERBOSITY: "low",
    PORTFOLIO_FEEDBACK_ENABLED: "true",
    PORTFOLIO_DESIGN_GALLERY_ENABLED: "true",
    PORTFOLIO_MAIN_PREVIEW_SESSION_SECRET: LOCAL_FEEDBACK_SESSION_SECRET,
    PORTFOLIO_FEEDBACK_ADMIN_TOKEN: LOCAL_FEEDBACK_ADMIN_TOKEN,
  },
  secrets: {
    required: ["OPENAI_API_KEY"],
  },
  durable_objects: {
    bindings: [
      {
        name: "PORTFOLIO_CHAT_BUDGET",
        class_name: "PortfolioChatBudgetObject",
      },
      {
        name: "PORTFOLIO_FEEDBACK",
        class_name: "PortfolioFeedbackObject",
      },
    ],
  },
  migrations: [
    {
      tag: "v1",
      new_sqlite_classes: ["PortfolioChatBudgetObject"],
    },
    {
      tag: "v2",
      new_sqlite_classes: ["PortfolioFeedbackObject"],
    },
  ],
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

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    build: {
      // Three.js is isolated in one lazy chunk. Its gzip size is tracked during verification.
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      // The Agents SDK exposes optional MCP transports from its root module.
      // Their PKCE helper has browser and Node exports but no Workerd export,
      // so Vite must leave it out of eager pre-bundling for the Worker graph.
      exclude: ["pkce-challenge"],
    },
    server: {
      allowedHosts: [TAILSCALE_DEV_HOST],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
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
