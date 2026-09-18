// Read-only Airtable adapter for the portfolio insights report.
//
// Resolves which Job Search Action each assigned portfolio link belongs to,
// plus the Person, Job, and Company around it. It issues GET requests only and
// asks for exactly the fields in FIELDS. A campaign code identifies the Action
// a link was assigned to; it never proves who opened the link.
//
// Duplicate, malformed, or ambiguously linked codes are configuration problems:
// the whole read fails with AirtableConfigurationError rather than attributing
// activity by guessing. The token comes from PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN
// or the Keychain entry `scripts/setup-portfolio-insights.sh` writes, and is
// never included in an error message.
//
// Nothing here imports a Node builtin, so the scheduled Worker runs this exact
// adapter. That is also why `resolveAirtableToken` takes its Keychain reader
// rather than owning one: only the CLI has a Keychain to read.

export const JOB_SEARCH_BASE_ID = "app0LM9NfGL4ZHi3j";

export const TABLES = Object.freeze({
  Actions: "tblheGY3pSKmWvAS9",
  People: "tblrJTH1gruJDCAVx",
  Jobs: "tbl26VM6KauE1psyF",
  Companies: "tblUae2PS5xsjgUwQ",
});

export const FIELDS = Object.freeze({
  Actions: [
    "Action",
    "State",
    "Person",
    "Job",
    "Company",
    "Portfolio Campaign Code",
    "Portfolio Link Sent",
    "Portfolio Link Channel",
    "Portfolio URL",
  ],
  People: ["Name"],
  Jobs: ["Job", "Stage", "Outcome Reason"],
  Companies: ["Company Name"],
});

// Deliberately not AIRTABLE_API_TOKEN: that name holds a general-purpose
// administrative token in interactive shells, and the report must only ever
// hold the separate read-only credential.
export const AIRTABLE_TOKEN_ENV = "PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN";
export const AIRTABLE_KEYCHAIN = Object.freeze({
  service: "biv-portfolio-insights",
  account: "airtable-read-token",
});

const CAMPAIGN_CODE = /^[a-z0-9][a-z0-9_-]{5,63}$/u;
const BASE_ID = /^app[A-Za-z0-9]{14}$/u;
const API_ORIGIN = "https://api.airtable.com";
const PAGE_SIZE = 100;
const MAX_PAGES = 500;

/**
 * @typedef {{
 *   actionRecordId: string;
 *   campaignCode: string;
 *   sentAt: string | null;
 *   channel: string;
 *   portfolioUrl: string;
 *   action: string;
 *   state: string;
 *   person: { name: string; airtableUrl: string } | null;
 *   company: string | null;
 *   job: { title: string; stage: string; outcome: string | null } | null;
 * }} PortfolioAssignment
 *
 * @typedef {{ id: string; fields: Record<string, unknown> }} AirtableRecord
 * @typedef {keyof typeof TABLES} TableName
 * @typedef {(url: string, init: { method: "GET"; headers: Record<string, string> }) => Promise<Response>} FetchImpl
 */

/** A request to Airtable failed or answered something unusable. */
export class AirtableRequestError extends Error {
  /**
   * @param {string} message
   * @param {number | null} [status]
   */
  constructor(message, status = null) {
    super(message);
    this.name = "AirtableRequestError";
    this.status = status;
  }
}

/** Airtable answered, but its assignments cannot be joined without guessing. */
export class AirtableConfigurationError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(problems.join("; "));
    this.name = "AirtableConfigurationError";
    this.problems = problems;
  }
}

/**
 * The read-only token: the dedicated environment variable first, then the
 * named Keychain entry. Answers null when neither holds one.
 *
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   readKeychain?: (service: string, account: string) => Promise<string>;
 * }} [options]
 * @returns {Promise<string | null>}
 */
export async function resolveAirtableToken({ env = {}, readKeychain = noKeychain } = {}) {
  const fromEnvironment = env[AIRTABLE_TOKEN_ENV]?.trim();
  if (fromEnvironment) return fromEnvironment;
  try {
    const stored = (await readKeychain(AIRTABLE_KEYCHAIN.service, AIRTABLE_KEYCHAIN.account)).trim();
    return stored || null;
  } catch {
    return null;
  }
}

/** A caller that passed no reader has no Keychain, so the environment is all there is. */
async function noKeychain() {
  throw new Error("no Keychain reader was supplied");
}

/**
 * @param {{ token: string; fetchImpl?: FetchImpl; baseId?: string }} options
 * @returns {Promise<PortfolioAssignment[]>}
 */
