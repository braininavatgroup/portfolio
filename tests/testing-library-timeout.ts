/**
 * testing-library's async helpers default to a 1000ms budget and vitest's
 * per-test timeout to 5000ms. Both are wall-clock guesses, and on a machine
 * running 62 files across a worker per core neither survives contention: the
 * elements these tests wait for sit behind React.lazy boundaries, and a
 * starved worker can take several seconds to get back to the scheduler. The
 * failure mode is a correct assertion reported as a missing element, in a
 * different test each run.
 *
 * These are ceilings, not waits. A test that passes still finishes the instant
 * its element appears; only a genuinely broken one spends the budget. The
 * async budget stays well below the test timeout so a missing element reports
 * itself as a missing element rather than as an unexplained test timeout.
 */
if (typeof document !== "undefined") {
  const { configure } = await import("@testing-library/dom");
  configure({ asyncUtilTimeout: 10_000 });
}

export {};
