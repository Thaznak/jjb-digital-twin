/** Rough monthly climate normals (max temp °C, rain mm), used when live weather is unavailable. Approximate, to verify. */
export interface Normals {
  tempMax: number[];
  rainMm: number[];
}

export const NORMALS: Record<string, Normals> = {
  lille: { tempMax: [6, 7, 11, 14, 18, 21, 23, 23, 20, 15, 10, 7], rainMm: [60, 50, 55, 50, 60, 65, 65, 65, 60, 70, 70, 70] },
  paris: { tempMax: [7, 9, 13, 16, 20, 23, 25, 25, 21, 16, 11, 8], rainMm: [50, 45, 50, 50, 65, 55, 60, 55, 50, 60, 55, 60] },
  lyon: { tempMax: [7, 9, 14, 17, 21, 26, 28, 28, 23, 17, 11, 7], rainMm: [50, 45, 55, 75, 85, 75, 65, 65, 90, 100, 85, 55] },
  marseille: { tempMax: [12, 13, 16, 19, 23, 27, 30, 30, 26, 21, 16, 12], rainMm: [55, 40, 35, 50, 40, 25, 10, 30, 75, 85, 60, 55] },
  montreal: { tempMax: [-5, -3, 3, 11, 19, 24, 26, 25, 20, 13, 6, -2], rainMm: [80, 65, 75, 85, 85, 90, 95, 90, 90, 90, 95, 85] },
};

export function nearestNormals(lat: number): Normals {
  if (lat > 45 && lat < 46) return NORMALS.montreal; // Montréal latitude band
  if (lat >= 50) return NORMALS.lille;
  if (lat >= 47.5) return NORMALS.paris;
  if (lat >= 44.5) return NORMALS.lyon;
  return NORMALS.marseille;
}
