// The scheduled Worker's backend for an insights run's records: one R2 bucket,
// keyed under a prefix.
//
// What the records are, and how long each one lives, is
// `scripts/portfolio-insights-records.mjs` — the same module the local run
// uses, so the 180-day raw-event boundary and the last-known-good rules have
// one owner rather than a copy per runtime. This file only says where the
// records sit.
//
// Nothing here makes the bucket readable: it has no public domain and no
// custom domain, so R2's only reader is a Worker holding the binding, and the
// only Worker route that renders any of it is the Access-gated one in
// `portfolio-insights-job.ts`.

import { recordStore } from "../scripts/portfolio-insights-records.mjs";
// Type-only: the local backend owns the port's shape, and the import is erased,
// so nothing of its Node builtins reaches the Worker bundle.
import type { InsightStorage } from "../scripts/portfolio-insights-storage.mjs";

/** The key prefix every record of a run shares. Passed to the run as its `directory`. */
export const INSIGHTS_PREFIX = "runs/";

/** R2 `list` truncates; a run that has kept a raw entry per day needs every page. */
async function listKeys(bucket: R2Bucket, prefix: string) {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    for (const object of page.objects) names.push(object.key.slice(prefix.length));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return names;
}

/**
 * The storage port over one R2 bucket. `location` is the key prefix, which
 * lets the same bucket hold a separate set of records per caller — the
 * scheduled run uses `INSIGHTS_PREFIX`, and a comparison run against a
 * recorded window can use its own without touching the live ones.
 */
export function r2InsightStorage(bucket: R2Bucket): InsightStorage {
  return recordStore({
    // R2 has no directories to create, and no permissions to narrow: the
    // bucket is private because nothing is bound to it but this Worker.
    ensure: async () => {},
    describe: (location: string, name: string) => `${location}${name}`,
    read: async (location: string, name: string) => {
      const object = await bucket.get(`${location}${name}`);
      return object === null ? null : await object.text();
    },
    // A single `put` is R2's atomic replace: readers see the old value or the
    // new one, which is what makes the previous value a safe fallback.
    write: async (location: string, name: string, contents: string) => {
      await bucket.put(`${location}${name}`, contents);
    },
    list: (location: string) => listKeys(bucket, location),
    remove: async (location: string, name: string) => {
      await bucket.delete(`${location}${name}`);
    },
  });
}
