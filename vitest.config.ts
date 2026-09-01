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
    // 8 cores but only 8 GB, and the jsdom suites each load React, three.js and
    // @react-three/fiber. At vitest's default of one worker per core minus one,
    // memory pressure made roughly one run in three fail two to four tests — a
    // different set each time, all passing in isolation. Capping the pool fixes
    // the flake; it costs a few seconds of wall clock.
    maxWorkers: 3,
    minWorkers: 1,
    environment: "node",
    exclude: ["**/.context/**", "**/node_modules/**"],
    include: ["**/*.test.{ts,tsx}"],
  },
});
