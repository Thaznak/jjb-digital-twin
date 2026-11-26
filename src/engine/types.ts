/** Domain model of the festival twin. Pure data, no DOM, no Phaser. */

export type StageKind = 'main' | 'open' | 'tent';

export interface Stage {
  id: string;
  name: string;
  kind: StageKind;
  /** Tile position of the front of the stage (where the crowd stands). */
  x: number;
  y: number;
  /** Footprint in tiles, for rendering. */
  w: number;
  h: number;
  /** Musical colour of the stage, shown in the lineup. */
  genre: string;
}

export interface Hub {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** A walkable link between two nodes (stage or hub ids). */
export interface Edge {
  a: string;
  b: string;
}

export interface Site {
  /** Metres per tile. */
  metresPerTile: number;
  stages: Stage[];
  hubs: Hub[];
  edges: Edge[];
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
