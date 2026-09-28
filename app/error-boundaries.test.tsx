// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const reportPageError = vi.hoisted(() => vi.fn());
vi.mock("../lib/page-error-beacon", () => ({ reportPageError }));

import GlobalError from "./global-error";
import RouteError from "./error";

afterEach(() => {
  cleanup();
  reportPageError.mockReset();
});

// A render error caught by a boundary never reaches window.onerror, so the
// boundaries report it themselves.
describe("error boundaries", () => {
  it("the route boundary reports the error it caught", () => {
    const error = new TypeError("reader failed");
    render(<RouteError error={error} reset={() => {}} />);
    expect(reportPageError).toHaveBeenCalledWith(error);
  });

  it("the global boundary reports the error it caught", () => {
    const error = new TypeError("layout failed");
    render(<GlobalError error={error} reset={() => {}} />, { container: document.documentElement });
    expect(reportPageError).toHaveBeenCalledWith(error);
  });
});
