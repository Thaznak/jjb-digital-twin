import type { Lineup, Person } from '../engine';

const KEY = 'hellfest-twin:v1';

export interface Saved {
  people: Person[];
  activeId: string | null;
  lineup: Lineup | null;
}

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
    if (!raw) return { people: [], activeId: null, lineup: null };
    const s = JSON.parse(raw) as Partial<Saved>;
    return { people: s.people ?? [], activeId: s.activeId ?? null, lineup: s.lineup ?? null };
  }, { people: [], activeId: null, lineup: null });
}

export function save(s: Saved): void {
  safe(() => localStorage.setItem(KEY, JSON.stringify(s)), undefined);
}
