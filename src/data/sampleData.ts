import { createRng } from '../engine/rng';
import { BELTS, type Belt, type ClubConfig, type Member } from '../engine/types';

/** Fictional, anonymised club. No real person in here. */
function sampleMembers(): Member[] {
  const r = createRng(2027);
  const adultBelts: [Belt, number][] = [['blanche', 0.45], ['bleue', 0.3], ['violette', 0.13], ['marron', 0.07], ['noire', 0.05]];
  const kidBelts: [Belt, number][] = [['blanche', 0.35], ['grise', 0.3], ['jaune', 0.2], ['orange', 0.1], ['verte', 0.05]];
  const pick = (table: [Belt, number][]) => {
    let x = r();
    for (const [b, p] of table) if ((x -= p) <= 0) return b;
    return table[0][0];
  };
  const out: Member[] = [];
  for (let i = 0; i < 86; i++) {
    const y = 2019 + Math.floor(r() * 7);
    out.push({ id: `A${String(i + 1).padStart(3, '0')}`, segment: 'adulte', belt: pick(adultBelts), age: 18 + Math.floor(r() * 30), joinDate: `${y}-09-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`, sessionsPerWeek: [1, 2, 2, 2, 3, 3, 4][Math.floor(r() * 7)] });
  }
  for (let i = 0; i < 34; i++) {
    const y = 2022 + Math.floor(r() * 4);
    out.push({ id: `E${String(i + 1).padStart(3, '0')}`, segment: 'enfant', belt: pick(kidBelts), age: 6 + Math.floor(r() * 9), joinDate: `${y}-09-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`, sessionsPerWeek: [1, 1, 2][Math.floor(r() * 3)] });
  }
  return out;
}

export function sampleClub(): ClubConfig {
  const buildings: ClubConfig['buildings'] = [{ id: 'dojo-1', type: 'dojo', x: 7, y: 6 }];
  // 20 tatamis on the 6x6 dojo floor, leaving the front rows free.
  let n = 0;
  for (let y = 6; y < 12 && n < 20; y++) for (let x = 7; x < 13 && n < 20; x++) if (y < 11 || x > 9) buildings.push({ id: `tatami-${n++}`, type: 'tatami', x, y });
  buildings.push({ id: 'vest-1', type: 'vestiaire', x: 4, y: 6 });
  buildings.push({ id: 'vest-2', type: 'vestiaire', x: 4, y: 9 });
  buildings.push({ id: 'accueil-1', type: 'accueil', x: 4, y: 12 });
  buildings.push({ id: 'parking-1', type: 'parking', x: 14, y: 13 });
  return {
    name: 'Club fictif de JJB',
    city: { name: 'Lille', lat: 50.63, lon: 3.06 },
    startCash: 8000,
    members: sampleMembers(),
    slots: [
      { id: 's1', day: 0, start: 19, durationH: 1.5, audience: 'adulte', label: 'Adultes tous niveaux', coachId: 'c1' },
      { id: 's2', day: 1, start: 18, durationH: 1, audience: 'enfant', label: 'Enfants 6-10 ans', coachId: 'c2' },
      { id: 's3', day: 1, start: 19.5, durationH: 1.5, audience: 'adulte', label: 'Adultes débutants', coachId: 'c2' },
      { id: 's4', day: 2, start: 12.5, durationH: 1, audience: 'adulte', label: 'Midi technique', coachId: 'c1' },
      { id: 's5', day: 2, start: 17, durationH: 1, audience: 'enfant', label: 'Enfants 11-14 ans', coachId: 'c3' },
      { id: 's6', day: 3, start: 19, durationH: 1.5, audience: 'adulte', label: 'Adultes avancés', coachId: 'c1' },
      { id: 's7', day: 4, start: 19, durationH: 1.5, audience: 'adulte', label: 'No-gi', coachId: 'c3' },
      { id: 's8', day: 5, start: 10, durationH: 1, audience: 'enfant', label: 'Enfants samedi', coachId: 'c2' },
      { id: 's9', day: 5, start: 11, durationH: 2, audience: 'tous', label: 'Open mat', coachId: 'c1' },
    ],
    coaches: [
      { id: 'c1', label: 'Prof principal', hourlyCost: 30, maxHoursWeek: 7 },
      { id: 'c2', label: 'Prof enfants', hourlyCost: 25, maxHoursWeek: 4 },
      { id: 'c3', label: 'Prof assistant', hourlyCost: 20, maxHoursWeek: 3 },
    ],
    charges: [
      { id: 'ch1', label: 'Loyer de la salle', kind: 'fixe', amount: 1300 },
      { id: 'ch2', label: 'Électricité et eau', kind: 'fixe', amount: 160 },
      { id: 'ch3', label: 'Assurance du club', kind: 'fixe', amount: 85 },
      { id: 'ch4', label: 'Affiliation fédérale', kind: 'fixe', amount: 40 },
      { id: 'ch5', label: 'Matériel et entretien', kind: 'fixe', amount: 70 },
      { id: 'ch6', label: 'Expert-comptable', kind: 'fixe', amount: 60 },
      { id: 'ch7', label: 'Licence et assurance individuelle', kind: 'par_adherent', amount: 3 },
    ],
    fees: { adultMonthly: 45, kidMonthly: 30, registrationFee: 40 },
    buildings,
    market: { baseSignupsPerMonth: 3.7, kidSignupShare: 0.3, baseChurnMonthly: 0.035, feeElasticity: 1.5 },
    history: [],
  };
}

export { BELTS };
