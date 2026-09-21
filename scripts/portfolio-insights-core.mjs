// One portfolio insights run, with every effect behind an injected port.
//
// Nothing in this module touches a filesystem, a Keychain, a clock, or
// `process`: the caller passes a `storage` implementing the port documented in
// `portfolio-insights-storage.mjs`, a `readContent` for the portfolio catalog,
// token resolvers, and `now`. The CLI binds those to the Mac's private
// directory and login Keychain; the scheduled Worker binds them to R2 and
// Worker secrets. Both then read the same sources through the same code, which
// is what makes a Worker run and a local run comparable row for row.
//
// The behaviour — per-source last-known-good, configuration errors that never
// fall back, stale journeys that are never counted as zero, and the write
// order snapshots → raw events → history → dashboard → prune — is described
// where it is implemented below.

import { AirtableConfigurationError, resolveAirtableToken } from "./portfolio-insights-airtable.mjs";
import { renderDashboard } from "./portfolio-insights-dashboard.mjs";
import {
  buildPortfolioIntelligence,
  contentCatalogFromPortfolioContent,
  summarizeForHistory,
} from "./portfolio-insights-intelligence.mjs";
import {
  deriveBelievable,
  formatHistory,
  formatLead,
  formatReport,
  historyRow,
  INSIGHT_EVENT_LIMIT,
  readInsightEventRows,
  windowForDays,
} from "./portfolio-insights-report.mjs";
import { CLARITY_PROJECT, liveFetchers, SITE_HOST } from "./portfolio-insights-sources.mjs";

/** @typedef {import("./portfolio-insights-storage.mjs").InsightStorage} InsightStorage */

export const KEYCHAIN_SERVICE = "biv-portfolio-insights";
// Older entries written by hand before `setup:insights` existed. Read as a
// fallback so a token that already works keeps working.
const LEGACY_KEYCHAIN_ENTRIES = {
  "cloudflare-api-token": [{ service: "biv-cloudflare-analytics", account: "api-token" }],
};

/**
 * One token: the environment first, then the Keychain entries the local setup
 * writes. A caller with no Keychain — the scheduled Worker — passes a reader
 * that throws, and every token then comes from its secrets through `env`.
 * @param {{ env: Record<string, string | undefined>, readKeychain: (service: string, account: string) => Promise<string> }} access
 * @param {string} environmentVariable
 * @param {string} account
 */
async function resolveToken({ env, readKeychain }, environmentVariable, account) {
  const fromEnvironment = env[environmentVariable]?.trim();
  if (fromEnvironment) return fromEnvironment;
  const entries = [
    { service: KEYCHAIN_SERVICE, account },
    ...(LEGACY_KEYCHAIN_ENTRIES[account] ?? []),
  ];
  for (const entry of entries) {
    try {
      const stored = (await readKeychain(entry.service, entry.account)).trim();
      if (stored) return stored;
    } catch {
      // Try the next entry; the missing-token message is the same either way.
    }
  }
  return null;
}

const SKIP_FLAGS = {
  clarity: "--no-clarity",
  cloudflare: "--no-cloudflare",
  insights: "--no-insights",
  airtable: "--no-airtable",
};

/** Findings that come from this run's Clarity and Cloudflare signals, not from event rows. */
const SOURCE_FINDING_KINDS = new Set(["frustration", "error", "performance"]);

const ANALYTICS_ENGINE_CAPABILITY =
  "Analytics Engine unavailable (needs Account Analytics Read on the Cloudflare token " +
  "and a deployment with PORTFOLIO_INSIGHT_EVENTS_SINK=analytics-engine)";

const CHAT_UNAVAILABLE_LOCALLY = "Guide transcripts are kept in the scheduled run's private bucket; read them at the insights dashboard";

/**
 * The Guide transcripts for this window, as a source state. Unlike the other
 * sources there is no last-known-good copy: transcripts are the store itself,
 * so a failed read is simply unavailable.
 * @param {{ read: (range: { start: string, end: string }) => Promise<Array<Record<string, any>>> } | undefined} port
 * @param {{ start: string, end: string }} range
 * @param {string} capturedAt
 * @param {boolean} offline
 */
async function resolveChatState(port, range, capturedAt, offline) {
  if (!port || offline) return { status: "unavailable", capturedAt: null, value: null, error: CHAT_UNAVAILABLE_LOCALLY };
  try {
    const turns = await port.read(range);
    return { status: "fresh", capturedAt, value: { turns } };
  } catch (error) {
    return { status: "unavailable", capturedAt: null, value: null, error: `transcripts: ${messageOf(error)}` };
  }
}

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function missingToken(name, account, where) {
  return new Error(
    `no token. Set ${name}, or run \`npm run setup:insights\` to store one ` +
      `in the Keychain (${KEYCHAIN_SERVICE} / ${account}). Mint it at ${where}.`,
  );
}

