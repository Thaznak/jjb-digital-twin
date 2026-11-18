/** Palette from docs/DIRECTION_ARTISTIQUE.md. */
export const C = {
  slate: 0x1f2a3d,
  slateLine: 0x2c3a52,
  linen: 0xe9e4d8,
  tatami: 0x3e7cb1,
  hinoki: 0xc69c6d,
  gold: 0xd9a93b,
  ok: 0x5bae7e,
  warn: 0xe59f3a,
  crisis: 0xd35b4f,
};

export const BELT_COLORS: Record<string, number> = {
  blanche: 0xf4f4f0,
  grise: 0x9aa0a6,
  jaune: 0xe8c547,
  orange: 0xe08a3c,
  verte: 0x4f9d5b,
  bleue: 0x2f6fb5,
  violette: 0x7a4fa0,
  marron: 0x7a5235,
  noire: 0x1a1a1a,
};

/** Ground colour per calendar month (season ring around the club). */
export function seasonGround(month: number): number {
  if (month === 11 || month <= 1) return 0x7d8b99; // hiver, gris bleuté
  if (month <= 4) return 0x7fa46a; // printemps, vert tendre
  if (month <= 7) return 0xb9a96a; // été, paille
  return 0xa4744a; // automne, rouille
}

export function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * f));
  const b = Math.min(255, Math.round((color & 255) * f));
  return (r << 16) | (g << 8) | b;
}
