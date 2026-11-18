import { BELTS, type Belt, type Member, type MonthlyHistory, type Segment } from '../engine/types';

/** Minimal CSV parser: comma or semicolon, quoted fields, header row. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const split = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (c === sep && !q) {
        out.push(cur);
        cur = '';
      } else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const norm = (h: string) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const header = split(lines[0]).map(norm);
  return lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
}

const num = (s: string | undefined) => {
  if (s === undefined || s === '') return undefined;
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** History CSV: mois, ca, adherents, [inscriptions], [departs]. */
export function parseHistoryCsv(text: string): { rows: MonthlyHistory[]; errors: string[] } {
  const errors: string[] = [];
  const rows: MonthlyHistory[] = [];
  parseCsv(text).forEach((r, i) => {
    const month = (r.mois ?? r.month ?? '').slice(0, 7);
    const revenue = num(r.ca ?? r.revenue ?? r.chiffre_d_affaires);
    const members = num(r.adherents ?? r.members);
    if (!/^\d{4}-\d{2}$/.test(month) || revenue === undefined || members === undefined) {
      errors.push(`Ligne ${i + 2} ignorée : il faut mois (AAAA-MM), ca et adherents.`);
      return;
    }
    rows.push({ month, revenue, members, signups: num(r.inscriptions ?? r.signups), departures: num(r.departs ?? r.departures) });
  });
  return { rows, errors };
}

/** Members CSV: id, segment, ceinture, age, date_inscription, seances_semaine. Names and contacts are dropped on purpose. */
export function parseMembersCsv(text: string): { rows: Member[]; errors: string[]; droppedColumns: string[] } {
  const errors: string[] = [];
  const parsed = parseCsv(text);
  const personal = ['nom', 'prenom', 'email', 'mail', 'telephone', 'tel', 'adresse', 'phone', 'name'];
  const droppedColumns = parsed.length ? Object.keys(parsed[0]).filter((k) => personal.some((p) => k.includes(p))) : [];
  const rows: Member[] = [];
  parsed.forEach((r, i) => {
    const belt = (r.ceinture ?? r.belt ?? 'blanche').toLowerCase() as Belt;
    const segRaw = (r.segment ?? r.categorie ?? '').toLowerCase();
    const age = num(r.age) ?? 30;
    const segment: Segment = segRaw.startsWith('enf') || segRaw.startsWith('kid') || (!segRaw && age < 16) ? 'enfant' : 'adulte';
    if (!BELTS.includes(belt)) errors.push(`Ligne ${i + 2} : ceinture « ${belt} » inconnue, remplacée par blanche.`);
    rows.push({
      id: r.id || `M${String(i + 1).padStart(3, '0')}`,
      segment,
      belt: BELTS.includes(belt) ? belt : 'blanche',
      age,
      joinDate: (r.date_inscription ?? r.inscription ?? r.join_date ?? '').slice(0, 10) || '2024-09-01',
      sessionsPerWeek: num(r.seances_semaine ?? r.seances ?? r.sessions) ?? 2,
    });
  });
  return { rows, errors, droppedColumns };
}

export function membersToCsv(members: Member[]): string {
  return ['id,segment,ceinture,age,date_inscription,seances_semaine', ...members.map((m) => [m.id, m.segment, m.belt, m.age, m.joinDate, m.sessionsPerWeek].join(','))].join('\n');
}

export const HISTORY_CSV_EXAMPLE = `mois,ca,adherents,inscriptions,departs
2025-09,5900,128,31,4
2025-10,5800,131,9,6
2025-11,5650,129,4,6
2025-12,5500,126,2,5
2026-01,5700,129,8,5
2026-02,5600,128,3,4`;
