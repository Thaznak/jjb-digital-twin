import { parseMembersCsv, parseHistoryCsv, HISTORY_CSV_EXAMPLE } from '../src/data/csv';
import { calibrate } from '../src/engine';
import { loadSeasonality } from '../src/data/seasonality';

describe('CSV import', () => {
  it('drops personal columns and parses members', () => {
    const csv = 'id;nom;email;ceinture;age;date_inscription;seances_semaine\nX1;Dupont;a@b.fr;Bleue;34;2023-09-10;3\nX2;Durand;c@d.fr;grise;9;2024-09-02;1';
    const r = parseMembersCsv(csv);
    expect(r.droppedColumns).toEqual(expect.arrayContaining(['nom', 'email']));
    expect(r.rows[0]).toEqual({ id: 'X1', segment: 'adulte', belt: 'bleue', age: 34, joinDate: '2023-09-10', sessionsPerWeek: 3 });
    expect(r.rows[1].segment).toBe('enfant');
    expect(JSON.stringify(r.rows)).not.toContain('Dupont');
  });
  it('parses history and calibrates flows', () => {
    const { rows, errors } = parseHistoryCsv(HISTORY_CSV_EXAMPLE);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(6);
    const cal = calibrate(rows, loadSeasonality(), { adultMonthly: 45, kidMonthly: 30, registrationFee: 40 });
    expect(cal.market.baseSignupsPerMonth).toBeGreaterThan(3);
    expect(cal.market.baseSignupsPerMonth).toBeLessThan(15);
    expect(cal.market.baseChurnMonthly).toBeGreaterThan(0.02);
    expect(cal.market.baseChurnMonthly).toBeLessThan(0.08);
  });
  it('reports bad rows', () => {
    expect(parseHistoryCsv('mois,ca,adherents\nseptembre,10,2').errors).toHaveLength(1);
  });
});
