import type { Point, Site, Stage } from './types';

/**
 * Stylised festival site, drawn by us from the public 2026 map: Mainstages side by side to the north,
 * Altar and Temple next to Hellcity, Warzone far west, Valley by the woods, Metal Corner towards the campsite.
 * The 4 stages announced for 2027 (Riot, Abyss, Forge, Crypt) have no published position: guesses to update.
 * Coordinates are plan units (u east, v south); 1 unit is about 12 m.
 */
export const SITE: Site = {
  metresPerUnit: 12,
  stages: [
    { id: 'ms1', name: 'Mainstage 1', kind: 'main', u: 27.5, v: 10, provisional: false, genre: 'Têtes d’affiche' },
    { id: 'ms2', name: 'Mainstage 2', kind: 'main', u: 20, v: 10.5, provisional: false, genre: 'Têtes d’affiche' },
    { id: 'altar', name: 'Altar', kind: 'tent', u: 34, v: 12.5, provisional: false, genre: 'Death, grind' },
    { id: 'temple', name: 'Temple', kind: 'tent', u: 39, v: 13.5, provisional: false, genre: 'Black, pagan' },
    { id: 'warzone', name: 'Warzone', kind: 'open', u: 5, v: 18.5, provisional: false, genre: 'Punk, hardcore' },
    { id: 'valley', name: 'Valley', kind: 'open', u: 16.5, v: 24.5, provisional: false, genre: 'Stoner, doom, sludge' },
    { id: 'riot', name: 'Riot', kind: 'tent', u: 8, v: 24, provisional: true, genre: 'Punk, crust' },
    { id: 'abyss', name: 'Abyss', kind: 'tent', u: 23, v: 26, provisional: true, genre: 'Post-metal, atmo' },
    { id: 'forge', name: 'Forge', kind: 'tent', u: 31, v: 17.5, provisional: true, genre: 'Thrash, heavy' },
    { id: 'crypt', name: 'Crypt', kind: 'tent', u: 36, v: 22.5, provisional: true, genre: 'Doom, death old school' },
  ],
  hubs: [
    { id: 'entree', name: 'Entrée', u: 45, v: 11 },
    { id: 'hellcity', name: 'Hellcity Square', u: 40, v: 15.5 },
    { id: 'hellcity-sud', name: 'Hellcity sud', u: 41, v: 21 },
    { id: 'carrefour-altar', name: 'Carrefour Altar', u: 34, v: 16 },
    { id: 'plaine', name: 'Plaine des Mainstages', u: 26, v: 15.5 },
    { id: 'avant-ms', name: 'Devant les Mainstages', u: 22, v: 13 },
    { id: 'clairiere', name: 'Clairière', u: 30, v: 20.5 },
    { id: 'carrefour-valley', name: 'Carrefour Valley', u: 22, v: 21.5 },
    { id: 'bois-ouest', name: 'Bois ouest', u: 14, v: 19.5 },
    { id: 'carrefour-warzone', name: 'Carrefour Warzone', u: 8.5, v: 18.5 },
    { id: 'grande-roue', name: 'Grande roue', u: 14, v: 12.5 },
    { id: 'chemin-nord', name: 'Chemin nord', u: 11, v: 16 },
    { id: 'metal-corner', name: 'Metal Corner', u: 47, v: 27.5 },
    { id: 'camping', name: 'Accès camping', u: 53, v: 34 },
  ],
  edges: [
    { a: 'entree', b: 'hellcity' },
    { a: 'hellcity', b: 'carrefour-altar' },
    { a: 'hellcity', b: 'temple' },
    { a: 'hellcity', b: 'hellcity-sud' },
    { a: 'altar', b: 'temple' },
    { a: 'altar', b: 'carrefour-altar' },
    { a: 'altar', b: 'plaine' },
    { a: 'carrefour-altar', b: 'plaine' },
    { a: 'carrefour-altar', b: 'forge' },
    { a: 'carrefour-altar', b: 'clairiere' },
    { a: 'plaine', b: 'avant-ms' },
    { a: 'plaine', b: 'ms1' },
    { a: 'avant-ms', b: 'ms1' },
    { a: 'avant-ms', b: 'ms2' },
    { a: 'ms1', b: 'ms2' },
    { a: 'avant-ms', b: 'grande-roue' },
    { a: 'grande-roue', b: 'chemin-nord' },
    { a: 'chemin-nord', b: 'carrefour-warzone' },
    { a: 'carrefour-warzone', b: 'warzone' },
    { a: 'carrefour-warzone', b: 'riot' },
    { a: 'carrefour-warzone', b: 'bois-ouest' },
    { a: 'bois-ouest', b: 'valley' },
    { a: 'bois-ouest', b: 'carrefour-valley' },
    { a: 'carrefour-valley', b: 'valley' },
    { a: 'carrefour-valley', b: 'abyss' },
    { a: 'carrefour-valley', b: 'clairiere' },
    { a: 'clairiere', b: 'forge' },
    { a: 'clairiere', b: 'crypt' },
    { a: 'crypt', b: 'hellcity-sud' },
    { a: 'hellcity-sud', b: 'metal-corner' },
    { a: 'metal-corner', b: 'camping' },
  ],
  pois: [
    { id: 'eau-1', kind: 'eau', name: 'Point d’eau Warzone', u: 7, v: 20.5 },
    { id: 'eau-2', kind: 'eau', name: 'Point d’eau Grande roue', u: 13, v: 11 },
    { id: 'eau-3', kind: 'eau', name: 'Point d’eau Altar', u: 31.5, v: 13.5 },
    { id: 'eau-4', kind: 'eau', name: 'Point d’eau Hellcity', u: 43, v: 19.5 },
    { id: 'eau-5', kind: 'eau', name: 'Point d’eau Metal Corner', u: 50, v: 27 },
    { id: 'wc-1', kind: 'wc', name: 'Toilettes Warzone', u: 9, v: 21 },
    { id: 'wc-2', kind: 'wc', name: 'Toilettes Grande roue', u: 15.5, v: 11 },
    { id: 'wc-3', kind: 'wc', name: 'Toilettes Mainstages', u: 31, v: 10.5 },
    { id: 'wc-4', kind: 'wc', name: 'Toilettes Hellcity', u: 38, v: 18 },
    { id: 'wc-5', kind: 'wc', name: 'Toilettes Valley', u: 19, v: 26.5 },
    { id: 'wc-6', kind: 'wc', name: 'Toilettes Metal Corner', u: 51, v: 29.5 },
    { id: 'secours-1', kind: 'secours', name: 'Poste de secours ouest', u: 11.5, v: 13.5 },
    { id: 'secours-2', kind: 'secours', name: 'Poste de secours Hellcity', u: 38.5, v: 15 },
    { id: 'secours-3', kind: 'secours', name: 'Poste de secours Metal Corner', u: 52, v: 31.5 },
    { id: 'bar-1', kind: 'bar', name: 'Bar de la plaine', u: 24.5, v: 17 },
    { id: 'bar-2', kind: 'bar', name: 'Bar du bois', u: 18, v: 27.5 },
    { id: 'bar-3', kind: 'bar', name: 'Bar Hellcity', u: 44, v: 15.5 },
    { id: 'bar-4', kind: 'bar', name: 'Bars du Metal Corner', u: 46, v: 25.5 },
    { id: 'info', kind: 'info', name: 'Point infos, objets trouvés', u: 42.5, v: 17.5 },
  ],
};

