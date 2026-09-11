// Owns: the Airtable report adapter is read-only (GET only), requests exactly
// the projected fields, follows pagination, resolves linked records locally
// without guessing, rejects linked-field cardinality above one, and refuses
// malformed or duplicate campaign codes. Retire when Airtable no longer owns
// portfolio link assignments.
import { describe, expect, it } from "vitest";

import {
  AirtableConfigurationError,
  AirtableRequestError,
  FIELDS,
  JOB_SEARCH_BASE_ID,
  TABLES,
  fetchPortfolioAssignments,
  resolveAirtableToken,
} from "./portfolio-insights-airtable.mjs";

type AirtableRecord = { id: string; fields: Record<string, unknown> };
type Page = { records: AirtableRecord[]; offset?: string };

const TOKEN = "patSECRETsentinel.0123456789abcdef";

/** Serves pages keyed by table ID; each table's pages are returned in order. */
function stubAirtable(pages: Record<string, Page[]>) {
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const fetchImpl = async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    calls.push({ url, init });
    const tableId = url.pathname.split("/").at(-1) ?? "";
    const tablePages = pages[tableId] ?? [{ records: [] }];
    const offset = url.searchParams.get("offset");
    const index = offset ? Number(offset.replace(/^page-/u, "")) : 0;
    const body = tablePages[index] ?? { records: [] };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return { calls, fetchImpl };
}

function action(id: string, fields: Record<string, unknown>): AirtableRecord {
  return { id, fields: { Action: `Send portfolio ${id}`, State: "Done", ...fields } };
}

const people: Page[] = [
  { records: [{ id: "recPersonA", fields: { Name: "Ada Lovelace" } }], offset: "page-1" },
  { records: [{ id: "recPersonB", fields: { Name: "Grace Hopper" } }] },
];
const jobs: Page[] = [
  {
    records: [
      { id: "recJob1", fields: { Job: "Staff Designer", Stage: "Interviewing", "Outcome Reason": "Chose another candidate" } },
      { id: "recJob2", fields: { Job: "Design Lead", Stage: "Applied" } },
    ],
  },
];
const companies: Page[] = [
  { records: [{ id: "recCompany1", fields: { "Company Name": "Analytical Engines" } }] },
];

