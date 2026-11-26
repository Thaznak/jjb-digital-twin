/** Colours from docs/DIRECTION_ARTISTIQUE.md (direction « Clisson nocturne »). */
export const C = {
  night: 0x0e0e10,
  grass: 0x27321f,
  grass2: 0x2c3824,
  trampled: 0x3a3428,
  path: 0x5b4d3a,
  pathEdge: 0x463b2d,
  ink: 0x0b0b0c,
  stage: 0x1c1c1f,
  metal: 0x55585e,
  screen: 0xd9cfb4,
  bone: 0xefe6d2,
  rust: 0xb3392a,
  ember: 0xf08a24,
  tentA: 0x3b3d42,
  tentB: 0x2a2c30,
  wood: 0x7a5a3a,
  tree: 0x1f3a22,
  tree2: 0x2d4f2c,
  water: 0x22313d,
};

export const PEOPLE_COLORS = ['#f2c14e', '#5fb3d9', '#e9707c', '#8fd16a', '#c38ee8', '#f29b4c', '#4fd1c5', '#f4f1e8'];

export function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * f));
  const b = Math.min(255, Math.round((color & 255) * f));
  return (r << 16) | (g << 8) | b;
}

export function hexNum(hex: string): number {
  return parseInt(hex.slice(1), 16);
}
