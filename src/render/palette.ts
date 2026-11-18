/** Palette from docs/DIRECTION_ARTISTIQUE.md (« Académie » direction: monochrome dojo, wood accents, kintsugi gold). */
export const C = {
  night: 0x1d1f22,
  ink: 0x141414,
  charcoal: 0x2b2d31,
  floor: 0x3a3d42,
  floor2: 0x35383d,
  wallLight: 0xe4e4e1,
  wallMid: 0xc9cacb,
  wallDark: 0x2f3034,
  roof: 0x4a4c51,
  mat: 0xeeeeec,
  matLine: 0xd3d4d2,
  matBorder: 0x3a3c40,
  wood: 0xb98a57,
  gold: 0xe0a526,
  plant: 0x5e8c3a,
  plantDark: 0x3f6a2a,
  pot: 0xc9c6bf,
  ok: 0x3f8f4e,
  warn: 0xf2b33d,
  crisis: 0xd4513f,
};

export const BELT_HEX: Record<string, string> = {
  blanche: '#F4F4F0',
  grise: '#9AA0A6',
  jaune: '#E8C547',
  orange: '#E08A3C',
  verte: '#4F9D5B',
  bleue: '#2F6FB5',
  violette: '#7A4FA0',
  marron: '#7A5235',
  noire: '#1A1A1A',
};

/** Outdoor ground colour per calendar month (season ring), muted for the night look. */
export function seasonGround(month: number): number {
  if (month === 11 || month <= 1) return 0x5d646d; // hiver
  if (month <= 4) return 0x4f6b45; // printemps
  if (month <= 7) return 0x7a7350; // été
  return 0x6b5038; // automne
}

export function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * f));
  const b = Math.min(255, Math.round((color & 255) * f));
  return (r << 16) | (g << 8) | b;
}
