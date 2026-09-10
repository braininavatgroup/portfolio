import source from './demo-source.json';
export type TouringShow = typeof source.show;
export type TouringField = { key: string; label: string; type: string; section: string };
export type TouringEvent = { key: string; start: string; end: string; timezone: string; summary: string; description: string; artistEmail: string };
export type TouringEvidence = {
  status: string;
  date: string;
  setTime: string;
  outstanding: { key: string; label: string; owner: string }[];
  daySheet: { sections: { section: string; fields: { label: string; value: string }[] }[] };
  events: TouringEvent[];
  draft: string | null;
  promoterFields: TouringField[];
};
export const exampleTransport: Readonly<{driver_name: string; driver_number: string; transfer_airport_hotel: string}>;
export function createTouringShow(): TouringShow;
export function savePromoterDetails(show: TouringShow, payload: Record<string,string>): TouringShow;
export function touringEvidence(show: TouringShow, daySheetHref?: string): TouringEvidence;
export function touringTime(value: string, timezone: string): string;
