import { createRng, parseClock, SITE, type FestivalDay, type Lineup, type Slot } from '../engine';

/** Hellfest 2027, 20th edition: Thursday 17 to Sunday 20 June 2027 (dates announced by the festival). */
export const DAYS: FestivalDay[] = [
  { index: 0, date: '2027-06-17', label: 'Jeudi 17' },
  { index: 1, date: '2027-06-18', label: 'Vendredi 18' },
  { index: 2, date: '2027-06-19', label: 'Samedi 19' },
  { index: 3, date: '2027-06-20', label: 'Dimanche 20' },
];

const A = ['Corbeaux', 'Ossements', 'Marais', 'Brasier', 'Cendres', 'Granit', 'Abysses', 'Ronces', 'Lames', 'Tonnerre', 'Ombres', 'Vipères', 'Loups', 'Rouille', 'Fange', 'Comètes', 'Spectres', 'Chardons', 'Enclumes', 'Goules'];
const B = ['de Clisson', 'du Muscadet', 'Noirs', 'Sans Nom', 'du Nord', 'de Fer', 'Éternels', 'Hurlants', 'de Sèvre', 'du Vignoble', 'Brûlés', 'Errants', 'de Minuit', 'Sacrés', 'de Granit'];
const SOLO = ['Vermine', 'Nécropolis', 'Kraken', 'Ossuaire', 'Tempête', 'Mandragore', 'Basalte', 'Charogne', 'Requiem', 'Sabbat', 'Fournaise', 'Golem', 'Vortex', 'Chimère', 'Brocéliande', 'Wyvern', 'Moloch', 'Obsidienne', 'Hydre', 'Lichen'];

function bandNames(seed: number) {
  const r = createRng(seed);
  const used = new Set<string>();
  return () => {
    for (let k = 0; k < 50; k++) {
      const name = r() < 0.45 ? `${SOLO[Math.floor(r() * SOLO.length)]}${r() < 0.3 ? ' ' + ['Rex', 'Ritual', 'Machine', 'Coven', 'Legion'][Math.floor(r() * 5)] : ''}` : `Les ${A[Math.floor(r() * A.length)]} ${B[Math.floor(r() * B.length)]}`;
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
    return `Groupe ${used.size + 1}`;
  };
}

/**
 * Invented lineup with a realistic shape: Mainstages alternate until 01:30,
 * other stages run 40 to 60 minute sets with changeovers. Every band name is fictional.
 */
export function sampleLineup(): Lineup {
  const name = bandNames(2027);
  const r = createRng(17);
  const slots: Slot[] = [];
  const push = (day: number, stageId: string, start: number, end: number) =>
    slots.push({ id: `${day}-${stageId}-${start}`, day, stageId, band: name(), start, end });

  for (const d of DAYS) {
    // Mainstages: alternating, sets grow longer towards the night.
    let t = 10 * 60 + 30;
    let side = 0;
    while (t < 23 * 60) {
      const len = t < 15 * 60 ? 40 : t < 19 * 60 ? 50 : 65;
      push(d.index, side ? 'ms2' : 'ms1', t, t + len);
      t += len + 5;
      side = 1 - side;
    }
    push(d.index, side ? 'ms2' : 'ms1', t, t + 105); // headliner
    t += 110;
    push(d.index, side ? 'ms1' : 'ms2', t, t + 75);

    for (const s of SITE.stages.filter((x) => x.kind !== 'main')) {
      const isNew = ['riot', 'abyss', 'forge', 'crypt'].includes(s.id);
      let u = (isNew ? 11 * 60 + 15 : 10 * 60 + 30) + Math.floor(r() * 4) * 5;
      const close = isNew ? 24 * 60 + 30 : 25 * 60 + 30;
      while (u < close - 40) {
        const len = u < 16 * 60 ? 40 : u < 21 * 60 ? 50 : 60;
        push(d.index, s.id, u, Math.min(u + len, close));
        u += len + (isNew ? 20 : 15) + Math.floor(r() * 2) * 5;
      }
    }
  }
  return { edition: 'Hellfest 2027 (programmation d’exemple)', sample: true, days: DAYS, slots };
}

const DAY_WORDS: Record<string, number> = { jeudi: 0, vendredi: 1, samedi: 2, dimanche: 3 };

function stageId(text: string): string {
  const key = text.trim().toLowerCase().replace(/\s+/g, '');
  const found = SITE.stages.find((s) => s.id === key || s.name.toLowerCase().replace(/\s+/g, '') === key || (key === 'mainstage1' && s.id === 'ms1') || (key === 'mainstage2' && s.id === 'ms2'));
  if (!found) throw new Error(`Scène inconnue : ${text}`);
  return found.id;
}

function dayIndex(text: string): number {
  const t = text.trim().toLowerCase();
  if (t in DAY_WORDS) return DAY_WORDS[t];
  const byDate = DAYS.find((d) => d.date === t);
  if (byDate) return byDate.index;
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= 4) return n - 1;
  throw new Error(`Jour inconnu : ${text}`);
}

/**
 * Real lineup import. CSV with header: jour,scene,debut,fin,groupe
 * jour = jeudi..dimanche, 1..4 or a date. Separator , or ;.
 */
export function parseLineupCsv(text: string, edition = 'Hellfest 2027'): Lineup {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('Fichier vide.');
  const sep = lines[0].includes(';') ? ';' : ',';
  const head = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const col = (n: string) => {
    const i = head.indexOf(n);
    if (i < 0) throw new Error(`Colonne manquante : ${n}`);
    return i;
  };
  const [cj, cs, cd, cf, cg] = ['jour', 'scene', 'debut', 'fin', 'groupe'].map(col);
  const slots: Slot[] = lines.slice(1).map((line, k) => {
    const c = line.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
    try {
      const day = dayIndex(c[cj]);
      const st = stageId(c[cs]);
      const start = parseClock(c[cd]);
      let end = parseClock(c[cf]);
      if (end <= start) end += 1440;
      if (!c[cg]) throw new Error('Nom du groupe manquant');
      return { id: `${day}-${st}-${start}`, day, stageId: st, band: c[cg], start, end };
    } catch (e) {
      throw new Error(`Ligne ${k + 2} : ${(e as Error).message}`);
    }
  });
  return { edition, sample: false, days: DAYS, slots };
}
