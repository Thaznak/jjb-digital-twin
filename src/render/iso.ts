export const TILE_W = 64;
export const TILE_H = 32;
export const MAP_W = 46;
export const MAP_H = 40;

/** Grid corner (x, y) to screen. Corner (0,0) is the top of the map diamond. */
export function toScreen(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) };
}
