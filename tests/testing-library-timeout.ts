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

  // jsdom deliberately omits the canvas implementation. Components feature-
  // detect a missing context, so mirror that browser contract without emitting
  // one "not implemented" warning for every render. Paint-path tests replace
  // this stub with a recording context.
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => null,
  });

  // jsdom also omits ResizeObserver. Browser components may subscribe to it
  // while mounting even when a test does not need to drive a resize event.
  if (typeof globalThis.ResizeObserver === "undefined") {
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
      writable: true,
    });
  }

  // jsdom omits IntersectionObserver as well; Embla subscribes to it to learn
  // whether a carousel is in view. Nothing here ever reports an intersection.
  if (typeof globalThis.IntersectionObserver === "undefined") {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
      writable: true,
    });
  }

  // jsdom omits matchMedia too. Embla reads it while activating a carousel
  // and ReaderCarousel reads the reduced-motion preference through it. This
  // stub answers "no" to every query; a test that needs a match replaces it.
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (media: string): MediaQueryList => ({
        addEventListener() {},
        addListener() {},
        dispatchEvent: () => false,
        matches: false,
        media,
        onchange: null,
        removeEventListener() {},
        removeListener() {},
      }),
      writable: true,
    });
  }
}

export {};
