import { SITE, type Point, type Stage } from '../engine';

/**
 * Vector art of the three map levels, in the « Clisson clair » style of the Figma mockups:
 * teal sky, bright grass slab with an earth edge, dark arched stage shells, cone trees.
 * Oblique projection: depth (v) goes up and slightly left, so the front and right faces show.
 * Pure string building: no DOM, so it can be tested and pre-rendered.
 */

export type Level = 'site' | 'abords' | 'clisson';

export const ART = {
  skyTop: '#0B5E57',
  skyBottom: '#063C37',
  grass: '#6DAF4B',
  grassDark: '#4E8E3C',
  grassSide: '#3F7A3B',
  earth: '#C27A3C',
  earthDark: '#8A5A2F',
  sand: '#E9C98A',
  sandDark: '#D9B26E',
  path: '#D69E5B',
  shell: '#294139',
  shellDark: '#173F39',
  shellTop: '#405448',
  screen: '#FFD69A',
  tent: '#273D39',
  tentSide: '#1B2F2B',
  rib: '#E8EEE6',
  newFill: '#2B6E6A',
  newLine: '#FFD69A',
  tree: '#3F8A3A',
  treeDark: '#2D6430',
  trunk: '#7A5233',
  ink: '#0B0B0C',
  cream: '#EFE6D2',
  orange: '#F08A24',
  water: '#7CC4D8',
  road: '#5B5F5A',
  roadLine: '#EFE6D2',
  roof: '#B5543A',
  wall: '#E9D3A3',
  camp: ['#F08A24', '#5FB3D9', '#E9707C', '#8FD16A', '#F2C14E', '#EFE6D2'],
};

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Frame {
  width: number;
  height: number;
  /** Projection of plan coordinates into the SVG. */
  k: number;
  ox: number;
  oy: number;
}

export const FRAMES: Record<Level, Frame> = {
  site: { width: 1700, height: 1000, k: 26, ox: 40, oy: 150 },
  abords: { width: 1700, height: 1100, k: 13, ox: 40, oy: 140 },
  clisson: { width: 1700, height: 1200, k: 8, ox: 40, oy: 120 },
};

const SKEW = 0.25;
const SQUASH = 0.55;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function project(f: Frame, p: Point, z = 0): { x: number; y: number } {
  return { x: r1(f.ox + p.u * f.k + (40 - p.v) * f.k * SKEW), y: r1(f.oy + p.v * f.k * SQUASH - z) };
}

