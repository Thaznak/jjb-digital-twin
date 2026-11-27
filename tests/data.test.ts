import { describe, expect, it } from 'vitest';
import { advice, clockLabel, decodePerson, encodePerson, mergePerson, parseClock, rainAt, summarize, SITE, type WeatherHour } from '../src/engine';
import { parseLineupCsv, sampleLineup } from '../src/data/lineup';
import { festivalDay } from '../src/data/weather';

describe('programmation', () => {
  it('l’exemple couvre 4 jours et 10 scènes, sans chevauchement sur une scène', () => {
    const l = sampleLineup();
    expect(l.sample).toBe(true);
    expect(new Set(l.slots.map((s) => s.day)).size).toBe(4);
    expect(new Set(l.slots.map((s) => s.stageId)).size).toBe(SITE.stages.length);
    for (const st of SITE.stages) for (const d of [0, 1, 2, 3]) {
      const xs = l.slots.filter((s) => s.stageId === st.id && s.day === d).sort((a, b) => a.start - b.start);
      for (let i = 1; i < xs.length; i++) expect(xs[i].start).toBeGreaterThanOrEqual(xs[i - 1].end);
    }
    expect(new Set(l.slots.map((s) => s.id)).size).toBe(l.slots.length);
  });

  it('importe un CSV réel, avec passage de minuit', () => {
    const l = parseLineupCsv('jour;scene;debut;fin;groupe\nvendredi;Mainstage 1;23:40;01:10;Groupe A\n2;warzone;18:00;18:45;Groupe B');
    expect(l.sample).toBe(false);
    expect(l.slots[0]).toMatchObject({ day: 1, stageId: 'ms1', start: 23 * 60 + 40, end: 25 * 60 + 10 });
    expect(l.slots[1]).toMatchObject({ day: 1, stageId: 'warzone' });
    expect(() => parseLineupCsv('jour,scene,debut,fin,groupe\nlundi,Valley,12:00,13:00,X')).toThrow(/Ligne 2/);
  });
});

describe('heures', () => {
  it('lit et affiche les heures de nuit', () => {
    expect(parseClock('01:30')).toBe(25 * 60 + 30);
    expect(clockLabel(25 * 60 + 30)).toBe('01:30');
    expect(() => parseClock('midi')).toThrow();
  });
});

describe('partage', () => {
  it('un code aller-retour garde la liste, accents compris', () => {
    const p = { id: 'x1', name: 'Zoé', color: '#5fb3d9', favorites: ['0-ms1-600', '1-valley-700'] };
    expect(decodePerson(encodePerson(p))).toEqual(p);
    expect(() => decodePerson('bonjour')).toThrow();
    expect(mergePerson([p], { ...p, name: 'Zoé B' })).toHaveLength(1);
    expect(mergePerson([p], { ...p, id: 'x2' })).toHaveLength(2);
  });
});

describe('météo', () => {
  const hours: WeatherHour[] = Array.from({ length: 24 }, (_, h) => ({ time: `2027-06-18T${String(h).padStart(2, '0')}:00`, tempC: 12 + h / 2, precipMm: h === 18 ? 3 : 0, rainProb: h === 18 ? 80 : 10, code: 0 }));
  it('résume une journée et donne un conseil', () => {
    const f = summarize('2027-06-18', hours)!;
    expect(f.tMax).toBe(23.5);
    expect(f.precipMm).toBe(3);
    expect(advice(f)).toMatch(/poncho/);
    expect(rainAt(hours, '2027-06-18', 18 * 60 + 20)).toBe(3);
  });
  it('se replie sur les normales de juin quand le festival est trop loin', () => {
    expect(festivalDay('2027-06-17', { hours: [], live: false }).source).toBe('normals');
  });
});
