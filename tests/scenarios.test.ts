import { applyShocks, compareScenario, coachHours } from '../src/engine';
import { sampleClub } from '../src/data/sampleData';
import { testEnv } from './helpers';

const start = '2027-01-01';

describe('scenarios', () => {
  it('a fee increase raises revenue but costs members', () => {
    const c = compareScenario(sampleClub(), testEnv(), [{ kind: 'hausse-cotisation', fromMonth: 0, pct: 0.2 }], start, 6);
    expect(c.scenario[0].revenue).toBeGreaterThan(c.baseline[0].revenue);
    expect(c.delta.members).toBeLessThan(0);
  });

  it('losing a coach overloads the others', () => {
    const eff = applyShocks(sampleClub(), [{ kind: 'depart-prof', fromMonth: 0, coachId: 'c2' }], 0);
    expect(eff.config.coaches.find((x) => x.id === 'c2')).toBeUndefined();
    const c = compareScenario(sampleClub(), testEnv(), [{ kind: 'depart-prof', fromMonth: 0, coachId: 'c2' }], start, 6);
    expect(c.delta.coachLoadMax).toBeGreaterThan(0);
    expect(c.alerts.some((a) => a.target === 'dojo')).toBe(true);
  });

  it('a new kids class brings more kids', () => {
    const c = compareScenario(sampleClub(), testEnv(), [{ kind: 'creneau-enfants', fromMonth: 0, day: 2, start: 14 }], start, 6);
    expect(c.scenario[5].kids).toBeGreaterThan(c.baseline[5].kids);
  });

  it('a June heatwave lowers June attendance', () => {
    const c = compareScenario(sampleClub(), testEnv(), [{ kind: 'canicule', calendarMonth: 5, extraC: 12 }], start, 6);
    const jun = (r: typeof c.baseline) => r.find((m) => m.month === '2027-06')!;
    expect(jun(c.scenario).avgFill).toBeLessThan(jun(c.baseline).avgFill);
  });

  it('a seminar adds one-off cash in its month', () => {
    const c = compareScenario(sampleClub(), testEnv(), [{ kind: 'stage', fromMonth: 1, participants: 30, price: 40, cost: 700, extraSignups: 3 }], start, 3);
    expect(c.scenario[1].revenue - c.baseline[1].revenue).toBeGreaterThan(400);
  });

  it('hiring a coach takes hours off the overloaded ones', () => {
    const base = sampleClub();
    base.coaches[0].maxHoursWeek = 4; // c1 teaches 7h
    const eff = applyShocks(base, [{ kind: 'embauche-prof', fromMonth: 0, hourlyCost: 22, maxHoursWeek: 4 }], 0);
    expect(coachHours(eff.config.slots, 'c1')).toBeLessThan(coachHours(base.slots, 'c1'));
  });

  it('a rent increase targets the rent line', () => {
    const eff = applyShocks(sampleClub(), [{ kind: 'hausse-loyer', fromMonth: 0, pct: 0.1 }], 0);
    expect(eff.config.charges.find((c) => c.id === 'ch1')!.amount).toBeCloseTo(1430);
  });
});
