type LocalWorkerConfig = {
  main: string;
  compatibility_flags: string[];
  d1_databases: never[];
  r2_buckets: never[];
  vars?: Record<string, string>;
  secrets?: { required: string[] };
  durable_objects?: {
    bindings: Array<{ name: string; class_name: string }>;
  };
  migrations?: Array<{ tag: string; new_sqlite_classes: string[] }>;
};

const baseLocalWorkerConfig: LocalWorkerConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [],
  r2_buckets: [],
};

export function getLocalWorkerConfig(
  command: "build" | "serve",
): LocalWorkerConfig {
  if (command === "build") return { ...baseLocalWorkerConfig };

  return {
    ...baseLocalWorkerConfig,
    vars: {
      PORTFOLIO_CHAT_LIVE_ENABLED: "true",
      PORTFOLIO_CHAT_TURNSTILE_REQUIRED: "false",
      PORTFOLIO_CHAT_DAILY_REQUEST_LIMIT: "200",
      OPENAI_PORTFOLIO_MODEL: "gpt-5.6-terra",
      OPENAI_PORTFOLIO_REASONING_EFFORT: "medium",
    },
    secrets: { required: ["OPENAI_API_KEY"] },
    durable_objects: {
      bindings: [
        {
          name: "PORTFOLIO_CHAT_BUDGET",
          class_name: "PortfolioChatBudgetObject",
        },
      ],
    },
    migrations: [
      {
        tag: "v1",
        new_sqlite_classes: ["PortfolioChatBudgetObject"],
      },
    ],
  };
}
