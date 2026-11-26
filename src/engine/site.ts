import type { Site, Stage } from './types';

/**
 * Stylised festival site. Our own drawing: the relative placement follows public descriptions
 * (two Mainstages side by side, Valley facing Warzone, covered Altar and Temple), not the official map.
 * The 2027 map with the 4 new stages is not published: their positions are guesses to update.
 */
export const SITE: Site = {
  metresPerTile: 12,
  stages: [
    { id: 'ms1', name: 'Mainstage 1', kind: 'main', x: 18, y: 12, w: 7, h: 4, genre: 'Têtes d’affiche' },
    { id: 'ms2', name: 'Mainstage 2', kind: 'main', x: 27, y: 12, w: 7, h: 4, genre: 'Têtes d’affiche' },
    { id: 'warzone', name: 'Warzone', kind: 'open', x: 37, y: 11, w: 5, h: 3, genre: 'Punk, hardcore' },
    { id: 'riot', name: 'Riot', kind: 'open', x: 39, y: 19, w: 4, h: 3, genre: 'Punk, crust' },
    { id: 'valley', name: 'Valley', kind: 'open', x: 31, y: 23, w: 5, h: 3, genre: 'Stoner, doom, sludge' },
    { id: 'abyss', name: 'Abyss', kind: 'tent', x: 38, y: 28, w: 4, h: 4, genre: 'Post-metal, atmo' },
    { id: 'altar', name: 'Altar', kind: 'tent', x: 7, y: 12, w: 5, h: 5, genre: 'Death, grind' },
    { id: 'temple', name: 'Temple', kind: 'tent', x: 7, y: 20, w: 5, h: 5, genre: 'Black, pagan' },
    { id: 'forge', name: 'Forge', kind: 'tent', x: 12, y: 28, w: 4, h: 4, genre: 'Thrash, heavy' },
    { id: 'crypt', name: 'Crypt', kind: 'tent', x: 5, y: 29, w: 4, h: 4, genre: 'Doom, death old school' },
  ],
  hubs: [
    { id: 'entree', name: 'Entrée', x: 22, y: 36 },
    { id: 'hellcity', name: 'Hell City', x: 22, y: 30 },
    { id: 'plaine', name: 'Plaine des Mainstages', x: 22, y: 17 },
    { id: 'est', name: 'Carrefour est', x: 33, y: 16 },
    { id: 'sudest', name: 'Carrefour sud-est', x: 32, y: 28 },
    { id: 'ouest', name: 'Carrefour ouest', x: 12, y: 17 },
    { id: 'sudouest', name: 'Carrefour sud-ouest', x: 11, y: 25 },
  ],
  edges: [
    { a: 'entree', b: 'hellcity' },
    { a: 'hellcity', b: 'plaine' },
    { a: 'plaine', b: 'ms1' },
    { a: 'plaine', b: 'ms2' },
    { a: 'ms1', b: 'ms2' },
    { a: 'plaine', b: 'est' },
    { a: 'ms2', b: 'est' },
    { a: 'est', b: 'warzone' },
    { a: 'est', b: 'riot' },
    { a: 'est', b: 'sudest' },
    { a: 'sudest', b: 'valley' },
    { a: 'sudest', b: 'abyss' },
    { a: 'hellcity', b: 'sudest' },
    { a: 'plaine', b: 'ouest' },
    { a: 'ms1', b: 'ouest' },
    { a: 'ouest', b: 'altar' },
    { a: 'ouest', b: 'temple' },
    { a: 'ouest', b: 'sudouest' },
    { a: 'sudouest', b: 'forge' },
    { a: 'sudouest', b: 'crypt' },
    { a: 'hellcity', b: 'sudouest' },
  ],
};

export function stageById(site: Site, id: string): Stage | undefined {
  return site.stages.find((s) => s.id === id);
}

function nodePos(site: Site, id: string): { x: number; y: number } {
  const n = site.stages.find((s) => s.id === id) ?? site.hubs.find((h) => h.id === id);
  if (!n) throw new Error(`Nœud inconnu : ${id}`);
  return { x: n.x, y: n.y };
}

/** Paths are never straight: crowds, barriers, bars. */
const DETOUR = 1.15;

export interface Route {
  nodes: string[];
  metres: number;
}

/** Shortest walking route between two nodes (Dijkstra on the path network). */
export function route(site: Site, from: string, to: string): Route {
  if (from === to) return { nodes: [from], metres: 0 };
  const adj = new Map<string, { to: string; m: number }[]>();
  for (const e of site.edges) {
    const a = nodePos(site, e.a);
    const b = nodePos(site, e.b);
    const m = Math.hypot(a.x - b.x, a.y - b.y) * site.metresPerTile * DETOUR;
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push({ to: e.b, m });
    adj.get(e.b)!.push({ to: e.a, m });
  }
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
  return stageById(site, stageId)?.kind === 'main' ? 4 : 2;
}

/** Door-to-door minutes from one stage to another, rounded up. */
export function walkMinutes(site: Site, from: string, to: string, cond: WalkConditions): number {
  if (from === to) return 0;
  const r = route(site, from, to);
  const speed = BASE_SPEED / (crowdFactor(cond.clock) * mudFactor(cond.precipMm));
  return Math.ceil(r.metres / speed + exitMinutes(site, from));
}