export async function fetchPortfolioAssignments({
  token,
  fetchImpl = globalThis.fetch,
  baseId = JOB_SEARCH_BASE_ID,
}) {
  if (typeof token !== "string" || token.trim() === "") {
    throw new TypeError("An Airtable read token is required.");
  }
  if (!BASE_ID.test(baseId)) {
    throw new TypeError("The Airtable base ID is malformed.");
  }
  const read = (/** @type {TableName} */ table) => listRecords({ baseId, table, token, fetchImpl });

  const people = byId(await read("People"));
  const jobs = byId(await read("Jobs"));
  const companies = byId(await read("Companies"));
  const actions = await read("Actions");

  /** @type {string[]} */
  const problems = [];
  /** @type {Map<string, string>} */
  const ownerByCode = new Map();
  const reportedDuplicates = new Set();
  /** @type {PortfolioAssignment[]} */
  const assignments = [];

  for (const record of actions) {
    const fields = record.fields;
    const code = text(fields["Portfolio Campaign Code"]);
    if (!code) continue;
    if (!CAMPAIGN_CODE.test(code)) {
      problems.push(`malformed campaign code on Action ${record.id}`);
      continue;
    }
    if (ownerByCode.has(code)) {
      if (!reportedDuplicates.has(code)) problems.push(`duplicate campaign code: ${code}`);
      reportedDuplicates.add(code);
      continue;
    }
    ownerByCode.set(code, record.id);

    const personId = singleLink(record, "Person", problems);
    const jobId = singleLink(record, "Job", problems);
    const companyId = singleLink(record, "Company", problems);

    // A link to a record the projection did not return stays anonymous.
    const person = personId ? people.get(personId) : undefined;
    const job = jobId ? jobs.get(jobId) : undefined;
    const company = companyId ? companies.get(companyId) : undefined;

    assignments.push({
      actionRecordId: record.id,
      campaignCode: code,
      sentAt: text(fields["Portfolio Link Sent"]) || null,
      channel: text(fields["Portfolio Link Channel"]),
      portfolioUrl: text(fields["Portfolio URL"]),
      action: text(fields.Action),
      state: text(fields.State),
      person: person
        ? {
            name: text(person.fields.Name),
            airtableUrl: `https://airtable.com/${baseId}/${TABLES.People}/${encodeURIComponent(person.id)}`,
          }
        : null,
      company: company ? text(company.fields["Company Name"]) || null : null,
      job: job
        ? {
            title: text(job.fields.Job),
            stage: text(job.fields.Stage),
            outcome: text(job.fields["Outcome Reason"]) || null,
          }
        : null,
    });
  }

  if (problems.length > 0) throw new AirtableConfigurationError(problems);
  return assignments;
}

/**
 * @param {{ baseId: string; table: TableName; token: string; fetchImpl: FetchImpl }} options
 * @returns {Promise<AirtableRecord[]>}
 */
async function listRecords({ baseId, table, token, fetchImpl }) {
  /** @type {AirtableRecord[]} */
  const records = [];
  const seenOffsets = new Set();
  /** @type {string | undefined} */
  let offset;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = recordsUrl(baseId, TABLES[table], FIELDS[table], offset);
    /** @type {Response} */
    let response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
      });
    } catch (error) {
      throw new AirtableRequestError(
        redact(`Airtable ${table} request failed: ${messageOf(error)}`, token),
      );
    }
    if (!response.ok) {
      const detail = await errorDetail(response);
      throw new AirtableRequestError(
        redact(`Airtable ${table} request failed: HTTP ${response.status}${detail}`, token),
        response.status,
      );
    }
    /** @type {unknown} */
    let body;
    try {
      body = await response.json();
    } catch {
      throw new AirtableRequestError(`Airtable ${table} answered with invalid JSON`, response.status);
    }
    const pageBody = /** @type {{ records?: unknown; offset?: unknown } | null} */ (body);
    if (!pageBody || !Array.isArray(pageBody.records)) {
      throw new AirtableRequestError(`Airtable ${table} answered without a records list`, response.status);
    }
    for (const record of pageBody.records) {
      if (record && typeof record.id === "string") {
        records.push({ id: record.id, fields: record.fields && typeof record.fields === "object" ? record.fields : {} });
      }
    }
    if (typeof pageBody.offset !== "string" || pageBody.offset === "") return records;
    if (seenOffsets.has(pageBody.offset)) {
      throw new AirtableRequestError(`Airtable ${table} repeated a page offset`);
    }
    seenOffsets.add(pageBody.offset);
    offset = pageBody.offset;
  }
  throw new AirtableRequestError(`Airtable ${table} exceeded ${MAX_PAGES} pages`);
}

/**
 * @param {string} baseId
 * @param {string} tableId
 * @param {readonly string[]} fields
 * @param {string | undefined} offset
 */
function recordsUrl(baseId, tableId, fields, offset) {
  const parameters = [`pageSize=${PAGE_SIZE}`];
  for (const field of fields) parameters.push(`${encodeURIComponent("fields[]")}=${encodeURIComponent(field)}`);
  if (offset) parameters.push(`offset=${encodeURIComponent(offset)}`);
  return `${API_ORIGIN}/v0/${baseId}/${tableId}?${parameters.join("&")}`;
}

/** Airtable's error type and message, when the body carries them. */
async function errorDetail(/** @type {Response} */ response) {
  try {
    const body = await response.json();
    const error = body?.error;
    if (typeof error === "string") return ` ${error}`;
    const parts = [error?.type, error?.message].filter((part) => typeof part === "string" && part);
    return parts.length > 0 ? ` ${parts.join(": ").slice(0, 300)}` : "";
  } catch {
    return "";
  }
}

/**
 * @param {AirtableRecord} record
 * @param {"Person" | "Job" | "Company"} field
 * @param {string[]} problems
 * @returns {string | null}
 */
function singleLink(record, field, problems) {
  const value = record.fields[field];
  if (value == null) return null;
  if (!Array.isArray(value)) {
    problems.push(`Action ${record.id} has a malformed ${field} link`);
    return null;
  }
  if (value.length > 1) {
    problems.push(`Action ${record.id} links ${value.length} ${field} records; expected at most one`);
    return null;
  }
  return typeof value[0] === "string" ? value[0] : null;
}

/** @param {AirtableRecord[]} records */
function byId(records) {
  return new Map(records.map((record) => [record.id, record]));
}

/** @param {unknown} value */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string} message
 * @param {string} token
 */
function redact(message, token) {
  return message.split(token).join("[redacted]");
}
