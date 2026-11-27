import {
  gatherings,
  guide as buildGuide,
  insideSite,
  mergePerson,
  planDay,
  pointAlong,
  rainAt,
  SITE,
  toPlan,
  whereabouts,
  type DayPlan,
  type Gathering,
  type GeoAnchor,
  type Guide,
  type Lineup,
  type Person,
  type Point,
  type PoiKind,
  type Slot,
} from './engine';
import { DAYS, sampleLineup } from './data/lineup';
import { demoFavoritesForMe, demoTeam, DEMO_PREFIX, PEOPLE_COLORS } from './data/demo';
import { load, save } from './data/storage';
import { fetchClissonWeather, type WeatherData } from './data/weather';
import { codeSync, type TeamSync } from './data/sync';
import type { Level } from './render/mapArt';

/**
 * Orchestration: holds the app state, calls the engine and the data connectors,
 * and tells the screens when something changed. No DOM here.
 */

export type Tab = 'carte' | 'programme' | 'plan' | 'equipe' | 'meteo' | 'horsligne';
export type Filter = 'scenes' | PoiKind;

/**
 * Rough GPS anchor of the site. TO CALIBRATE on site: stand at the entrance gate, read the
 * coordinates and put them here. Outside the site, the app offers to choose a starting point.
 */
export const ANCHOR: GeoAnchor = { lat: 47.0985, lon: -1.2645, at: { u: 45, v: 11 }, rotationDeg: 0 };

export interface Pin {
  person: Person;
  at: Point;
  stageId: string | null;
  walking: boolean;
}

export interface Selection {
  kind: 'stage' | 'poi';
  id: string;
}

export interface ActiveGuide {
  toId: string;
  toName: string;
  guide: Guide;
}

export class App {
  lineup: Lineup;
  people: Person[];
  activeId: string;
  tab: Tab = 'carte';
  day = 1;
  clock = 21 * 60 + 40;
  live = false;
  level: Level = 'site';
  filters = new Set<Filter>(['scenes']);
  selected: Selection | null = null;
  me: Point | null = null;
  meSource: 'gps' | 'choisi' | null = null;
  picking = false;
  guiding: ActiveGuide | null = null;
  voice = false;
  weather: WeatherData = { hours: [], live: false };
  online = typeof navigator === 'undefined' ? true : navigator.onLine;
  offlineReady = false;
  lastSync: string | null;
  /** V1: share codes. Swap for a backend implementation in V2. */
  sync: TeamSync = codeSync;
  private listeners = new Set<() => void>();
  private planCache = new Map<string, DayPlan>();
  private watchId: number | null = null;

  constructor() {
    const saved = load();
    this.lineup = saved.lineup ?? sampleLineup();
    this.lastSync = saved.lastSync;
    if (saved.start) {
      this.me = saved.start;
      this.meSource = 'choisi';
    }
    if (saved.people.length) {
      this.people = saved.people;
      this.activeId = saved.activeId && saved.people.some((p) => p.id === saved.activeId) ? saved.activeId : saved.people[0].id;
    } else {
      const team = demoTeam(this.lineup);
      const me: Person = { id: 'moi-' + Math.random().toString(36).slice(2, 8), name: 'Moi', color: PEOPLE_COLORS[0], favorites: demoFavoritesForMe(this.lineup, team) };
      this.people = [me, ...team];
      this.activeId = me.id;
      this.lastSync = new Date().toISOString();
    }
    this.syncLiveClock();
  }

  // ---------- subscription ----------
  on(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    this.planCache.clear();
    void this.sync.push(this.active).catch(() => undefined);
    save({ people: this.people, activeId: this.activeId, lineup: this.lineup.sample ? null : this.lineup, lastSync: this.lastSync, start: this.meSource === 'choisi' ? this.me : null });
    this.listeners.forEach((f) => f());
  }
  /** Lighter update (clock, map), without saving. */
  tick() {
    this.listeners.forEach((f) => f());
  }

  // ---------- people ----------
  get active(): Person {
    return this.people.find((p) => p.id === this.activeId) ?? this.people[0];
  }
  get hasDemo() {
    return this.people.some((p) => p.id.startsWith(DEMO_PREFIX));
  }
  setActive(id: string) {
    this.activeId = id;
    this.emit();
  }
  toggleFavorite(slotId: string) {
    const p = this.active;
    p.favorites = p.favorites.includes(slotId) ? p.favorites.filter((x) => x !== slotId) : [...p.favorites, slotId];
    this.emit();
  }
  addPerson(name: string) {
    const used = new Set(this.people.map((p) => p.color));
    const color = PEOPLE_COLORS.find((c) => !used.has(c)) ?? PEOPLE_COLORS[this.people.length % PEOPLE_COLORS.length];
    const p: Person = { id: 'p-' + Math.random().toString(36).slice(2, 8), name: name.trim().slice(0, 24) || 'Ami', color, favorites: [] };
    this.people = [...this.people, p];
    this.emit();
    return p;
  }
  removePerson(id: string) {
    if (id === this.activeId) return;
    this.people = this.people.filter((p) => p.id !== id);
    this.emit();
  }
  renameActive(name: string) {
    this.active.name = name.trim().slice(0, 24) || this.active.name;
    this.emit();
  }
  clearDemo() {
    this.people = this.people.filter((p) => !p.id.startsWith(DEMO_PREFIX));
    this.active.favorites = [];
    this.emit();
  }
  shareLink(): string {
    const base = typeof location === 'undefined' ? '' : location.origin + location.pathname;
    return this.sync.share(this.active, base);
  }
  /** Adds or refreshes a friend from a code or a link. Returns the friend's name. */
  importCode(text: string): string {
    const p = this.sync.receive(text);
    if (p.id === this.activeId) throw new Error('C’est ton propre code.');
    const known = this.people.find((x) => x.id === p.id);
    if (!known && this.people.some((x) => x.color === p.color)) {
      const used = new Set(this.people.map((x) => x.color));
      p.color = PEOPLE_COLORS.find((c) => !used.has(c)) ?? p.color;
    }
    this.people = mergePerson(this.people, known ? { ...p, color: known.color } : p);
    this.lastSync = new Date().toISOString();
    this.emit();
    return p.name;
  }

