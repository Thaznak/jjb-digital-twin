import { createRng, type Lineup, type Person } from '../engine';

/** Colours of the team, in order of arrival. */
export const PEOPLE_COLORS = ['#F2C14E', '#5FB3D9', '#E9707C', '#8FD16A', '#C38EE8', '#F29B4C', '#4FD1C5', '#B9B2A1'];

export const DEMO_PREFIX = 'exemple-';

/**
 * Example team so the map is alive on first launch: four friends with overlapping tastes.
 * Their ids start with "exemple-" so they can be removed in one tap.
 */
export function demoTeam(lineup: Lineup): Person[] {
  const r = createRng(42);
  const names = ['Sam', 'Lou', 'Alex', 'Mo'];
  const people: Person[] = names.map((name, i) => ({ id: DEMO_PREFIX + name.toLowerCase(), name, color: PEOPLE_COLORS[i + 1], favorites: [] }));
  for (const d of lineup.days) {
    const slots = lineup.slots.filter((s) => s.day === d.index);
    const core = eveningCore(slots);
    for (const p of people) {
      const picks = new Set(core.filter(() => r() < 0.8).map((s) => s.id));
      while (picks.size < 7) picks.add(slots[Math.floor(r() * slots.length)].id);
      p.favorites.push(...picks);
    }
  }
  return people;
}

/** A shared core: a few sets the whole group likes (Mainstages in the evening). */
function eveningCore(slots: Lineup['slots']) {
  const evening = slots.filter((s) => s.start >= 19 * 60 && (s.stageId === 'ms1' || s.stageId === 'ms2')).sort((a, b) => a.start - b.start);
  return evening.filter((_, i) => i % 2 === 0).slice(0, 3);
}

/** A starter list for "Moi", taken from the example, so the plan is not empty on first launch. */
export function demoFavoritesForMe(lineup: Lineup, team: Person[]): string[] {
  const r = createRng(7);
  const out: string[] = [];
  for (const d of lineup.days) {
    const friends = new Set(team.flatMap((p) => p.favorites));
    const slots = lineup.slots.filter((s) => s.day === d.index);
    const core = eveningCore(slots);
    const shared = slots.filter((s) => s.start < 19 * 60 && friends.has(s.id) && r() < 0.5).slice(0, 3);
    const own = slots.filter((s) => s.start < 19 * 60 && r() < 0.04).slice(0, 2);
    out.push(...[...core, ...shared, ...own].map((s) => s.id));
  }
  return [...new Set(out)];
}