export const POI_LABELS: Record<string, string> = { eau: 'Eau', wc: 'WC', secours: 'Secours', bar: 'Bars', info: 'Infos' };

export function stageById(site: Site, id: string): Stage | undefined {
  return site.stages.find((s) => s.id === id);
}

export function nodePoint(site: Site, id: string): Point {
  const n = site.stages.find((s) => s.id === id) ?? site.hubs.find((h) => h.id === id);
  if (!n) throw new Error(`Nœud inconnu : ${id}`);
  return { u: n.u, v: n.v };
}

export function nodeName(site: Site, id: string): string {
  return (site.stages.find((s) => s.id === id) ?? site.hubs.find((h) => h.id === id))?.name ?? id;
}

/** Paths are never straight: crowds, barriers, bars. */
const DETOUR = 1.1;

export function metres(site: Site, a: Point, b: Point): number {
  return Math.hypot(a.u - b.u, a.v - b.v) * site.metresPerUnit;
}

export interface Route {
  nodes: string[];
  metres: number;
}

function adjacency(site: Site) {
  const adj = new Map<string, { to: string; m: number }[]>();
  for (const e of site.edges) {
    const m = metres(site, nodePoint(site, e.a), nodePoint(site, e.b)) * DETOUR;
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push({ to: e.b, m });
    adj.get(e.b)!.push({ to: e.a, m });
  }
  return adj;
}