/** The last run's aggregate intelligence summary, which findings compare against. */
function previousSummary(rows) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const summary = rows[index]?.intelligence;
    if (summary && typeof summary === "object" && summary.version === 1) return summary;
  }
  return null;
}

/**
 * One source's state for this run. A skipped source shows its saved value
 * (unless `useSaved` is false). A fetch that answers is written as the new
 * last-known-good only after it returned a parsed value; a request failure
 * leaves the file alone and falls back to it.
 *
 * A configuration error (`isConfigurationError`) is not a request failure:
 * the saved value rests on the same broken configuration, so the file is
 * replaced by the problems. A stored configuration error then outranks any
 * saved value through skips, rebuilds, and outages, and the source stays
 * unavailable with those problems until a fetch parses cleanly.
 */
async function resolveSourceState({
  name,
  fetch,
  directory,
  capturedAt,
  record,
  storage,
  useSaved = true,
  isConfigurationError = () => false,
  onConfigurationErrors = () => {},
  describe = messageOf,
}) {
  const saved = useSaved ? await storage.readSourceSnapshot(directory, name) : null;
  const blocked = saved?.configurationErrors?.length ? saved.configurationErrors : null;
  const refuse = (problems) => {
    onConfigurationErrors(problems);
    return { status: "unavailable", capturedAt: null, value: null, error: problems.join("; ") };
  };
  if (!fetch) {
    if (blocked) return refuse(blocked);
    return storage.resolveSourceResult({
      previous: saved,
      error: saved ? undefined : `not requested (${SKIP_FLAGS[name]})`,
      capturedAt,
    });
  }
  let fresh;
  try {
    fresh = await fetch();
    if (fresh === undefined || fresh === null) throw new Error(`${name} answered nothing`);
  } catch (error) {
    if (isConfigurationError(error)) {
      const listed = Array.isArray(error?.problems) ? error.problems.filter((problem) => typeof problem === "string" && problem) : [];
      const problems = listed.length > 0 ? listed : [messageOf(error)];
      if (record) await storage.writeSourceConfigurationError(directory, name, problems, capturedAt);
      return refuse(problems);
    }
    if (blocked) return refuse(blocked);
    return storage.resolveSourceResult({ previous: saved, error: describe(error), capturedAt });
  }
  if (record) await storage.writeSourceSnapshot(directory, name, fresh, capturedAt);
  return storage.resolveSourceResult({ fresh, previous: saved, capturedAt });
}

/**
 * The event-level rows journeys come from. Fresh when the read decodes;
 * otherwise the newest raw-events file inside retention, shown as stale;
 * otherwise unavailable, and `events` is null so nothing reads it as zero.
 */
async function resolveEvents({ fetch, directory, capturedAt, storage }) {
  let error;
  if (fetch) {
    try {
      const rows = await fetch();
      if (!Array.isArray(rows)) throw new Error("Analytics Engine answered without event rows");
      const { events, truncated } = readInsightEventRows(rows);
      return { status: "fresh", capturedAt, events, truncated };
    } catch (failure) {
      error = `${ANALYTICS_ENGINE_CAPABILITY}: ${messageOf(failure)}`.slice(0, 300);
    }
  }
  const latest = await storage.readLatestRawEvents(directory, capturedAt);
  if (latest) {
    return {
      status: "stale",
      capturedAt: latest.capturedAt,
      events: latest.events,
      // Raw files written before the flag was stored fall back to a full page.
      truncated: typeof latest.truncated === "boolean" ? latest.truncated : latest.events.length >= INSIGHT_EVENT_LIMIT,
      ...(error ? { error } : {}),
    };
  }
  return {
    status: "unavailable",
    capturedAt: null,
    events: null,
    truncated: false,
    error: error ?? `not requested (${SKIP_FLAGS.insights})`,
  };
}

/** A source's value for display, or null. */
const shown = (state) => (state.status !== "unavailable" ? state.value : null);
/** A source's value only when this run measured it, for history. */
const measured = (state) => (state.status === "fresh" ? state.value : null);

/**
 * One insights run: resolve every source, derive intelligence, write the
 * records in their safe order, and return the terminal output and exit code.
 *
 * Every dependency is required, because this module has no ambient ones. Each
 * caller states where the run reads its tokens and where it keeps its records:
 * `scripts/portfolio-insights.mjs` binds them to the Mac, and
 * `worker/portfolio-insights-job.ts` binds them to Worker secrets and R2.
 *
 * `directory` is opaque here — a path for the CLI's storage, a key prefix for
 * the Worker's — and is only ever handed back to `storage`.
 *
 * @param {import("./portfolio-insights-report.mjs").InsightOptions} options
 * @param {{
 *   directory: string | URL,
 *   storage: InsightStorage,
 *   env: Record<string, string | undefined>,
 *   readKeychain: (service: string, account: string) => Promise<string>,
 *   readContent: () => Promise<unknown>,
 *   now?: () => Date,
 *   fetchers?: Partial<typeof liveFetchers>,
 *   chatTranscripts?: {
 *     read: (range: { start: string, end: string }) => Promise<Array<Record<string, any>>>,
 *     prune: (now: Date) => Promise<void>,
 *   },
 * }} dependencies
 */
