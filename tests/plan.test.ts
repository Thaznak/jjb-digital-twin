import { describe, expect, it } from 'vitest';
import { conflicts, gatherings, planDay, suggestions, whereabouts, SITE, type Lineup, type Person, type Slot } from '../src/engine';

const s = (id: string, stageId: string, start: string, end: string): Slot => {
  const t = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
  return { id, day: 0, stageId, band: id, start: t(start), end: t(end) };
};
const lineup: Lineup = {
  edition: 'test',
  sample: true,
  days: [{ index: 0, date: '2027-06-17', label: 'Jeudi' }],
  slots: [
    s('a', 'warzone', '15:00', '15:45'),
    s('b', 'temple', '15:50', '16:40'), // loin de Warzone : trop court pour y aller à l'heure
    s('c', 'ms1', '17:00', '18:00'),
    s('d', 'altar', '17:30', '18:20'), // chevauche c
    s('e', 'ms2', '18:05', '19:00'),
  ],
};
const P = (id: string, favs: string[]): Person => ({ id, name: id.toUpperCase(), color: '#ffffff', favorites: favs });

describe('conflits', () => {
  it('repère les chevauchements et les enchaînements trop courts', () => {
    const k = conflicts(SITE, lineup.slots);
    expect(k.some((c) => c.kind === 'overlap' && c.a.id === 'c' && c.b.id === 'd')).toBe(true);
    expect(k.some((c) => c.kind === 'tight' && c.a.id === 'a' && c.b.id === 'b')).toBe(true);
  });
});

describe('planning', () => {
  it('choisit le concert vu avec des amis quand deux favoris se chevauchent', () => {
    const me = P('moi', ['c', 'd']);
    const alone = planDay(SITE, lineup, [me], me, 0);
    const friends = [me, P('sam', ['d']), P('lou', ['d'])];
    const together = planDay(SITE, lineup, friends, me, 0);
    expect(alone.sets.map((x) => x.slot.id)).toEqual(['c']); // le plus long
    expect(together.sets.map((x) => x.slot.id)).toEqual(['d']);
    expect(together.dropped.map((x) => x.id)).toEqual(['c']);
    expect(together.minutesTogether).toBeGreaterThan(0);
  });

  it('accepte un léger retard et compte la marche', () => {
    const me = P('moi', ['a', 'b']);
    const plan = planDay(SITE, lineup, [me], me, 0);
    expect(plan.sets.map((x) => x.slot.id)).toEqual(['a', 'b']);
    expect(plan.sets[1].lateBy).toBeGreaterThan(0);
    expect(plan.walkMinutes).toBeGreaterThan(5);
  });
});

describe('qui est où', () => {
  const me = P('moi', ['a', 'b', 'c']);
  const sam = P('sam', ['c']);
  const people = [me, sam];
  const plans = new Map(people.map((p) => [p.id, planDay(SITE, lineup, people, p, 0)]));

  it('suit une personne : scène, marche, puis libre', () => {
    const plan = plans.get('moi')!;
    expect(whereabouts(plan, 15 * 60 + 10)).toMatchObject({ kind: 'stage', stageId: 'warzone' });
    expect(whereabouts(plan, 15 * 60 + 47).kind).toBe('walking');
    expect(whereabouts(plan, 23 * 60).kind).toBe('free');
  });

  it('regroupe les personnes devant la même scène', () => {
    const g = gatherings(plans, people, 17 * 60 + 30);
    expect(g[0]).toMatchObject({ stageId: 'ms1' });
    expect(g[0].people.map((p) => p.id).sort()).toEqual(['moi', 'sam']);
  });

  it('propose les concerts des amis qui tiennent dans le planning', () => {
    const lou = P('lou', ['e']);
    const all = [me, sam, lou];
    const plan = planDay(SITE, lineup, all, me, 0);
    const sug = suggestions(SITE, lineup, all, me, plan);
    expect(sug.map((x) => x.slot.id)).toContain('e');
    expect(sug.find((x) => x.slot.id === 'e')!.friends).toEqual(['LOU']);
  });
});