/** Shortest walking route between two nodes (Dijkstra on the path network). */
export function route(site: Site, from: string, to: string): Route {
  if (from === to) return { nodes: [from], metres: 0 };
  const adj = adjacency(site);
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const open = new Set<string>([from]);
  while (open.size) {
    let cur = '';
    let best = Infinity;
    for (const n of open) {
      const d = dist.get(n)!;
      if (d < best) {
        best = d;
        cur = n;
      }
    }
    open.delete(cur);
    if (cur === to) break;
    for (const { to: nb, m } of adj.get(cur) ?? []) {
      const nd = best + m;
      if (nd < (dist.get(nb) ?? Infinity)) {
        dist.set(nb, nd);
        prev.set(nb, cur);
        open.add(nb);
      }
    }
  }
  if (!dist.has(to)) throw new Error(`Pas de chemin entre ${from} et ${to}`);
  const nodes = [to];
  while (nodes[0] !== from) nodes.unshift(prev.get(nodes[0])!);
  return { nodes, metres: Math.round(dist.get(to)!) };
}

/** Closest node of the path network to a free point (a GPS fix or a chosen start). */
export function nearestNode(site: Site, p: Point): string {
  let best = '';
  let d = Infinity;
  for (const n of [...site.stages, ...site.hubs]) {
    const dn = Math.hypot(n.u - p.u, n.v - p.v);
    if (dn < d) {
      d = dn;
      best = n.id;
    }
  }
  return best;
}

export interface WalkConditions {
  /** Minutes since midnight of the festival day. */
  clock: number;
  /** Rain in mm over the hour. Mud slows everyone down. */
  precipMm?: number;
}

/** Walking speed in a festival crowd, metres per minute. */
export const BASE_SPEED = 65;

/** Crowd density by time of day: light in the afternoon, packed around headliners. */
export function crowdFactor(clock: number): number {
  const h = (clock / 60) % 24;
  if (h >= 20 && h < 24.5) return 1.45;
  if (h >= 17 && h < 20) return 1.25;
  if (h < 3) return 1.2;
  return 1.05;
}

export function mudFactor(precipMm = 0): number {
  if (precipMm >= 4) return 1.3;
  if (precipMm >= 1) return 1.15;
  return 1;
}

/** Time to leave a crowd before walking: longer in front of a Mainstage. */
export function exitMinutes(site: Site, stageId: string): number {
  const s = stageById(site, stageId);
  if (!s) return 0;
  return s.kind === 'main' ? 4 : 2;
}

export function minutesFor(m: number, cond: WalkConditions): number {
  return m / (BASE_SPEED / (crowdFactor(cond.clock) * mudFactor(cond.precipMm)));
}

/** Door-to-door minutes from one node to another, rounded up. */
export function walkMinutes(site: Site, from: string, to: string, cond: WalkConditions): number {
  if (from === to) return 0;
  return Math.ceil(minutesFor(route(site, from, to).metres, cond) + exitMinutes(site, from));
}
