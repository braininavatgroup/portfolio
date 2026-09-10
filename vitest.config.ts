import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "next/link": fileURLToPath(
        new URL("./tests/next-link.tsx", import.meta.url),
      ),
    },
  },
  test: {
    testTimeout: 30_000,
    setupFiles: ["./tests/testing-library-timeout.ts"],
    environment: "node",
    exclude: ["**/.context/**", "**/node_modules/**"],
    include: ["**/*.test.{ts,tsx}"],
  },
});
