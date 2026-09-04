import { describe, expect, it } from "vitest";
import {
  buildQuarterTrend,
  filterPitches,
  generatePitchDataset,
  pitchesToCsv,
  summarizePitches,
  type Pitch,
} from "./quarterly-dashboard";

const pitches: Pitch[] = [
  {
    determinationDate: "2026-04-18",
    id: "pitch-1",
    listedPrice: 4_500_000,
    pitchDate: "2026-04-03",
    property: "12 Mercer Street, SoHo",
    soldPrice: 4_350_000,
    stage: "Signed exclusive",
  },
  {
    determinationDate: "2026-05-02",
    id: "pitch-2",
    listedPrice: 3_250_000,
    pitchDate: "2026-04-14",
    property: "88 Hudson Avenue, Tribeca",
    stage: "Signed exclusive",
  },
  {
    determinationDate: "2026-05-20",
    id: "pitch-3",
    lostTo: "Compass",
    pitchDate: "2026-05-01",
    property: "40 Orchard Place, Chelsea",
    stage: "Lost",
  },
  {
    id: "pitch-4",
    pitchDate: "2026-06-11",
    property: "7 Riverside Lane, West Village",
    stage: "Open",
  },
  {
    determinationDate: "2025-12-20",
    id: "pitch-5",
    lostTo: "Corcoran",
    pitchDate: "2025-11-10",
    property: "3 Beacon Court, NoHo",
    stage: "Lost",
  },
];

describe("quarterly dashboard data", () => {
  it("replays the same generated records for the same seed", () => {
    expect(generatePitchDataset(42)).toEqual(generatePitchDataset(42));
    expect(generatePitchDataset(42)).not.toEqual(generatePitchDataset(43));
  });

  it("covers eight quarters and keeps stage-specific fields valid", () => {
    const generated = generatePitchDataset(20260529);
    const periods = new Set(
      generated.map((pitch) => {
        const month = Number(pitch.pitchDate.slice(5, 7));
        return `${pitch.pitchDate.slice(0, 4)} Q${Math.ceil(month / 3)}`;
      }),
    );

    expect([...periods]).toEqual([
      "2024 Q3",
      "2024 Q4",
      "2025 Q1",
      "2025 Q2",
      "2025 Q3",
      "2025 Q4",
      "2026 Q1",
      "2026 Q2",
    ]);
    expect(new Set(generated.map((pitch) => pitch.stage))).toEqual(
      new Set(["Signed exclusive", "Lost", "Open", "Passed"]),
    );

    for (const pitch of generated) {
      if (pitch.stage === "Signed exclusive") {
        expect(pitch.determinationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(pitch.listedPrice).toBeGreaterThan(0);
        expect(pitch.lostTo).toBeUndefined();
      } else if (pitch.stage === "Lost") {
        expect(pitch.determinationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(pitch.lostTo).toBeTruthy();
        expect(pitch.listedPrice).toBeUndefined();
      } else if (pitch.stage === "Open") {
        expect(pitch.determinationDate).toBeUndefined();
        expect(pitch.lostTo).toBeUndefined();
      } else {
        expect(pitch.determinationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(pitch.lostTo).toBeUndefined();
        expect(pitch.listedPrice).toBeUndefined();
      }
    }
  });

  it("composes year, quarter, stage, and competitor filters", () => {
    expect(
      filterPitches(pitches, {
        lostTo: "Compass",
        quarter: "Q2",
        stages: ["Lost"],
        year: 2026,
      }),
    ).toEqual([pitches[2]]);
  });

  it("calculates conversion from resolved pitches only", () => {
    expect(summarizePitches(pitches.slice(0, 4))).toEqual({
      conversionRate: 66.7,
      newListings: 2,
      openPitches: 1,
      pitches: 4,
      signedExclusives: 2,
    });
  });

  it("orders quarter trends chronologically", () => {
    expect(buildQuarterTrend([pitches[0], pitches[4]])).toEqual([
      {
        conversionRate: 0,
        label: "2025 Q4",
        pitches: 1,
        signedExclusives: 0,
      },
      {
        conversionRate: 100,
        label: "2026 Q2",
        pitches: 1,
        signedExclusives: 1,
      },
    ]);
  });

  it("quotes CSV fields containing punctuation and leaves absent values blank", () => {
    expect(pitchesToCsv([pitches[0]])).toBe(
      [
        "Property,Pitched,Stage,Resolved,Listed,Sold,Lost to",
        '"12 Mercer Street, SoHo",2026-04-03,Signed exclusive,2026-04-18,4500000,4350000,',
      ].join("\n"),
    );
  });
});
