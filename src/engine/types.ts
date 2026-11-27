/** Domain model of the festival twin. Pure data, no DOM. */

export type StageKind = 'main' | 'open' | 'tent';

/**
 * Plan coordinates: u to the east, v to the south, in site units (see Site.metresPerUnit).
 * The renderer turns them into an isometric view; the engine only sees the ground plan.
 */
export interface Point {
  u: number;
  v: number;
}

export interface Stage extends Point {
  id: string;
  name: string;
  kind: StageKind;
  /** True for the 4 stages announced for 2027 whose position is not published yet. */
  provisional: boolean;
  genre: string;
}

export interface Hub extends Point {
  id: string;
  name: string;
}

export type PoiKind = 'eau' | 'wc' | 'secours' | 'bar' | 'info';

export interface Poi extends Point {
  id: string;
  kind: PoiKind;
  name: string;
}

/** A walkable link between two nodes (stage or hub ids). */
export interface Edge {
  a: string;
  b: string;
}

export interface Site {
  metresPerUnit: number;
  stages: Stage[];
  hubs: Hub[];
  edges: Edge[];
  pois: Poi[];
}

/** A concert. Times are minutes since midnight of the festival day; after midnight goes beyond 1440. */
export interface Slot {
  id: string;
  day: number;
  stageId: string;
  band: string;
  start: number;
  end: number;
}

export interface FestivalDay {
  index: number;
  date: string; // ISO yyyy-mm-dd
  label: string;
}

export interface Lineup {
  edition: string;
  /** True for invented sample data. Shown in the UI until a real lineup is imported. */
  sample: boolean;
  days: FestivalDay[];
  slots: Slot[];
}

export interface Person {
  id: string;
  name: string;
  color: string;
  favorites: string[];
}

export interface WeatherHour {
  /** ISO local time, yyyy-mm-ddThh:00 */
  time: string;
  tempC: number;
  precipMm: number;
  rainProb: number;
  code: number;
}
