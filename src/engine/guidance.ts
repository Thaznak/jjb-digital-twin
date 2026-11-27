import type { Point, Site } from './types';
import { metres, minutesFor, nearestNode, nodeName, nodePoint, route, type WalkConditions } from './site';

export type StepKind = 'depart' | 'gauche' | 'droite' | 'tout-droit' | 'arrivee';

export interface Step {
  kind: StepKind;
  at: Point;
  /** Metres walked since the previous step. */
  metres: number;
  /** Name of the place the step leads to. */
  towards: string;
}

export interface Guide {
  points: Point[];
  nodes: string[];
  metres: number;
  minutes: number;
  steps: Step[];
}

/** Turns sharper than this count as a turn; below, it is "continue straight". */
const TURN_DEG = 35;

function heading(a: Point, b: Point) {
  return Math.atan2(b.v - a.v, b.u - a.u);
}

/**
 * Walking guidance from a free point (GPS fix or chosen start) to a node.
 * Plan coordinates have v pointing south, so a positive cross product is a right turn.
 */
export function guide(site: Site, from: Point, toId: string, cond: WalkConditions): Guide {
  const start = nearestNode(site, from);
  const r = route(site, start, toId);
  const pts: Point[] = [from, ...r.nodes.map((n) => nodePoint(site, n))].filter((p, i, a) => i === 0 || Math.hypot(p.u - a[i - 1].u, p.v - a[i - 1].v) > 0.05);
  const names = [null, ...r.nodes.map((n) => nodeName(site, n))].slice(-pts.length);
  const total = pts.slice(1).reduce((t, p, i) => t + metres(site, pts[i], p), 0);
  const steps: Step[] = [{ kind: 'depart', at: pts[0], metres: 0, towards: names[1] ?? nodeName(site, toId) }];
  let acc = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    acc += metres(site, pts[i - 1], pts[i]);
    let d = heading(pts[i], pts[i + 1]) - heading(pts[i - 1], pts[i]);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const deg = (d * 180) / Math.PI;
    const kind: StepKind = Math.abs(deg) < TURN_DEG ? 'tout-droit' : deg > 0 ? 'droite' : 'gauche';
    if (kind === 'tout-droit') continue;
    steps.push({ kind, at: pts[i], metres: Math.round(acc), towards: names[i + 1] ?? '' });
    acc = 0;
  }
  acc += pts.length > 1 ? metres(site, pts[pts.length - 2], pts[pts.length - 1]) : 0;
  steps.push({ kind: 'arrivee', at: pts[pts.length - 1], metres: Math.round(acc), towards: nodeName(site, toId) });
  return { points: pts, nodes: r.nodes, metres: Math.round(total), minutes: Math.max(1, Math.ceil(minutesFor(total, cond))), steps };
}

export function stepText(s: Step): string {
  switch (s.kind) {
    case 'depart':
      return `Partez vers ${s.towards}`;
    case 'gauche':
      return 'Tournez à gauche';
    case 'droite':
      return 'Tournez à droite';
    case 'tout-droit':
      return 'Continuez tout droit';
    case 'arrivee':
      return `Vous êtes arrivé : ${s.towards}`;
  }
}

export interface Progress {
  /** Metres from the start along the route. */
  along: number;
  remaining: number;
  /** Index of the next step to announce. */
  next: number;
  /** Metres to that step. */
  toNext: number;
  /** Distance from the route, metres. Above ~30 m the person is off route. */
  offRoute: number;
}

/** Projects a position on the route and finds the next instruction. */
export function progress(site: Site, g: Guide, pos: Point): Progress {
  let bestD = Infinity;
  let bestAlong = 0;
  let along = 0;
  for (let i = 0; i < g.points.length - 1; i++) {
    const a = g.points[i];
    const b = g.points[i + 1];
    const du = b.u - a.u;
    const dv = b.v - a.v;
    const len2 = du * du + dv * dv || 1e-9;
    const t = Math.max(0, Math.min(1, ((pos.u - a.u) * du + (pos.v - a.v) * dv) / len2));
    const proj = { u: a.u + du * t, v: a.v + dv * t };
    const d = metres(site, proj, pos);
    const seg = metres(site, a, b);
    if (d < bestD) {
      bestD = d;
      bestAlong = along + seg * t;
    }
    along += seg;
  }
  let cum = 0;
  let next = g.steps.length - 1;
  let toNext = along - bestAlong;
  for (let i = 1; i < g.steps.length; i++) {
    cum += g.steps[i].metres;
    if (cum > bestAlong + 5) {
      next = i;
      toNext = cum - bestAlong;
      break;
    }
  }
  return { along: Math.round(bestAlong), remaining: Math.max(0, Math.round(along - bestAlong)), next, toNext: Math.max(0, Math.round(toNext)), offRoute: Math.round(bestD) };
}

/** Point at a fraction (0..1) of the walking route between two nodes. Used to draw people on the move. */
export function pointAlong(site: Site, from: string, to: string, fraction: number): Point {
  const pts = route(site, from, to).nodes.map((n) => nodePoint(site, n));
  if (pts.length === 1) return pts[0];
  const lens = pts.slice(1).map((p, i) => metres(site, pts[i], p));
  let target = Math.max(0, Math.min(1, fraction)) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i] || i === lens.length - 1) {
      const t = lens[i] ? Math.min(1, target / lens[i]) : 1;
      return { u: pts[i].u + (pts[i + 1].u - pts[i].u) * t, v: pts[i].v + (pts[i + 1].v - pts[i].v) * t };
    }
    target -= lens[i];
  }
  return pts[pts.length - 1];
}
