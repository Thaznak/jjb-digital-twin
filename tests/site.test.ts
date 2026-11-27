import { describe, expect, it } from 'vitest';
import { crowdFactor, guide, insideSite, mudFactor, nearestNode, pointAlong, progress, route, SITE, toLatLon, toPlan, walkMinutes, type GeoAnchor } from '../src/engine';

describe('réseau de chemins', () => {
  it('relie toutes les scènes et lieux entre eux', () => {
    const ids = [...SITE.stages, ...SITE.hubs].map((n) => n.id);
    for (const id of ids) expect(() => route(SITE, 'entree', id)).not.toThrow();
  });

  it('les deux Mainstages sont plus proches que Warzone et Temple', () => {
    expect(route(SITE, 'ms1', 'ms2').metres).toBeLessThan(route(SITE, 'warzone', 'temple').metres);
  });

  it('un trajet traverse le site en quelques centaines de mètres', () => {
    const m = route(SITE, 'warzone', 'temple').metres;
    expect(m).toBeGreaterThan(300);
    expect(m).toBeLessThan(900);
  });
});

describe('temps de marche', () => {
  it('la foule du soir et la boue ralentissent', () => {
    const calm = walkMinutes(SITE, 'valley', 'altar', { clock: 14 * 60 });
    const night = walkMinutes(SITE, 'valley', 'altar', { clock: 22 * 60 });
    const mud = walkMinutes(SITE, 'valley', 'altar', { clock: 14 * 60, precipMm: 6 });
    expect(night).toBeGreaterThan(calm);
    expect(mud).toBeGreaterThan(calm);
    expect(crowdFactor(22 * 60)).toBeGreaterThan(crowdFactor(14 * 60));
    expect(mudFactor(0)).toBe(1);
  });

  it('quitter une Mainstage prend plus de temps', () => {
    const fromMain = walkMinutes(SITE, 'ms1', 'altar', { clock: 15 * 60 });
    const toMain = walkMinutes(SITE, 'altar', 'ms1', { clock: 15 * 60 });
    expect(fromMain).toBeGreaterThan(toMain);
  });
});

describe('guidage', () => {
  it('donne un départ, des virages et une arrivée', () => {
    const g = guide(SITE, { u: 45, v: 11.5 }, 'valley', { clock: 15 * 60 });
    expect(g.steps[0].kind).toBe('depart');
    expect(g.steps[g.steps.length - 1].kind).toBe('arrivee');
    expect(g.steps.slice(1, -1).every((s) => s.kind === 'gauche' || s.kind === 'droite')).toBe(true);
    expect(g.metres).toBeGreaterThan(0);
    const sum = g.steps.reduce((t, s) => t + s.metres, 0);
    expect(Math.abs(sum - g.metres)).toBeLessThan(5);
  });

  it('un virage à droite est reconnu (plan : v vers le sud)', () => {
    // Est puis sud : pour quelqu'un qui marche vers l'est, aller au sud c'est tourner à droite.
    const site = { ...SITE, stages: [], hubs: [{ id: 'a', name: 'A', u: 0, v: 0 }, { id: 'b', name: 'B', u: 10, v: 0 }, { id: 'c', name: 'C', u: 10, v: 10 }], edges: [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }] };
    const g = guide(site, { u: 0, v: 0 }, 'c', { clock: 12 * 60 });
    expect(g.steps.map((s) => s.kind)).toEqual(['depart', 'droite', 'arrivee']);
  });

  it('suit la progression et détecte une sortie d’itinéraire', () => {
    const g = guide(SITE, { u: 45, v: 11.5 }, 'warzone', { clock: 15 * 60 });
    const start = progress(SITE, g, g.points[0]);
    const mid = progress(SITE, g, g.points[Math.floor(g.points.length / 2)]);
    expect(mid.remaining).toBeLessThan(start.remaining);
    expect(progress(SITE, g, { u: 45, v: 40 }).offRoute).toBeGreaterThan(30);
  });

  it('place une personne en chemin entre deux scènes', () => {
    const p0 = pointAlong(SITE, 'warzone', 'temple', 0);
    const p1 = pointAlong(SITE, 'warzone', 'temple', 1);
    const half = pointAlong(SITE, 'warzone', 'temple', 0.5);
    expect(p0).toEqual({ u: 5, v: 18.5 });
    expect(p1).toEqual({ u: 39, v: 13.5 });
    expect(half.u).toBeGreaterThan(p0.u);
    expect(half.u).toBeLessThan(p1.u);
    expect(nearestNode(SITE, { u: 5.2, v: 18.4 })).toBe('warzone');
  });
});

describe('GPS', () => {
  const anchor: GeoAnchor = { lat: 47.09, lon: -1.27, at: { u: 28, v: 18 }, rotationDeg: 20 };
  it('aller-retour plan ↔ GPS', () => {
    const p = { u: 10, v: 30 };
    const ll = toLatLon(SITE, anchor, p);
    const back = toPlan(SITE, anchor, ll.lat, ll.lon);
    expect(back.u).toBeCloseTo(10, 6);
    expect(back.v).toBeCloseTo(30, 6);
  });
  it('100 m au nord, sans rotation, c’est 100/12 unités vers le haut du plan', () => {
    const a = { ...anchor, rotationDeg: 0 };
    const p = toPlan(SITE, a, 47.09 + 100 / 111_320, -1.27);
    expect(p.v).toBeCloseTo(18 - 100 / 12, 3);
    expect(insideSite(p)).toBe(true);
    expect(insideSite({ u: 200, v: 0 })).toBe(false);
  });
});
