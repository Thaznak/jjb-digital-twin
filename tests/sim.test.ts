import { ClubSim, facilities, weatherFactor, addDays, weekday } from '../src/engine';
import { sampleClub } from '../src/data/sampleData';
import { testEnv } from './helpers';

describe('dates', () => {
  it('handles month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekday('2026-11-16')).toBe(0); // lundi
  });
});

describe('ClubSim over 12 simulated months', () => {
  const sim = new ClubSim(sampleClub(), testEnv(), { startDate: '2026-09-01', seed: 1 });
  const months = sim.runMonths(12);

  it('produces 12 monthly reports', () => {
    expect(months).toHaveLength(12);
    expect(months[0].month).toBe('2026-09');
    expect(months[11].month).toBe('2027-08');
  });

  it('keeps the membership in a plausible band', () => {
    for (const m of months) {
      expect(m.members).toBeGreaterThan(60);
      expect(m.members).toBeLessThan(220);
    }
  });

  it('has a September sign-up peak and a summer churn peak', () => {
    const sep = months.find((m) => m.month === '2026-09')!;
    const apr = months.find((m) => m.month === '2027-04')!;
    const jul = months.find((m) => m.month === '2027-07')!;
    expect(sep.signups).toBeGreaterThan(apr.signups * 3);
    expect(jul.departures).toBeGreaterThan(apr.departures);
  });

  it('books revenue and costs into cash', () => {
    const net = months.reduce((s, m) => s + m.revenue - m.costs, 0);
    expect(months[11].cash).toBeCloseTo(8000 + net, 0);
    expect(months.every((m) => m.revenue > 3000 && m.costs > 2000)).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const again = new ClubSim(sampleClub(), testEnv(), { startDate: '2026-09-01', seed: 1 }).runMonths(12);
    expect(again[11].cash).toBeCloseTo(months[11].cash, 6);
  });

  it('never fills a class beyond its capacity', () => {
    for (const d of sim.days) for (const f of d.fills) expect(f.attendees).toBeLessThanOrEqual(f.capacity + 1e-9);
  });
});

describe('buildings change capacity and costs', () => {
  it('the mats are the bottleneck of the sample club', () => {
    const f = facilities(sampleClub().buildings);
    expect(f.matPlaces).toBe(40);
    expect(f.lockerPlaces).toBe(50);
    expect(f.slotCapacity).toBe(40);
    expect(f.bottleneck).toBe('tatamis');
  });
  it('removing a locker room makes it the bottleneck and lowers running costs', () => {
    const c = sampleClub();
    const before = facilities(c.buildings);
    const after = facilities(c.buildings.filter((b) => b.id !== 'vest-2'));
    expect(after.slotCapacity).toBe(25);
    expect(after.bottleneck).toBe('vestiaires');
    expect(after.monthlyCost).toBeLessThan(before.monthlyCost);
  });
  it('a shop adds a margin per member', () => {
    const noShop = sampleClub();
    noShop.buildings = noShop.buildings.filter((b) => b.type !== 'boutique');
    const base = new ClubSim(noShop, testEnv(), { startDate: '2027-01-01', seed: 3 }).runMonths(3);
    const c = sampleClub();
    const shop = new ClubSim(c, testEnv(), { startDate: '2027-01-01', seed: 3 }).runMonths(3);
    expect(shop[0].revenue - base[0].revenue).toBeGreaterThan(100);
    expect(facilities(c.buildings).revenuePerMember).toBe(1.5);
  });
  it('no dojo means no class', () => {
    expect(facilities([{ id: 'v', type: 'vestiaire', x: 0, y: 0 }]).slotCapacity).toBe(0);
  });
});

describe('weather', () => {
  it('rain, cold and heat reduce attendance', () => {
    const ok = weatherFactor({ tempMaxC: 15, precipMm: 0, source: 'normales' });
    expect(ok).toBe(1);
    expect(weatherFactor({ tempMaxC: 15, precipMm: 12, source: 'normales' })).toBeLessThan(ok);
    expect(weatherFactor({ tempMaxC: 0, precipMm: 0, source: 'normales' })).toBeLessThan(ok);
    expect(weatherFactor({ tempMaxC: 34, precipMm: 0, source: 'normales' })).toBeLessThan(0.8);
  });
});
