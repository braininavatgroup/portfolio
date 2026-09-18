import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runInsights } from "../scripts/portfolio-insights-core.mjs";
import {
  FIXTURE_CURRENT_RUN,
  fixtureDependencies,
  fixtureHistoryRows,
} from "../scripts/portfolio-insights-fixture.mjs";
import { parseArguments } from "../scripts/portfolio-insights-report.mjs";
import * as localStorage from "../scripts/portfolio-insights-storage.mjs";
import { INSIGHTS_PREFIX, r2InsightStorage } from "./portfolio-insights-store";

// Failure this pins: BIV-527 moved this run from Bradley's Mac to a scheduled
// Worker on the promise that it is the same run — same sources, same report,
// same page — with only its records kept somewhere else. If the two backends
// drift, the dashboard he reads at the edge stops being the dashboard the CLI
// would have produced, and the acceptance comparison that proved the move
// stops meaning anything for every later run.
//
// This compares them over fixtures, so it fails on a code change rather than
// on a quiet day's traffic. The live row-for-row comparison is the one-time
// acceptance in BIV-527, not a repeatable check.
//
// Owner: scripts/portfolio-insights-records.mjs, which both backends share.
// Retire when only one backend is left.

/** An in-memory R2 bucket: get, put, delete, and a paginated prefixed list. */
function fakeBucket() {
  const objects = new Map<string, string>();
  return {
    objects,
    bucket: {
      get: async (key: string) => {
        const body = objects.get(key);
        return body === undefined ? null : { text: async () => body };
      },
      put: async (key: string, value: string) => {
        objects.set(key, value);
      },
      delete: async (key: string) => {
        objects.delete(key);
      },
      list: async ({ prefix = "" }: { prefix?: string } = {}) => ({
        objects: [...objects.keys()]
          .filter((key) => key.startsWith(prefix))
          .sort()
          .map((key) => ({ key })),
        truncated: false,
        cursor: undefined,
      }),
    } as unknown as R2Bucket,
  };
}

let directory: string;
let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "portfolio-insights-parity-"));
  directory = join(root, "insights");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

type Dependencies = Parameters<typeof runInsights>[1];

/**
 * The same run, over whichever backend and prior history it is given. The
 * fixture builder passes `storage` straight through its rest parameter, which
 * its inferred type does not carry, so the shape is asserted here.
 */
const run = (storage: typeof localStorage, location: string) =>
  runInsights(
    parseArguments([]),
    fixtureDependencies({ directory: location, now: FIXTURE_CURRENT_RUN, storage }) as unknown as Dependencies,
  );

/** Yesterday's history, so both runs have the same past to compare against. */
async function seedHistory(storage: typeof localStorage, location: string) {
  await storage.ensurePrivateDirectory(location);
  for (const row of fixtureHistoryRows()) await storage.appendHistoryRow(location, row);
}

describe("local and edge backends", () => {
  it("produce the same dashboard, history row and snapshots from the same sources", async () => {
    const { bucket, objects } = fakeBucket();
    const edge = r2InsightStorage(bucket) as unknown as typeof localStorage;

    await seedHistory(localStorage, directory);
    await seedHistory(edge, INSIGHTS_PREFIX);

    const local = await run(localStorage, directory);
    const remote = await run(edge, INSIGHTS_PREFIX);

    expect(remote.exitCode).toBe(local.exitCode);
    expect(remote.output).toBe(local.output);
    expect(remote.snapshot).toEqual(local.snapshot);

    // Every record the run wrote, byte for byte: the page Bradley reads, the
    // row the next run compares against, each source's last-known-good value,
    // and the event-level rows behind the journeys.
    const written = (await readdir(directory)).sort();
    expect(written).toContain("dashboard.html");
    expect(written.some((name) => name.startsWith("raw-events-"))).toBe(true);
    for (const name of written) {
      expect(objects.get(`${INSIGHTS_PREFIX}${name}`)).toBe(await readFile(join(directory, name), "utf8"));
    }
    expect([...objects.keys()].sort()).toEqual(written.map((name) => `${INSIGHTS_PREFIX}${name}`));
  });
});
