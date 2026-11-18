/**
 * Pixel-art practitioners drawn from a pixel grid, with an automatic 1px dark outline.
 * Pure functions: they return a grid of colours, the scene turns it into a texture.
 */

export type Pose = 'debout' | 'assis';
export type Hair = 'court' | 'chignon' | 'boucles' | 'rase';

export interface PersonSpec {
  skin: string;
  hair: Hair;
  hairColor: string;
  gi: 'blanc' | 'noir' | 'tshirt';
  belt: string;
  kid: boolean;
  beard: boolean;
  pose: Pose;
}

export const SKINS = ['#F2CFAE', '#DDA97F', '#B07650', '#7A4B2E', '#4E2F1F'];
export const HAIR_COLORS = ['#1B1410', '#2E1D12', '#4A2E1A', '#1A1A1A'];
const OUTLINE = '#111214';

type Grid = (string | null)[][];

function grid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(null));
}
function rect(g: Grid, x: number, y: number, w: number, h: number, c: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[j].length) g[j][i] = c;
}

function giColors(spec: PersonSpec) {
  if (spec.gi === 'noir') return { main: '#26272B', shade: '#3B3D43', lapel: '#45474E' };
  if (spec.gi === 'tshirt') return { main: '#2A2B2F', shade: '#1E1F22', lapel: '#2A2B2F' };
  return { main: '#F4F4F2', shade: '#D2D3D0', lapel: '#E2E3E0' };
}

function head(g: Grid, ox: number, oy: number, spec: PersonSpec) {
  rect(g, ox + 1, oy + 1, 6, 6, spec.skin); // face
  rect(g, ox + 0, oy + 3, 1, 2, spec.skin); // ears
  rect(g, ox + 7, oy + 3, 1, 2, spec.skin);
  const hc = spec.hairColor;
  if (spec.hair === 'court') rect(g, ox + 1, oy, 6, 2, hc);
  if (spec.hair === 'rase') rect(g, ox + 1, oy, 6, 1, hc);
  if (spec.hair === 'boucles') {
    rect(g, ox, oy - 1, 8, 3, hc);
    rect(g, ox - 1, oy + 1, 1, 3, hc);
    rect(g, ox + 8, oy + 1, 1, 3, hc);
  }
  if (spec.hair === 'chignon') {
    rect(g, ox + 1, oy, 6, 2, hc);
    rect(g, ox + 2, oy - 2, 3, 2, hc);
    rect(g, ox, oy + 1, 1, 3, hc);
  }
  rect(g, ox + 2, oy + 3, 1, 1, '#1A1210'); // eyes
  rect(g, ox + 5, oy + 3, 1, 1, '#1A1210');
  if (spec.beard) rect(g, ox + 1, oy + 5, 6, 2, spec.hairColor);
}

/** Returns a colour grid; null = transparent. */
export function personGrid(spec: PersonSpec): Grid {
  const c = giColors(spec);
  if (spec.pose === 'debout') {
    const H = spec.kid ? 24 : 31;
    const g = grid(16, H);
    const s = spec.kid ? 0.78 : 1;
    const hy = 2;
    head(g, 4, hy, spec);
    const top = hy + 7;
    const jacketH = Math.round(9 * s);
    rect(g, 3, top, 10, jacketH, c.main); // jacket
    rect(g, 2, top + 1, 1, jacketH - 1, c.shade); // sleeves
    rect(g, 13, top + 1, 1, jacketH - 1, c.shade);
    rect(g, 2, top + jacketH, 1, 1, spec.skin); // hands
    rect(g, 13, top + jacketH, 1, 1, spec.skin);
    if (spec.gi !== 'tshirt') {
      rect(g, 6, top, 1, 3, c.lapel); // V lapels
      rect(g, 9, top, 1, 3, c.lapel);
      rect(g, 7, top + 2, 2, 1, c.lapel);
      rect(g, 3, top + jacketH - 2, 10, 2, spec.belt); // belt: the vivid colour
      rect(g, 9, top + jacketH, 1, 2, spec.belt); // belt tail
      if (spec.belt === '#1A1A1A') rect(g, 11, top + jacketH - 2, 1, 2, '#C8342A');
    }
    const legTop = top + jacketH;
    const legH = H - legTop - 2;
    rect(g, 4, legTop, 3, legH, c.main); // legs
    rect(g, 9, legTop, 3, legH, c.main);
    rect(g, 7, legTop, 2, 2, c.shade);
    rect(g, 4, H - 2, 3, 1, spec.skin); // bare feet
    rect(g, 9, H - 2, 3, 1, spec.skin);
    return outline(g);
  }
  // Seated cross-legged, like students waiting at the edge of the mat.
  const H = spec.kid ? 18 : 22;
  const g = grid(18, H);
  head(g, 5, 2, spec);
  const top = 9;
  const jacketH = spec.kid ? 5 : 7;
  rect(g, 4, top, 10, jacketH, c.main);
  if (spec.gi !== 'tshirt') {
    rect(g, 7, top, 1, 3, c.lapel);
    rect(g, 10, top, 1, 3, c.lapel);
    rect(g, 4, top + jacketH - 2, 10, 2, spec.belt);
  }
  const legY = top + jacketH;
  rect(g, 1, legY, 16, H - legY - 1, c.main); // crossed legs
  rect(g, 3, legY, 12, 1, c.shade);
  rect(g, 6, H - 2, 2, 1, spec.skin);
  rect(g, 10, H - 2, 2, 1, spec.skin);
  rect(g, 3, top + 2, 1, jacketH - 1, c.shade); // arms on knees
  rect(g, 14, top + 2, 1, jacketH - 1, c.shade);
  return outline(g);
}

/** Adds a 1px outline around every filled pixel, on a grid grown by 1px on each side. */
export function outline(src: Grid): Grid {
  const h = src.length + 2;
  const w = src[0].length + 2;
  const g = grid(w, h);
  for (let y = 0; y < src.length; y++) for (let x = 0; x < src[0].length; x++) g[y + 1][x + 1] = src[y][x];
  const out = g.map((r) => [...r]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y][x]) continue;
      const n = [g[y - 1]?.[x], g[y + 1]?.[x], g[y]?.[x - 1], g[y]?.[x + 1]];
      if (n.some(Boolean)) out[y][x] = OUTLINE;
    }
  return out;
}

export function specKey(s: PersonSpec): string {
  return ['p', s.skin, s.hair, s.hairColor, s.gi, s.belt, s.kid ? 'k' : 'a', s.beard ? 'b' : '', s.pose].join('_');
}
