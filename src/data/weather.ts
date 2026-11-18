import type { CityRef, DayWeather } from '../engine/types';
import { createRng } from '../engine/rng';
import { nearestNormals, type Normals } from './climate';

/** Connector contract: anything that can tell the engine the weather of a given day. */
export interface WeatherConnector {
  label: string;
  isLive: boolean;
  weather(isoDate: string): DayWeather;
}

/** Synthetic weather from climate normals, deterministic per date. Always available, offline. */
export function normalsWeather(normals: Normals): WeatherConnector {
  return {
    label: 'Normales climatiques (hors ligne)',
    isLive: false,
    weather(iso) {
      const m = Number(iso.slice(5, 7)) - 1;
      const seed = Number(iso.replace(/-/g, ''));
      const r = createRng(seed);
      const temp = normals.tempMax[m] + (r() * 2 - 1) * 5;
      const rainy = r() < Math.min(0.7, normals.rainMm[m] / 120);
      const precipMm = rainy ? r() * 14 : 0;
      return { tempMaxC: Math.round(temp * 10) / 10, precipMm: Math.round(precipMm * 10) / 10, source: 'normales' };
    },
  };
}

interface OpenMeteoDaily {
  daily?: { time: string[]; temperature_2m_max: (number | null)[]; precipitation_sum: (number | null)[] };
}

/**
 * Open-Meteo connector (free, no key). Loads the last 92 days and the next 16,
 * then falls back to climate normals outside that window or if the network is blocked.
 */
export async function openMeteoWeather(city: CityRef, fetchImpl: typeof fetch = fetch): Promise<WeatherConnector> {
  const fallback = normalsWeather(nearestNormals(city.lat));
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_max,precipitation_sum&past_days=92&forecast_days=16&timezone=auto`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetchImpl(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as OpenMeteoDaily;
    const d = data.daily;
    if (!d) throw new Error('réponse vide');
    const table = new Map<string, DayWeather>();
    d.time.forEach((t, i) => {
      const temp = d.temperature_2m_max[i];
      const rain = d.precipitation_sum[i];
      if (temp !== null && rain !== null) table.set(t, { tempMaxC: temp, precipMm: rain, source: 'open-meteo' });
    });
    return {
      label: `Open-Meteo, ${city.name} (réel)`,
      isLive: true,
      weather: (iso) => table.get(iso) ?? fallback.weather(iso),
    };
  } catch {
    return fallback;
  }
}

export interface GeoResult {
  name: string;
  lat: number;
  lon: number;
  country: string;
  population?: number;
}

/** Open-Meteo geocoding (free, no key). Returns [] when offline. */
export async function geocode(query: string, fetchImpl: typeof fetch = fetch): Promise<GeoResult[]> {
  try {
    const res = await fetchImpl(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=fr`);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: { name: string; latitude: number; longitude: number; country: string; population?: number }[] };
    return (data.results ?? []).map((r) => ({ name: r.name, lat: r.latitude, lon: r.longitude, country: r.country, population: r.population }));
  } catch {
    return [];
  }
}
