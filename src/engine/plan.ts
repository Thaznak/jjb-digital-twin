import type { Lineup, Person, Site, Slot } from './types';
import { walkMinutes } from './site';

/** Arriving more than this late to a set is not worth it: the planner drops the set. */
export const MAX_LATE = 15;
/** Each friend who also picked a set adds this share of value: seeing it together counts. */
export const FRIEND_BONUS = 0.5;

export type Rain = (day: number, clock: number) => number;
const dry: Rain = () => 0;

export interface PlannedSet {
  slot: Slot;
  /** Minute the person reaches the stage (may be after the start). */
  arrival: number;
  /** Minutes of walking from the previous planned set, 0 for the first one. */
  walk: number;
  lateBy: number;
  friends: string[];
}

export interface Conflict {
  a: Slot;
  b: Slot;
  /** 'overlap': both play at the same time. 'tight': not enough time to walk from a to b. */
  kind: 'overlap' | 'tight';
  walk: number;
}

export interface DayPlan {
  day: number;
  sets: PlannedSet[];
  dropped: Slot[];
  conflicts: Conflict[];
  walkMinutes: number;
  minutesTogether: number;
}

export function slotsOfDay(lineup: Lineup, day: number): Slot[] {
  return lineup.slots.filter((s) => s.day === day).sort((a, b) => a.start - b.start || a.end - b.end);
}

export function favoritesOfDay(lineup: Lineup, person: Person, day: number): Slot[] {
  const fav = new Set(person.favorites);
  return slotsOfDay(lineup, day).filter((s) => fav.has(s.id));
}

export function fansOf(people: Person[], slotId: string): Person[] {
  return people.filter((p) => p.favorites.includes(slotId));
}

/** Pairs of favorites that cannot both be seen in full. */
export function conflicts(site: Site, favs: Slot[], rain: Rain = dry): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < favs.length; i++) {
    for (let j = i + 1; j < favs.length; j++) {
      const a = favs[i];
      const b = favs[j];
      if (b.start >= a.end + 120) break;
      if (b.start < a.end && a.start < b.end) {
        out.push({ a, b, kind: 'overlap', walk: 0 });
        continue;
      }
      const first = a.end <= b.start ? a : b;
      const second = first === a ? b : a;
      const walk = walkMinutes(site, first.stageId, second.stageId, { clock: first.end, precipMm: rain(first.day, first.end) });
      if (first.end + walk > second.start) out.push({ a: first, b: second, kind: 'tight', walk });
    }
  }
  return out;
}

/**
 * Best schedule for one person and one day, among their favorites.
 * Weighted interval scheduling where a set is worth the minutes actually seen,
 * boosted by each friend who picked it, and a transition needs walking time.
 */
export function planDay(site: Site, lineup: Lineup, people: Person[], person: Person, day: number, rain: Rain = dry): DayPlan {
  const favs = favoritesOfDay(lineup, person, day);
  const friendsOf = (s: Slot) => fansOf(people, s.id).filter((p) => p.id !== person.id).map((p) => p.name);
  const mult = favs.map((s) => 1 + FRIEND_BONUS * friendsOf(s).length);
  const n = favs.length;
  const best: number[] = new Array(n).fill(0);
  const prev: number[] = new Array(n).fill(-1);
  const arrival: number[] = favs.map((s) => s.start);
  const walks: number[] = new Array(n).fill(0);

  for (let j = 0; j < n; j++) {
    const s = favs[j];
    best[j] = (s.end - s.start) * mult[j];
    for (let i = 0; i < j; i++) {
      const p = favs[i];
      if (p.end > s.start + MAX_LATE) continue;
      const walk = walkMinutes(site, p.stageId, s.stageId, { clock: p.end, precipMm: rain(day, p.end) });
      const arr = Math.max(s.start, p.end + walk);
      if (arr > s.start + MAX_LATE || arr >= s.end) continue;
      const v = best[i] + (s.end - arr) * mult[j];
      if (v > best[j] + 1e-9) {
        best[j] = v;
        prev[j] = i;
        arrival[j] = arr;
        walks[j] = walk;
      }
    }
  }

  let end = -1;
  for (let j = 0; j < n; j++) if (end < 0 || best[j] > best[end]) end = j;
  const chain: number[] = [];
  for (let j = end; j >= 0; j = prev[j]) chain.unshift(j);
  const chosen = new Set(chain);

  const sets: PlannedSet[] = chain.map((j) => ({
    slot: favs[j],
    arrival: prev[j] < 0 ? favs[j].start : arrival[j],
    walk: prev[j] < 0 ? 0 : walks[j],
    lateBy: prev[j] < 0 ? 0 : arrival[j] - favs[j].start,
    friends: friendsOf(favs[j]),
  }));

  return {
    day,
    sets,
    dropped: favs.filter((_, j) => !chosen.has(j)),
    conflicts: conflicts(site, favs, rain),
    walkMinutes: sets.reduce((t, s) => t + s.walk, 0),
    minutesTogether: sets.reduce((t, s) => t + (s.friends.length ? s.slot.end - s.arrival : 0), 0),
  };
}

