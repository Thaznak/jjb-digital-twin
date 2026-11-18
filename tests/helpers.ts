import { loadSeasonality } from '../src/data/seasonality';
import { normalsWeather } from '../src/data/weather';
import { NORMALS } from '../src/data/climate';
import type { Environment } from '../src/engine';

export function testEnv(): Environment {
  return { weather: normalsWeather(NORMALS.lille).weather, seasonality: loadSeasonality() };
}
