export const pitchStages = [
  "Signed exclusive",
  "Lost",
  "Open",
  "Passed",
] as const;

export type PitchStage = (typeof pitchStages)[number];
export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

export type Pitch = {
  determinationDate?: string;
  id: string;
  listedPrice?: number;
  lostTo?: string;
  pitchDate: string;
  property: string;
  soldPrice?: number;
  stage: PitchStage;
};

export type DashboardFilters = {
  lostTo: string;
  quarter: Quarter | "all";
  stages: readonly PitchStage[];
  year: number | "all";
};

export type DashboardSummary = {
  conversionRate: number;
  newListings: number;
  openPitches: number;
  pitches: number;
  signedExclusives: number;
};

export type QuarterTrend = {
  conversionRate: number;
  label: string;
  pitches: number;
  signedExclusives: number;
};

const DEFAULT_SEED = 20260529;
export const pitchCompetitors = [
  "Compass",
  "Douglas Elliman",
  "Corcoran",
  "Coldwell Banker",
  "Sotheby's Intl",
] as const;
const neighborhoods = [
  "SoHo",
  "Tribeca",
  "Chelsea",
  "West Village",
  "NoHo",
  "Upper West Side",
  "Brooklyn Heights",
  "Park Slope",
] as const;
const streetNames = [
  "Mercer",
  "Hudson",
  "Orchard",
  "Riverside",
  "Beacon",
  "Franklin",
  "Grove",
  "Lexington",
  "Alder",
  "Cedar",
] as const;
const streetTypes = ["Street", "Avenue", "Place", "Lane", "Court"] as const;
const periods: ReadonlyArray<{ quarter: Quarter; year: number }> = [
  { quarter: "Q3", year: 2024 },
  { quarter: "Q4", year: 2024 },
  { quarter: "Q1", year: 2025 },
  { quarter: "Q2", year: 2025 },
  { quarter: "Q3", year: 2025 },
  { quarter: "Q4", year: 2025 },
  { quarter: "Q1", year: 2026 },
  { quarter: "Q2", year: 2026 },
];

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function quarterNumber(quarter: Quarter) {
  return Number(quarter.slice(1));
}

function isoDate(year: number, monthIndex: number, dayOffset: number) {
  const date = new Date(Date.UTC(year, monthIndex, 1 + dayOffset));
  return date.toISOString().slice(0, 10);
}

function periodForPitch(pitch: Pitch) {
  const year = Number(pitch.pitchDate.slice(0, 4));
  const month = Number(pitch.pitchDate.slice(5, 7));
  return { quarter: `Q${Math.ceil(month / 3)}` as Quarter, year };
}

function moneyFrom(rng: () => number) {
  return Math.round((1_200_000 + rng() * 7_800_000) / 25_000) * 25_000;
}

function stageFor(rng: () => number, periodIndex: number): PitchStage {
  const roll = rng();
  const signedRate = 0.18 + periodIndex * 0.012;
  if (roll < signedRate) return "Signed exclusive";
  if (roll < 0.57) return "Lost";
  if (periodIndex === periods.length - 1 && roll < 0.82) return "Open";
  return "Passed";
}

export function generatePitchDataset(seed = DEFAULT_SEED): Pitch[] {
  const rng = createRng(seed);
  const generated: Pitch[] = [];

  periods.forEach(({ quarter, year }, periodIndex) => {
    const count = 32 + Math.floor(rng() * 17);
    const startMonth = (quarterNumber(quarter) - 1) * 3;

    for (let recordIndex = 0; recordIndex < count; recordIndex += 1) {
      const pitchDayOffset = Math.floor(rng() * 86);
      const stage = stageFor(rng, periodIndex);
      const determinationOffset = pitchDayOffset + 7 + Math.floor(rng() * 25);
      const listedPrice = stage === "Signed exclusive" ? moneyFrom(rng) : undefined;
      const propertyNumber = 10 + Math.floor(rng() * 1989);
      const street = streetNames[Math.floor(rng() * streetNames.length)];
      const streetType = streetTypes[Math.floor(rng() * streetTypes.length)];
      const neighborhood = neighborhoods[Math.floor(rng() * neighborhoods.length)];
      const record: Pitch = {
        id: `${year}-${quarter.toLowerCase()}-${String(recordIndex + 1).padStart(2, "0")}`,
        pitchDate: isoDate(year, startMonth, pitchDayOffset),
        property: `${propertyNumber} ${street} ${streetType}, ${neighborhood}`,
        stage,
      };

      if (stage !== "Open") {
        record.determinationDate = isoDate(year, startMonth, determinationOffset);
      }
      if (stage === "Signed exclusive") {
        record.listedPrice = listedPrice;
        if (listedPrice && rng() < 0.58) {
          record.soldPrice = Math.round((listedPrice * (0.92 + rng() * 0.12)) / 25_000) * 25_000;
        }
      }
      if (stage === "Lost") {
        record.lostTo = pitchCompetitors[Math.floor(rng() * pitchCompetitors.length)];
      }

      generated.push(record);
    }
  });

  return generated;
}

export function filterPitches(
  pitches: readonly Pitch[],
  filters: DashboardFilters,
): Pitch[] {
  return pitches.filter((pitch) => {
    const period = periodForPitch(pitch);
    if (filters.year !== "all" && period.year !== filters.year) return false;
    if (filters.quarter !== "all" && period.quarter !== filters.quarter) return false;
    if (filters.stages.length > 0 && !filters.stages.includes(pitch.stage)) return false;
    if (filters.lostTo !== "all" && pitch.lostTo !== filters.lostTo) return false;
    return true;
  });
}

export function summarizePitches(pitches: readonly Pitch[]): DashboardSummary {
  const signedExclusives = pitches.filter(
    (pitch) => pitch.stage === "Signed exclusive",
  ).length;
  const resolved = pitches.filter((pitch) => pitch.stage !== "Open").length;

  return {
    conversionRate: resolved === 0 ? 0 : Math.round((signedExclusives / resolved) * 1000) / 10,
    newListings: pitches.filter(
      (pitch) => pitch.stage === "Signed exclusive" && pitch.listedPrice,
    ).length,
    openPitches: pitches.filter((pitch) => pitch.stage === "Open").length,
    pitches: pitches.length,
    signedExclusives,
  };
}

export function buildQuarterTrend(pitches: readonly Pitch[]): QuarterTrend[] {
  const groups = new Map<string, Pitch[]>();
  for (const pitch of pitches) {
    const period = periodForPitch(pitch);
    const label = `${period.year} ${period.quarter}`;
    groups.set(label, [...(groups.get(label) ?? []), pitch]);
  }

  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, group]) => {
      const summary = summarizePitches(group);
      return {
        conversionRate: summary.conversionRate,
        label,
        pitches: summary.pitches,
        signedExclusives: summary.signedExclusives,
      };
    });
}

function csvField(value: string | number | undefined) {
  if (value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function pitchesToCsv(pitches: readonly Pitch[]) {
  const header = "Property,Pitched,Stage,Resolved,Listed,Sold,Lost to";
  const rows = pitches.map((pitch) =>
    [
      pitch.property,
      pitch.pitchDate,
      pitch.stage,
      pitch.determinationDate,
      pitch.listedPrice,
      pitch.soldPrice,
      pitch.lostTo,
    ]
      .map(csvField)
      .join(","),
  );
  return [header, ...rows].join("\n");
}