export type Whereabouts =
  | { kind: 'stage'; stageId: string; slot: Slot; waiting: boolean }
  | { kind: 'walking'; from: string; to: string; progress: number; next: Slot }
  | { kind: 'free' };

/** Where a person is at a given minute, following their plan. */
export function whereabouts(plan: DayPlan, clock: number): Whereabouts {
  const sets = plan.sets;
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    if (clock >= s.arrival && clock < s.slot.end) return { kind: 'stage', stageId: s.slot.stageId, slot: s.slot, waiting: clock < s.slot.start };
    const prev = sets[i - 1];
    if (prev && clock >= prev.slot.end && clock < s.arrival) {
      const leave = prev.slot.end;
      const reach = leave + s.walk;
      if (clock < reach && s.walk > 0) {
        return { kind: 'walking', from: prev.slot.stageId, to: s.slot.stageId, progress: (clock - leave) / s.walk, next: s.slot };
      }
      return { kind: 'stage', stageId: s.slot.stageId, slot: s.slot, waiting: true };
    }
  }
  return { kind: 'free' };
}

export interface Gathering {
  stageId: string;
  slot: Slot;
  people: Person[];
}

/** Who stands in front of which stage at a given minute. */
export function gatherings(plans: Map<string, DayPlan>, people: Person[], clock: number): Gathering[] {
  const by = new Map<string, Gathering>();
  for (const p of people) {
    const plan = plans.get(p.id);
    if (!plan) continue;
    const w = whereabouts(plan, clock);
    if (w.kind !== 'stage') continue;
    const g = by.get(w.stageId) ?? { stageId: w.stageId, slot: w.slot, people: [] };
    g.people.push(p);
    by.set(w.stageId, g);
  }
  return [...by.values()].sort((a, b) => b.people.length - a.people.length);
}

export interface Suggestion {
  slot: Slot;
  friends: string[];
}

/** Sets friends picked that fit in the person's plan without breaking it. */
export function suggestions(site: Site, lineup: Lineup, people: Person[], person: Person, plan: DayPlan, rain: Rain = dry): Suggestion[] {
  const mine = new Set(person.favorites);
  const out: Suggestion[] = [];
  for (const s of slotsOfDay(lineup, plan.day)) {
    if (mine.has(s.id)) continue;
    const friends = fansOf(people, s.id).filter((p) => p.id !== person.id).map((p) => p.name);
    if (!friends.length) continue;
    const before = [...plan.sets].reverse().find((x) => x.slot.end <= s.start);
    const after = plan.sets.find((x) => x.slot.start >= s.end);
    const overlaps = plan.sets.some((x) => x.slot.start < s.end && s.start < x.slot.end);
    if (overlaps) continue;
    const okBefore = !before || before.slot.end + walkMinutes(site, before.slot.stageId, s.stageId, { clock: before.slot.end, precipMm: rain(s.day, before.slot.end) }) <= s.start + MAX_LATE;
    const okAfter = !after || s.end + walkMinutes(site, s.stageId, after.slot.stageId, { clock: s.end, precipMm: rain(s.day, s.end) }) <= after.slot.start + MAX_LATE;
    if (okBefore && okAfter) out.push({ slot: s, friends });
  }
  return out.sort((a, b) => b.friends.length - a.friends.length || a.slot.start - b.slot.start);
}
