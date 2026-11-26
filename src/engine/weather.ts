import type { WeatherHour } from './types';

export interface DayForecast {
  date: string;
  tMax: number;
  tMin: number;
  precipMm: number;
  rainProb: number;
  /** 'forecast' from Open-Meteo, 'normals' from June climate averages when the date is too far. */
  source: 'forecast' | 'normals';
}

/** Rain in mm at a festival-day clock (minutes since midnight, may exceed 1440). */
export function rainAt(hours: WeatherHour[], date: string, clock: number): number {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + Math.floor(clock / 60) * 60);
  const key = d.toISOString().slice(0, 13);
  return hours.find((h) => h.time.slice(0, 13) === key)?.precipMm ?? 0;
}

export function summarize(date: string, hours: WeatherHour[]): DayForecast | null {
  const day = hours.filter((h) => h.time.startsWith(date));
  if (!day.length) return null;
  return {
    date,
    tMax: Math.max(...day.map((h) => h.tempC)),
    tMin: Math.min(...day.map((h) => h.tempC)),
    precipMm: Math.round(day.reduce((t, h) => t + h.precipMm, 0) * 10) / 10,
    rainProb: Math.max(...day.map((h) => h.rainProb)),
    source: 'forecast',
  };
}

/** One short piece of advice per day, in French, present tense. */
export function advice(f: DayForecast): string {
  if (f.precipMm >= 5 || f.rainProb >= 70) return 'Pluie probable : poncho et bottes, les allées se transforment en boue.';
  if (f.tMax >= 30) return 'Forte chaleur : bouchons d’oreilles, crème, et de l’eau à chaque changement de scène.';
  if (f.tMin <= 10) return 'Nuit fraîche : prends une couche pour les têtes d’affiche.';
  if (f.rainProb >= 40) return 'Averses possibles : garde un poncho dans la poche.';
  return 'Temps clément : rien de spécial à prévoir.';
}

/** Weather code (WMO) to a short French label. */
export function codeLabel(code: number): string {
  if (code === 0) return 'Ciel clair';
  if (code <= 2) return 'Éclaircies';
  if (code === 3) return 'Couvert';
  if (code <= 48) return 'Brouillard';
  if (code <= 57) return 'Bruine';
  if (code <= 67) return 'Pluie';
  if (code <= 77) return 'Neige';
  if (code <= 82) return 'Averses';
  return 'Orage';
}
