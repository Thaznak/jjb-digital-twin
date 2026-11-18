import { BUILDING_SPECS, ClubSim, detectAlerts, facilities, type Alert, type Building, type BuildingType, type ClubConfig, type DayReport, type Environment, type MonthReport } from './engine';
import { loadSeasonality } from './data/seasonality';
import { normalsWeather, openMeteoWeather, type WeatherConnector } from './data/weather';
import { nearestNormals } from './data/climate';
import { saveConfig } from './data/storage';

export type Speed = 0 | 1 | 5 | 30;

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Orchestrates engine + data connectors for the UI. Holds no rendering code. */
export class Game {
  config: ClubConfig;
  weather: WeatherConnector;
  env: Environment;
  sim!: ClubSim;
  speed: Speed = 1;
  last: DayReport | null = null;
  startDate = todayIso();
  private acc = 0;
  private listeners = new Set<(r: DayReport) => void>();
  private resetListeners = new Set<() => void>();

  constructor(config: ClubConfig) {
    this.config = config;
    this.weather = normalsWeather(nearestNormals(config.city.lat));
    this.env = { weather: (d) => this.weather.weather(d), seasonality: loadSeasonality() };
    this.restart();
  }

  /** Tries the live Open-Meteo connector; keeps normals if the network refuses. */
  async connectWeather(): Promise<void> {
    this.weather = await openMeteoWeather(this.config.city);
    this.restart();
  }

  restart() {
    this.startDate = todayIso();
    this.sim = new ClubSim(this.config, this.env, { startDate: this.startDate, seed: 42 });
    this.last = this.sim.step();
    this.resetListeners.forEach((f) => f());
    this.listeners.forEach((f) => f(this.last!));
  }

  setConfig(c: ClubConfig) {
    this.config = c;
    saveConfig(c);
    this.restart();
    void this.connectWeather();
  }

  onDay(f: (r: DayReport) => void) {
    this.listeners.add(f);
  }
  onReset(f: () => void) {
    this.resetListeners.add(f);
  }

  /** Called every frame with the elapsed ms. 1 day per second at x1. */
  tick(dtMs: number) {
    if (!this.speed) return;
    this.acc += (dtMs / 1000) * this.speed;
    let steps = 0;
    while (this.acc >= 1 && steps < 40) {
      this.acc -= 1;
      steps++;
      this.last = this.sim.step();
      this.listeners.forEach((f) => f(this.last!));
    }
  }

  place(type: BuildingType, x: number, y: number): { ok: boolean; message: string } {
    const spec = BUILDING_SPECS[type];
    if (this.sim.state.cash < spec.capex) return { ok: false, message: `Pas assez de trésorerie pour ${spec.label.toLowerCase()} (${spec.capex} €).` };
    const b: Building = { id: `${type}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`, type, x, y };
    this.config.buildings.push(b);
    this.sim.state.cash -= spec.capex;
    saveConfig(this.config);
    return { ok: true, message: `${spec.label} construit${type === 'accueil' || type === 'parking' || type === 'tatami' ? '' : 's'} : ${spec.description}` };
  }

  remove(b: Building) {
    this.config.buildings = this.config.buildings.filter((x) => x.id !== b.id);
    saveConfig(this.config);
  }

  /** Live fragilities over the last 30 days, shown as kintsugi cracks. */
  liveAlerts(): Alert[] {
    const days = this.sim.days.slice(-30);
    if (!days.length) return [];
    const fills = days.flatMap((d) => d.fills);
    const pseudo: MonthReport = {
      month: days[days.length - 1].date.slice(0, 7),
      revenue: 0,
      costs: 0,
      margin: 0,
      cash: days[days.length - 1].cash,
      members: 0,
      kids: 0,
      signups: 0,
      departures: 0,
      satisfaction: days[days.length - 1].satisfaction,
      avgFill: 0,
      peakFill: fills.reduce((m, f) => (f.capacity ? Math.max(m, f.demand / f.capacity) : m), 0),
      overflowSlotDays: 0,
      coachLoadMax: Math.max(0, ...days[days.length - 1].coachLoads.map((c) => c.load)),
    };
    return detectAlerts([pseudo], facilities(this.config.buildings).bottleneck);
  }
}
