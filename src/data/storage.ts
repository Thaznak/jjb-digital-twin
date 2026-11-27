import type { Lineup, Person, Point } from '../engine';

const KEY = 'hellfest-twin:v2';

export interface Saved {
  people: Person[];
  activeId: string | null;
  lineup: Lineup | null;
  /** Last time friends' lists were refreshed (code import), ISO. */
  lastSync: string | null;
  /** Chosen starting point when there is no GPS. */
  start: Point | null;
}

const EMPTY: Saved = { people: [], activeId: null, lineup: null, lastSync: null, start: null };

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function load(): Saved {
  return safe(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Saved>) };
  }, { ...EMPTY });
}

export function save(s: Saved): void {
  safe(() => localStorage.setItem(KEY, JSON.stringify(s)), undefined);
}
