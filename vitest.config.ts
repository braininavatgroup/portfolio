import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "next/link": fileURLToPath(
        new URL("./tests/stubs/next-link.tsx", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
  },
});
