export const TILE_W = 64;
export const TILE_H = 32;
export const MAP_SIZE = 20;

/** Grid corner (x, y) to screen. Corner (0,0) is the top of the map diamond. */
export function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) };
}

/** Screen to grid tile (floored). */
export function toTile(sx: number, sy: number): { x: number; y: number } {
  const gx = sy / TILE_H + sx / TILE_W;
  const gy = sy / TILE_H - sx / TILE_W;
  return { x: Math.floor(gx), y: Math.floor(gy) };
}