describe("fetchPortfolioAssignments", () => {
  it("issues only GET requests projecting exactly the listed fields for each table", async () => {
    const { calls, fetchImpl } = stubAirtable({
      [TABLES.Actions]: [{ records: [] }],
      [TABLES.People]: people,
      [TABLES.Jobs]: jobs,
      [TABLES.Companies]: companies,
    });

    await fetchPortfolioAssignments({ token: TOKEN, fetchImpl });

    expect(FIELDS).toEqual({
      Actions: [
        "Action", "State", "Person", "Job", "Company",
        "Portfolio Campaign Code", "Portfolio Link Sent", "Portfolio Link Channel", "Portfolio URL",
      ],
      People: ["Name"],
      Jobs: ["Job", "Stage", "Outcome Reason"],
      Companies: ["Company Name"],
    });
    expect(calls.length).toBeGreaterThan(0);
    const requestedTables = new Set<string>();
    for (const { url, init } of calls) {
      expect(init?.method).toBe("GET");
      expect(init?.body).toBeUndefined();
      expect(url.origin).toBe("https://api.airtable.com");
      const tableId = url.pathname.split("/").at(-1) ?? "";
      expect(url.pathname).toBe(`/v0/${JOB_SEARCH_BASE_ID}/${tableId}`);
      const tableName = Object.entries(TABLES).find(([, id]) => id === tableId)?.[0] as keyof typeof FIELDS;
      expect(tableName).toBeDefined();
      requestedTables.add(tableName);
      expect(url.searchParams.getAll("fields[]")).toEqual(FIELDS[tableName]);
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    }
    expect([...requestedTables].sort()).toEqual(["Actions", "Companies", "Jobs", "People"]);
  });

  it("percent-encodes repeated fields[] parameters and page offsets", async () => {
    const { calls, fetchImpl } = stubAirtable({
      [TABLES.Actions]: [{ records: [] }],
      [TABLES.People]: [{ records: [], offset: "itr/abc+def=" }],
    });

    await fetchPortfolioAssignments({ token: TOKEN, fetchImpl }).catch(() => {});

    const actionsUrl = calls.find(({ url }) => url.pathname.endsWith(TABLES.Actions))!.url;
    expect(actionsUrl.search).toContain("fields%5B%5D=Portfolio%20Campaign%20Code");
    expect(actionsUrl.search).not.toContain("fields[]");
    const secondPeoplePage = calls.filter(({ url }) => url.pathname.endsWith(TABLES.People))[1];
    expect(secondPeoplePage.url.search).toContain("offset=itr%2Fabc%2Bdef%3D");
  });

  it("follows Airtable offsets until the last page and joins linked records locally", async () => {
    const { calls, fetchImpl } = stubAirtable({
      [TABLES.Actions]: [
        {
          records: [
            action("recAction1", {
              Person: ["recPersonB"],
              Job: ["recJob1"],
              Company: ["recCompany1"],
              "Portfolio Campaign Code": "grace-hopper-01",
              "Portfolio Link Sent": "2026-09-10T15:00:00.000Z",
              "Portfolio Link Channel": "Email",
              "Portfolio URL": "https://bradleyberkman.com/?campaign=grace-hopper-01",
            }),
          ],
          offset: "page-1",
        },
        { records: [action("recAction2", { "Portfolio Campaign Code": "  " })] },
      ],
      [TABLES.People]: people,
      [TABLES.Jobs]: jobs,
      [TABLES.Companies]: companies,
    });

    const assignments = await fetchPortfolioAssignments({ token: TOKEN, fetchImpl });

    expect(calls.filter(({ url }) => url.pathname.endsWith(TABLES.Actions))).toHaveLength(2);
    expect(calls.filter(({ url }) => url.pathname.endsWith(TABLES.People))).toHaveLength(2);
    expect(assignments).toEqual([
      {
        actionRecordId: "recAction1",
        campaignCode: "grace-hopper-01",
        sentAt: "2026-09-10T15:00:00.000Z",
        channel: "Email",
        portfolioUrl: "https://bradleyberkman.com/?campaign=grace-hopper-01",
        action: "Send portfolio recAction1",
        state: "Done",
        person: {
          name: "Grace Hopper",
          airtableUrl: "https://airtable.com/app0LM9NfGL4ZHi3j/tblrJTH1gruJDCAVx/recPersonB",
        },
        company: "Analytical Engines",
        job: { title: "Staff Designer", stage: "Interviewing", outcome: "Chose another candidate" },
      },
    ]);
  });

  it("renders a Person-less Action as unassigned outreach and leaves unmapped links anonymous", async () => {
    const { fetchImpl } = stubAirtable({
      [TABLES.Actions]: [
        {
          records: [
            action("recUnassigned", { "Portfolio Campaign Code": "cold-outreach-1", Job: ["recJob2"] }),
            action("recUnmapped", {
              "Portfolio Campaign Code": "deleted-links-1",
              Person: ["recGonePerson"],
              Job: ["recGoneJob"],
              Company: ["recGoneCompany"],
            }),
          ],
        },
      ],
      [TABLES.People]: people,
      [TABLES.Jobs]: jobs,
      [TABLES.Companies]: companies,
    });

    const [unassigned, unmapped] = await fetchPortfolioAssignments({ token: TOKEN, fetchImpl });

    expect(unassigned).toMatchObject({
      campaignCode: "cold-outreach-1",
      person: null,
      company: null,
      sentAt: null,
      channel: "",
      portfolioUrl: "",
      job: { title: "Design Lead", stage: "Applied", outcome: null },
    });
    expect(unmapped).toMatchObject({ campaignCode: "deleted-links-1", person: null, company: null, job: null });
  });

  it("rejects an Action linked to more than one Person, Job, or Company", async () => {
    const { fetchImpl } = stubAirtable({
      [TABLES.Actions]: [
        {
          records: [
            action("recTwoPeople", {
              "Portfolio Campaign Code": "two-people-1",
              Person: ["recPersonA", "recPersonB"],
            }),
            action("recTwoJobs", { "Portfolio Campaign Code": "two-jobs-01", Job: ["recJob1", "recJob2"] }),
          ],
        },
      ],
      [TABLES.People]: people,
      [TABLES.Jobs]: jobs,
      [TABLES.Companies]: companies,
    });

    const error = await fetchPortfolioAssignments({ token: TOKEN, fetchImpl }).catch((caught) => caught);

    expect(error).toBeInstanceOf(AirtableConfigurationError);
    expect(error.problems).toEqual([
      "Action recTwoPeople links 2 Person records; expected at most one",
      "Action recTwoJobs links 2 Job records; expected at most one",
    ]);
  });

  it("refuses duplicate non-empty campaign codes instead of guessing an owner", async () => {
    const { fetchImpl } = stubAirtable({
      [TABLES.Actions]: [
        {
          records: [
            action("recFirst", { "Portfolio Campaign Code": "shared-code", Person: ["recPersonA"] }),
            action("recBlank1", { "Portfolio Campaign Code": "" }),
            action("recBlank2", {}),
            action("recSecond", { "Portfolio Campaign Code": "shared-code", Person: ["recPersonB"] }),
          ],
        },
      ],
      [TABLES.People]: people,
    });

    const attempt = fetchPortfolioAssignments({ token: TOKEN, fetchImpl });

    await expect(attempt).rejects.toBeInstanceOf(AirtableConfigurationError);
    await expect(attempt).rejects.toThrow("duplicate campaign code: shared-code");
  });

  it("treats a malformed campaign code as a configuration error", async () => {
    const { fetchImpl } = stubAirtable({
      [TABLES.Actions]: [
        {
          records: [
            action("recUpper", { "Portfolio Campaign Code": "Grace-Hopper" }),
            action("recShort", { "Portfolio Campaign Code": "abc" }),
            action("recGood", { "Portfolio Campaign Code": "good-code-1" }),
          ],
        },
      ],
    });

    const error = await fetchPortfolioAssignments({ token: TOKEN, fetchImpl }).catch((caught) => caught);

    expect(error).toBeInstanceOf(AirtableConfigurationError);
    expect(error.problems).toEqual([
      "malformed campaign code on Action recUpper",
      "malformed campaign code on Action recShort",
    ]);
  });

  it("rejects a non-2xx response without exposing the bearer token", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          error: { type: "UNKNOWN_FIELD_NAME", message: `Unknown field name: "Portfolio Campaign Code" (${TOKEN})` },
        }),
        { status: 422 },
      );

    const error = await fetchPortfolioAssignments({ token: TOKEN, fetchImpl }).catch((caught) => caught);

    expect(error).toBeInstanceOf(AirtableRequestError);
    expect(error.status).toBe(422);
    expect(error.message).toContain("HTTP 422");
    expect(error.message).toContain("UNKNOWN_FIELD_NAME");
    expect(error.message).not.toContain(TOKEN);
    expect(String(error.stack)).not.toContain(TOKEN);
  });

  it("rejects a network failure without exposing the bearer token", async () => {
    const fetchImpl = async () => {
      throw new TypeError(`fetch failed for Bearer ${TOKEN}`);
    };

    const error = await fetchPortfolioAssignments({ token: TOKEN, fetchImpl }).catch((caught) => caught);

    expect(error).toBeInstanceOf(AirtableRequestError);
    expect(error.message).not.toContain(TOKEN);
  });

  it("refuses to run without a token or with a malformed base ID", async () => {
    const { fetchImpl } = stubAirtable({});
    await expect(fetchPortfolioAssignments({ token: "", fetchImpl })).rejects.toThrow(/token/u);
    await expect(
      fetchPortfolioAssignments({ token: TOKEN, fetchImpl, baseId: "app0LM9/../x" }),
    ).rejects.toThrow(/base/u);
  });
});

describe("resolveAirtableToken", () => {
  it("prefers the dedicated read-only environment variable", async () => {
    const reads: string[][] = [];
    const token = await resolveAirtableToken({
      env: { PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN: "  pat-read  ", AIRTABLE_API_TOKEN: "pat-admin" },
      readKeychain: async (service, account) => {
        reads.push([service, account]);
        return "pat-keychain";
      },
    });
    expect(token).toBe("pat-read");
    expect(reads).toEqual([]);
  });

  it("falls back to the named Keychain entry and never uses the general admin token", async () => {
    const reads: string[][] = [];
    const token = await resolveAirtableToken({
      env: { AIRTABLE_API_TOKEN: "pat-admin" },
      readKeychain: async (service, account) => {
        reads.push([service, account]);
        return "pat-keychain\n";
      },
    });
    expect(token).toBe("pat-keychain");
    expect(reads).toEqual([["biv-portfolio-insights", "airtable-read-token"]]);
  });

  it("answers null when neither source holds a token", async () => {
    const token = await resolveAirtableToken({
      env: { AIRTABLE_API_TOKEN: "pat-admin" },
      readKeychain: async () => {
        throw new Error("The specified item could not be found in the keychain.");
      },
    });
    expect(token).toBeNull();
  });
});