  // ---------- lineup ----------
  setLineup(l: Lineup) {
    const ids = new Set(l.slots.map((s) => s.id));
    for (const p of this.people) p.favorites = p.favorites.filter((f) => ids.has(f));
    this.lineup = l;
    this.emit();
  }
  slot(id: string): Slot | undefined {
    return this.lineup.slots.find((s) => s.id === id);
  }

  // ---------- time ----------
  setMoment(day: number, clock: number) {
    this.day = day;
    this.clock = clock;
    this.live = false;
    this.emit();
  }
  /** During the festival, follow the real clock. */
  syncLiveClock() {
    const now = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = DAYS.find((d) => d.date === iso(now));
    const yesterday = DAYS.find((d) => d.date === iso(new Date(now.getTime() - 86400000)));
    const mins = now.getHours() * 60 + now.getMinutes();
    if (yesterday && mins < 5 * 60) {
      this.day = yesterday.index;
      this.clock = mins + 1440;
      this.live = true;
    } else if (today && mins >= 9 * 60) {
      this.day = today.index;
      this.clock = mins;
      this.live = true;
    }
    return this.live;
  }
  goLive() {
    if (!this.syncLiveClock()) return false;
    this.emit();
    return true;
  }

  // ---------- derived ----------
  rain = (day: number, clock: number) => rainAt(this.weather.hours, DAYS[day]?.date ?? '', clock);

  plan(person: Person, day = this.day): DayPlan {
    const key = `${person.id}:${day}`;
    let p = this.planCache.get(key);
    if (!p) {
      p = planDay(SITE, this.lineup, this.people, person, day, this.rain);
      this.planCache.set(key, p);
    }
    return p;
  }
  plans(day = this.day): Map<string, DayPlan> {
    return new Map(this.people.map((p) => [p.id, this.plan(p, day)]));
  }
  gatherings(): Gathering[] {
    return gatherings(this.plans(), this.people, this.clock);
  }
  pins(): Pin[] {
    return this.people.flatMap((person): Pin[] => {
      const w = whereabouts(this.plan(person), this.clock);
      if (w.kind === 'stage') {
        const s = SITE.stages.find((x) => x.id === w.stageId)!;
        return [{ person, at: { u: s.u, v: s.v }, stageId: s.id, walking: false }];
      }
      if (w.kind === 'walking') return [{ person, at: pointAlong(SITE, w.from, w.to, w.progress), stageId: null, walking: true }];
      return [];
    });
  }
  nowPlaying(stageId: string): Slot | undefined {
    return this.lineup.slots.find((s) => s.day === this.day && s.stageId === stageId && s.start <= this.clock && this.clock < s.end);
  }
  nextOn(stageId: string): Slot | undefined {
    return this.lineup.slots.filter((s) => s.day === this.day && s.stageId === stageId && s.start > this.clock).sort((a, b) => a.start - b.start)[0];
  }

  // ---------- map ----------
  setTab(t: Tab) {
    this.tab = t;
    this.tick();
  }
  select(sel: Selection | null) {
    this.selected = sel;
    this.tick();
  }
  toggleFilter(f: Filter) {
    if (this.filters.has(f)) this.filters.delete(f);
    else this.filters.add(f);
    this.tick();
  }
  setLevel(l: Level) {
    this.level = l;
    this.tick();
  }

  // ---------- position and guidance ----------
  startGps(onError: (msg: string) => void) {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      onError('Pas de GPS sur cet appareil : choisis ton point de départ sur la carte.');
      return;
    }
    if (this.watchId !== null) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const p = toPlan(SITE, ANCHOR, pos.coords.latitude, pos.coords.longitude);
        if (!insideSite(p)) {
          this.stopGps();
          onError('Tu n’es pas sur le site : choisis ton point de départ sur la carte.');
          return;
        }
        this.me = p;
        this.meSource = 'gps';
        this.refreshGuide();
        this.tick();
      },
      () => {
        this.stopGps();
        onError('GPS indisponible : choisis ton point de départ sur la carte.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }
  stopGps() {
    if (this.watchId !== null && typeof navigator !== 'undefined') navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }
  chooseStart(p: Point) {
    this.stopGps();
    this.me = p;
    this.meSource = 'choisi';
    this.picking = false;
    this.refreshGuide();
    this.emit();
  }
  guideTo(toId: string, toName: string) {
    if (!this.me) return false;
    this.guiding = { toId, toName, guide: buildGuide(SITE, this.me, toId, { clock: this.clock, precipMm: this.rain(this.day, this.clock) }) };
    this.selected = null;
    this.tick();
    return true;
  }
  refreshGuide() {
    if (this.guiding && this.me) this.guiding.guide = buildGuide(SITE, this.me, this.guiding.toId, { clock: this.clock, precipMm: this.rain(this.day, this.clock) });
  }
  stopGuide() {
    this.guiding = null;
    this.tick();
  }

  // ---------- connectors ----------
  async loadWeather() {
    this.weather = await fetchClissonWeather();
    this.planCache.clear();
    this.tick();
  }
  setOnline(v: boolean) {
    this.online = v;
    this.tick();
  }
}