class Painter {
  items: { d: string; z: number }[] = [];
  box4 = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  constructor(public f: Frame) {}
  P(u: number, v: number, z = 0) {
    const q = project(this.f, { u, v }, z);
    this.box4.x0 = Math.min(this.box4.x0, q.x);
    this.box4.x1 = Math.max(this.box4.x1, q.x);
    this.box4.y0 = Math.min(this.box4.y0, q.y);
    this.box4.y1 = Math.max(this.box4.y1, q.y + 30);
    return q;
  }
  viewBox(pad = 60): ViewBox {
    const b = this.box4;
    return { x: Math.floor(b.x0 - pad), y: Math.floor(b.y0 - pad * 2), w: Math.ceil(b.x1 - b.x0 + pad * 2), h: Math.ceil(b.y1 - b.y0 + pad * 3) };
  }
  add(d: string, z: number) {
    this.items.push({ d, z });
  }
  poly(pts: { x: number; y: number }[], fill: string, z: number, extra = '') {
    this.add(`<polygon points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="${fill}" ${extra}/>`, z);
  }
  area(uv: [number, number][], fill: string, z = -1000, extra = '') {
    this.poly(uv.map(([u, v]) => this.P(u, v)), fill, z, extra);
  }
  /** Ground slab: top face plus an earth edge below its southern outline. */
  slab(uv: [number, number][], top: string, depth = 16) {
    const pts = uv.map(([u, v]) => this.P(u, v));
    const low = pts.map((p) => ({ x: p.x, y: p.y + depth }));
    this.poly(low, ART.earthDark, -3001);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (b.x <= a.x) continue; // only edges that face the viewer
      this.poly([a, b, { x: b.x, y: b.y + depth }, { x: a.x, y: a.y + depth }], ART.earth, -3000);
    }
    this.poly(pts, top, -2999);
  }
  line(uv: [number, number][], color: string, w: number, z = -900, extra = '') {
    const pts = uv.map(([u, v]) => this.P(u, v));
    this.add(`<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`, z);
  }
  /** Axis-aligned box: footprint [u0,u0+w] x [v0,v0+d], height h px. */
  box(u0: number, v0: number, w: number, d: number, h: number, color: string, side: string, top: string, extra = '') {
    const A = this.P(u0, v0), B = this.P(u0 + w, v0), C = this.P(u0 + w, v0 + d), D = this.P(u0, v0 + d);
    const up = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - h });
    const z = D.y;
    this.poly([B, C, up(C), up(B)], side, z, extra);
    this.poly([D, C, up(C), up(D)], color, z, extra);
    this.poly([up(A), up(B), up(C), up(D)], top, z, extra);
    return { A, B, C, D, z, h };
  }
  tree(u: number, v: number, s = 1) {
    const p = this.P(u, v);
    const h = 30 * s;
    const w = 9 * s;
    this.add(
      `<ellipse cx="${r1(p.x + 4 * s)}" cy="${r1(p.y + 1)}" rx="${r1(9 * s)}" ry="${r1(3 * s)}" fill="#000" opacity=".18"/>` +
        `<rect x="${r1(p.x - 1.2 * s)}" y="${r1(p.y - 6 * s)}" width="${r1(2.4 * s)}" height="${r1(6 * s)}" fill="${ART.trunk}"/>` +
        `<path d="M${r1(p.x - w)} ${r1(p.y - 5 * s)} Q${r1(p.x - w * 0.9)} ${r1(p.y - h * 0.7)} ${p.x} ${r1(p.y - h)} Q${r1(p.x + w * 0.9)} ${r1(p.y - h * 0.7)} ${r1(p.x + w)} ${r1(p.y - 5 * s)} Z" fill="${ART.tree}"/>` +
        `<path d="M${p.x} ${r1(p.y - h)} Q${r1(p.x + w * 0.9)} ${r1(p.y - h * 0.7)} ${r1(p.x + w)} ${r1(p.y - 5 * s)} L${p.x} ${r1(p.y - 5 * s)} Z" fill="${ART.treeDark}"/>`,
      p.y,
    );
  }
  forest(cu: number, cv: number, ru: number, rv: number, n: number, seed: number, s = 1) {
    let a = seed;
    const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const t = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd());
      pts.push([cu + Math.cos(t) * ru * d, cv + Math.sin(t) * rv * d, s * (0.75 + rnd() * 0.55)]);
    }
    pts.sort((p, q) => p[1] - q[1]).forEach(([u, v, sc]) => this.tree(u, v, sc));
  }
  /** Front-facing arched shell (Mainstage, Warzone, Valley). (u,v) is the front centre. */
  shell(u: number, v: number, w: number, d: number, h: number, screens: boolean) {
    const u0 = u - w / 2;
    const v0 = v - d;
    const b = this.box(u0, v0, w, d, h * 0.62, ART.shell, ART.shellDark, ART.shellTop);
    const D = b.D, C = b.C;
    const top = h * 0.62;
    const midx = (D.x + C.x) / 2;
    const arc = h * 0.38;
    // Arched roof over the front face, and its depth to the back.
    const back = this.P(u0 + w, v0);
    this.add(
      `<path d="M${D.x} ${r1(D.y - top)} Q${r1(midx)} ${r1(D.y - top - arc * 2)} ${C.x} ${r1(C.y - top)} L${back.x} ${r1(back.y - top)} Q${r1(midx + (back.x - C.x))} ${r1(back.y - top - arc * 2)} ${r1(D.x + (back.x - C.x))} ${r1(back.y - top)} Z" fill="${ART.shellTop}" stroke="${ART.ink}" stroke-opacity=".25"/>` +
        `<path d="M${D.x} ${r1(D.y - top)} Q${r1(midx)} ${r1(D.y - top - arc * 2)} ${C.x} ${r1(C.y - top)} Z" fill="${ART.shell}"/>`,
      b.z + 0.1,
    );
    // Stage opening with lights and a lit strip.
    const ow = (C.x - D.x) * 0.72;
    const ox = midx - ow / 2;
    const oy = D.y - top * 0.95;
    this.add(
      `<path d="M${r1(ox)} ${r1(D.y - 4)} L${r1(ox)} ${r1(oy + arc * 0.4)} Q${r1(midx)} ${r1(oy - arc * 0.9)} ${r1(ox + ow)} ${r1(oy + arc * 0.4)} L${r1(ox + ow)} ${r1(D.y - 4)} Z" fill="${ART.shellDark}"/>` +
        `<rect x="${r1(ox + ow * 0.15)}" y="${r1(D.y - top * 0.32)}" width="${r1(ow * 0.7)}" height="3" fill="${ART.orange}"/>` +
        Array.from({ length: 5 }, (_, i) => `<circle cx="${r1(ox + ow * (0.18 + i * 0.16))}" cy="${r1(oy + arc * 0.5)}" r="2.2" fill="${i % 2 ? ART.orange : ART.screen}"/>`).join(''),
      b.z + 0.2,
    );
    if (screens) {
      for (const sx of [D.x - 16, C.x + 4]) {
        this.add(
          `<rect x="${r1(sx)}" y="${r1(D.y - top * 1.05)}" width="12" height="${r1(top * 0.9)}" fill="${ART.shellDark}" stroke="${ART.ink}" stroke-opacity=".4"/>` +
            `<path d="M${r1(sx + 6)} ${r1(D.y - top * 0.85)} l5 10 l-5 10 l-5 -10 Z" fill="${ART.screen}"/>`,
          b.z + 0.3,
        );
      }
    }
    return { x: midx, y: D.y - top - arc * 1.6 };
  }
  /** Long hangar tent with white ribs (Altar, Temple). (u,v) is the front centre. */
  hangar(u: number, v: number, w: number, d: number, h: number) {
    const u0 = u - w / 2;
    const v0 = v - d;
    const D = this.P(u0, v), C = this.P(u0 + w, v), B = this.P(u0 + w, v0), A = this.P(u0, v0);
    const z = D.y;
    const wall = h * 0.45;
    const arc = h * 0.55;
    const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    // Right side wall, roof (barrel) then front gable.
    this.poly([C, B, { x: B.x, y: B.y - wall }, { x: C.x, y: C.y - wall }], ART.tentSide, z);
    const fm = mid(D, C);
    const bm = mid(A, B);
    this.add(
      `<path d="M${D.x} ${r1(D.y - wall)} Q${r1(fm.x)} ${r1(fm.y - wall - arc * 2)} ${C.x} ${r1(C.y - wall)} L${B.x} ${r1(B.y - wall)} Q${r1(bm.x)} ${r1(bm.y - wall - arc * 2)} ${A.x} ${r1(A.y - wall)} Z" fill="${ART.tent}"/>`,
      z + 0.1,
    );
    let ribs = '';
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const L = { x: D.x + (A.x - D.x) * t, y: D.y + (A.y - D.y) * t };
      const R = { x: C.x + (B.x - C.x) * t, y: C.y + (B.y - C.y) * t };
      const M = mid(L, R);
      ribs += `<path d="M${r1(L.x)} ${r1(L.y - wall)} Q${r1(M.x)} ${r1(M.y - wall - arc * 2)} ${r1(R.x)} ${r1(R.y - wall)}" fill="none" stroke="${ART.rib}" stroke-width="1.6" stroke-opacity=".85"/>`;
    }
    this.add(ribs, z + 0.2);
    this.add(
      `<path d="M${D.x} ${D.y} L${D.x} ${r1(D.y - wall)} Q${r1(fm.x)} ${r1(fm.y - wall - arc * 2)} ${C.x} ${r1(C.y - wall)} L${C.x} ${C.y} Z" fill="${ART.shellDark}" stroke="${ART.ink}" stroke-opacity=".3"/>` +
        `<rect x="${r1(fm.x - (C.x - D.x) * 0.22)}" y="${r1(D.y - wall * 0.9)}" width="${r1((C.x - D.x) * 0.44)}" height="${r1(wall * 0.9)}" fill="${ART.tentSide}"/>` +
        Array.from({ length: 4 }, (_, i) => `<line x1="${r1(D.x + ((C.x - D.x) * (i + 1)) / 5)}" y1="${r1(D.y - wall * 0.2)}" x2="${r1(D.x + ((C.x - D.x) * (i + 1)) / 5)}" y2="${r1(D.y - wall * 0.75)}" stroke="${ART.rib}" stroke-opacity=".6"/>`).join(''),
      z + 0.3,
    );
    return { x: fm.x, y: fm.y - wall - arc * 1.4 };
  }
  /** Translucent cube with a dashed outline: a 2027 stage whose position is not published. */
  ghost(u: number, v: number, w: number) {
    const ex = `stroke="${ART.newLine}" stroke-width="1.6" stroke-dasharray="5 4" fill-opacity=".78"`;
    const b = this.box(u - w / 2, v - w, w, w, 46, ART.newFill, '#1F5653', '#3C8A84', ex);
    const D = b.D, C = b.C;
    const top = { x: (D.x + C.x) / 2, y: D.y - 46 };
    this.add(`<path d="M${D.x} ${r1(D.y - 46)} L${r1(top.x + 10)} ${r1(top.y - 22)} L${C.x} ${r1(C.y - 46)}" fill="none" stroke="${ART.newLine}" stroke-opacity=".7"/>`, b.z + 0.1);
    return { x: top.x, y: top.y - 26 };
  }
  /** Inner SVG content (no <svg> wrapper): the map view puts it in its own SVG with overlays. */
  body() {
    return this.items
      .sort((a, b) => a.z - b.z)
      .map((i) => i.d)
      .join('');
  }
  svg() {
    const vb = this.viewBox();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${vb.w}" height="${vb.h}"><rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${ART.skyBottom}"/>${this.body()}</svg>`;
  }
}

/** Where to pin each stage name on the site level, in SVG coordinates. */
export type Anchors = Record<string, { x: number; y: number }>;

function siteArt(): Built {
  const p = new Painter(FRAMES.site);
  p.slab([[1, 15], [11, 10.5], [12, 5], [20, 0.5], [34, 1], [39, 5.5], [47, 8], [51, 12], [49, 22], [57, 26.5], [56, 37], [42, 31], [36, 26], [25, 29], [19, 33], [11, 31], [1, 24]], ART.grass);
  // Crowd areas, sand coloured, in front of the big stages.
  p.area([[16, 10.5], [31, 10], [32, 14.5], [15, 15]], ART.sand, -2500);
  p.area([[1.5, 18.5], [9, 18], [10, 22], [2, 23]], ART.sand, -2500);
  p.area([[12.5, 24.5], [21, 24], [20, 28.5], [13, 28.5]], ART.sand, -2500);
  p.area([[37, 13.5], [48, 11.5], [50, 21.5], [40, 23.5]], ART.sandDark, -2500); // Hellcity square
  p.area([[41, 24.5], [53, 25], [56, 33.5], [44, 29.5]], ART.grassDark, -2500); // Metal Corner
  // Paths: drawn from the walking network so map and routing agree.
  const pt = (id: string) => {
    const n = SITE.stages.find((s) => s.id === id) ?? SITE.hubs.find((h) => h.id === id)!;
    return [n.u, n.v] as [number, number];
  };
  for (const e of SITE.edges) p.line([pt(e.a), pt(e.b)], ART.earth, 15, -2200);
  for (const e of SITE.edges) p.line([pt(e.a), pt(e.b)], ART.path, 11, -2100);
  // Woods.
  p.forest(19, 18.5, 6, 2.6, 75, 7, 1.15);
  p.forest(29, 23.5, 3.5, 1.5, 22, 11, 1);
  p.forest(3, 9, 3, 3, 26, 5, 1.1);
  p.forest(52, 18, 3, 3, 18, 13, 1);
  p.forest(31, 29, 5, 1.2, 18, 17, 0.9);
  const anchors: Anchors = {};
  const big = (s: Stage) => (s.kind === 'main' ? p.shell(s.u, s.v - 1.2, 7, 2.8, 92, true) : s.kind === 'open' ? p.shell(s.u, s.v - 1.2, 4.5, 2.2, 62, false) : s.provisional ? p.ghost(s.u, s.v - 0.8, 2.6) : p.hangar(s.u, s.v - 0.8, 4.4, 4.2, 70));
  for (const s of SITE.stages) anchors[s.id] = big(s);
  // Hellcity shops and Hell Stage.
  for (let i = 0; i < 5; i++) p.box(39 + i * 1.9, 19.5, 1.4, 1.2, 22, i % 2 ? '#B5543A' : '#E9D3A3', i % 2 ? '#8E3F2B' : '#C9B183', i % 2 ? '#D06B4E' : '#F3E3BD');
  anchors.hellstage = p.shell(43.5, 17.2, 2.6, 1.4, 40, false);
  // Entrance gate: two towers and a lintel (our own design).
  p.box(46.2, 9.4, 1.1, 1, 70, '#7B7A72', '#5E5D57', '#9A988E');
  p.box(48.8, 9.9, 1.1, 1, 70, '#7B7A72', '#5E5D57', '#9A988E');
  p.box(46.2, 9.4, 3.7, 1, 12, '#5E5D57', '#4A4944', '#7B7A72');
  anchors.entree = p.P(48, 9.4, 100);
  // Metal Corner bars.
  for (let i = 0; i < 4; i++) p.box(45.5 + i * 2.2, 26.5 + i * 0.7, 1.5, 1, 18, '#D69E5B', '#A8743F', '#E9C98A');
  // Light towers and the Ferris wheel.
  for (const [u, v] of [[22, 16.5], [26, 19], [35, 15], [12, 16]] as [number, number][]) {
    const a = p.P(u, v);
    p.add(`<line x1="${a.x}" y1="${a.y}" x2="${a.x}" y2="${r1(a.y - 64)}" stroke="#4B4E4A" stroke-width="2"/><path d="M${r1(a.x - 7)} ${r1(a.y - 64)} h14 M${r1(a.x - 5)} ${r1(a.y - 60)} h10" stroke="#4B4E4A" stroke-width="2"/>`, a.y);
  }
  const fw = p.P(13.5, 11.2);
  p.add(
    `<circle cx="${fw.x}" cy="${r1(fw.y - 48)}" r="34" fill="none" stroke="${ART.cream}" stroke-width="3"/>` +
      Array.from({ length: 8 }, (_, i) => `<line x1="${fw.x}" y1="${r1(fw.y - 48)}" x2="${r1(fw.x + Math.cos((i * Math.PI) / 4) * 34)}" y2="${r1(fw.y - 48 + Math.sin((i * Math.PI) / 4) * 34)}" stroke="${ART.cream}" stroke-opacity=".6"/>`).join('') +
      `<path d="M${r1(fw.x - 16)} ${fw.y} L${fw.x} ${r1(fw.y - 48)} L${r1(fw.x + 16)} ${fw.y}" fill="none" stroke="#4B4E4A" stroke-width="3"/>`,
    fw.y,
  );
  return { svg: p.svg(), body: p.body(), viewBox: p.viewBox(), anchors, labels: [] };
}

export interface MapLabel {
  x: number;
  y: number;
  text: string;
  kind: 'zone' | 'strong' | 'hint';
}

function abordsArt(): Built {
  const p = new Painter(FRAMES.abords);
  const L: MapLabel[] = [];
  const lab = (u: number, v: number, text: string, kind: MapLabel['kind']) => L.push({ ...p.P(u, v), text, kind });
  p.slab([[-6, -2], [116, -2], [116, 92], [-6, 92]], ART.grassDark, 24);
  for (let i = 0; i < 13; i++) p.line([[i * 9 - 4, -2], [i * 9 + 4, 92]], '#5F9E45', 6, -2900);
  p.line([[-6, 80], [12, 74], [22, 78], [34, 72], [42, 64], [54, 60], [62, 66], [76, 62], [116, 70]], ART.water, 16, -2500);
  p.line([[-6, 36], [30, 42], [56, 40], [80, 30], [116, 26]], ART.road, 13, -2400);
  p.line([[-6, 36], [30, 42], [56, 40], [80, 30], [116, 26]], ART.roadLine, 1.5, -2399, 'stroke-dasharray="8 8"');
  p.line([[50, -2], [52, 18], [56, 40], [58, 56], [52, 62], [46, 92]], ART.road, 10, -2400);
  p.line([[56, 40], [70, 48], [82, 58], [100, 64]], ART.road, 8, -2400);
  // Festival grounds (miniature).
  p.area([[30, 45], [44, 42], [54, 45], [56, 55], [48, 59], [34, 58], [28, 52]], ART.grass, -2000, `stroke="${ART.orange}" stroke-width="3"`);
  p.area([[35, 46], [45, 45.5], [46, 48.5], [35, 49]], ART.sand, -1999);
  p.forest(40, 53, 4.5, 2, 26, 3, 0.7);
  p.shell(38, 47, 4, 1.4, 44, false);
  p.shell(43, 47, 4, 1.4, 44, false);
  p.hangar(49, 50, 3.5, 2.5, 34);
  p.shell(32, 54, 2.5, 1, 30, false);
  lab(42, 62, 'SITE DU FESTIVAL', 'strong');
  // Campsite.
  p.area([[60, 44], [84, 40], [92, 54], [70, 60], [60, 54]], '#8DBF6A', -2000, `stroke="${ART.earth}" stroke-width="2"`);
  let a = 5;
  const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647;
  const tents: [number, number][] = [];
  for (let i = 0; i < 170; i++) {
    const u = 62 + rnd() * 27;
    const v = 43 + rnd() * 15;
    if (v > 44 + (u - 60) * 0.55 + 9 || v < 44 - (u - 60) * 0.17) continue;
    tents.push([u, v]);
  }
  tents.sort((x, y) => x[1] - y[1]).forEach(([u, v], i) => {
    const q = p.P(u, v);
    p.add(`<path d="M${r1(q.x - 6)} ${q.y} L${q.x} ${r1(q.y - 8)} L${r1(q.x + 6)} ${q.y} Z" fill="${ART.camp[i % ART.camp.length]}" stroke="${ART.ink}" stroke-width=".6"/>`, q.y);
  });
  lab(76, 63, 'CAMPING', 'strong');
  lab(76, 67, 'Accès par le Metal Corner', 'hint');
  const lot = (pts: [number, number][], name: string, sub: string, lu: number, lv: number) => {
    p.area(pts, '#8F928C', -1900, `stroke="${ART.ink}" stroke-opacity=".3" stroke-width="2"`);
    const [u0, v0] = pts[0];
    for (let i = 0; i < 40; i++) {
      const q = p.P(u0 + 1.2 + (i % 10) * 1.6, v0 + 2 + Math.floor(i / 10) * 3);
      p.add(`<rect x="${q.x}" y="${q.y}" width="10" height="5" rx="1.5" fill="${['#EFE6D2', '#5FB3D9', '#E9707C', '#2B2E2B'][i % 4]}"/>`, -1800);
    }
    lab(lu, lv, name, 'strong');
    lab(lu, lv + 4, sub, 'hint');
  };
  lot([[4, 44], [22, 43], [22, 58], [4, 60]], 'PARKING OUEST', 'Navette gratuite 24 h/24 · 5 min', 13, 64);
  lot([[84, 18], [102, 16], [104, 30], [86, 32]], 'PARKING EST', '15 min à pied', 94, 36);
  p.line([[22, 50], [30, 50]], ART.orange, 4, -1000, 'stroke-dasharray="7 6"');
  p.line([[56, 40], [46, 43]], ART.orange, 4, -1000, 'stroke-dasharray="7 6"');
  p.line([[86, 31], [72, 35], [56, 40]], ART.cream, 2.5, -999, 'stroke-dasharray="3 5"');
  const rb = p.P(56, 40);
  p.add(`<circle cx="${rb.x}" cy="${rb.y}" r="13" fill="${ART.road}" stroke="${ART.orange}" stroke-width="3"/>`, rb.y);
  lab(68, 37, 'Rond-point sud · navettes gare', 'hint');
  lab(12, 33, '← Clisson centre et gare', 'hint');
  lab(108, 21, 'Vers Cholet', 'hint');
  lab(4, 30, 'Vers Nantes', 'hint');
  lab(96, 74, 'La Moine', 'hint');
  return { svg: p.svg(), body: p.body(), viewBox: p.viewBox(), anchors: {}, labels: L };
}

function clissonArt(): Built {
  const p = new Painter(FRAMES.clisson);
  const L: MapLabel[] = [];
  const lab = (u: number, v: number, text: string, kind: MapLabel['kind']) => L.push({ ...p.P(u, v), text, kind });
  p.slab([[-6, -2], [190, -2], [190, 175], [-6, 175]], ART.grassDark, 28);
  for (let i = 0; i < 19; i++) p.line([[i * 9 - 4, -2], [i * 9 + 18, 175]], '#5F9E45', 5, -2900);
  p.line([[30, -2], [44, 34], [60, 70], [66, 96], [62, 130], [70, 175]], ART.water, 18, -2500);
  p.line([[62, 92], [80, 88], [100, 95], [130, 90], [190, 97]], ART.water, 12, -2500);
  p.line([[-6, 34], [60, 38], [110, 30], [190, 25]], '#4A4E49', 17, -2400);
  p.line([[-6, 34], [60, 38], [110, 30], [190, 25]], ART.roadLine, 2, -2399, 'stroke-dasharray="10 10"');
  p.line([[56, -2], [58, 38], [64, 80], [70, 125], [60, 175]], ART.road, 9, -2400);
  p.line([[64, 80], [100, 74], [130, 64], [190, 58]], ART.road, 8, -2400);
  p.line([[-6, 106], [40, 98], [64, 88]], ART.road, 8, -2400);
  p.line([[-6, 62], [40, 80], [56, 92], [80, 140], [96, 175]], '#3E3F3A', 3, -2300, 'stroke-dasharray="2 6"');
  let a = 3;
  const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647;
  const blocks: [number, number][] = [];
  for (let i = 0; i < 190; i++) {
    const u = 40 + rnd() * 46;
    const v = 72 + rnd() * 40;
    if (Math.hypot((u - 63) / 24, (v - 92) / 20) > 1) continue;
    if (Math.abs(u - (60 + (v - 70) * 0.2)) < 3.5) continue;
    blocks.push([u, v]);
  }
  blocks.sort((x, y) => x[1] - y[1]).forEach(([u, v], i) => p.box(u, v, 1.8, 1.6, 10 + (i % 3) * 4, ART.wall, '#C9B183', i % 4 ? ART.roof : '#8E3F2B'));
  p.box(58, 86, 4.5, 3, 40, '#B9B2A1', '#968F80', '#D3CDBE');
  p.box(57.6, 85.6, 1.3, 1.3, 56, '#B9B2A1', '#968F80', '#D3CDBE');
  p.box(61.6, 88, 1.3, 1.3, 56, '#B9B2A1', '#968F80', '#D3CDBE');
  lab(56, 80, 'Château', 'hint');
  lab(50, 116, 'CLISSON', 'strong');
  p.box(50, 97, 4, 1.5, 16, '#E9D3A3', '#C9B183', '#B5543A');
  lab(46, 103, 'Gare de Clisson', 'zone');
  p.area([[96, 55], [112, 51], [120, 59], [110, 69], [96, 67]], ART.grass, -2000, `stroke="${ART.orange}" stroke-width="4"`);
  p.shell(104, 56, 4, 1.4, 34, false);
  p.hangar(112, 60, 3, 2, 26);
  lab(108, 73, 'SITE DU FESTIVAL', 'strong');
  p.area([[122, 57], [140, 53], [146, 65], [126, 71]], '#8DBF6A', -2000, `stroke="${ART.earth}" stroke-width="2"`);
  lab(136, 75, 'Camping', 'zone');
  p.area([[78, 49], [90, 47], [90, 57], [78, 59]], '#8F928C', -2000);
  lab(84, 62, 'P Ouest', 'zone');
  p.area([[148, 37], [162, 35], [164, 45], [150, 47]], '#8F928C', -2000);
  lab(156, 50, 'P Est', 'zone');
  p.line([[52, 97], [64, 82], [86, 72], [98, 62]], ART.orange, 4, -1000, 'stroke-dasharray="8 7"');
  lab(80, 84, 'Navette gare → site', 'hint');
  lab(160, 20, 'N249 → Cholet', 'hint');
  lab(12, 30, 'N249 → Nantes', 'hint');
  lab(150, 101, 'La Moine', 'hint');
  lab(26, 140, 'La Sèvre Nantaise', 'hint');
  return { svg: p.svg(), body: p.body(), viewBox: p.viewBox(), anchors: {}, labels: L };
}

export interface Built {
  svg: string;
  body: string;
  viewBox: ViewBox;
  anchors: Anchors;
  labels: MapLabel[];
}

let cache: Partial<Record<Level, Built>> = {};

/** Builds (once) and returns the art of a level. */
export function art(level: Level): Built {
  if (!cache[level]) cache[level] = level === 'site' ? siteArt() : level === 'abords' ? abordsArt() : clissonArt();
  return cache[level]!;
}

export function resetArtCache() {
  cache = {};
}
