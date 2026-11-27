import type { DayForecast, WeatherHour } from '../engine';
import { summarize } from '../engine';

/** Clisson, Loire-Atlantique. */
export const CLISSON = { lat: 47.0869, lon: -1.2819, name: 'Clisson' };

/** Rough June climate in Clisson, used when the festival is beyond the 16-day forecast. To refine. */
export const JUNE_NORMALS = { tMax: 24, tMin: 13, precipMm: 1.8, rainProb: 35 };

export interface WeatherData {
  hours: WeatherHour[];
  live: boolean;
  error?: string;
}

interface OpenMeteoHourly {
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    precipitation: (number | null)[];
    precipitation_probability: (number | null)[];
    weather_code: (number | null)[];
  };
}

/** Open-Meteo hourly forecast, free and without key. 16 days ahead at most. */
export async function fetchClissonWeather(fetchImpl: typeof fetch = fetch): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${CLISSON.lat}&longitude=${CLISSON.lon}` +
    '&hourly=temperature_2m,precipitation,precipitation_probability,weather_code&forecast_days=16&timezone=Europe%2FParis';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetchImpl(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const h = ((await res.json()) as OpenMeteoHourly).hourly;
    if (!h) throw new Error('réponse vide');
    const hours: WeatherHour[] = h.time.map((time, i) => ({
      time,
      tempC: h.temperature_2m[i] ?? 0,
      precipMm: h.precipitation[i] ?? 0,
      rainProb: h.precipitation_probability[i] ?? 0,
      code: h.weather_code[i] ?? 0,
    }));
    return { hours, live: true };
  } catch (e) {
    return { hours: [], live: false, error: (e as Error).message };
  }
}

/** Forecast for a festival date, or June normals when it is too far away. */
export function festivalDay(date: string, data: WeatherData): DayForecast {
  return summarize(date, data.hours) ?? { date, ...JUNE_NORMALS, source: 'normals' };
}

/** Days of the next week, for the "Clisson cette semaine" card. */
export function nextDays(data: WeatherData, count = 7): { date: string; f: DayForecast; code: number }[] {
  const dates = [...new Set(data.hours.map((h) => h.time.slice(0, 10)))].slice(0, count);
  return dates.map((date) => {
    const midday = data.hours.find((h) => h.time === `${date}T14:00`);
    return { date, f: summarize(date, data.hours)!, code: midday?.code ?? 0 };
  });
}
