// Owns: the pure decisions inside the managed dashboard browser check —
// argument parsing, the run-scoped output path, the Clarity/Airtable anchor
// allowlist, section order, the own-file-only request rule, and the phone
// overflow and minimum text-size thresholds. The browser run itself is proven
// by running the script, not here. Retire with the HTML dashboard.
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ALLOWED_LINK_PREFIXES,
  SCENARIOS,
  SECTION_HEADINGS,
  anchorFailures,
  defaultOutputDir,
  headingOrderFailure,
  isAllowedHref,
  layoutFailures,
  parseArguments,
  runIdFor,
  unexpectedRequests,
} from "./verify-insights-dashboard.mjs";

describe("parseArguments", () => {
  it("reads --file and --output in either form", () => {
    expect(parseArguments(["--file", "a.html", "--output=out"])).toEqual({
      file: "a.html",
      output: "out",
      help: false,
    });
    expect(parseArguments(["--file=a.html"])).toMatchObject({ file: "a.html", output: null });
  });

  it("requires a file and rejects unknown or valueless flags", () => {
    expect(() => parseArguments([])).toThrow(/--file is required/);
    expect(() => parseArguments(["--file"])).toThrow(/--file needs a value/);
    expect(() => parseArguments(["--file", "--output", "x"])).toThrow(/--file needs a value/);
    expect(() => parseArguments(["--file", "a.html", "--url", "x"])).toThrow(/Unknown argument/);
  });

  it("allows --help without a file", () => {
    expect(parseArguments(["--help"]).help).toBe(true);
  });
});

describe("output location", () => {
  it("scopes each run under the workspace's biv-421 verification directory", () => {
    const runId = runIdFor(new Date("2026-09-11T16:40:05.123Z"));
    expect(runId).toBe("2026-09-11T16-40-05-123Z");
    expect(defaultOutputDir("/repo", runId)).toBe(
      path.join("/repo", ".context", "verification", "biv-421", runId),
    );
  });
});

describe("anchor allowlist", () => {
  const good = {
    href: `${ALLOWED_LINK_PREFIXES[0]}impressions`,
    target: "_blank",
    rel: "noreferrer",
  };

  it("accepts Clarity and Airtable links that open a new tab without a referrer", () => {
    expect(anchorFailures(good)).toEqual([]);
    expect(
      anchorFailures({ ...good, href: `${ALLOWED_LINK_PREFIXES[1]}tblPeople/rec1`, rel: "noopener NoReferrer" }),
    ).toEqual([]);
  });

  it("rejects look-alike hosts, other Clarity projects, relative, and script links", () => {
    for (const href of [
      "https://clarity.microsoft.com/projects/view/otherproj/",
      "https://clarity.microsoft.com.evil.test/projects/view/yatoiqtrjm/",
      "https://airtable.com/appOTHER/",
      "http://airtable.com/app0LM9NfGL4ZHi3j/",
      "#top",
      "javascript:alert(1)",
      null,
    ]) {
      expect(isAllowedHref(href)).toBe(false);
    }
  });

  it("reports a missing target or noreferrer", () => {
    expect(anchorFailures({ ...good, target: null })).toEqual([expect.stringMatching(/not _blank/)]);
    expect(anchorFailures({ ...good, rel: "noopener" })).toEqual([expect.stringMatching(/lacks noreferrer/)]);
  });
});

describe("section order", () => {
  it("passes when the seven sections appear in order among other headings", () => {
    expect(headingOrderFailure(["Summary", ...SECTION_HEADINGS])).toBeNull();
  });

  it("names the first section that is missing or out of order", () => {
    const swapped = [...SECTION_HEADINGS];
    [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
    expect(headingOrderFailure(swapped)).toMatch(/first missing "Content resonance"/);
    expect(headingOrderFailure(SECTION_HEADINGS.slice(0, 6))).toMatch(/first missing "Diagnostics"/);
  });
});

describe("requests", () => {
  it("allows only the dashboard file itself", () => {
    const file = "file:///tmp/dashboard.html";
    expect(unexpectedRequests([file, file], file)).toEqual([]);
    expect(unexpectedRequests([file, "https://fonts.example/a.css"], file)).toEqual(["https://fonts.example/a.css"]);
  });
});

describe("layout thresholds", () => {
  const fits = { viewportWidth: 390, scrollWidth: 391, clientWidth: 390, smallText: [] };

  it("tolerates one pixel of rounding at phone width", () => {
    expect(layoutFailures(fits, "open")).toEqual([]);
  });

  it("flags phone overflow but not desktop scroll width", () => {
    expect(layoutFailures({ ...fits, scrollWidth: 520 }, "open")).toEqual([
      expect.stringMatching(/overflows horizontally/),
    ]);
    expect(layoutFailures({ ...fits, viewportWidth: 1440, clientWidth: 1440, scrollWidth: 1600 }, "open")).toEqual(
      [],
    );
  });

  it("reports each element whose text renders below the minimum", () => {
    expect(
      layoutFailures({ ...fits, smallText: [{ selector: "span.note", px: 10, text: "tiny" }] }, "closed"),
    ).toEqual([expect.stringMatching(/span\.note renders text at 10px/)]);
  });
});

describe("scenarios", () => {
  it("covers desktop and phone in light and dark, light before dark at each width", () => {
    expect(SCENARIOS.map((scenario) => [scenario.viewport.width, scenario.colorScheme])).toEqual([
      [1440, "light"],
      [1440, "dark"],
      [390, "light"],
      [390, "dark"],
    ]);
  });
});