export async function runInsights(options, dependencies) {
  const { env, readKeychain, readContent, storage, directory } = dependencies;
  const fetchers = { ...liveFetchers, ...dependencies.fetchers };
  const now = dependencies.now ?? (() => new Date());

  if (options.history) {
    const rows = await storage.readHistory(directory);
    return {
      exitCode: 0,
      output: options.json ? `${JSON.stringify(rows, null, 2)}\n` : `${formatHistory(rows).join("\n")}\n`,
      snapshot: null,
      dashboardPath: null,
    };
  }

  const started = now();
  const capturedAt = started.toISOString();
  const range = windowForDays(options.days, started);
  // --dashboard with neither Cloudflare nor Clarity rebuilds the page from
  // what is on disk: no source is requested and no run is recorded.
  const offline = options.dashboard && !options.cloudflare && !options.clarity;
  const record = options.snapshot && !offline;
  if (record) await storage.ensurePrivateDirectory(directory);

  const access = { env, readKeychain };
  const cloudflareToken = async () =>
    (await resolveToken(access, "CLOUDFLARE_API_TOKEN", "cloudflare-api-token")) ??
    Promise.reject(missingToken("CLOUDFLARE_API_TOKEN", "cloudflare-api-token", "https://dash.cloudflare.com/profile/api-tokens"));
  const clarityToken = async () =>
    (await resolveToken(access, "CLARITY_API_TOKEN", "clarity-api-token")) ??
    Promise.reject(
      missingToken("CLARITY_API_TOKEN", "clarity-api-token", `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT}/settings`),
    );
  const airtableToken = async () =>
    (await resolveAirtableToken({ env, readKeychain })) ??
    Promise.reject(missingToken("PORTFOLIO_INSIGHTS_AIRTABLE_TOKEN", "airtable-read-token", "https://airtable.com/create/tokens"));

  const shared = { directory, capturedAt, record, storage };
  const clarity = await resolveSourceState({
    ...shared,
    name: "clarity",
    // Clarity's export API reaches back three days at most, whatever --days says.
    fetch: options.clarity ? async () => fetchers.clarity(await clarityToken(), Math.min(3, options.days)) : null,
  });
  const cloudflare = await resolveSourceState({
    ...shared,
    name: "cloudflare",
    fetch: options.cloudflare ? async () => fetchers.cloudflare(await cloudflareToken(), range) : null,
  });
  const readInsights = options.insights && !offline;
  const insights = await resolveSourceState({
    ...shared,
    name: "insights",
    fetch: readInsights ? async () => fetchers.insightAggregates(await cloudflareToken(), range) : null,
    describe: (error) => `${ANALYTICS_ENGINE_CAPABILITY}: ${messageOf(error)}`,
  });
  /** @type {string[]} */
  let airtableProblems = [];
  const airtable = await resolveSourceState({
    ...shared,
    name: "airtable",
    fetch: options.airtable && !offline ? async () => fetchers.airtable(await airtableToken()) : null,
    // --no-airtable means no identity at all, not yesterday's identity.
    useSaved: options.airtable,
    // A duplicate or malformed code makes every saved join suspect too.
    isConfigurationError: (error) => error instanceof AirtableConfigurationError,
    onConfigurationErrors: (problems) => {
      airtableProblems = problems;
    },
  });
  const events = await resolveEvents({
    ...shared,
    fetch: readInsights ? async () => fetchers.insightEvents(await cloudflareToken(), range) : null,
  });

  // Guide transcripts live only in the Worker's bucket, so a local run has no
  // port and says so rather than reporting an empty window.
  const chat = await resolveChatState(dependencies.chatTranscripts, range, capturedAt, offline);

  const history = await storage.readHistory(directory);
  let catalog = {};
  try {
    catalog = contentCatalogFromPortfolioContent(await readContent());
  } catch {
    // Labels fall back to content IDs.
  }
  const reportWindow = { ...range, label: `${range.start.slice(0, 10)} → ${range.end.slice(0, 10)}` };
  const derive = (eventRows) =>
    buildPortfolioIntelligence({
      events: eventRows,
      assignments: airtable,
      contentCatalog: catalog,
      clarity,
      cloudflare,
      previous: previousSummary(history),
      window: reportWindow,
    });
  const intelligence = derive(events.events);
  // History records journeys only when this run read them; stale or missing
  // rows go in as `events: null`, which summarizes as unavailable, never zero.
  const recordedIntelligence = events.status === "fresh" ? intelligence : derive(null);
  // Stale journeys still show, labelled with the raw file's capture time, but
  // they are not evidence about this window: only findings from this run's
  // Clarity and Cloudflare signals survive.
  const shownIntelligence =
    events.status === "fresh"
      ? intelligence
      : { ...intelligence, findings: intelligence.findings.filter((finding) => SOURCE_FINDING_KINDS.has(finding.kind)) };

  const aggregate = shown(insights);
  const raw = events.events ? { truncated: events.truncated, eventCount: events.events.length } : null;
  const insightsError = events.error ?? (insights.error ? `aggregate counts: ${insights.error}` : undefined);
  const cloudflareValue = shown(cloudflare);
  const clarityValue = shown(clarity);
  const legacy = (state) => shown(state) ?? { error: state.error ?? "unavailable" };

  const snapshot = {
    capturedAt,
    site: SITE_HOST,
    window: range,
    sources: {
      clarity,
      cloudflare,
      // Journeys are what the dashboard's Analytics Engine sections show, so
      // this state follows the event-level read; aggregate counts ride along.
      insights: {
        status: events.status,
        capturedAt: events.capturedAt,
        value: raw ? { ...(aggregate ?? {}), raw } : null,
        ...(insightsError ? { error: insightsError } : {}),
      },
      airtable,
      chat,
    },
    clarity: legacy(clarity),
    cloudflare: legacy(cloudflare),
    insights: aggregate ? { ...aggregate, ...(raw ? { raw } : {}) } : { error: insights.error ?? "unavailable" },
    believable: deriveBelievable({
      shape: cloudflareValue?.shape,
      dimensions: cloudflareValue?.dimensions,
      clarity: clarityValue,
    }),
    intelligence: events.status === "unavailable" ? null : shownIntelligence,
  };
  const configurationErrors = [
    ...new Set([...airtableProblems, ...(snapshot.intelligence?.diagnostics?.configurationErrors ?? [])]),
  ];
  // Not an error: a code no Action carries is an old, retired, or forwarded
  // link. Its activity is already anonymous; the lead only names it.
  const unmappedCampaigns = snapshot.intelligence?.diagnostics?.unmappedCampaigns ?? [];

  // The history row holds only what this run measured, in aggregate.
  const measuredCloudflare = measured(cloudflare);
  const measuredClarity = measured(clarity);
  const row = {
    ...historyRow({
      capturedAt,
      window: range,
      cloudflare: measuredCloudflare ?? undefined,
      clarity: measuredClarity ?? undefined,
      insights: measured(insights) ?? undefined,
      believable: deriveBelievable({
        shape: measuredCloudflare?.shape,
        dimensions: measuredCloudflare?.dimensions,
        clarity: measuredClarity,
      }),
    }),
    sources: {
      clarity: clarity.status,
      cloudflare: cloudflare.status,
      insights: insights.status,
      journeys: events.status,
      airtable: airtable.status,
      chat: chat.status,
    },
    ...(chat.status === "fresh" ? { chatTurns: chat.value.turns.length } : {}),
    intelligence: summarizeForHistory(recordedIntelligence),
  };

  // Write order: source snapshots (above) → raw events → history → dashboard → prune.
  if (record && events.status === "fresh") {
    await storage.writeRawEvents(directory, events.events, capturedAt, {
      truncated: events.truncated,
      windowStart: range.start,
    });
  }
  if (record) await storage.appendHistoryRow(directory, row);
  let dashboardPath = null;
  if (record || options.dashboard) {
    await storage.ensurePrivateDirectory(directory);
    const page = renderDashboard({ snapshot, history: record ? [...history, row] : history, generatedAt: capturedAt });
    dashboardPath = await storage.writeDashboard(directory, page);
  }
  // Only after history and the dashboard both landed: an aborted run keeps
  // every raw file it may not have summarised yet.
  if (record) await storage.pruneRawSnapshots(directory, started);
  if (record && dependencies.chatTranscripts) {
    // Retention holds even when today's read failed.
    await dependencies.chatTranscripts.prune(started).catch(() => {});
  }

  const useful =
    [clarity, cloudflare, insights].some((state) => state.status !== "unavailable") || events.status !== "unavailable";
  let output;
  if (options.json) output = `${JSON.stringify(snapshot, null, 2)}\n`;
  else if (offline) output = `${dashboardPath}\n`;
  else output = `${formatLead(snapshot, { configurationErrors, unmappedCampaigns })}${formatReport(snapshot)}`;
  return { exitCode: useful ? 0 : 1, output, snapshot, dashboardPath };
}
