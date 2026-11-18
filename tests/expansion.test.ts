import { evaluateLocation, type ExpansionInput } from '../src/engine';
import { LOCATIONS } from '../src/data/locations';

const base = (id: string, over: Partial<ExpansionInput> = {}): ExpansionInput => ({
  location: LOCATIONS.find((l) => l.id === id)!,
  surfaceM2: 150,
  fitOutCost: 12000,
  adultFee: 45,
  kidFee: 30,
  kidShare: 0.3,
  coachHoursWeek: 10,
  coachHourly: 25,
  otherFixedMonthly: 300,
  practiceRate: 0.007,
  rampMonths: 18,
  attractiveness: 1,
  horizonMonths: 36,
  currentClubMembers: 120,
  ...over,
});

describe('new club evaluation', () => {
  it('gives a verdict with reasons and a cash curve', () => {
    const r = evaluateLocation(base('roubaix'));
    expect(r.months).toHaveLength(36);
    expect(r.reasons.length).toBeGreaterThan(2);
    expect(['pertinent', 'a-creuser', 'pas-pertinent']).toContain(r.verdict);
  });
  it('an expensive, crowded market is worse than a cheap, empty one', () => {
    const paris = evaluateLocation(base('paris11'));
    const arras = evaluateLocation(base('arras'));
    expect(arras.months[35].cash).toBeGreaterThan(paris.months[35].cash);
  });
  it('flags cannibalisation when the site is close to the current club', () => {
    expect(evaluateLocation(base('villeneuve')).cannibalised).toBeGreaterThan(1);
    expect(evaluateLocation(base('arras')).cannibalised).toBe(0);
  });
  it('a tiny room caps membership', () => {
    const r = evaluateLocation(base('paris11', { surfaceM2: 25 }));
    expect(r.target).toBe(r.capacityCap);
  });
  it('no market means not relevant', () => {
    const r = evaluateLocation(base('lens', { practiceRate: 0.0005 }));
    expect(r.verdict).toBe('pas-pertinent');
  });
});
